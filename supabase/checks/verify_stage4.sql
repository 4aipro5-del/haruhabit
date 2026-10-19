-- 4단계 SQL(20261020000000_stage4_challenges.sql)을 실행한 뒤 SQL Editor 에서 Run 하세요.
-- 데이터는 읽기만 하고 바꾸지 않아요. 세 결과가 모두 기대값과 같으면 성공입니다.

-- 1) 새 표 2개 + RLS 켜짐 (rls_enabled 가 둘 다 true)
select tablename, rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public' and tablename in ('calendar_members', 'calendar_invites')
order by tablename;

-- 2) 새 함수 13개가 모두 있는지 (13행)
select proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('is_calendar_member', 'can_link_calendar', 'check_challenge_delete', 'set_nickname',
                  'create_challenge', 'create_invite', 'get_active_invite', 'revoke_invite',
                  'preview_invite', 'accept_invite', 'leave_challenge', 'get_challenge_members',
                  'get_challenge_records')
order by proname;

-- 3) 바뀐·추가된 권한 규칙 (4행: calendars 멤버 조회, activity_records 생성·수정, links 생성)
select tablename, policyname
from pg_policies
where schemaname = 'public'
  and policyname in ('calendars: 멤버 조회', 'activity_records: 본인 생성', 'activity_records: 본인 수정', 'links: 본인 생성')
order by tablename, policyname;
