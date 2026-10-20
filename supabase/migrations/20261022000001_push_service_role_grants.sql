-- =====================================================================
-- 하루한칸: 푸시 발송 함수(Edge Function)가 쓸 서버 권한
-- Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여 넣고 Run 하면 됩니다.
--
-- 왜 필요한가요?
--   Edge Function 은 서버 전용 키(service_role)로 DB 를 읽고 써요.
--   최근 Supabase 프로젝트는 새 표에 이 키의 권한을 자동으로 주지 않아서,
--   알림 대기열을 읽지 못하고 "permission denied for table push_outbox" 가 났어요.
--
-- 이 파일은 service_role 에게 '알림 발송에 필요한 만큼만' 권한을 줍니다.
--   - 데이터는 바꾸지 않아요.
--   - 브라우저용 키(anon, authenticated)의 권한은 그대로예요. (대기열·구독은 계속 브라우저에서 접근 불가)
--   - service_role 키는 Supabase Secrets 에만 있고 브라우저에는 없어요.
-- =====================================================================

-- 받는 사람·문구를 계산하려고 읽기만 하는 표
grant select on public.activity_records,
                public.activity_calendar_links,
                public.calendars,
                public.calendar_members,
                public.profiles
  to service_role;

-- 알림 대기열: 읽고 '처리 중 / 완료 / 실패' 상태를 바꿈
grant select, update on public.push_outbox to service_role;

-- 받는 사람별 발송 상태: 기록하고 바꿈
grant select, insert, update on public.push_deliveries to service_role;

-- 기기 구독: 읽고, 성공 시각·실패 횟수를 바꾸고, 끝난 구독(404/410)은 지움
grant select, update, delete on public.push_subscriptions to service_role;

-- 확인용: 아래 결과에 service_role 줄이 보이면 성공이에요
select table_name, string_agg(privilege_type, ', ' order by privilege_type) as service_role_privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee = 'service_role'
  and table_name in ('activity_records', 'activity_calendar_links', 'calendars', 'calendar_members', 'profiles',
                     'push_outbox', 'push_deliveries', 'push_subscriptions')
group by table_name
order by table_name;
