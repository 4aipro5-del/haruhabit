-- =====================================================================
-- 하루한칸 4단계: 친구 초대 · 공동 목표 · 개인 경쟁 챌린지
-- Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여 넣고 Run 하면 됩니다.
--
-- 이 파일이 하는 일 (기존 데이터는 바꾸거나 지우지 않아요)
--  1) 표 추가: calendar_members(챌린지 멤버), calendar_invites(초대 링크)
--  2) profiles 에 nickname 칸 추가 (친구에게는 이메일 대신 닉네임만 보임)
--  3) 챌린지 만들기·초대·참여·나가기·조회용 서버 함수 추가
--  4) 권한 규칙 보강: 멤버는 챌린지 정보를 볼 수 있고, 내 기록만 챌린지에 연결할 수 있음
--
-- 보안 원칙
--  - activity_records(활동 원본)의 '본인만 조회' 규칙은 그대로 둡니다.
--    친구 기록은 get_challenge_records() 로만 받고, 그 챌린지에 연결된 기록의
--    날짜·양·작성자만 나옵니다. (메모, 다른 캘린더 연결, 개인 캘린더는 절대 안 나감)
--  - 새 표 두 개는 브라우저에서 직접 읽고 쓸 수 없고, 아래 함수로만 다룹니다.
--  - 모든 함수는 auth.uid()(로그인한 사람)를 기준으로 검사하고, 사용자 id 를 인자로 받지 않습니다.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. 닉네임 (이메일을 친구에게 보여 주지 않기 위해 따로 둠)
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists nickname text
  check (nickname is null or char_length(btrim(nickname)) between 1 and 20);


-- ---------------------------------------------------------------------
-- 2. 챌린지 멤버
--    (챌린지, 사용자) 가 기본키라서 같은 사람이 두 번 참여할 수 없어요.
-- ---------------------------------------------------------------------
create table public.calendar_members (
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        text not null default 'member' check (role in ('owner', 'member')),
  joined_at   timestamptz not null default now(),
  primary key (calendar_id, user_id)
);

create index calendar_members_user_idx on public.calendar_members (user_id);


-- ---------------------------------------------------------------------
-- 3. 초대 링크
--    토큰은 서버가 만든 무작위 64자 (UUID 두 개, 244비트) → 추측 불가
--    챌린지마다 '사용 중인 링크'는 하나만 (새로 만들면 예전 것은 자동 취소)
-- ---------------------------------------------------------------------
create table public.calendar_invites (
  id          uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  token       text not null unique,
  created_by  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  revoked_at  timestamptz
);

create index calendar_invites_calendar_idx on public.calendar_invites (calendar_id);

alter table public.calendar_members enable row level security;
alter table public.calendar_invites enable row level security;
-- 정책을 하나도 만들지 않음 + 권한 회수 → 브라우저에서 직접 접근 불가, 아래 함수로만 사용
revoke all on public.calendar_members, public.calendar_invites from anon, authenticated;


-- ---------------------------------------------------------------------
-- 4. 권한 도우미
--    security definer: 권한 규칙 안에서 멤버 표를 읽어도 규칙이 자기 자신을
--    다시 부르지 않아서 무한 재귀가 생기지 않아요. (읽기만 하고 auth.uid() 기준)
-- ---------------------------------------------------------------------
create or replace function public.is_calendar_member(p_calendar_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.calendar_members m
    where m.calendar_id = p_calendar_id
      and m.user_id = (select auth.uid())
  );
$$;

-- 내 기록을 이 캘린더에 연결할 수 있는지: 내 개인 캘린더이거나, 내가 멤버인 챌린지
create or replace function public.can_link_calendar(p_calendar_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.calendars c
    where c.id = p_calendar_id
      and (
        (c.type = 'personal' and c.owner_id = (select auth.uid()))
        or (c.type <> 'personal' and exists (
          select 1 from public.calendar_members m
          where m.calendar_id = c.id and m.user_id = (select auth.uid())
        ))
      )
  );
$$;

