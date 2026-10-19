-- 초대 코드 SQL(20261021000000_invite_codes.sql)을 실행한 뒤 SQL Editor 에서 Run 하세요.
-- 데이터는 읽기만 하고 바꾸지 않아요. 두 결과가 모두 기대값과 같으면 성공입니다.

-- 1) 초대 표에 code 칸이 생겼는지, 시도 기록 표가 있고 RLS 가 켜졌는지 (2행: code, true)
select 'calendar_invites.code' as item, data_type as result
from information_schema.columns
where table_schema = 'public' and table_name = 'calendar_invites' and column_name = 'code'
union all
select 'invite_code_attempts RLS', rowsecurity::text
from pg_tables
where schemaname = 'public' and tablename = 'invite_code_attempts';

-- 2) 함수 3개가 코드도 돌려주는지 (3행)
select proname, pg_get_function_result(oid) as returns
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('create_invite', 'get_active_invite', 'resolve_invite_code')
order by proname;
