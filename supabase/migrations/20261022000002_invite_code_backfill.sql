-- =====================================================================
-- 하루한칸: 초대 코드가 없는 예전 초대 링크에도 코드 붙이기
-- Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여 넣고 Run 하면 됩니다.
--
-- 왜 필요한가요?
--   초대 코드 기능을 추가하기 전에 만든 초대 링크에는 코드가 없어서,
--   방장이 '새 링크 만들기'를 눌러야만 코드가 보였어요. (그러면 이미 보낸 링크가 취소됨)
--
-- 이 파일이 하는 일
--   1) 지금 쓰고 있는(취소·만료 안 된) 링크 중 코드가 없는 것에 코드를 붙여요.
--      링크 주소·유효기간은 그대로라서, 이미 보낸 링크도 계속 쓸 수 있어요.
--   2) 앞으로도 방장이 친구 초대 창을 열 때 코드가 없으면 그 자리에서 붙여 줘요.
--   그 밖의 데이터(기록·캘린더·챌린지·멤버)는 바꾸지 않아요.
-- =====================================================================

-- 1) 지금 쓰고 있는 링크에 코드 붙이기 (한 줄씩: 코드가 겹치지 않게)
do $$
declare
  v_id uuid;
begin
  for v_id in
    select i.id from public.calendar_invites i
    where i.code is null and i.revoked_at is null and i.expires_at > now()
  loop
    update public.calendar_invites set code = public.new_invite_code() where id = v_id;
  end loop;
end;
$$;

-- 2) 방장이 지금 링크를 볼 때 코드가 없으면 붙여서 돌려줌
--    (돌려주는 칸은 그대로라 함수 모양은 같고, 내용만 바꿔요)
create or replace function public.get_active_invite(p_calendar_id uuid)
returns table (token text, code text, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_invite public.calendar_invites;
begin
  select i.* into v_invite
  from public.calendar_invites i
  join public.calendars c on c.id = i.calendar_id
  where i.calendar_id = p_calendar_id
    and c.owner_id = (select auth.uid())
    and i.revoked_at is null
    and i.expires_at > now()
  order by i.created_at desc
  limit 1;

  if not found then
    return;
  end if;

  if v_invite.code is null then
    update public.calendar_invites set code = public.new_invite_code() where id = v_invite.id
    returning * into v_invite;
  end if;

  return query select v_invite.token, v_invite.code, v_invite.expires_at;
end;
$$;

revoke all on function public.get_active_invite(uuid) from public, anon;
grant execute on function public.get_active_invite(uuid) to authenticated;

-- 확인용: 지금 쓰고 있는 링크 중 코드 없는 것 (0 이 나오면 성공)
select count(*) as 코드없는_사용중_링크
from public.calendar_invites
where code is null and revoked_at is null and expires_at > now();