revoke all on function public.is_calendar_member(uuid) from public, anon;
revoke all on function public.can_link_calendar(uuid) from public, anon;
grant execute on function public.is_calendar_member(uuid) to authenticated;
grant execute on function public.can_link_calendar(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 5. 권한 규칙 보강
-- ---------------------------------------------------------------------

-- 멤버는 자기가 참여한 챌린지 정보를 볼 수 있음 (수정·삭제는 지금처럼 만든 사람만)
create policy "calendars: 멤버 조회" on public.calendars
  for select to authenticated using (type <> 'personal' and public.is_calendar_member(id));

-- 활동 원본: 대표 캘린더는 내가 연결할 수 있는 캘린더만 (기존: 내 캘린더만)
drop policy "activity_records: 본인 생성" on public.activity_records;
create policy "activity_records: 본인 생성" on public.activity_records
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and (primary_calendar_id is null or public.can_link_calendar(primary_calendar_id))
  );
drop policy "activity_records: 본인 수정" on public.activity_records;
create policy "activity_records: 본인 수정" on public.activity_records
  for update to authenticated using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and (primary_calendar_id is null or public.can_link_calendar(primary_calendar_id))
  );

-- 연결: 내 활동을, 내가 연결할 수 있는 캘린더에만
drop policy "links: 본인 생성" on public.activity_calendar_links;
create policy "links: 본인 생성" on public.activity_calendar_links
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.activity_records a
                where a.id = activity_id and a.owner_id = (select auth.uid()))
    and public.can_link_calendar(calendar_id)
  );


-- ---------------------------------------------------------------------
-- 6. 연결 검사 보강: 챌린지는 기간 안의 날짜만 연결 가능
--    (기존 검사: 기록한 사람만 연결, 같은 단위만 연결 — 그대로 유지)
-- ---------------------------------------------------------------------
create or replace function public.check_activity_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_activity_owner uuid;
  v_activity_unit  text;
  v_activity_date  date;
  v_calendar       public.calendars;
begin
  select owner_id, unit, activity_date into v_activity_owner, v_activity_unit, v_activity_date
  from public.activity_records where id = new.activity_id;

  select * into v_calendar from public.calendars where id = new.calendar_id;

  if v_activity_owner is distinct from new.owner_id then
    raise exception '활동을 기록한 사람만 캘린더에 연결할 수 있어요' using errcode = '42501';
  end if;
  if v_activity_unit is distinct from v_calendar.unit then
    raise exception '단위가 다른 캘린더에는 연결할 수 없어요' using errcode = '22023';
  end if;
  if v_calendar.type <> 'personal'
     and (v_activity_date < v_calendar.start_date
          or (v_calendar.end_date is not null and v_activity_date > v_calendar.end_date)) then
    raise exception '챌린지 기간 밖의 날짜는 연결할 수 없어요' using errcode = '22023';
  end if;
  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- 7. 챌린지 삭제 보호: 다른 멤버가 남아 있으면 삭제할 수 없음
--    (브라우저에서 표를 직접 지우려 해도 막힘. 계정 삭제 같은 서버 작업은 예외)
-- ---------------------------------------------------------------------
create or replace function public.check_challenge_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.type <> 'personal'
     and (select auth.uid()) is not null
     and exists (
       select 1 from public.calendar_members m
       where m.calendar_id = old.id and m.user_id <> old.owner_id
     ) then
    raise exception '다른 멤버가 있는 챌린지는 삭제할 수 없어요. 혼자 남았을 때 삭제할 수 있어요' using errcode = '42501';
  end if;
  return old;
end;
$$;

create trigger calendars_challenge_delete_check
  before delete on public.calendars
  for each row execute function public.check_challenge_delete();


-- ---------------------------------------------------------------------
-- 8. 닉네임 저장 (내 것만)
-- ---------------------------------------------------------------------
create or replace function public.set_nickname(p_nickname text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_nickname, ''));
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요해요' using errcode = '28000';
  end if;
  if char_length(v_name) not between 1 and 20 then
    raise exception '닉네임은 1~20자로 적어 주세요' using errcode = '22023';
  end if;
  update public.profiles set nickname = v_name where id = (select auth.uid());
  return v_name;
end;
$$;


