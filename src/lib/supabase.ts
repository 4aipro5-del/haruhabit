import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Supabase 연결 (값은 .env.local 의 VITE_ 변수에서 읽음)
// 공개돼도 되는 Publishable key 만 씁니다. service_role/secret 키는 절대 여기에 넣지 마세요.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

/**
 * 메일 링크로 돌아왔을 때의 처음 주소.
 * Supabase 가 주소의 로그인 정보를 읽고 지우기 전에 저장해 두어, 실패 이유를 보여 줄 수 있게 합니다.
 */
export const initialUrl = typeof window === 'undefined' ? '' : window.location.href

/** 서버가 15초 안에 답하지 않으면 요청을 끊고 실패로 처리 ("저장 중…"에 멈춰 있지 않게) */
const REQUEST_TIMEOUT_MS = 15_000
const fetchWithTimeout: typeof fetch = (input, init) =>
  fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS) })

/** 설정값이 없으면 null → 앱은 지금처럼 이 브라우저(localStorage)에만 저장 */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          // 메일 링크에 로그인 정보가 직접 담기는 방식 → 링크를 요청한 브라우저가 아니어도 로그인됨
          // (PKCE 방식은 요청한 브라우저에서만 열려서, 메일 앱이 다른 브라우저를 열면 실패했음)
          flowType: 'implicit',
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
        global: { fetch: fetchWithTimeout },
      })
    : null

export const isCloudConfigured = supabase !== null

/** Supabase·네트워크 오류를 사용자에게 보여줄 한국어 문장으로 바꿉니다. */
export function friendlyError(error: unknown): string {
  const e = error as { message?: string; code?: string; status?: number } | null
  const message = e?.message ?? String(error)
  if (/TimeoutError|AbortError|timed out|aborted/i.test(`${(e as { name?: string })?.name} ${message}`)) {
    return '서버 응답이 없어 중단했어요. 저장되지 않았을 수 있으니 다시 시도해 주세요. (같은 기록이 두 번 생기지는 않아요)'
  }
  if (/Failed to fetch|NetworkError|Load failed|fetch/i.test(message) && !e?.code) {
    return '인터넷 연결을 확인해 주세요. 저장되지 않았어요.'
  }
  if (e?.code === '40001' || e?.code === 'PT409' || e?.status === 409) return '다른 기기에서 먼저 수정된 기록이에요. 새로고침한 뒤 다시 시도해 주세요.'
  if (e?.code === '42501') return '이 데이터를 바꿀 권한이 없어요. 다시 로그인해 주세요.'
  if (e?.code === '28000' || /JWT|token/i.test(message)) return '로그인이 만료됐어요. 다시 로그인해 주세요.'
  if (/Invalid login credentials/i.test(message)) return '이메일 또는 비밀번호가 맞지 않아요.'
  if (/Email not confirmed/i.test(message)) return '이메일 인증이 아직 안 됐어요. 받은 메일의 링크를 눌러 주세요.'
  if (/User already registered/i.test(message)) return '이미 가입된 이메일이에요. 로그인해 주세요.'
  if (/Password should be at least/i.test(message)) return '비밀번호는 6자 이상이어야 해요.'
  if (/different from the old password/i.test(message)) return '지금 비밀번호와 다른 비밀번호를 정해 주세요.'
  if (/reauthentication|requires recent login/i.test(message))
    return '보안을 위해 다시 로그인한 뒤 비밀번호를 바꿔 주세요.'
  if (/email rate limit/i.test(message))
    return '메일 발송 한도를 넘었어요. Supabase 기본 메일은 시간당 몇 통만 보낼 수 있어요. 1시간쯤 뒤에 다시 시도해 주세요.'
  if (/only request this after (\d+) seconds/i.test(message))
    return `같은 이메일로는 잠시 후에 다시 요청할 수 있어요. (${message.match(/after (\d+) seconds/i)?.[1]}초 뒤)`
  if (/rate limit|too many/i.test(message)) return '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.'
  // 데이터베이스가 보낸 한국어 안내(단위가 다른 캘린더 등)는 그대로 보여 줌
  if (/[가-힣]/.test(message)) return message
  return `처리하지 못했어요. (${message})`
}
