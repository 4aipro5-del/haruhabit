-- =====================================================================
-- 하루한칸: 챌린지 활동 웹 푸시 알림
-- Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여 넣고 Run 하면 됩니다.
-- (4단계 SQL 과 초대 코드 SQL 을 먼저 실행한 상태여야 해요)
--
-- 이 파일이 하는 일 (기존 기록·캘린더·챌린지는 바꾸거나 지우지 않아요)
--  1) push_subscriptions : 기기별 푸시 구독 (아이폰·맥 따로 켜고 끔, 기본은 없음 = 꺼짐)
--  2) push_outbox        : 알림 대기열. 챌린지에 연결된 '새' 기록 1건당 1줄
--  3) push_deliveries    : 대기열 1줄 × 받는 사람 1명당 발송 상태 (중복 발송 방지)
--  4) save_activity      : 새 기록이 챌린지에 연결되면 대기열에 1줄 추가
--                          (수정·삭제, 예전 기록 옮기기는 넣지 않음.
--                           대기열 추가가 실패해도 기록 저장은 그대로 성공)
--  5) 기기 등록·해제·확인 함수
--
-- 대기열 1줄이 생기면 Database Webhook 이 Edge Function(notify-challenge-activity)을 부르고,
-- Edge Function 이 서버에서 받는 사람을 다시 계산해 푸시를 보냅니다.
-- 세 표 모두 브라우저에서 직접 읽고 쓸 수 없어요. (구독은 아래 함수로 '내 기기'만 등록·해제)
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. 기기별 푸시 구독
--    endpoint 는 브라우저(기기)마다 하나. 같은 기기에서 다른 계정으로 로그인하면 새 계정으로 옮겨져요.
-- ---------------------------------------------------------------------
create table public.push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  endpoint        text not null unique check (endpoint ~ '^https://'),
  p256dh          text not null,
  auth            text not null,
  device_label    text check (device_label is null or char_length(device_label) <= 60),
  created_at      timestamptz not null default now(),
  last_success_at timestamptz,
  failure_count   integer not null default 0
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);


-- ---------------------------------------------------------------------
-- 2. 알림 대기열 (활동 1건당 1줄 → 웹훅이 두 번 와도 같은 줄)
-- ---------------------------------------------------------------------
create table public.push_outbox (
  id           bigint generated always as identity primary key,
  activity_id  uuid not null unique references public.activity_records (id) on delete cascade,
  author_id    uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  status       text not null default 'pending' check (status in ('pending', 'processing', 'done', 'failed')),
  attempts     integer not null default 0,
  processed_at timestamptz,
  error        text
);


