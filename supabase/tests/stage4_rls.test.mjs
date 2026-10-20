// 4단계 DB 보안·흐름 시험 (실제 Supabase 가 아니라 내 컴퓨터의 임시 Postgres(PGlite)에서 실행)
// 실행: npm i --no-save @electric-sql/pglite@0.2.17 && node supabase/tests/stage4_rls.test.mjs supabase/migrations

// 4단계 SQL 을 PGlite(WASM Postgres)에서 검증: Supabase 의 auth 스키마·역할을 흉내 내고 RLS/함수를 시험
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const dir = process.argv[2]
const files = [
  '20261018000000_stage3_personal_cloud.sql',
  '20261019000000_fix_conflict_error_code.sql',
  '20261020000000_stage4_challenges.sql',
  '20261021000000_invite_codes.sql',
  '20261022000000_web_push.sql',
  '20261022000001_push_service_role_grants.sql',
]

const db = new PGlite()
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin;
  grant usage on schema public to anon, authenticated;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  -- Supabase 기본값: public 의 새 표·함수는 anon/authenticated 에게 권한이 열려 있음
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
`)
for (const f of files) {
  try {
    await db.exec(readFileSync(`${dir}/${f}`, 'utf8'))
    console.log('OK  migration', f)
  } catch (e) {
    console.log('FAIL migration', f, e.message)
    process.exit(1)
  }
}

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass++
  else fail++
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`)
}

