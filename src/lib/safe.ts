/**
 * JSON 由来の URL を描画するときの無害化（#35・docs/security.md §2・§3）。
 * 教科書 JSON は他の端末から読み込むので、`javascript:` や `data:text/html` のような値が入りうる。
 * スキーマでは弾かず（古い JSON を読めなくしないため）、描画するときにリンクや画像にしない。
 */

/** http(s) の URL だけをリンクにする */
export const isHttpUrl = (u: unknown): u is string => typeof u === 'string' && /^https?:\/\/[^\s]+$/i.test(u)

/** 画像として表示してよい data URL（data:image/…）だけを通す */
export const isImageDataUrl = (u: unknown): u is string => typeof u === 'string' && /^data:image\/[a-z0-9.+-]+(;[a-z0-9=.-]+)*,/i.test(u)