-- ---------------------------------------------------------------------
-- 3. 받는 사람별 발송 상태 (대기열 1줄 × 사람 1명 = 1줄 → 같은 사람에게 두 번 보내지 않음)
--    status: sending(보내는 중) / sent / throttled(짧은 시간 안 연속 기록이라 생략) / no_devices / failed
-- ---------------------------------------------------------------------
create table public.push_deliveries (
  outbox_id  bigint not null references public.push_outbox (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  status     text not null check (status in ('sending', 'sent', 'throttled', 'no_devices', 'failed')),
  created_at timestamptz not null default now(),
  sent_at    timestamptz,
  primary key (outbox_id, user_id)
);

-- '같은 친구 → 같은 사람' 최근 발송 확인용 (연속 기록 알림 제한)
create index push_deliveries_recent_idx on public.push_deliveries (user_id, author_id, sent_at);

alter table public.push_subscriptions enable row level security;
alter table public.push_outbox        enable row level security;
alter table public.push_deliveries    enable row level security;
-- 정책 없음 + 권한 회수 → 브라우저에서 직접 접근 불가 (Edge Function 은 서버 전용 키로 접근)
revoke all on public.push_subscriptions, public.push_outbox, public.push_deliveries from anon, authenticated;


-- ---------------------------------------------------------------------
-- 4-1. 대기열 추가 (save_activity 안에서만 부름)
--      브라우저가 대기열 표를 직접 만지지 못하게, 확인을 마친 뒤 서버 권한으로 넣어요.
--      - 로그인한 사람의 활동이고, 방금(5분 안) 만든 활동이고, 챌린지에 연결돼 있을 때만
--      - 같은 활동은 한 줄만 (다시 불러도 늘지 않음)
-- ---------------------------------------------------------------------
create or replace function public.enqueue_push(p_activity_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    return;
  end if;
  if not exists (
    select 1 from public.activity_records a
    where a.id = p_activity_id
      and a.owner_id = v_uid
      and a.legacy_id is null
      and a.created_at > now() - interval '5 minutes'
  ) then
    return;
  end if;
  if not exists (
    select 1 from public.activity_calendar_links l
    join public.calendars c on c.id = l.calendar_id
    where l.activity_id = p_activity_id and c.type <> 'personal'
  ) then
    return;
  end if;

  insert into public.push_outbox (activity_id, author_id)
  values (p_activity_id, v_uid)
  on conflict (activity_id) do nothing;
end;
$$;

revoke all on function public.enqueue_push(uuid) from public, anon;
grant execute on function public.enqueue_push(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 4. 기록 저장 함수: 새 기록이 챌린지에 연결되면 대기열에 1줄
--    (20261019000000_fix_conflict_error_code.sql 의 save_activity 와 같고, 마지막에 대기열 추가만 더함)
-- ---------------------------------------------------------------------
create or replace function public.save_activity(
  p_id                  uuid,
  p_activity_date       date,
  p_amount              numeric,
  p_unit                text,
  p_note                text,
  p_calendar_ids        uuid[],
  p_primary_calendar_id uuid,
  p_expected_updated_at timestamptz default null,
  p_legacy_id           text default null
)
returns public.activity_records
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing public.activity_records;
  v_row      public.activity_records;
  v_is_new   boolean := false;
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요해요' using errcode = '28000';
  end if;
  if coalesce(array_length(p_calendar_ids, 1), 0) = 0 then
    raise exception '반영할 캘린더를 하나 이상 골라 주세요' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.calendars c
    where c.id = any (p_calendar_ids) and c.unit <> p_unit
  ) then
    raise exception '단위가 다른 캘린더에는 연결할 수 없어요' using errcode = '22023';
  end if;

  select * into v_existing from public.activity_records where id = p_id for update;

  if found then
    if p_expected_updated_at is not null and v_existing.updated_at <> p_expected_updated_at then
      -- PT409 → HTTP 409 Conflict (다시 시도하지 않고 바로 알려 줌)
      raise exception '다른 기기에서 먼저 수정된 기록이에요. 새로고침 후 다시 시도해 주세요' using errcode = 'PT409';
    end if;
    update public.activity_records
       set activity_date = p_activity_date,
           amount = p_amount,
           unit = p_unit,
           note = p_note,
           primary_calendar_id = p_primary_calendar_id
     where id = p_id
    returning * into v_row;
  else
    insert into public.activity_records (id, activity_date, amount, unit, note, primary_calendar_id, legacy_id)
    values (p_id, p_activity_date, p_amount, p_unit, p_note, p_primary_calendar_id, p_legacy_id)
    returning * into v_row;
    v_is_new := true;
  end if;

  delete from public.activity_calendar_links
   where activity_id = p_id and calendar_id <> all (p_calendar_ids);

  insert into public.activity_calendar_links (activity_id, calendar_id)
  select p_id, unnest(p_calendar_ids)
  on conflict (activity_id, calendar_id) do nothing;

  -- 알림 대기열: '새' 기록 + 챌린지 연결 + 예전 기록 옮기기(legacy)가 아닐 때만
  -- 대기열이나 웹훅에 문제가 있어도 기록 저장은 성공하도록 따로 감쌈
  if v_is_new and p_legacy_id is null and exists (
    select 1 from public.calendars c where c.id = any (p_calendar_ids) and c.type <> 'personal'
  ) then
    begin
      perform public.enqueue_push(p_id);
    exception when others then
      raise warning '알림 대기열 추가 실패 (기록은 저장됨): %', sqlerrm;
    end;
  end if;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. 기기 등록·해제·확인 (로그인한 본인 기준)
-- ---------------------------------------------------------------------
create or replace function public.register_push(p_endpoint text, p_p256dh text, p_auth text, p_label text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception '로그인이 필요해요' using errcode = '28000';
  end if;
  if p_endpoint is null or p_endpoint !~ '^https://' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception '알림 구독 정보가 올바르지 않아요' using errcode = '22023';
  end if;

  -- 같은 기기(endpoint)는 한 계정에만: 다른 계정으로 등록돼 있었다면 지금 계정으로 옮김
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, device_label)
  values (v_uid, p_endpoint, p_p256dh, p_auth, left(p_label, 60))
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        device_label = excluded.device_label,
        failure_count = 0,
        created_at = now();
end;
$$;

create or replace function public.unregister_push(p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions s
   where s.endpoint = p_endpoint and s.user_id = (select auth.uid());
$$;

-- 이 기기가 지금 내 계정으로 알림을 받도록 등록돼 있는지
create or replace function public.is_push_registered(p_endpoint text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.push_subscriptions s
    where s.endpoint = p_endpoint and s.user_id = (select auth.uid())
  );
$$;

revoke all on function public.register_push(text, text, text, text) from public, anon;
revoke all on function public.unregister_push(text) from public, anon;
revoke all on function public.is_push_registered(text) from public, anon;
grant execute on function public.register_push(text, text, text, text) to authenticated;
grant execute on function public.unregister_push(text) to authenticated;
grant execute on function public.is_push_registered(text) to authenticated;
