# 하루한칸 — GitHub Pages 배포 안내

배포 준비(설정 파일·워크플로)는 끝났고, 아래는 **직접 해 주셔야 하는 단계**예요.
아직 아무것도 업로드·배포하지 않았어요.

배포 주소는 `https://<GitHub 계정>.github.io/<저장소 이름>/` 이 됩니다.
이 프로젝트의 저장소: <https://github.com/4aipro5-del/haruhabit> → 배포 주소 **`https://4aipro5-del.github.io/haruhabit/`**

---

## 1. GitHub 저장소 만들기
1. <https://github.com/new> 에서 **Repository name** 입력 (이 프로젝트는 `haruhabit` 으로 만들었어요 ✅)
2. **공개(Public)** 로 할지 **비공개(Private)** 로 할지 정하기
   - 무료 계정에서 GitHub Pages 는 **Public 저장소**에서만 쓸 수 있어요.
   - Public 이면 코드가 누구에게나 보여요. (.env.local 과 폰트 파일은 올라가지 않게 해 두었어요)
3. "Add a README" 등은 **체크하지 않고** Create repository

## 2. 코드 올리기 (제가 대신할 수 있어요 — 확인만 해 주세요)
✅ 완료: `git remote add origin https://github.com/4aipro5-del/haruhabit.git` → `git push -u origin main`

## 3. Supabase 값을 GitHub 에 넣기
저장소 **Settings › Secrets and variables › Actions › Variables 탭 › New repository variable**
| 이름 | 값 |
|---|---|
| `VITE_SUPABASE_URL` | `https://<프로젝트ID>.supabase.co` (지금 .env.local 에 있는 값) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` (지금 .env.local 에 있는 값) |

> 이 두 값은 원래 브라우저에 공개되는 값이에요. service_role / sb_secret_ 키는 절대 넣지 마세요.
> 워크플로가 sb_secret_ 키를 발견하면 배포를 멈추도록 해 두었어요.

## 4. GitHub Pages 켜기
저장소 **Settings › Pages › Build and deployment › Source** 를 **GitHub Actions** 로 바꾸기

## 5. Supabase 인증 주소 추가
Supabase 대시보드 **Authentication › URL Configuration**
- **Redirect URLs** 에 추가: `https://4aipro5-del.github.io/haruhabit/**`
- **Site URL**: 배포 후 실제로 쓸 주소로 바꾸려면 `https://4aipro5-del.github.io/haruhabit/`
  (로컬 개발용 `http://localhost:5173/**` 는 Redirect URLs 에 그대로 두세요)

## 6. 배포 실행
main 브랜치에 올리면 자동으로 배포돼요. 또는 저장소 **Actions › Deploy to GitHub Pages › Run workflow**.
초록색 체크가 뜨면 위 배포 주소로 들어가 확인해 주세요.

---

## 알아 두기
- **폰트**: 카페24 써라운드 에어(카페24)를 눈누가 제공하는 웹폰트 주소(jsDelivr)에서 불러와요.
  라이선스상 웹폰트를 포함해 사용 범위 제한이 없고(OFL, 수정·재배포 가능), 글꼴 자체 판매만 금지예요.
  (메모먼트 꾹꾹체는 웹폰트 임베딩이 허용되지 않아 쓰지 않아요.)
- **주소 형태**: 화면 이동은 `#/stats` 처럼 `#` 주소를 써서 GitHub Pages 에서 새로고침해도 404 가 나지 않아요.
- **로컬 기록은 주소마다 따로**: 배포 사이트(github.io)의 브라우저 저장 공간은 localhost 와 별개예요.
  배포 사이트에서는 예시 데이터로 시작하고, 로그인하면 클라우드 기록이 보여요.
