// public/icon.svg から PWA 用の PNG アイコンを作る。アイコンを変えたときだけ実行する: node scripts/make_icons.mjs
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'

const svg = readFileSync('public/icon.svg', 'utf8')
const browser = await chromium.launch()
for (const size of [192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`)
  await page.screenshot({ path: `public/icon-${size}.png` })
  await page.close()
}
await browser.close()
console.log('icons written')
