-- 마이그레이션을 실행한 뒤 SQL Editor 에서 이 쿼리를 Run 하면 설정이 맞는지 확인할 수 있어요.
-- 아래 세 결과가 모두 기대값과 같으면 성공입니다.

-- 1) 표 7개가 모두 있고 RLS 가 켜져 있는지 (rls_enabled 가 모두 true)
select tablename, rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles', 'calendars', 'goals', 'activity_records',
                    'activity_calendar_links', 'daily_memos', 'data_imports')
order by tablename;

-- 2) 정책 개수 (표마다 1개 이상)
select tablename, count(*) as policy_count
from pg_policies
where schemaname = 'public'
group by tablename
order by tablename;

-- 3) 함수 4개가 있는지
select proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('save_activity', 'delete_calendar', 'can_access_calendar', 'handle_new_user')
order by proname;
