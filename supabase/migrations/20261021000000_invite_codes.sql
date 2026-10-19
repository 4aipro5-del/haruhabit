-- =====================================================================
-- 하루한칸 4단계 추가: 초대 코드 (링크가 잘리거나 안 열릴 때 쓰는 6자리 코드)
-- Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여 넣고 Run 하면 됩니다.
-- (4단계 SQL 20261020000000_stage4_challenges.sql 을 먼저 실행한 상태여야 해요)
--
-- 이 파일이 하는 일 (기존 데이터는 바꾸거나 지우지 않아요)
--  1) calendar_invites 에 code 칸 추가 → 초대 링크를 만들면 코드도 같이 생김
--     (유효기간 7일·최대 20명·취소·새로 만들기가 링크와 똑같이 적용)
--  2) invite_code_attempts 표 추가 → 틀린 코드 입력을 계정당 1시간에 5번까지만 허용
--  3) 함수: create_invite / get_active_invite 가 코드도 돌려주고,
--     resolve_invite_code(코드) 로 코드를 초대 링크 토큰으로 바꿈 (로그인한 사람만)
--
-- 이미 만들어 둔 초대 링크는 그대로 쓸 수 있어요. 코드가 없으니, 코드가 필요하면 '새 링크 만들기'를 누르면 돼요.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. 코드 칸 (예전 링크는 비어 있음)
--    헷갈리는 글자(0 O 1 I L)를 뺀 31글자 중 6자리 → 약 8억 9천만 가지
-- ---------------------------------------------------------------------
alter table public.calendar_invites
  add column if not exists code text unique
  check (code is null or code ~ '^[A-HJKMNP-Z2-9]{6}$');


-- ---------------------------------------------------------------------
-- 2. 틀린 코드 입력 기록 (계정별). 1시간이 지난 기록은 세지 않아요.
-- ---------------------------------------------------------------------
create table public.invite_code_attempts (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index invite_code_attempts_user_idx on public.invite_code_attempts (user_id, attempted_at);

alter table public.invite_code_attempts enable row level security;
-- 정책 없음 + 권한 회수 → 브라우저에서 직접 읽고 쓸 수 없음 (아래 함수로만 기록)
revoke all on public.invite_code_attempts from anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. 코드 만들기 도우미: 서버의 무작위 값(gen_random_uuid)으로 6자리를 뽑음
-- ---------------------------------------------------------------------
create or replace function public.new_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  -- 31글자
  v_bytes    bytea;
  v_code     text;
begin
  loop
    v_bytes := uuid_send(gen_random_uuid());
    v_code := '';
    for i in 0..5 loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 31) + 1, 1);
    end loop;
    -- 예전에 쓴 적 없는 코드가 나올 때까지 다시 뽑음 (겹칠 일은 거의 없음)
    exit when not exists (select 1 from public.calendar_invites i where i.code = v_code);
  end loop;
  return v_code;
end;
$$;

revoke all on function public.new_invite_code() from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 4. 초대 링크 만들기 / 지금 링크 보기: 코드도 함께 돌려줌
--    (돌려주는 칸이 바뀌어서 지우고 다시 만들어요)
-- ---------------------------------------------------------------------
drop function if exists public.create_invite(uuid);
create function public.create_invite(p_calendar_id uuid)
returns table (token text, code text, expires_at timestamptz)
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
    insert into public.calendar_invites (calendar_id, token, code, created_by, expires_at)
    values (
      p_calendar_id,
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
      public.new_invite_code(),
      v_uid,
      now() + interval '7 days'
    )
    returning calendar_invites.token as new_token, calendar_invites.code as new_code,
              calendar_invites.expires_at as new_expires_at
  )
  select created.new_token, created.new_code, created.new_expires_at from created;
end;
$$;

drop function if exists public.get_active_invite(uuid);
create function public.get_active_invite(p_calendar_id uuid)
returns table (token text, code text, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select i.token, i.code, i.expires_at
  from public.calendar_invites i
  join public.calendars c on c.id = i.calendar_id
  where i.calendar_id = p_calendar_id
    and c.owner_id = (select auth.uid())
    and i.revoked_at is null
    and i.expires_at > now()
  order by i.created_at desc
  limit 1;
$$;


-- ---------------------------------------------------------------------
-- 5. 코드 → 초대 토큰 (로그인한 사람만)
--    - 소문자·띄어쓰기·하이픈은 알아서 정리
--    - 틀리면 기록하고 남은 횟수를 알려 줌. 1시간 안에 5번 틀리면 잠김 (맞는 코드도 잠시 막힘)
--    - 맞으면 토큰을 돌려주고, 만료·취소·인원·중복 참여는 지금처럼 초대 화면에서 서버가 검사
--    결과: {status: 'ok', token} / {status: 'wrong', remaining} / {status: 'locked', retry_minutes}
--    (틀린 기록이 지워지지 않도록 오류를 던지지 않고 결과로 알려 줌)
-- ---------------------------------------------------------------------
create or replace function public.resolve_invite_code(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_code     text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_failed   integer;
  v_oldest   timestamptz;
  v_token    text;
  c_limit    constant integer := 5;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요' using errcode = '28000';
  end if;

  select count(*), min(a.attempted_at) into v_failed, v_oldest
  from public.invite_code_attempts a
  where a.user_id = v_uid and a.attempted_at > now() - interval '1 hour';

  if v_failed >= c_limit then
    return jsonb_build_object(
      'status', 'locked',
      'retry_minutes', greatest(1, ceil(extract(epoch from (v_oldest + interval '1 hour' - now())) / 60))::int
    );
  end if;

  select i.token into v_token from public.calendar_invites i where i.code = v_code;

  if v_token is null then
    insert into public.invite_code_attempts (user_id) values (v_uid);
    return jsonb_build_object('status', 'wrong', 'remaining', c_limit - v_failed - 1);
  end if;

  return jsonb_build_object('status', 'ok', 'token', v_token);
end;
$$;


-- ---------------------------------------------------------------------
-- 6. 실행 권한
-- ---------------------------------------------------------------------
revoke all on function public.create_invite(uuid) from public, anon;
revoke all on function public.get_active_invite(uuid) from public, anon;
revoke all on function public.resolve_invite_code(text) from public, anon;
grant execute on function public.create_invite(uuid) to authenticated;
grant execute on function public.get_active_invite(uuid) to authenticated;
grant execute on function public.resolve_invite_code(text) to authenticated;