-- ---------------------------------------------------------------------
-- 9. 챌린지 만들기: 캘린더 + 방장 멤버십을 한 번에
-- ---------------------------------------------------------------------
create or replace function public.create_challenge(
  p_type       text,
  p_name       text,
  p_icon       text,
  p_color      text,
  p_unit       text,
  p_target     numeric,
  p_start_date date,
  p_end_date   date,
  p_nickname   text,
  p_sort_order integer default 0
)
returns public.calendars
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.calendars;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요' using errcode = '28000';
  end if;
  if p_type not in ('shared', 'competition') then
    raise exception '챌린지 유형이 올바르지 않아요' using errcode = '22023';
  end if;
  if p_end_date is null then
    raise exception '챌린지는 종료일이 필요해요' using errcode = '22023';
  end if;
  if p_type = 'shared' and (p_target is null or p_target <= 0) then
    raise exception '공동 목표량을 적어 주세요' using errcode = '22023';
  end if;

  perform public.set_nickname(p_nickname);

  insert into public.calendars (owner_id, type, name, icon, color, unit, target, start_date, end_date, sort_order)
  values (v_uid, p_type, btrim(p_name), p_icon, p_color, p_unit, p_target, p_start_date, p_end_date, p_sort_order)
  returning * into v_row;

  insert into public.calendar_members (calendar_id, user_id, role)
  values (v_row.id, v_uid, 'owner');

  return v_row;
end;
$$;


