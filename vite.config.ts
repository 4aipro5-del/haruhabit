import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages 는 https://<계정>.github.io/<저장소이름>/ 아래에서 열리므로
// 배포할 때는 BASE_PATH=/<저장소이름>/ 으로 빌드합니다. (GitHub Actions 워크플로에서 자동 설정)
// 로컬 개발(npm run dev)에서는 지금처럼 '/' 를 씁니다.
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
})
