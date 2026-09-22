/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * CSP（docs/security.md §5・#37）。GitHub Pages はレスポンスヘッダを設定できないので meta で入れる。
 * 外部への接続先は Anthropic API と Google Fonts だけ。画像は data URL（JSON に埋め込み）。
 * 本番ビルドにだけ入れる。開発サーバー（vite）は HMR と React の preamble がインライン script を使うため対象外。
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  // style 属性（React の inline style）を使うので 'unsafe-inline' が要る。Google Fonts の CSS は外部
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://api.anthropic.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

const cspMeta = (): Plugin => ({
  name: 'csp-meta',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
  ],
})

// GitHub Pages はリポジトリ名の下で配信されるので base を合わせる
export default defineConfig({
  base: '/jibun_textbook/',
  plugins: [
    cspMeta(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'じぶん教科書',
        short_name: 'じぶん教科書',
        description: 'AIの下書きに自分で書き込んで、自分の教科書に育てる',
        lang: 'ja',
        theme_color: '#f6f5f4',
        background_color: '#f6f5f4',
        display: 'standalone',
        start_url: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
    }),
  ],
  server: { port: 5173 },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
  },
})
