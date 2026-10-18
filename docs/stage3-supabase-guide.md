# 하루한칸 3단계 — Supabase 준비 안내

이 문서는 3단계(로그인 + 클라우드 저장)를 시작하기 전에 **직접 해 주셔야 하는 Supabase 설정**과,
앱이 데이터를 어떻게 옮기고 저장할지에 대한 설계를 정리한 것입니다.

---

## A. 직접 해 주세요: Supabase 설정 (약 15분)

### 1. 프로젝트 만들기
1. <https://supabase.com> 에 로그인합니다. (GitHub 계정으로 가입 가능)
2. **New project** 를 누릅니다.
3. 다음처럼 입력합니다.
   - **Name**: `haru-habit` (아무 이름이나 괜찮아요)
   - **Database Password**: 강한 비밀번호를 만들고 **안전한 곳(비밀번호 관리자 등)에 따로 보관**하세요.
     이 비밀번호는 앱 코드에 넣지 않습니다. 저에게도 보내지 마세요.
   - **Region**: `Northeast Asia (Seoul)`
4. **Create new project** 를 누르고 1~2분 기다립니다.

### 2. 데이터베이스 표 만들기 (SQL 실행)
1. 왼쪽 메뉴에서 **SQL Editor** 를 엽니다.
2. **New query** 를 누릅니다.
3. 프로젝트 폴더의 `supabase/migrations/20261018000000_stage3_personal_cloud.sql` 파일 내용을 **전부 복사해서 붙여 넣습니다.**
4. 오른쪽 아래 **Run** 을 누릅니다. `Success. No rows returned` 가 나오면 성공입니다.
   - 빨간 오류가 나오면 오류 문구를 그대로 복사해서 알려 주세요. 다시 실행하기 전에 확인이 필요해요.
5. 다시 **New query** 를 눌러 `supabase/checks/verify_setup.sql` 내용을 붙여 넣고 **Run** 합니다.
   - 표 7개 모두 `rls_enabled = true`
   - 함수 4개(`can_access_calendar`, `delete_calendar`, `handle_new_user`, `save_activity`)
   - 이 결과 화면을 캡처해서 보내 주시면 제가 확인할게요.

### 3. 이메일 로그인 설정
1. 왼쪽 메뉴 **Authentication** → **Sign In / Providers** 로 갑니다.
2. **Email** 이 켜져 있는지 확인합니다. (기본값: 켜짐)
3. **Confirm email**(가입 확인 메일) 설정을 정합니다.
   - **켜 두기(권장)**: 가입하면 확인 메일이 오고, 메일 속 링크를 눌러야 로그인할 수 있어요.
   - **꺼 두기**: 가입 즉시 로그인됩니다. 테스트는 편하지만 아무 이메일로나 가입할 수 있어요.
   - 어느 쪽으로 했는지 알려 주세요. 앱 안내 문구를 그에 맞게 만들게요.
4. **Authentication** → **URL Configuration** 으로 갑니다.
   - **Site URL**: `http://localhost:5173`
   - **Redirect URLs** 에 `http://localhost:5173/**` 를 추가합니다.
     (가입 확인 메일·비밀번호 재설정 메일의 링크가 이 주소로 돌아옵니다.)

> 참고: Supabase 기본 메일 발송은 **시간당 몇 통**으로 제한돼 있어요.
> 테스트 중 메일이 안 오면 잠시 후 다시 시도하거나, 받은편지함의 스팸함을 확인해 주세요.

### 4. 연결 값 확인
1. 왼쪽 아래 **Project Settings** → **API Keys** (또는 상단 **Connect** 버튼) 으로 갑니다.
2. 다음 두 값을 확인합니다.
   - **Project URL**: `https://xxxxxxxx.supabase.co`
   - **Publishable key**: `sb_publishable_...` 로 시작 (화면에 없으면 **Legacy API Keys** 탭의 `anon` `public` 키)
3. 이 두 값은 브라우저에 공개돼도 괜찮은 값이라 저에게 보내 주셔도 됩니다.
   (실제 보호는 위에서 만든 RLS 규칙이 담당합니다.)

