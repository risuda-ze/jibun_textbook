/** 貼り付け画像の縮小。JSONに埋め込むので、長辺1600px・WebPに再圧縮する。 */

export const MAX_EDGE = 1600

export function fitSize(w: number, h: number, max = MAX_EDGE): { w: number; h: number } {
  const long = Math.max(w, h)
  if (long <= max) return { w, h }
  const k = max / long
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = () => rej(new Error('画像を読み込めませんでした。'))
    img.src = src
  })
}

const readAsDataUrl = (f: Blob): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result))
    r.onerror = () => rej(new Error('ファイルを読み込めませんでした。'))
    r.readAsDataURL(f)
  })

export async function shrinkImage(input: Blob | string, max = MAX_EDGE, quality = 0.85): Promise<string> {
  const src = typeof input === 'string' ? input : await readAsDataUrl(input)
  const img = await loadImage(src)
  const { w, h } = fitSize(img.naturalWidth, img.naturalHeight, max)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const x = c.getContext('2d')!
  x.fillStyle = '#fff'
  x.fillRect(0, 0, w, h)
  x.drawImage(img, 0, 0, w, h)
  const webp = c.toDataURL('image/webp', quality)
  // WebPに書けないブラウザはPNGを返すので、その場合はJPEGにする
  return webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/jpeg', quality)
}
