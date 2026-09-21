import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
    base: '/jibun_textbook/',
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            manifest: {
                name: '自分教科書',
                short_name: '自分教科書',
                description: 'AIが下書きした教材に自分で書き込む',
                theme_color: '#ffffff',
                background_color: '#ffffff',
                display: 'standalone',
                icons: [
                    {
                        src: 'data:image/svg+xml,<svg viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg"><rect fill="%23007AFF" width="192" height="192" rx="40"/><text x="96" y="130" font-size="140" font-weight="bold" text-anchor="middle" fill="white" font-family="system-ui">自</text></svg>',
                        sizes: '192x192',
                        type: 'image/svg+xml',
                        purpose: 'any'
                    }
                ]
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}']
            }
        })
    ],
    server: {
        port: 5173,
        open: true
    }
});
