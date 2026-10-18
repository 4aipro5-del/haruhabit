-- =====================================================================
-- 하루한칸 3단계: 개인 캘린더·활동·메모 클라우드 저장
-- Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여 넣고 Run 하면 됩니다.
--
-- 핵심 규칙
--  1) 활동 원본은 activity_records 에 한 건만 저장합니다.
--  2) 활동이 어떤 캘린더에 반영됐는지는 activity_calendar_links 에 따로 저장합니다.
--     (운동 30분 1건 → 링크 2건: 운동, 운동 60시간 챌린지)
--  3) 모든 표에 RLS(행 수준 보안)를 켜서 본인 데이터만 읽고 쓸 수 있습니다.
--  4) 친구와 함께 쓰는 공유 챌린지는 다음 단계에서 calendar_members 표를 추가하고
--     can_access_calendar() 함수에 조건만 더하면 되도록 준비해 두었습니다.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. 공통: updated_at 자동 갱신 (다른 기기와의 수정 충돌 감지에 사용)
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- 1. profiles: 로그인 계정 1개당 1행 (가입하면 자동 생성)
-- ---------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------------------------------------------------------------------
-- 2. calendars: 캘린더 + 목표 설정 (TS: HabitCalendar)
-- ---------------------------------------------------------------------
create table public.calendars (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  type            text not null default 'personal' check (type in ('personal', 'shared', 'competition')),
  name            text not null check (char_length(name) between 1 and 40),
  description     text not null default '',
  icon            text not null,
  color           text not null,
  unit            text not null check (unit in ('check', 'hours', 'km', 'count', 'pages')),
  -- 실천 빈도 (TS: frequency). 매일이면 times 없음, 주 N회면 times 필수
  frequency_kind  text check (frequency_kind in ('daily', 'weekly')),
  frequency_times smallint check (frequency_times between 1 and 7),
  -- 개인: 1회 목표량 / 공동: 전체 목표량 / 경쟁: 1인당 목표량 (TS: target)
  target          numeric(10, 2) check (target > 0),
  start_date      date not null,
  end_date        date,
  sort_order      integer not null default 0,
  -- localStorage 에서 이전한 캘린더의 원래 id. 같은 데이터를 두 번 이전하지 않게 막습니다.
  legacy_id       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint calendars_period_check check (end_date is null or end_date >= start_date),
  constraint calendars_frequency_check check (
    frequency_kind is null
    or (frequency_kind = 'daily' and frequency_times is null)
    or (frequency_kind = 'weekly' and frequency_times is not null)
  ),
  constraint calendars_legacy_unique unique (owner_id, legacy_id)
);

create index calendars_owner_idx on public.calendars (owner_id);


-- ---------------------------------------------------------------------
-- 3. goals: 캘린더의 세부 목표 문장 (TS: HabitCalendar.goals: string[])
-- ---------------------------------------------------------------------
create table public.goals (
  id          uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  owner_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 100),
  position    smallint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index goals_calendar_idx on public.goals (calendar_id);


-- ---------------------------------------------------------------------
-- 4. activity_records: 활동 원본 (TS: ActivityRecord, calendarIds 제외)
--    id 는 브라우저가 미리 만든 UUID 를 그대로 씁니다.
--    → 같은 저장 요청이 두 번 와도 같은 id 라서 활동이 두 번 생기지 않습니다.
-- ---------------------------------------------------------------------
create table public.activity_records (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  activity_date       date not null,
  amount              numeric(10, 2) not null check (amount > 0),
  unit                text not null check (unit in ('check', 'hours', 'km', 'count', 'pages')),
  note                text check (note is null or char_length(note) <= 500),
  -- 전체 보기 점 색깔에 쓰는 대표 캘린더 (TS: primaryCalendarId)
  primary_calendar_id uuid references public.calendars (id) on delete set null,
  legacy_id           text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint activity_records_legacy_unique unique (owner_id, legacy_id)
);

create index activity_records_owner_date_idx on public.activity_records (owner_id, activity_date);


-- ---------------------------------------------------------------------
-- 5. activity_calendar_links: 활동 ↔ 캘린더 연결 (TS: ActivityRecord.calendarIds)
-- ---------------------------------------------------------------------
create table public.activity_calendar_links (
  activity_id uuid not null references public.activity_records (id) on delete cascade,
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  -- 연결을 만든 사람 = 활동 작성자 (공유 챌린지에서도 '누구의 기록인지'를 지키기 위해)
  owner_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (activity_id, calendar_id)
);

create index activity_calendar_links_calendar_idx on public.activity_calendar_links (calendar_id);
create index activity_calendar_links_owner_idx on public.activity_calendar_links (owner_id);


-- ---------------------------------------------------------------------
-- 6. daily_memos: 날짜별 메모 (하루에 하나)
-- ---------------------------------------------------------------------
create table public.daily_memos (
  owner_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  memo_date  date not null,
  content    text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, memo_date)
);