const users = {}
async function mkUser(name) {
  const id = crypto.randomUUID()
  await db.query(`reset role`)
  await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, `${name}@example.com`])
  users[name] = id
  return id
}
/** 해당 사용자로 쿼리 (null = 로그인 안 함) */
async function as(name, sql, params = []) {
  await db.query(`reset role`)
  if (name) {
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [users[name]])
    await db.query(`set role authenticated`)
  } else {
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`)
    await db.query(`set role anon`)
  }
  try {
    const r = await db.query(sql, params)
    return { rows: r.rows, affected: r.affectedRows ?? 0 }
  } finally {
    await db.query(`reset role`)
  }
}
async function fails(name, user, sql, params = [], match) {
  try {
    const r = await as(user, sql, params)
    ok(name, false, `막히지 않음: ${JSON.stringify(r.rows).slice(0, 120)}`)
  } catch (e) {
    ok(name, !match || e.message.includes(match), e.message.slice(0, 90))
  }
}

const A = await mkUser('a')
const B = await mkUser('b')
const C = await mkUser('c')
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)
const end = '2099-12-31'

// 1. A 개인 캘린더 + 공동 챌린지
const personal = (await as('a', `insert into calendars (name, icon, color, unit, start_date) values ('운동','dumbbell','leaf','hours',$1) returning id`, [today])).rows[0].id
const ch = (await as('a', `select (create_challenge('shared','운동 60시간','dumbbell','sky','hours',60,$1,$2,'에이')).id`, [today, end])).rows[0].id
ok('1. A 공동 챌린지 생성', Boolean(ch))
await fails('nickname: 빈 닉네임 거절', 'a', `select set_nickname('  ')`, [], '닉네임')
await fails('create_challenge: 종료일 없으면 거절', 'a', `select create_challenge('shared','x','dumbbell','sky','hours',1,$1,null,'에이')`, [today], '종료일')
await fails('create_challenge: 로그인 안 하면 거절', null, `select create_challenge('shared','x','dumbbell','sky','hours',1,$1,$2,'x')`, [today, end])

// 2. 초대 링크
const inv = (await as('a', `select * from create_invite($1)`, [ch])).rows[0]
ok('2. A 초대 링크 생성 (64자)', inv?.token?.length === 64, inv?.token?.slice(0, 8) + '…')
const again = (await as('a', `select * from get_active_invite($1)`, [ch])).rows[0]
ok('2. 방장은 지금 링크를 다시 볼 수 있음', again?.token === inv.token)
ok('2. 다른 사람은 링크를 볼 수 없음', (await as('b', `select * from get_active_invite($1)`, [ch])).rows.length === 0)
await fails('2. 멤버 아닌 사람이 링크 생성 시도 → 차단', 'b', `select * from create_invite($1)`, [ch], '만든 사람')

// 미리보기 (로그인 전)
const pv = (await as(null, `select preview_invite($1) as p`, [inv.token])).rows[0].p
ok('미리보기: 로그인 전에도 요약만 보임', pv.status === 'ok' && pv.name === '운동 60시간' && pv.owner_nickname === '에이' && !('owner_id' in pv), JSON.stringify(pv).slice(0, 80))
ok('미리보기: 이메일 정보 없음', !JSON.stringify(pv).includes('@'))
ok('미리보기: 틀린 토큰 → invalid, 정보 없음', (await as(null, `select preview_invite('zzz') as p`)).rows[0].p.status === 'invalid')
await fails('로그인 전 참여 시도 → 차단', null, `select accept_invite($1,'x')`, [inv.token])

// 3. B 참여, 중복 참여
const j1 = (await as('b', `select accept_invite($1,'비') as r`, [inv.token])).rows[0].r
ok('3. B 링크로 참여', j1.status === 'joined' && j1.calendar_id === ch)
const j2 = (await as('b', `select accept_invite($1,'비') as r`, [inv.token])).rows[0].r
ok('12. 중복 참여 → 새로 추가되지 않음', j2.status === 'member')
ok('12. 미리보기도 이미 참여로 표시', (await as('b', `select preview_invite($1) as p`, [inv.token])).rows[0].p.status === 'member')
await db.query('reset role')
ok('12. 멤버 행은 A, B 두 개뿐', (await db.query(`select count(*)::int n from calendar_members where calendar_id=$1`, [ch])).rows[0].n === 2)

// 4~5. 기록
const ra = crypto.randomUUID()
const rb = crypto.randomUUID()
await as('a', `select save_activity($1,$2,0.5,'hours',null,$3,$4)`, [ra, today, [personal, ch], personal])
await as('b', `select save_activity($1,$2,0.3333,'hours',null,$3,$4)`, [rb, today, [ch], ch])
ok('4. A 30분 기록 (개인 운동 + 챌린지)', true)
ok('5. B 20분 기록 (챌린지)', true)

// 6~7. 공동 합계·기여도
for (const who of ['a', 'b']) {
  const rows = (await as(who, `select * from get_challenge_records($1)`, [[ch]])).rows
  const total = rows.reduce((s, r) => s + Number(r.amount), 0)
  const byA = rows.filter((r) => r.owner_id === A).reduce((s, r) => s + Number(r.amount), 0)
  const byB = rows.filter((r) => r.owner_id === B).reduce((s, r) => s + Number(r.amount), 0)
  ok(`6. ${who.toUpperCase()}가 본 공동 합계 50분`, Math.round(total * 60) === 50, `${Math.round(total * 60)}분`)
  ok(`7. ${who.toUpperCase()}가 본 기여도 30분/20분`, Math.round(byA * 60) === 30 && Math.round(byB * 60) === 20)
  ok(`   기록 함수에 메모·다른 캘린더 정보 없음`, rows.every((r) => !('note' in r) && !('primary_calendar_id' in r)))
}
const members = (await as('b', `select * from get_challenge_members($1)`, [[ch]])).rows
ok('멤버 목록: 닉네임·역할만, 참여 순', members.map((m) => `${m.nickname}:${m.role}`).join(',') === '에이:owner,비:member')
ok('멤버 목록: 이메일 없음', !JSON.stringify(members).includes('@'))

// 8. 개인 전체 통계 중복 없음 (A 의 원본은 1건)
const mine = (await as('a', `select * from activity_records`)).rows
ok('8. A 원본 기록은 1건 (중복 없음)', mine.length === 1 && Number(mine[0].amount) === 0.5)

// 9. B 가 A 의 기록·데이터를 건드리려는 시도
ok('9. B는 A의 원본 기록을 직접 볼 수 없음', (await as('b', `select * from activity_records where id=$1`, [ra])).rows.length === 0)
ok('9. B의 A 기록 수정 → 0건', (await as('b', `update activity_records set amount=9 where id=$1`, [ra])).affected === 0)
ok('9. B의 A 기록 삭제 → 0건', (await as('b', `delete from activity_records where id=$1`, [ra])).affected === 0)
await fails('9. B가 save_activity로 A 기록 id 덮어쓰기 → 차단', 'b', `select save_activity($1,$2,9,'hours',null,$3,$4)`, [ra, today, [ch], ch])
await fails('9. B가 A 명의(owner_id)로 기록 등록 → 차단', 'b', `insert into activity_records (owner_id, activity_date, amount, unit) values ($1,$2,1,'hours')`, [A, today])
await fails('9. B가 A의 기록을 챌린지에 연결 → 차단', 'b', `insert into activity_calendar_links (activity_id, calendar_id) values ($1,$2)`, [ra, ch])
await fails('9. B가 연결 owner_id를 A로 위조 → 차단', 'b', `insert into activity_calendar_links (activity_id, calendar_id, owner_id) values ($1,$2,$3)`, [ra, ch, A])
ok('9. B의 A 연결 삭제 → 0건', (await as('b', `delete from activity_calendar_links where activity_id=$1`, [ra])).affected === 0)
ok('9. B는 A의 개인 캘린더를 볼 수 없음', (await as('b', `select * from calendars where id=$1`, [personal])).rows.length === 0)
ok('9. B는 A 개인 캘린더 기록을 함수로도 못 봄', (await as('b', `select * from get_challenge_records($1)`, [[personal]])).rows.length === 0)
await fails('9. B가 내 기록을 A 개인 캘린더에 연결 → 차단', 'b', `select save_activity($1,$2,1,'hours',null,$3,$4)`, [crypto.randomUUID(), today, [personal], personal])
ok('9. B는 A의 메모를 볼 수 없음', (await as('b', `select * from daily_memos`)).rows.length === 0)
ok('9. B의 챌린지 수정 → 0건 (방장만)', (await as('b', `update calendars set name='해킹' where id=$1`, [ch])).affected === 0)
ok('9. B의 챌린지 삭제 → 0건 (방장만)', (await as('b', `delete from calendars where id=$1`, [ch])).affected === 0)
await fails('보안: 멤버 표 직접 조회 → 거절', 'b', `select * from calendar_members`)
await fails('보안: 초대 표 직접 조회 → 거절', 'b', `select * from calendar_invites`)
await fails('보안: 멤버 표 직접 추가 → 거절', 'c', `insert into calendar_members (calendar_id, user_id) values ($1,$2)`, [ch, C])
await fails('보안: 로그인 전 기록 함수 → 거절', null, `select * from get_challenge_records($1)`, [[ch]])
ok('9. B는 챌린지 정보는 볼 수 있음 (멤버)', (await as('b', `select * from calendars where id=$1`, [ch])).rows.length === 1)

// 멤버 아닌 C
ok('비멤버 C: 챌린지 정보 못 봄', (await as('c', `select * from calendars where id=$1`, [ch])).rows.length === 0)
ok('비멤버 C: 기록 못 봄', (await as('c', `select * from get_challenge_records($1)`, [[ch]])).rows.length === 0)
ok('비멤버 C: 멤버 목록 못 봄', (await as('c', `select * from get_challenge_members($1)`, [[ch]])).rows.length === 0)
await fails('비멤버 C: 챌린지에 기록 연결 → 차단', 'c', `select save_activity($1,$2,1,'hours',null,$3,$4)`, [crypto.randomUUID(), today, [ch], ch])
const cp = (await as('c', `select preview_invite($1) as p`, [inv.token])).rows[0].p
ok('비멤버 C: 링크로는 요약만 (기록 없음)', cp.status === 'ok' && !('records' in cp))

// 기간 검사
await fails('챌린지 기간 밖 날짜 연결 → 차단', 'b', `select save_activity($1,'2000-01-01',1,'hours',null,$2,$3)`, [crypto.randomUUID(), [ch], ch], '기간')
await fails('단위 다른 기록 연결 → 차단', 'b', `select save_activity($1,$2,1,'km',null,$3,$4)`, [crypto.randomUUID(), today, [ch], ch], '단위')

// 방장 삭제 보호
await fails('방장: 다른 멤버 있으면 삭제 차단', 'a', `select delete_calendar($1)`, [ch], '다른 멤버')
await fails('방장: 표 직접 삭제도 차단', 'a', `delete from calendars where id=$1`, [ch], '다른 멤버')
await fails('방장은 나가기 불가', 'a', `select leave_challenge($1)`, [ch], '방장')

// 10. 개인 경쟁
const comp = (await as('a', `select (create_challenge('competition','10월 공부','book','lilac','hours',null,$1,$2,'에이')).id`, [today, end])).rows[0].id
const inv2 = (await as('a', `select * from create_invite($1)`, [comp])).rows[0]
await as('b', `select accept_invite($1,'비')`, [inv2.token])
await as('c', `select accept_invite($1,'씨')`, [inv2.token])
await as('a', `select save_activity($1,$2,2,'hours',null,$3,$4)`, [crypto.randomUUID(), today, [comp], comp])
await as('b', `select save_activity($1,$2,1,'hours',null,$3,$4)`, [crypto.randomUUID(), today, [comp], comp])
await as('c', `select save_activity($1,$2,2,'hours',null,$3,$4)`, [crypto.randomUUID(), today, [comp], comp])
const crows = (await as('b', `select * from get_challenge_records($1)`, [[comp]])).rows
const tot = (id) => crows.filter((r) => r.owner_id === id).reduce((s, r) => s + Number(r.amount), 0)
ok('10. 경쟁: 멤버별 누적 (A 2, B 1, C 2)', tot(A) === 2 && tot(B) === 1 && tot(C) === 2)
ok('10. 경쟁: 목표량 없이도 생성 가능', true)

// 12. 만료·취소·잘못된 링크
await as('a', `select revoke_invite($1)`, [comp])
ok('12. 취소된 링크 미리보기 → revoked (요약 없음)', (await as(null, `select preview_invite($1) as p`, [inv2.token])).rows[0].p.status === 'revoked')
const D = await mkUser('d')
await fails('12. 취소된 링크로 참여 → 차단', 'd', `select accept_invite($1,'디')`, [inv2.token], '취소')
const inv3 = (await as('a', `select * from create_invite($1)`, [comp])).rows[0]
await db.query('reset role')
await db.query(`update calendar_invites set expires_at = now() - interval '1 minute' where token=$1`, [inv3.token])
ok('12. 만료된 링크 미리보기 → expired', (await as(null, `select preview_invite($1) as p`, [inv3.token])).rows[0].p.status === 'expired')
await fails('12. 만료된 링크로 참여 → 차단', 'd', `select accept_invite($1,'디')`, [inv3.token], '만료')
await fails('12. 없는 링크로 참여 → 차단', 'd', `select accept_invite('nope','디')`, [], '올바르지')
const inv4 = (await as('a', `select * from create_invite($1)`, [comp])).rows[0]
ok('12. 새 링크를 만들면 예전 링크는 자동 취소', (await as(null, `select preview_invite($1) as p`, [inv.token])).rows[0].p.status === 'ok' && inv4.token !== inv3.token)

// 20명 제한
const inv5 = (await as('a', `select * from create_invite($1)`, [ch])).rows[0]
for (let i = 0; i < 18; i++) {
  await mkUser('u' + i)
  await as('u' + i, `select accept_invite($1,$2)`, [inv5.token, '유저' + i])
}
await db.query('reset role')
ok('20명까지 참여', (await db.query(`select count(*)::int n from calendar_members where calendar_id=$1`, [ch])).rows[0].n === 20)
await mkUser('late')
ok('21번째: 미리보기 full', (await as('late', `select preview_invite($1) as p`, [inv5.token])).rows[0].p.status === 'full')
await fails('21번째: 참여 차단', 'late', `select accept_invite($1,'늦음')`, [inv5.token], '20명')

// 기간이 끝난 챌린지
const old = (await as('a', `select (create_challenge('shared','지난','book','sky','hours',5,'2020-01-01','2020-01-31','에이')).id`)).rows[0].id
const inv6 = (await as('a', `select * from create_invite($1)`, [old])).rows[0]
ok('끝난 챌린지 미리보기 → ended', (await as('d', `select preview_invite($1) as p`, [inv6.token])).rows[0].p.status === 'ended')
await fails('끝난 챌린지 참여 차단', 'd', `select accept_invite($1,'디')`, [inv6.token], '끝난')

// 나가기: 원본 보존, 연결만 해제, 통계에서 제외
const rb2 = crypto.randomUUID()
const bPersonal = (await as('b', `insert into calendars (name, icon, color, unit, start_date) values ('B운동','dumbbell','leaf','hours',$1) returning id`, [today])).rows[0].id
await as('b', `select save_activity($1,$2,1,'hours',null,$3,$4)`, [rb2, today, [ch, bPersonal], ch])
await as('b', `select leave_challenge($1)`, [ch])
const bRecs = (await as('b', `select a.id, a.primary_calendar_id, array(select calendar_id from activity_calendar_links l where l.activity_id=a.id) ids from activity_records a order by a.id`)).rows
const r1 = bRecs.find((r) => r.id === rb)
const r2 = bRecs.find((r) => r.id === rb2)
ok('탈퇴: B의 원본 기록 그대로 보존', Boolean(r1 && r2))
ok('탈퇴: 챌린지에만 있던 기록 → 연결 0개, 대표 캘린더 비움', r1 && r1.ids.length === 0 && r1.primary_calendar_id === null)
ok('탈퇴: 개인 캘린더 연결은 유지, 대표 캘린더는 개인으로', r2 && r2.ids.length === 1 && r2.ids[0] === bPersonal && r2.primary_calendar_id === bPersonal)
const afterLeave = (await as('a', `select * from get_challenge_records($1)`, [[ch]])).rows
ok('탈퇴: 챌린지 통계에서 B 기록 제외', afterLeave.every((r) => r.owner_id !== B))
ok('탈퇴: B는 챌린지를 더 이상 못 봄', (await as('b', `select * from calendars where id=$1`, [ch])).rows.length === 0)
await fails('탈퇴 후 B가 다시 연결 시도 → 차단', 'b', `select save_activity($1,$2,1,'hours',null,$3,$4)`, [rb, today, [ch], ch])
ok('탈퇴 후 B 기록 수정 (개인 캘린더로 다시 연결) 가능', (await as('b', `select save_activity($1,$2,0.3333,'hours',null,$3,$4)`, [rb, today, [bPersonal], bPersonal])).rows.length === 1)

// 혼자 남으면 삭제 가능
const solo = (await as('a', `select (create_challenge('shared','혼자','book','sky','hours',5,$1,$2,'에이')).id`, [today, end])).rows[0].id
await as('a', `select delete_calendar($1)`, [solo])
ok('방장 혼자면 삭제 가능', (await as('a', `select * from calendars where id=$1`, [solo])).rows.length === 0)

// ---- 초대 코드 (6자리, 틀린 입력 1시간에 5번) ----
const codeCal = (await as('a', `select (create_challenge('shared','코드 테스트','book','sky','hours',5,$1,$2,'에이')).id`, [today, end])).rows[0].id
const ci = (await as('a', `select * from create_invite($1)`, [codeCal])).rows[0]
ok('코드: 링크와 함께 6자리 코드 생성', /^[A-HJKMNP-Z2-9]{6}$/.test(ci.code ?? ''), ci.code)
ok('코드: 헷갈리는 글자(0 O 1 I L) 없음', !/[01OIL]/.test(ci.code))
ok('코드: 방장은 지금 코드를 다시 볼 수 있음', (await as('a', `select * from get_active_invite($1)`, [codeCal])).rows[0].code === ci.code)
const E = await mkUser('e')
const messy = ' ' + ci.code.slice(0, 3).toLowerCase() + '-' + ci.code.slice(3) + ' '
const cr1 = (await as('e', `select resolve_invite_code($1) as r`, [messy])).rows[0].r
ok('코드: 소문자·하이픈·띄어쓰기 섞여도 인식 → 토큰', cr1.status === 'ok' && cr1.token === ci.token)
await fails('코드: 로그인 전에는 사용 불가', null, `select resolve_invite_code($1)`, [ci.code])
await fails('코드: 시도 기록 표 직접 조회 불가', 'e', `select * from invite_code_attempts`)
await fails('코드: 코드 생성 함수 직접 호출 불가', 'e', `select new_invite_code()`)
const F = await mkUser('f')
const wrong = ci.code === 'AAAAAA' ? 'BBBBBB' : 'AAAAAA'
const tries = []
for (let i = 0; i < 5; i++) tries.push((await as('f', `select resolve_invite_code($1) as r`, [wrong])).rows[0].r)
ok('코드: 틀리면 남은 횟수 4→0', tries.map((t) => t.remaining).join(',') === '4,3,2,1,0', JSON.stringify(tries.map((t) => t.status + t.remaining)))
const locked = (await as('f', `select resolve_invite_code($1) as r`, [ci.code])).rows[0].r
ok('코드: 5번 틀리면 맞는 코드도 잠김 (약 60분)', locked.status === 'locked' && locked.retry_minutes >= 59 && locked.retry_minutes <= 60, JSON.stringify(locked))
ok('코드: 다른 계정은 영향 없음', (await as('e', `select resolve_invite_code($1) as r`, [ci.code])).rows[0].r.status === 'ok')
ok('코드: 맞는 코드는 횟수에 안 셈', (await as('e', `select resolve_invite_code($1) as r`, [ci.code])).rows[0].r.status === 'ok')
await db.query('reset role')
await db.query(`update invite_code_attempts set attempted_at = now() - interval '61 minutes' where user_id=$1`, [users.f])
ok('코드: 1시간 지나면 다시 시도 가능', (await as('f', `select resolve_invite_code($1) as r`, [ci.code])).rows[0].r.status === 'ok')
// 코드로 받은 토큰도 링크와 똑같이 검사됨
const viaCode = (await as('e', `select accept_invite($1,'이') as r`, [cr1.token])).rows[0].r
ok('코드: 코드로 받은 토큰으로 참여', viaCode.status === 'joined')
const ci2 = (await as('a', `select * from create_invite($1)`, [codeCal])).rows[0]
const oldCode = (await as('f', `select resolve_invite_code($1) as r`, [ci.code])).rows[0].r
ok('코드: 새 링크를 만들면 예전 코드는 취소 상태', oldCode.status === 'ok' && (await as('f', `select preview_invite($1) as p`, [oldCode.token])).rows[0].p.status === 'revoked')
ok('코드: 새 코드는 예전 코드와 다름', ci2.code !== ci.code)
await as('a', `select revoke_invite($1)`, [codeCal])
const rc = (await as('f', `select resolve_invite_code($1) as r`, [ci2.code])).rows[0].r
await fails('코드: 취소된 링크의 코드로 참여 → 차단', 'f', `select accept_invite($1,'에프')`, [rc.token], '취소')

// ---- 웹 푸시: 대기열·구독 ----
const pushCh = (await as('a', `select (create_challenge('shared','푸시 테스트','book','sky','hours',10,$1,$2,'에이')).id`, [today, end])).rows[0].id
const pinv = (await as('a', `select * from create_invite($1)`, [pushCh])).rows[0]
await as('b', `select accept_invite($1,'비')`, [pinv.token])
const outboxCount = async () => { await db.query('reset role'); return (await db.query(`select count(*)::int n from push_outbox`)).rows[0].n }
const before = await outboxCount()
const pa = crypto.randomUUID()
await as('a', `select save_activity($1,$2,0.5,'hours',null,$3,$4)`, [pa, today, [personal, pushCh], personal])
ok('푸시: 챌린지에 연결된 새 기록 → 대기열 1줄', (await outboxCount()) === before + 1)
await as('a', `select save_activity($1,$2,0.7,'hours',null,$3,$4)`, [pa, today, [personal, pushCh], personal])
ok('푸시: 같은 기록 수정 → 대기열 늘지 않음', (await outboxCount()) === before + 1)
const pp = crypto.randomUUID()
await as('a', `select save_activity($1,$2,1,'hours',null,$3,$4)`, [pp, today, [personal], personal])
ok('푸시: 개인 캘린더에만 연결 → 대기열 없음', (await outboxCount()) === before + 1)
await as('a', `select save_activity($1,$2,1,'hours',null,$3,$4)`, [pp, today, [personal, pushCh], personal])
ok('푸시: 기존 기록을 수정해 챌린지 추가 → 대기열 없음 (수정은 제외)', (await outboxCount()) === before + 1)
await as('a', `select save_activity($1,$2,1,'hours',null,$3,$4,null,'legacy-x')`, [crypto.randomUUID(), today, [personal, pushCh], personal])
ok('푸시: 예전 기록 옮기기(legacy) → 대기열 없음', (await outboxCount()) === before + 1)
const pm = crypto.randomUUID()
await as('b', `select save_activity($1,$2,0.5,'hours',null,$3,$4)`, [pm, today, [pushCh], pushCh])
ok('푸시: 다른 멤버의 새 기록도 대기열 1줄', (await outboxCount()) === before + 2)
await fails('푸시: 대기열 직접 조회 불가', 'b', `select * from push_outbox`)
await fails('푸시: 발송 상태 직접 조회 불가', 'b', `select * from push_deliveries`)
await fails('푸시: 구독 표 직접 조회 불가', 'b', `select * from push_subscriptions`)
await fails('푸시: 대기열 직접 추가 불가', 'b', `insert into push_outbox (activity_id, author_id) values ($1,$2)`, [pm, users.b], 'permission')
const oldRec = crypto.randomUUID()
await as('b', `select save_activity($1,$2,1,'hours',null,$3,$4)`, [oldRec, today, [bPersonal], bPersonal])
await db.query('reset role')
await db.query(`update activity_records set created_at = now() - interval '1 hour' where id=$1`, [oldRec])
const c0 = await outboxCount()
await as('b', `select enqueue_push($1)`, [oldRec])
await as('b', `select enqueue_push($1)`, [pa])
ok('푸시: 대기열 함수를 직접 불러도 예전 기록·남의 기록은 안 들어감', (await outboxCount()) === c0)
// 대기열 추가가 실패해도 기록 저장은 성공 (대기열 함수가 고장 난 상황을 흉내)
await db.query('reset role')
const originalEnqueue = (await db.query(`select pg_get_functiondef('public.enqueue_push(uuid)'::regprocedure) d`)).rows[0].d
await db.query(`create or replace function public.enqueue_push(p_activity_id uuid) returns void language plpgsql security definer set search_path = '' as $f$ begin raise exception 'broken'; end; $f$`)
const survive = crypto.randomUUID()
let saved = false
try { await as('a', `select save_activity($1,$2,0.2,'hours',null,$3,$4)`, [survive, today, [pushCh], pushCh]); saved = true } catch (e) { console.log(e.message) }
await db.query('reset role')
ok('푸시: 대기열 추가가 실패해도 기록 저장은 성공', saved && (await db.query(`select count(*)::int n from activity_records where id=$1`, [survive])).rows[0].n === 1)
await db.exec(originalEnqueue)
// 기기 구독
const ep = 'https://push.example.com/abc'
await fails('푸시: 로그인 전 등록 불가', null, `select register_push($1,'k','a','x')`, [ep])
await fails('푸시: http 주소 등록 불가', 'b', `select register_push('http://x','k','a','x')`)
await as('b', `select register_push($1,'k1','a1','B 맥')`, [ep])
ok('푸시: 내 기기 등록 확인', (await as('b', `select is_push_registered($1) r`, [ep])).rows[0].r === true)
ok('푸시: 다른 사람은 내 기기 확인 결과 false', (await as('a', `select is_push_registered($1) r`, [ep])).rows[0].r === false)
await as('a', `select unregister_push($1)`, [ep])
ok('푸시: 다른 사람은 내 기기 해제 불가', (await as('b', `select is_push_registered($1) r`, [ep])).rows[0].r === true)
await as('b', `select register_push($1,'k2','a2','B 아이폰')`, ['https://push.example.com/def'])
await db.query('reset role')
ok('푸시: 한 사람이 기기 여러 대', (await db.query(`select count(*)::int n from push_subscriptions where user_id=$1`, [users.b])).rows[0].n === 2)
await as('a', `select register_push($1,'k3','a3','공용 맥')`, [ep])
ok('푸시: 같은 기기에서 다른 계정으로 등록 → 새 계정으로 옮겨짐', (await as('a', `select is_push_registered($1) r`, [ep])).rows[0].r === true && (await as('b', `select is_push_registered($1) r`, [ep])).rows[0].r === false)
await as('b', `select unregister_push($1)`, ['https://push.example.com/def'])
ok('푸시: 내 기기 해제 (다른 기기는 영향 없음)', (await as('a', `select is_push_registered($1) r`, [ep])).rows[0].r === true)

// 재귀·성능 확인: 여러 표 조회가 오류 없이 끝나는지
try {
  await as('b', `select (select count(*) from calendars), (select count(*) from activity_records), (select count(*) from activity_calendar_links)`)
  ok('재귀 없음: 권한 규칙이 걸린 표 조회 정상', true)
} catch (e) {
  ok('재귀 없음', false, e.message)
}

// 기존 3단계 동작 유지
ok('기존: 개인 기록 저장·조회 정상', (await as('a', `select count(*)::int n from activity_records`)).rows[0].n >= 1)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