-- ---------------------------------------------------------------------
-- 10. 초대 링크 만들기 / 지금 링크 보기 / 취소 (방장만)
-- ---------------------------------------------------------------------
create or replace function public.create_invite(p_calendar_id uuid)
returns table (token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
begin
  if not exists (
    select 1 from public.calendars c
    where c.id = p_calendar_id and c.owner_id = v_uid and c.type <> 'personal'
  ) then
    raise exception '챌린지를 만든 사람만 초대 링크를 만들 수 있어요' using errcode = '42501';
  end if;

  update public.calendar_invites i
     set revoked_at = now()
   where i.calendar_id = p_calendar_id and i.revoked_at is null;

  return query
  with created as (
    insert into public.calendar_invites (calendar_id, token, created_by, expires_at)
    values (
      p_calendar_id,
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
      v_uid,
      now() + interval '7 days'
    )
    returning calendar_invites.token as new_token, calendar_invites.expires_at as new_expires_at
  )
  select created.new_token, created.new_expires_at from created;
end;
$$;

create or replace function public.get_active_invite(p_calendar_id uuid)
returns table (token text, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select i.token, i.expires_at
  from public.calendar_invites i
  join public.calendars c on c.id = i.calendar_id
  where i.calendar_id = p_calendar_id
    and c.owner_id = (select auth.uid())
    and i.revoked_at is null
    and i.expires_at > now()
  order by i.created_at desc
  limit 1;
$$;

create or replace function public.revoke_invite(p_calendar_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.calendars c
    where c.id = p_calendar_id and c.owner_id = (select auth.uid())
  ) then
    raise exception '챌린지를 만든 사람만 초대 링크를 취소할 수 있어요' using errcode = '42501';
  end if;
  update public.calendar_invites i
     set revoked_at = now()
   where i.calendar_id = p_calendar_id and i.revoked_at is null;
end;
$$;


-- ---------------------------------------------------------------------
-- 11. 초대 미리보기 (로그인 전에도 사용)
--     쓸 수 있는 링크일 때만 챌린지 요약을 보여 주고, 아니면 상태만 알려 줌
--     status: ok / member(이미 참여) / full(20명) / ended(기간 끝) / expired / revoked / invalid
-- ---------------------------------------------------------------------
create or replace function public.preview_invite(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_invite   public.calendar_invites;
  v_calendar public.calendars;
  v_count    integer;
  v_owner    text;
  v_status   text;
  v_today    date := (now() at time zone 'Asia/Seoul')::date;
begin
  select * into v_invite from public.calendar_invites where token = p_token;
  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;
  if v_invite.revoked_at is not null then
    return jsonb_build_object('status', 'revoked');
  end if;
  if v_invite.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;

  select * into v_calendar from public.calendars where id = v_invite.calendar_id;
  select count(*) into v_count from public.calendar_members where calendar_id = v_calendar.id;
  select coalesce(p.nickname, '방장') into v_owner from public.profiles p where p.id = v_calendar.owner_id;

  v_status := case
    when (select auth.uid()) is not null and exists (
      select 1 from public.calendar_members m
      where m.calendar_id = v_calendar.id and m.user_id = (select auth.uid())
    ) then 'member'
    when v_calendar.end_date is not null and v_calendar.end_date < v_today then 'ended'
    when v_count >= 20 then 'full'
    else 'ok'
  end;

  return jsonb_build_object(
    'status', v_status,
    'calendar_id', case when v_status = 'member' then v_calendar.id end,
    'name', v_calendar.name,
    'type', v_calendar.type,
    'icon', v_calendar.icon,
    'color', v_calendar.color,
    'unit', v_calendar.unit,
    'target', v_calendar.target,
    'start_date', v_calendar.start_date,
    'end_date', v_calendar.end_date,
    'owner_nickname', v_owner,
    'member_count', v_count,
    'expires_at', v_invite.expires_at
  );
end;
$$;


-- ---------------------------------------------------------------------
-- 12. 초대 수락: 만료·취소·기간 종료·인원(20명)·중복 참여를 서버에서 검사
-- ---------------------------------------------------------------------
create or replace function public.accept_invite(p_token text, p_nickname text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_invite   public.calendar_invites;
  v_calendar public.calendars;
  v_count    integer;
  v_today    date := (now() at time zone 'Asia/Seoul')::date;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요' using errcode = '28000';
  end if;

  select * into v_invite from public.calendar_invites where token = p_token;
  if not found then
    raise exception '올바르지 않은 초대 링크예요' using errcode = '22023';
  end if;
  if v_invite.revoked_at is not null then
    raise exception '취소된 초대 링크예요. 방장에게 새 링크를 받아 주세요' using errcode = '22023';
  end if;
  if v_invite.expires_at <= now() then
    raise exception '만료된 초대 링크예요. 방장에게 새 링크를 받아 주세요' using errcode = '22023';
  end if;

  -- 같은 챌린지에 동시에 여러 명이 참여해도 인원 검사가 정확하도록 챌린지 행을 잠금
  select * into v_calendar from public.calendars where id = v_invite.calendar_id for update;

  if exists (select 1 from public.calendar_members m where m.calendar_id = v_calendar.id and m.user_id = v_uid) then
    return jsonb_build_object('status', 'member', 'calendar_id', v_calendar.id);
  end if;
  if v_calendar.end_date is not null and v_calendar.end_date < v_today then
    raise exception '이미 끝난 챌린지예요' using errcode = '22023';
  end if;
  select count(*) into v_count from public.calendar_members where calendar_id = v_calendar.id;
  if v_count >= 20 then
    raise exception '이 챌린지는 인원(20명)이 다 찼어요' using errcode = '22023';
  end if;

  perform public.set_nickname(p_nickname);

  insert into public.calendar_members (calendar_id, user_id, role)
  values (v_calendar.id, v_uid, 'member')
  on conflict (calendar_id, user_id) do nothing;

  return jsonb_build_object('status', 'joined', 'calendar_id', v_calendar.id);
end;
$$;


-- ---------------------------------------------------------------------
-- 13. 챌린지 나가기 (방장은 나갈 수 없음 → 혼자 남으면 삭제)
--     내 활동 원본은 지우지 않고, 이 챌린지와의 연결만 끊음.
--     대표 캘린더가 이 챌린지였던 기록은 남은 캘린더(개인 우선)로 바꾸고, 없으면 비움.
-- ---------------------------------------------------------------------
create or replace function public.leave_challenge(p_calendar_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_role text;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요' using errcode = '28000';
  end if;
  select m.role into v_role from public.calendar_members m
   where m.calendar_id = p_calendar_id and m.user_id = v_uid;
  if v_role is null then
    raise exception '참여하지 않은 챌린지예요' using errcode = '22023';
  end if;
  if v_role = 'owner' then
    raise exception '방장은 나갈 수 없어요. 혼자 남았을 때 챌린지를 삭제할 수 있어요' using errcode = '42501';
  end if;

  delete from public.activity_calendar_links l
   where l.calendar_id = p_calendar_id and l.owner_id = v_uid;

  update public.activity_records a
     set primary_calendar_id = (
       select l.calendar_id
       from public.activity_calendar_links l
       join public.calendars c on c.id = l.calendar_id
       where l.activity_id = a.id
       order by (c.type = 'personal') desc, c.sort_order, c.created_at
       limit 1
     )
   where a.owner_id = v_uid and a.primary_calendar_id = p_calendar_id;

  delete from public.calendar_members m
   where m.calendar_id = p_calendar_id and m.user_id = v_uid;
end;
$$;


-- ---------------------------------------------------------------------
-- 14. 챌린지 멤버·기록 조회 (내가 멤버인 챌린지만)
--     멤버: 닉네임·역할·참여 시각만 (이메일 없음)
--     기록: 그 챌린지에 연결된, 현재 멤버의 기록의 날짜·양·단위·작성자만
-- ---------------------------------------------------------------------
create or replace function public.get_challenge_members(p_calendar_ids uuid[])
returns table (calendar_id uuid, user_id uuid, nickname text, role text, joined_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.calendar_id, m.user_id, coalesce(p.nickname, '멤버'), m.role, m.joined_at
  from public.calendar_members m
  left join public.profiles p on p.id = m.user_id
  where m.calendar_id = any (p_calendar_ids)
    and public.is_calendar_member(m.calendar_id)
  order by m.calendar_id, m.joined_at;
$$;

create or replace function public.get_challenge_records(p_calendar_ids uuid[])
returns table (activity_id uuid, owner_id uuid, calendar_id uuid, activity_date date, amount numeric, unit text)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.owner_id, l.calendar_id, a.activity_date, a.amount, a.unit
  from public.activity_calendar_links l
  join public.activity_records a on a.id = l.activity_id
  join public.calendars c on c.id = l.calendar_id
  where l.calendar_id = any (p_calendar_ids)
    and c.type <> 'personal'
    and public.is_calendar_member(l.calendar_id)
    and exists (
      select 1 from public.calendar_members m
      where m.calendar_id = l.calendar_id and m.user_id = a.owner_id
    )
  order by a.activity_date, a.id;
$$;


-- ---------------------------------------------------------------------
-- 15. 함수 실행 권한
--     preview_invite 만 로그인 전(anon)에도 쓸 수 있음 (챌린지 요약만 보여 줌)
-- ---------------------------------------------------------------------
revoke all on function public.set_nickname(text) from public, anon;
revoke all on function public.create_challenge(text, text, text, text, text, numeric, date, date, text, integer) from public, anon;
revoke all on function public.create_invite(uuid) from public, anon;
revoke all on function public.get_active_invite(uuid) from public, anon;
revoke all on function public.revoke_invite(uuid) from public, anon;
revoke all on function public.preview_invite(text) from public;
revoke all on function public.accept_invite(text, text) from public, anon;
revoke all on function public.leave_challenge(uuid) from public, anon;
revoke all on function public.get_challenge_members(uuid[]) from public, anon;
revoke all on function public.get_challenge_records(uuid[]) from public, anon;
revoke all on function public.check_challenge_delete() from public, anon, authenticated;

grant execute on function public.set_nickname(text) to authenticated;
grant execute on function public.create_challenge(text, text, text, text, text, numeric, date, date, text, integer) to authenticated;
grant execute on function public.create_invite(uuid) to authenticated;
grant execute on function public.get_active_invite(uuid) to authenticated;
grant execute on function public.revoke_invite(uuid) to authenticated;
grant execute on function public.preview_invite(text) to anon, authenticated;
grant execute on function public.accept_invite(text, text) to authenticated;
grant execute on function public.leave_challenge(uuid) to authenticated;
grant execute on function public.get_challenge_members(uuid[]) to authenticated;
grant execute on function public.get_challenge_records(uuid[]) to authenticated;
