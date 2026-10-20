import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { registerServiceWorker } from './lib/push'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// 웹 푸시 알림용 서비스 워커 (알림을 켜지 않아도 등록만 해 둠. 실패해도 앱은 그대로)
registerServiceWorker()