> ⚠️ **절대 보내지 말 것 / 코드에 넣지 말 것**
> - `service_role` 키 또는 `sb_secret_...` 로 시작하는 키
> - Database Password
> - 이 값들은 모든 보안 규칙을 무시할 수 있는 열쇠입니다.

### 5. 테스트용 이메일 2개 준비
다른 사용자가 내 기록을 볼 수 없는지 확인하려면 **계정 2개**가 필요해요.
Gmail 이라면 `내아이디+test1@gmail.com`, `내아이디+test2@gmail.com` 처럼 `+` 뒤에 아무 글자를 붙이면
같은 메일함으로 받을 수 있어요.

### 6. 끝나면 알려 주세요
"Supabase 설정 완료" 라고 말씀해 주시면서 다음을 함께 알려 주세요.
- Project URL, Publishable key (또는 직접 `.env.local` 에 넣었다고 말씀해 주셔도 돼요)
- Confirm email 을 켰는지/껐는지
- verify_setup.sql 결과 캡처

---

## B. 데이터 구조 (현재 앱 → 데이터베이스)

| 앱(TypeScript) | 데이터베이스 표 | 비고 |
|---|---|---|
| `HabitCalendar` | `calendars` | 빈도(`frequency`)·목표량(`target`)·기간 포함 |
| `HabitCalendar.goals: string[]` | `goals` | 세부 목표 문장 한 줄 = 한 행 |
| `ActivityRecord` (원본) | `activity_records` | **활동 1건 = 1행**, 작성자 `owner_id` 필수 |
| `ActivityRecord.calendarIds` | `activity_calendar_links` | 연결 1개 = 1행 (운동 30분 → 운동, 운동 60시간 챌린지 = 2행) |
| `ActivityRecord.primaryCalendarId` | `activity_records.primary_calendar_id` | 전체 보기 점 색 |
| `memos: Record<날짜, 문장>` | `daily_memos` | 날짜당 1행 |
| 계정 | `profiles` | 가입하면 자동 생성 |
| (새로 추가) | `data_imports` | 로컬 → 클라우드 이전 기록, 같은 데이터 반복 이전 방지 |

- 모든 표에 **RLS** 가 켜져 있어 로그인한 본인 데이터만 보고 쓸 수 있어요.
  브라우저에서 다른 사람 id 를 보내도 서버가 거절합니다.
- 활동 저장은 `save_activity` 함수 하나로 **원본과 연결을 함께** 저장합니다.
  중간에 실패하면 전부 취소돼서 "원본만 있고 연결은 없는" 상태가 생기지 않아요.
- 활동 id 는 브라우저가 미리 만든 UUID 를 씁니다. 같은 저장 요청이 두 번 가도 활동은 한 번만 생겨요.
- `updated_at` 으로 다른 기기에서 먼저 바뀐 기록을 감지합니다. (덮어쓰기 전에 알려 줌)
- 다음 단계(공유 챌린지)는 `calendar_members` 표를 추가하고 `can_access_calendar()` 에 조건만 더하면 됩니다.

## C. 기존 데이터 이전 계획 (5~7단계에서 구현)

1. **먼저 백업**: 설정 › 데이터 › **백업 파일 내려받기** 로 이 브라우저의 원본을 파일로 저장합니다.
2. 로그인하면 이전할지 **먼저 물어봅니다.** 이전 전에 캘린더·활동·연결·메모 개수를 미리 보여 줍니다.
3. **예시 데이터는 올리지 않습니다.**
   - 예시 기록은 id 가 `sample-` 로 시작해서 실제 기록(`rec-...`)과 구분됩니다.
   - 예시 캘린더(운동·공부·독서 등)는 내가 직접 남긴 기록이 연결돼 있거나 내가 만든 경우에만 올립니다.
4. 같은 데이터는 한 번만 올라가도록 로컬 데이터의 지문과 원래 id(`legacy_id`)로 확인합니다.
5. 올린 뒤 개수와 **활동-캘린더 연결 관계**가 그대로인지 다시 읽어서 검증합니다.
6. 실패하면 이유를 보여 주고 다시 시도할 수 있게 합니다.
7. 이전에 성공해도 **로컬 데이터는 바로 지우지 않습니다.**