-- ---------------------------------------------------------------------
-- 7. data_imports: localStorage → 클라우드 이전 기록 (같은 데이터 반복 이전 방지·검증)
-- ---------------------------------------------------------------------
create table public.data_imports (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- 이전한 로컬 데이터의 지문(SHA-256). 같은 지문은 한 번만 이전됩니다.
  source_fingerprint text not null,
  calendar_count     integer not null default 0,
  activity_count     integer not null default 0,
  link_count         integer not null default 0,
  memo_count         integer not null default 0,
  status             text not null default 'started' check (status in ('started', 'verified', 'failed')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint data_imports_fingerprint_unique unique (owner_id, source_fingerprint)
);


-- ---------------------------------------------------------------------
-- 8. updated_at 트리거
-- ---------------------------------------------------------------------
create trigger profiles_set_updated_at         before update on public.profiles         for each row execute function public.set_updated_at();
create trigger calendars_set_updated_at        before update on public.calendars        for each row execute function public.set_updated_at();
create trigger goals_set_updated_at            before update on public.goals            for each row execute function public.set_updated_at();
create trigger activity_records_set_updated_at before update on public.activity_records for each row execute function public.set_updated_at();
create trigger daily_memos_set_updated_at      before update on public.daily_memos      for each row execute function public.set_updated_at();
create trigger data_imports_set_updated_at     before update on public.data_imports     for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------
-- 9. 접근 권한 도우미
--    지금은 '내가 만든 캘린더'만 접근 가능.
--    다음 단계(공유 챌린지)에서 calendar_members 를 만들면 여기에 'or 멤버' 조건만 추가합니다.
-- ---------------------------------------------------------------------
create or replace function public.can_access_calendar(p_calendar_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.calendars c
    where c.id = p_calendar_id
      and c.owner_id = (select auth.uid())
  );
$$;


-- ---------------------------------------------------------------------
-- 10. 데이터 무결성 (서버에서 한 번 더 확인)
-- ---------------------------------------------------------------------

-- 연결할 때: 활동 작성자와 연결 작성자가 같고, 활동과 캘린더 단위가 같아야 함
create or replace function public.check_activity_link()
returns trigger
language plpgsql
security definer  -- 공유 챌린지가 생겨도 다른 멤버 행까지 보고 판단하도록 (읽기만 함)
set search_path = ''
as $$
declare
  v_activity_owner uuid;
  v_activity_unit  text;
  v_calendar_unit  text;
begin
  select owner_id, unit into v_activity_owner, v_activity_unit
  from public.activity_records where id = new.activity_id;

  select unit into v_calendar_unit
  from public.calendars where id = new.calendar_id;

  if v_activity_owner is distinct from new.owner_id then
    raise exception '활동을 기록한 사람만 캘린더에 연결할 수 있어요' using errcode = '42501';
  end if;
  if v_activity_unit is distinct from v_calendar_unit then
    raise exception '단위가 다른 캘린더에는 연결할 수 없어요' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger activity_calendar_links_check
  before insert or update on public.activity_calendar_links
  for each row execute function public.check_activity_link();

-- 캘린더 단위를 바꿀 때: 이미 연결된 활동이 있으면 막음
create or replace function public.check_calendar_unit_change()
returns trigger
language plpgsql
security definer  -- 공유 챌린지가 생겨도 다른 멤버 행까지 보고 판단하도록 (읽기만 함)
set search_path = ''
as $$
begin
  if new.unit is distinct from old.unit and exists (
    select 1 from public.activity_calendar_links l where l.calendar_id = new.id
  ) then
    raise exception '연결된 활동이 있는 캘린더는 단위를 바꿀 수 없어요' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger calendars_unit_change_check
  before update of unit on public.calendars
  for each row execute function public.check_calendar_unit_change();


-- ---------------------------------------------------------------------
-- 11. 활동 저장 함수 (원본 + 연결을 한 번에, 전부 성공하거나 전부 취소)
--     - p_id: 브라우저가 만든 UUID → 재시도해도 중복 생성 없음
--     - p_expected_updated_at: 수정할 때 내가 마지막으로 본 시각.
--       다른 기기에서 먼저 바꿨으면 오류(40001)로 알려 줌
--     security invoker → RLS 가 그대로 적용되어 다른 사람 데이터는 건드릴 수 없음
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
      raise exception '다른 기기에서 먼저 수정된 기록이에요. 새로고침 후 다시 시도해 주세요' using errcode = '40001';
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
  end if;

  -- 체크를 해제한 캘린더 연결만 지우고, 새로 고른 캘린더는 추가
  delete from public.activity_calendar_links
   where activity_id = p_id and calendar_id <> all (p_calendar_ids);

  insert into public.activity_calendar_links (activity_id, calendar_id)
  select p_id, unnest(p_calendar_ids)
  on conflict (activity_id, calendar_id) do nothing;

  return v_row;
end;
$$;


-- ---------------------------------------------------------------------
-- 12. 캘린더 삭제 함수
--     이 캘린더에만 연결된 활동은 함께 삭제하고, 다른 캘린더에도 연결된 활동은 남깁니다.
--     (지금 앱의 동작과 동일)
-- ---------------------------------------------------------------------
create or replace function public.delete_calendar(p_calendar_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.activity_records a
   where a.owner_id = (select auth.uid())
     and exists (select 1 from public.activity_calendar_links l
                  where l.activity_id = a.id and l.calendar_id = p_calendar_id)
     and not exists (select 1 from public.activity_calendar_links l
                      where l.activity_id = a.id and l.calendar_id <> p_calendar_id);

  delete from public.calendars where id = p_calendar_id;
end;
$$;


-- ---------------------------------------------------------------------
-- 13. 행 수준 보안 (RLS)
--     owner_id 를 브라우저에서 다른 사람 id 로 보내도 with check 에서 거절됩니다.
-- ---------------------------------------------------------------------
alter table public.profiles                enable row level security;
alter table public.calendars               enable row level security;
alter table public.goals                   enable row level security;
alter table public.activity_records        enable row level security;
alter table public.activity_calendar_links enable row level security;
alter table public.daily_memos             enable row level security;
alter table public.data_imports            enable row level security;

-- profiles: 내 프로필만 보고 고칠 수 있음 (생성은 가입 트리거가 처리)
create policy "profiles: 본인 조회" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: 본인 수정" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- calendars
create policy "calendars: 본인 조회" on public.calendars
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "calendars: 본인 생성" on public.calendars
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "calendars: 본인 수정" on public.calendars
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "calendars: 본인 삭제" on public.calendars
  for delete to authenticated using (owner_id = (select auth.uid()));

-- goals
create policy "goals: 본인 조회" on public.goals
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "goals: 본인 생성" on public.goals
  for insert to authenticated with check (owner_id = (select auth.uid()) and public.can_access_calendar(calendar_id));
create policy "goals: 본인 수정" on public.goals
  for update to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and public.can_access_calendar(calendar_id));
create policy "goals: 본인 삭제" on public.goals
  for delete to authenticated using (owner_id = (select auth.uid()));

-- activity_records
create policy "activity_records: 본인 조회" on public.activity_records
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "activity_records: 본인 생성" on public.activity_records
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and (primary_calendar_id is null or public.can_access_calendar(primary_calendar_id))
  );
