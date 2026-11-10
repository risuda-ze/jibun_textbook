import { defineConfig, devices } from '@playwright/test'

// 通しテスト。AIは「デモ応答」に切り替えて、外部に一切つながずに動線を確かめる。
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173/jibun_textbook/', serviceWorkers: 'block' },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/jibun_textbook/',
    reuseExistingServer: true,
    timeout: 180_000,
  },
  projects: [
    { name: 'pc', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    // phone は viewport に依存する spec だけ走らせる。残りは pc だけで足りる（#131）
    {
      name: 'phone',
      use: { ...devices['Pixel 7'] },
      testMatch: /(flow|reorder|wide|busy_button|generate_group|note_edit|inline_image)\.spec\.ts$/,
    },
  ],
})
