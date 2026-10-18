import { useState, type FormEvent, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../../data/AuthProvider'

// 설정 › 계정: 회원가입·로그인·로그아웃·비밀번호 재설정

type FormMode = 'login' | 'signup' | 'reset' | 'link'

const inputClass =
  'w-full rounded-lg border border-line bg-white/80 px-3.5 py-2.5 text-base text-ink-900 placeholder:text-ink-300 focus:border-ink-400 focus:outline-none'
const primaryButton =
  'rounded-lg bg-ink-900 px-5 py-2.5 text-base text-paper disabled:cursor-not-allowed disabled:bg-ink-300 sm:text-lg'
const lineButton =
  'rounded-lg border border-line px-4 py-2 text-base text-ink-700 hover:bg-line/50 disabled:opacity-50 sm:px-5 sm:py-2.5 sm:text-lg'

/** 비밀번호 입력칸 + 보기/숨기기 버튼 (입력한 글자를 확인할 수 있게) */
function PasswordInput({
  value,
  onChange,
  autoComplete,
}: {
  value: string
  onChange: (value: string) => void
  autoComplete: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <span className="relative block">
      <input
        type={visible ? 'text' : 'password'}
        required
        minLength={6}
        autoComplete={autoComplete}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        lang="en"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} pr-12`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? '비밀번호 숨기기' : '비밀번호 보기'}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-400 hover:text-ink-700"
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </span>
  )
}

function Message({ tone, children }: { tone: 'info' | 'error' | 'ok'; children: ReactNode }) {
  const style = { info: 'bg-sky-100 text-sky-700', error: 'bg-peach-100 text-peach-700', ok: 'bg-leaf-100 text-leaf-700' }[tone]
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={`rounded-lg px-3.5 py-2.5 text-base ${style}`}>
      {children}
    </p>
  )
}

export function AccountSection() {
  const auth = useAuth()

  if (!auth.configured) {
    return <Message tone="info">Supabase 연결 설정이 없어서 이 브라우저에만 저장돼요.</Message>
  }
  if (auth.initializing) return <p className="px-2 py-4 text-lg text-ink-500">로그인 상태를 확인하는 중…</p>

  return (
    <div className="flex flex-col gap-4">
      {auth.notice === 'confirmed' && (
        <Message tone="ok">이메일 인증이 끝났어요. 이제 클라우드에 저장돼요.</Message>
      )}
      {auth.notice === 'link-error' && (
        <Message tone="error">
          메일 링크로 로그인하지 못했어요. {auth.noticeDetail ?? '링크가 만료됐을 수 있어요.'} 아래에서 새 링크를 받거나 로그인해 주세요.
        </Message>
      )}
      {auth.user && auth.notice === 'recovery' ? (
        <NewPasswordForm />
      ) : auth.user ? (
        <SignedIn email={auth.user.email ?? ''} />
      ) : (
        <AuthForm />
      )}
    </div>
  )
}

function SignedIn({ email }: { email: string }) {
  const { signOut } = useAuth()
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-line px-2 py-4 text-lg sm:text-xl">
        <span className="min-w-0">
          <span className="block truncate text-ink-900">{email}</span>
          <span className="text-base text-ink-500">로그인됨 · 클라우드에 저장돼요</span>
        </span>
        <button
          type="button"
          disabled={working}
          onClick={async () => {
            setWorking(true)
            setError(null)
            try {
              await signOut()
            } catch (err) {
              setError(err instanceof Error ? err.message : '로그아웃하지 못했어요.')
              setWorking(false)
            }
          }}
          className={lineButton}
        >
          {working ? '로그아웃 중…' : '로그아웃'}
        </button>
      </div>
      {error && <Message tone="error">{error}</Message>}
    </div>
  )
}

function AuthForm() {
  const auth = useAuth()
  const [mode, setMode] = useState<FormMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const switchMode = (next: FormMode) => {
    setMode(next)
    setError(null)
    setDone(null)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (working) return
    setWorking(true)
    setError(null)
    setDone(null)
    try {
      if (mode === 'login') {
        await auth.signIn(email.trim(), password)
      } else if (mode === 'signup') {
        const { needsConfirmation, alreadyRegistered } = await auth.signUp(email.trim(), password)
        if (alreadyRegistered) {
          setError(
            '이미 가입된 이메일이라 확인 메일은 보내지 않았어요. 로그인 탭에서 로그인하거나, 이메일 링크로 탭에서 로그인 링크를 받아 주세요.',
          )
        } else if (needsConfirmation) {
          setDone(
            `${email.trim()} 으로 확인 메일을 보냈어요. 메일의 링크를 이 브라우저에서 열면 로그인돼요. 메일이 안 보이면 스팸함도 확인해 주세요.`,
          )
        }
      } else if (mode === 'link') {
        await auth.sendLoginLink(email.trim())
        setDone('로그인 링크를 보냈어요. 메일의 링크를 이 브라우저에서 열면 바로 로그인돼요. (처음이면 계정이 만들어져요)')
      } else {
        await auth.sendPasswordReset(email.trim())
        setDone('비밀번호 재설정 메일을 보냈어요. 메일의 링크를 이 브라우저에서 열어 새 비밀번호를 정해 주세요.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '요청을 처리하지 못했어요.')
    } finally {
      setWorking(false)
    }
  }

  const tab = (value: FormMode, label: string) => (
    <button
      type="button"
      onClick={() => switchMode(value)}
      aria-pressed={mode === value}
      className={`rounded-full px-4 py-1.5 text-base ${mode === value ? 'bg-ink-900 text-paper' : 'text-ink-700 hover:bg-line/60'}`}
    >
      {label}
    </button>
  )

  return (
    <div className="flex flex-col gap-4">
      {/* 안내 문장은 입력칸 폭(max-w-md)에 묶이지 않게 따로 두고, 문장마다 한 줄로 */}
      <p className="text-base text-ink-500">
        <span className="block">로그인하면 기록이 클라우드에 저장되고, 다른 기기에서도 같은 기록을 볼 수 있어요.</span>
        <span className="block">로그인하지 않아도 이 브라우저의 기록은 그대로예요.</span>
      </p>
      <form onSubmit={submit} className="flex max-w-md flex-col gap-4">
        <div className="flex gap-1">
          {tab('login', '로그인')}
          {tab('signup', '회원가입')}
          {tab('link', '이메일 링크로')}
        </div>

        <label className="flex flex-col gap-1.5 text-base text-ink-700">
          이메일
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </label>

        {mode === 'link' && (
          <p className="text-base text-ink-500">비밀번호 없이, 메일로 받은 링크를 눌러 가입·로그인해요.</p>
        )}

        {(mode === 'login' || mode === 'signup') && (
          <label className="flex flex-col gap-1.5 text-base text-ink-700">
            비밀번호 {mode === 'signup' && <span className="text-sm text-ink-400">(6자 이상)</span>}
            <PasswordInput
              value={password}
              onChange={setPassword}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
            <span className="text-sm text-ink-400">영문 입력 상태에서 입력해 주세요 (한/영 키 확인)</span>
          </label>
        )}

        {error && <Message tone="error">{error}</Message>}
        {done && <Message tone="ok">{done}</Message>}

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={working} className={primaryButton}>
            {working
              ? '처리 중…'
              : mode === 'login'
                ? '로그인'
                : mode === 'signup'
                  ? '가입하기'
                  : mode === 'link'
                    ? '로그인 링크 받기'
                    : '재설정 메일 보내기'}
          </button>
          {mode === 'login' && (
            <button type="button" onClick={() => switchMode('reset')} className="text-base text-ink-500 underline-offset-4 hover:underline">
              비밀번호를 잊으셨나요?
            </button>
          )}
          {mode === 'reset' && (
            <button type="button" onClick={() => switchMode('login')} className="text-base text-ink-500 underline-offset-4 hover:underline">
              로그인으로 돌아가기
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

function NewPasswordForm() {
  const { updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      className="flex max-w-md flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault()
        if (password !== confirm) {
          setError('두 비밀번호가 서로 달라요.')
          return
        }
        setWorking(true)
        setError(null)
        try {
          await updatePassword(password)
        } catch (err) {
          setError(err instanceof Error ? err.message : '비밀번호를 바꾸지 못했어요.')
          setWorking(false)
        }
      }}
    >
      <Message tone="info">새 비밀번호를 정해 주세요.</Message>
      <label className="flex flex-col gap-1.5 text-base text-ink-700">
        새 비밀번호 <span className="text-sm text-ink-400">(6자 이상)</span>
        <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" />
      </label>
      <label className="flex flex-col gap-1.5 text-base text-ink-700">
        새 비밀번호 확인
        <PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" />
      </label>
      {error && <Message tone="error">{error}</Message>}
      <div>
        <button type="submit" disabled={working} className={primaryButton}>
          {working ? '바꾸는 중…' : '비밀번호 바꾸기'}
        </button>
      </div>
    </form>
  )
}