create policy "activity_records: 본인 수정" on public.activity_records
  for update to authenticated using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and (primary_calendar_id is null or public.can_access_calendar(primary_calendar_id))
  );
create policy "activity_records: 본인 삭제" on public.activity_records
  for delete to authenticated using (owner_id = (select auth.uid()));

-- activity_calendar_links: 내 활동을 내가 접근 가능한 캘린더에만 연결
create policy "links: 본인 조회" on public.activity_calendar_links
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "links: 본인 생성" on public.activity_calendar_links
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.activity_records a
                where a.id = activity_id and a.owner_id = (select auth.uid()))
    and public.can_access_calendar(calendar_id)
  );
create policy "links: 본인 삭제" on public.activity_calendar_links
  for delete to authenticated using (owner_id = (select auth.uid()));

-- daily_memos
create policy "daily_memos: 본인 조회" on public.daily_memos
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "daily_memos: 본인 생성" on public.daily_memos
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "daily_memos: 본인 수정" on public.daily_memos
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "daily_memos: 본인 삭제" on public.daily_memos
  for delete to authenticated using (owner_id = (select auth.uid()));

-- data_imports
create policy "data_imports: 본인 조회" on public.data_imports
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "data_imports: 본인 생성" on public.data_imports
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "data_imports: 본인 수정" on public.data_imports
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));


-- ---------------------------------------------------------------------
-- 14. 표 권한: 로그인하지 않은 사용자(anon)는 아무것도 못 하고,
--     로그인한 사용자(authenticated)도 위 RLS 규칙 안에서만 가능
-- ---------------------------------------------------------------------
revoke all on public.profiles, public.calendars, public.goals, public.activity_records,
              public.activity_calendar_links, public.daily_memos, public.data_imports
  from anon;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.calendars, public.goals, public.activity_records,
                                        public.daily_memos to authenticated;
grant select, insert, delete on public.activity_calendar_links to authenticated;
grant select, insert, update on public.data_imports to authenticated;

revoke all on function public.save_activity(uuid, date, numeric, text, text, uuid[], uuid, timestamptz, text) from public, anon;
revoke all on function public.delete_calendar(uuid) from public, anon;
revoke all on function public.can_access_calendar(uuid) from public, anon;
grant execute on function public.save_activity(uuid, date, numeric, text, text, uuid[], uuid, timestamptz, text) to authenticated;
grant execute on function public.delete_calendar(uuid) to authenticated;
grant execute on function public.can_access_calendar(uuid) to authenticated;
