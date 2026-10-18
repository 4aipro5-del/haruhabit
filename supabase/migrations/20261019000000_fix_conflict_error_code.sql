-- =====================================================================
-- 하루한칸 3단계 수정: '다른 기기에서 먼저 수정됨' 오류 코드 변경
--
-- 문제: 충돌을 알릴 때 40001(serialization_failure) 코드를 썼더니,
--       Supabase 서버(PostgREST)가 "잠깐 겹친 것"으로 보고 계속 다시 시도해서 요청이 끝나지 않았어요.
-- 해결: PostgREST 가 HTTP 409(충돌)로 바로 돌려주는 'PT409' 코드로 바꿉니다.
--
-- Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여 넣고 Run 하면 됩니다.
-- (표나 데이터는 바뀌지 않고, save_activity 함수만 다시 만들어요)
-- =====================================================================

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
  end if;

  delete from public.activity_calendar_links
   where activity_id = p_id and calendar_id <> all (p_calendar_ids);

  insert into public.activity_calendar_links (activity_id, calendar_id)
  select p_id, unnest(p_calendar_ids)
  on conflict (activity_id, calendar_id) do nothing;

  return v_row;
end;
$$;

revoke all on function public.save_activity(uuid, date, numeric, text, text, uuid[], uuid, timestamptz, text) from public, anon;
grant execute on function public.save_activity(uuid, date, numeric, text, text, uuid[], uuid, timestamptz, text) to authenticated;
