import { initialUrl } from './supabase'

// 초대 링크로 들어왔다가 로그인·회원가입을 하러 가도, 끝나면 초대 화면으로 돌아오게 하는 장치
// 1) 초대 화면을 열면 토큰을 이 브라우저에 잠깐 저장
// 2) 가입 확인·로그인 메일 링크에도 ?invite=토큰 을 붙여서, 메일을 다른 브라우저에서 열어도 돌아옴
// 3) 참여를 마치거나 쓸 수 없는 링크로 확인되면 지움

const KEY = 'haru-habit:pending-invite'
const TOKEN = /^[A-Za-z0-9_-]{16,128}$/

export function getPendingInvite(): string | null {
  try {
    const token = localStorage.getItem(KEY)
    return token && TOKEN.test(token) ? token : null
  } catch {
    return null
  }
}

export function setPendingInvite(token: string) {
  if (!TOKEN.test(token)) return
  try {
    localStorage.setItem(KEY, token)
  } catch {
    /* 저장할 수 없는 브라우저(사생활 보호 모드 등)면 메일 링크의 ?invite= 로만 돌아옴 */
  }
}

export function clearPendingInvite() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* 무시 */
  }
}

/** 친구에게 보낼 초대 주소. 배포 사이트에서는 https://4aipro5-del.github.io/haruhabit/#/join/토큰 */
export function inviteUrl(token: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}#/join/${token}`
}

// 메일 링크로 돌아온 주소(?invite=토큰)에 초대가 있으면 기억해 둠 (주소는 로그인 처리 후 정리됨)
if (typeof window !== 'undefined' && initialUrl) {
  const fromMail = new URL(initialUrl).searchParams.get('invite')
  if (fromMail) setPendingInvite(fromMail)
}
