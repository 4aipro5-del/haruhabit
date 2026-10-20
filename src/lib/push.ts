import { supabase } from './supabase'

// 웹 푸시 (이 기기에서 챌린지 활동 알림 받기)
// - 기기마다 따로 켜고 꺼요. 기본은 꺼짐(구독 없음).
// - 브라우저에는 공개 키만 있고, 발송은 서버(Edge Function)가 해요.
// - 아이폰은 Safari 로 '홈 화면에 추가'한 앱에서만 받을 수 있어요 (iOS 16.4 이상).

const PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim() ?? ''
const SW_URL = `${import.meta.env.BASE_URL}sw.js`

/**
 * 이 기기의 알림 상태
 * unsupported: 웹 푸시를 지원하지 않는 브라우저 / ios-install: 아이폰인데 홈 화면 앱이 아님
 * not-ready: 공개 키가 없음(배포 설정) / denied: 알림 권한 거부 / off: 꺼짐 / on: 켜짐
 */
export type PushState = 'unsupported' | 'ios-install' | 'not-ready' | 'denied' | 'off' | 'on'

export function isIos() {
  const ua = navigator.userAgent
  // iPadOS 는 맥처럼 보이지만 터치가 있음
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

function supportsPush() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** 앱을 열 때 서비스 워커 등록 (알림을 받으려면 필요). 실패해도 앱 사용에는 영향 없음 */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.register(SW_URL, { scope: import.meta.env.BASE_URL }).catch(() => {})
  // 알림을 눌렀는데 창 이동이 막힌 경우 서비스 워커가 보내는 주소로 이동
  navigator.serviceWorker.addEventListener('message', (event) => {
    const url = event.data?.type === 'open-url' ? String(event.data.url) : ''
    if (url.startsWith(window.location.origin)) window.location.href = url
  })
}

/** 기기 이름 (나중에 어느 기기인지 알아보기 위한 참고용) */
function deviceLabel() {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return '아이폰'
  if (/iPad/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)) return '아이패드'
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : '브라우저'
  const os = /Macintosh/.test(ua) ? '맥' : /Windows/.test(ua) ? '윈도우' : /Android/.test(ua) ? '안드로이드' : ''
  return `${os} ${browser}`.trim()
}

function base64UrlToBytes(value: string) {
  const padded = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
  return (await reg?.pushManager.getSubscription()) ?? null
}

/** 이 기기의 지금 상태 (화면에 안내를 보여 주기 위해) */
export async function getPushState(): Promise<PushState> {
  if (isIos() && !isStandalone()) return 'ios-install'
  if (!supportsPush()) return 'unsupported'
  if (!PUBLIC_KEY) return 'not-ready'
  if (Notification.permission === 'denied') return 'denied'
  if (!supabase) return 'not-ready'
  try {
    const sub = await currentSubscription()
    if (!sub) return 'off'
    const { data } = await supabase.rpc('is_push_registered', { p_endpoint: sub.endpoint })
    return data === true ? 'on' : 'off'
  } catch {
    return 'off'
  }
}

/**
 * 이 기기에서 켜기. 버튼을 누른 순간에 불러야 해요 (Safari 는 사용자가 누를 때만 권한을 물을 수 있음).
 * 성공하면 'on', 권한을 거부하면 'denied' 를 돌려줘요.
 */
export async function enablePush(): Promise<PushState> {
  if (isIos() && !isStandalone()) return 'ios-install'
  if (!supportsPush()) return 'unsupported'
  if (!PUBLIC_KEY || !supabase) return 'not-ready'

  // 권한 요청을 가장 먼저 (다른 기다림 뒤에 부르면 Safari 가 막을 수 있음)
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off'

  const reg = (await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)) ??
    (await navigator.serviceWorker.register(SW_URL, { scope: import.meta.env.BASE_URL }))
  await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(PUBLIC_KEY) }))
  const json = sub.toJSON()
  const { error } = await supabase.rpc('register_push', {
    p_endpoint: sub.endpoint,
    p_p256dh: json.keys?.p256dh ?? '',
    p_auth: json.keys?.auth ?? '',
    p_label: deviceLabel(),
  })
  if (error) throw new Error('알림 설정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
  return 'on'
}

/** 이 기기에서 끄기 (다른 기기는 그대로) */
export async function disablePush(): Promise<PushState> {
  if (!supportsPush()) return 'unsupported'
  const sub = await currentSubscription()
  if (sub && supabase) {
    const { error } = await supabase.rpc('unregister_push', { p_endpoint: sub.endpoint })
    if (error) throw new Error('알림을 끄지 못했어요. 잠시 후 다시 시도해 주세요.')
  }
  await sub?.unsubscribe().catch(() => {})
  return 'off'
}

/** 로그아웃할 때: 이 기기가 그 계정의 알림을 계속 받지 않도록 정리 (실패해도 로그아웃은 진행) */
export async function forgetThisDevice() {
  try {
    if (!supportsPush()) return
    const sub = await currentSubscription()
    if (!sub) return
    await supabase?.rpc('unregister_push', { p_endpoint: sub.endpoint })
    await sub.unsubscribe()
  } catch {
    /* 무시 */
  }
}
