# 하루한칸

혼자서도, 함께여도. 매일 조금씩.

개인 습관 기록과 친구들과 함께하는 챌린지를 위한 웹앱입니다.
**지금은 3단계(로그인 + 클라우드 저장)**입니다. 로그인하면 기록이 Supabase 에 저장되고, 로그인하지 않으면 예전처럼 이 브라우저에만 저장됩니다.
Supabase 설정 방법은 [docs/stage3-supabase-guide.md](docs/stage3-supabase-guide.md), 데이터베이스는 `supabase/migrations/` 의 SQL 두 개(순서대로 실행)를 보세요.
`.env.local` 에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` 가 필요합니다. (`.env.example` 참고)

이전 단계 설명: **2단계(개인 기록)** 내 캘린더·활동·메모는 이 브라우저의 localStorage(`haru-habit:v1`)에 저장되어 새로고침해도 유지됩니다.
처음 실행하면 예시 데이터로 시작하고, 설정 › '예시 데이터로 되돌리기'로 언제든 처음 상태로 돌릴 수 있습니다.
친구 기록은 친구 계정 연동 전까지 읽기 전용 예시 데이터입니다.

### 데이터 규칙
- 활동은 원본 한 건만 저장하고, `calendarIds`로 여러 캘린더에 반영합니다.
- 전체 통계는 활동을 한 번만 세고, 캘린더별 통계는 그 캘린더에 연결된 활동만 셉니다.
- 전체 보기 점 색은 활동에 저장된 대표 캘린더(`primaryCalendarId`) 색이라 캘린더 순서와 무관합니다.
- 캘린더를 삭제하면 그 캘린더에만 연결된 활동은 함께 삭제되고, 다른 캘린더에도 연결된 활동은 남습니다.

## 배포 (GitHub Pages)

`.github/workflows/deploy-pages.yml` 이 main 브랜치에 올라오면 빌드·배포합니다.
필요한 설정은 [docs/github-pages-guide.md](docs/github-pages-guide.md) 를 보세요.
배포 주소: https://4aipro5-del.github.io/haruhabit/ · 로컬에서 배포용으로 빌드해 보려면: `BASE_PATH=/haruhabit/ npm run build`

## 실행 방법

터미널에서 이 폴더로 이동한 다음:

```bash
npm install      # 처음 한 번만
npm run dev      # 개발 서버 실행 → http://localhost:5173
npm run build    # TypeScript 검사 + 배포용 빌드
```

## 화면

| 주소 | 화면 |
| --- | --- |
| `#/` | 캘린더 (다이어리 달력 + 날짜 상세) |
| `#/stats` | 통계 |
| `#/settings` | 설정 |
| `#/calendar/exercise` · `study` · `reading` | 개인 캘린더 상세 |
| `#/calendar/exercise-60` | 공동 목표형 상세 |
| `#/calendar/study-20` | 개인 경쟁형 상세 |
| `#/new` | 새 캘린더 만들기 |
| `#/edit/:id` | 개인 캘린더 수정·삭제 (설정 › 캘린더 관리에서 이동) |

## 폴더 구조

```
src/
  types/            데이터 타입 (캘린더, 멤버, 기록)
  data/
    sampleData.ts   예시 데이터 (오늘 날짜 기준으로 생성)
    repository.ts   예시 데이터·멤버 정보 꺼내기
    storage.ts      localStorage 읽기/쓰기 → 나중에 Supabase로 교체
    DataProvider.tsx  앱 전체가 함께 쓰는 데이터와 추가·수정·삭제 함수
  lib/
    date.ts         한국 시간 기준 날짜 계산
    stats.ts        달성률·연속 기록·순위 계산
    summary.ts      홈 카드용 요약
    units.ts        단위(시간, 쪽, km…) 표시
    colors.ts       파스텔 색상 클래스
    icons.ts        아이콘·유형 정보
    router.ts       주소(#) 기반 화면 이동
    activity.ts     대표 캘린더(점 색), 캘린더 필터, 챌린지 기간 확인
  hooks/
    useMonthNavigator.ts  상세 화면 달력 상태
  components/
    ui/             카드, 진행률 바, 배지, 버튼 등 재사용 부품
    diary/          첫 화면 다이어리 달력, 날짜 상세, 기록 팝업
    calendar/       상세 화면용 월간 달력, 날짜별 기록, 캘린더 카드
    layout/         사이드바, 모눈종이(Paper), 상세 화면 머리말
  pages/            캘린더 / 통계 / 설정 / 유형별 상세 / 캘린더 만들기·수정
(폰트)              오뮤 다예쁨체 — 눈누 웹폰트(jsDelivr)로 불러옴. 폰트 파일 재배포 금지라 저장소에 넣지 않음
```

## 다음 단계에서 구현 예정

- 친구 초대, 공동 목표·개인 경쟁 캘린더의 실제 다중 사용자 연동 (calendar_members 표 + can_access_calendar 함수 확장)
