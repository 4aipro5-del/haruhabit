import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { friendlyError, initialUrl, isCloudConfigured, supabase } from '../lib/supabase'
import { getPendingInvite } from '../lib/invite'
import { forgetThisDevice } from '../lib/push'

// 로그인 상태와 회원가입·로그인·로그아웃·비밀번호 재설정

/** 메일 링크로 돌아왔을 때 무엇 때문인지 (주소의 ?auth= 값) */
export type AuthNotice = 'confirmed' | 'recovery' | 'link-error' | null

interface AuthContextValue {
  configured: boolean
  /** 처음 로그인 상태를 확인하는 중 */
  initializing: boolean
  session: Session | null
  user: User | null
  notice: AuthNotice
  /** 링크 처리에 실패했을 때 이유 */
  noticeDetail: string | null
  clearNotice: () => void
  /** alreadyRegistered: 이미 가입·인증된 이메일 (이 경우 Supabase 는 메일을 보내지 않음) */
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean; alreadyRegistered: boolean }>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  sendPasswordReset: (email: string) => Promise<void>
  /** 비밀번호 없이 이메일 링크로 가입·로그인 (처음이면 계정이 만들어짐) */
  sendLoginLink: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * 메일 링크가 돌아올 주소. # 주소 이동과 섞이지 않게 ?auth= 만 붙입니다.
 * GitHub Pages 처럼 하위 경로(/haru-habit-tracker/)에서 열려도 맞는 주소가 되도록 BASE_URL 을 붙입니다.
 */
const redirectUrl = (kind: 'confirmed' | 'recovery') => {
  // 초대 링크로 들어왔다가 가입·로그인하는 중이면, 메일 링크를 눌렀을 때 초대 화면으로 돌아오도록 함께 보냄
  const invite = kind === 'confirmed' ? getPendingInvite() : null
  return `${window.location.origin}${import.meta.env.BASE_URL}?auth=${kind}${invite ? `&invite=${invite}` : ''}`
}

async function run(fn: () => PromiseLike<{ data: unknown; error: unknown }>): Promise<unknown> {
  let result: { data: unknown; error: unknown }
  try {
    result = await fn()
  } catch (error) {
    throw new Error(friendlyError(error))
  }
  if (result.error) throw new Error(friendlyError(result.error))
  return result.data
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [initializing, setInitializing] = useState(isCloudConfigured)
  const [notice, setNotice] = useState<AuthNotice>(null)
  const [noticeDetail, setNoticeDetail] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    // 메일 링크로 돌아온 주소: ?auth=confirmed#access_token=... 또는 #error=...&error_code=otp_expired
    const url = new URL(initialUrl || window.location.href)
    const query = url.searchParams
    const isRouteHash = url.hash.startsWith('#/')
    const hashParams = new URLSearchParams(isRouteHash ? '' : url.hash.slice(1))
    const authParam = query.get('auth')
    const linkType = hashParams.get('type')
    const errorCode = hashParams.get('error_code') ?? query.get('error_code')
    const errorText = hashParams.get('error_description') ?? query.get('error_description')
    const fromLink = Boolean(authParam || hashParams.has('access_token') || errorCode || errorText || query.has('code'))

    // getSession 은 주소에 담긴 로그인 정보를 처리하는 작업이 끝날 때까지 기다립니다.
    supabase.auth.getSession().then(({ data, error }) => {
      setSession(data.session)
      setInitializing(false)
      if (fromLink) {
        if (data.session && (authParam === 'recovery' || linkType === 'recovery')) setNotice('recovery')
        else if (data.session) setNotice('confirmed')
        else {
          setNotice('link-error')
          setNoticeDetail(
            errorCode === 'otp_expired'
              ? '링크가 만료됐거나 이미 한 번 사용됐어요. 새 링크를 받아 주세요. (메일 보안 검사가 링크를 먼저 열어 버리면 이렇게 될 수 있어요.)'
              : errorText
                ? `이유: ${errorText}`
                : error
                  ? `이유: ${error.message}`
                  : null,
          )
        }
        // 주소에 남은 로그인 정보를 지워서 새로고침해도 다시 처리되지 않게 함
        window.history.replaceState(null, '', url.pathname + (isRouteHash ? url.hash : ''))
      }
    })

    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'PASSWORD_RECOVERY') setNotice('recovery')
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: isCloudConfigured,
      initializing,
      session,
      user: session?.user ?? null,
      notice,
      noticeDetail,
      clearNotice: () => {
        setNotice(null)
        setNoticeDetail(null)
      },

      signUp: async (email, password) => {
        if (!supabase) throw new Error('Supabase 설정이 없어요.')
        const client = supabase
        const data = (await run(() =>
          client.auth.signUp({ email, password, options: { emailRedirectTo: redirectUrl('confirmed') } }),
        )) as { session: Session | null; user: User | null }
        // 이미 가입·인증된 이메일이면 Supabase 는 보안상 '보냈다'고만 답하고 메일은 보내지 않음.
        // 이때 돌아온 user 의 identities 가 비어 있어서 구분할 수 있음.
        const alreadyRegistered = !data.session && (data.user?.identities?.length ?? 0) === 0
        // 확인 메일이 켜져 있으면 세션 없이 user 만 돌아옴
        return { needsConfirmation: !data.session && !alreadyRegistered, alreadyRegistered }
      },

      signIn: async (email, password) => {
        if (!supabase) throw new Error('Supabase 설정이 없어요.')
        const client = supabase
        await run(() => client.auth.signInWithPassword({ email, password }))
      },

      signOut: async () => {
        if (!supabase) return
        const client = supabase
        // 로그아웃한 기기에는 그 계정의 챌린지 알림이 더 오지 않게 (실패해도 로그아웃은 진행)
        await forgetThisDevice()
        await run(async () => {
          const { error } = await client.auth.signOut()
          return { data: null, error }
        })
        setNotice(null)
      },

      sendLoginLink: async (email) => {
        if (!supabase) throw new Error('Supabase 설정이 없어요.')
        const client = supabase
        await run(() =>
          client.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectUrl('confirmed'), shouldCreateUser: true } }),
        )
      },

      sendPasswordReset: async (email) => {
        if (!supabase) throw new Error('Supabase 설정이 없어요.')
        const client = supabase
        await run(() => client.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl('recovery') }))
      },

      updatePassword: async (password) => {
        if (!supabase) throw new Error('Supabase 설정이 없어요.')
        const client = supabase
        await run(() => client.auth.updateUser({ password }))
        setNotice(null)
      },
    }),
    [initializing, session, notice, noticeDetail],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth는 AuthProvider 안에서만 쓸 수 있어요.')
  return ctx
}

export type { User }
