import { z } from 'zod'

/** 教科書1冊 = JSON 1ファイル。ここが保存形式の正。APIキーやAI設定は含めない。 */

export const ImageZ = z.object({
  id: z.string(),
  dataUrl: z.string(),
  alt: z.string().default(''),
})

export const BlockZ = z.object({
  id: z.string(),
  /** 書き手。ai = AIの下書き / me = 自分のノート */
  by: z.enum(['ai', 'me']),
  /** 本文。Markdown文字列 */
  md: z.string(),
  /** AIの文を自分で書き換えたか */
  edited: z.boolean().default(false),
  /** 出典URLやメモ */
  source: z.string().default(''),
  /** 本文から引用した文 */
  quote: z.string().default(''),
  images: z.array(ImageZ).default([]),
})

export const LinkZ = z.object({
  title: z.string(),
  url: z.string(),
  fetchedAt: z.string().default(''),
})

export const CluesZ = z.object({
  queries: z.array(z.string()).default([]),
  links: z.array(LinkZ).default([]),
  how: z.array(z.string()).default([]),
})

export const TaskZ = z.object({ text: z.string(), checked: z.boolean().default(false) })

export const LessonZ = z.object({
  id: z.string(),
  title: z.string(),
  minutes: z.number().default(45),
  /** 実践課題の節か */
  isTask: z.boolean().default(false),
  /** 手動の印: 完了 */
  done: z.boolean().default(false),
  /** 手動の印: あとで再確認 */
  review: z.boolean().default(false),
  summary: z.string().default(''),
  tasks: z.array(TaskZ).default([]),
  clues: CluesZ.default({ queries: [], links: [], how: [] }),
  blocks: z.array(BlockZ).default([]),
  /** 生成のときに渡した資料の名前（#63）。本文は持たない */
  materials: z.array(z.string()).default([]),
})

export const ChapterZ = z.object({
  id: z.string(),
  title: z.string(),
  lessons: z.array(LessonZ).default([]),
})

export const InputZ = z.object({
  prompt: z.string().default(''),
  can: z.string().default(''),
  time: z.string().default(''),
  env: z.string().default(''),
})

export const TextbookZ = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  title: z.string(),
  goal: z.string().default(''),
  input: InputZ.default({ prompt: '', can: '', time: '', env: '' }),
  createdAt: z.string(),
  updatedAt: z.string(),
  chapters: z.array(ChapterZ).default([]),
})

/**
 * id の一意性（#36）。章・節・ブロック・画像の id は教科書全体で重ならないこと。
 * 重なると findLesson / updateLesson が最初の1つしか扱えず、片方の編集が反映されない。
 * TextbookZ 自体には付けない（端末内の古いデータを読めなくしないため）。読み込み（parseImport）は
 * TextbookStrictZ で弾き、起動時（store.init）は renumberDuplicateIds で振り直して救済する。
 */
export function findDuplicateIds(tb: Textbook): string[] {
  const seen = new Set<string>()
  const dup = new Set<string>()
  const see = (id: string) => { if (seen.has(id)) dup.add(id); else seen.add(id) }
  see(tb.id)
  for (const c of tb.chapters) {
    see(c.id)
    for (const l of c.lessons) {
      see(l.id)
      for (const b of l.blocks) {
        see(b.id)
        for (const im of b.images) see(im.id)
      }
    }
  }
  return [...dup]
}

/** 重複した id を後ろから振り直す。最初の1つは元のまま。戻り値の count は振り直した数 */
export function renumberDuplicateIds(tb: Textbook): { tb: Textbook; count: number } {
  const seen = new Set<string>()
  let count = 0
  const fix = <T extends { id: string }>(x: T): T => {
    if (seen.has(x.id)) { count++; return { ...x, id: uid() } }
    seen.add(x.id)
    return x
  }
  const out: Textbook = fix({
    ...tb,
    chapters: tb.chapters.map((c) => ({
      ...fix(c),
      lessons: c.lessons.map((l) => ({
        ...fix(l),
        blocks: l.blocks.map((b) => ({ ...fix(b), images: b.images.map(fix) })),
      })),
    })),
  })
  return { tb: out, count }
}

export const TextbookStrictZ = TextbookZ.superRefine((tb, ctx) => {
  const dup = findDuplicateIds(tb)
  if (dup.length) ctx.addIssue({ code: 'custom', path: ['id'], message: `id が重複しています: ${dup.slice(0, 5).join(', ')}${dup.length > 5 ? ' …' : ''}` })
})

export type Image = z.infer<typeof ImageZ>
export type Block = z.infer<typeof BlockZ>
export type Clues = z.infer<typeof CluesZ>
export type Task = z.infer<typeof TaskZ>
export type Lesson = z.infer<typeof LessonZ>
export type Chapter = z.infer<typeof ChapterZ>
export type CourseInput = z.infer<typeof InputZ>
export type Textbook = z.infer<typeof TextbookZ>

/** ノート入力欄の下書き。画面をまたいで保持するが、端末には保存しない（#12） */
export type NoteDraft = { md: string; images: string[]; source: string; quote: string }
export const emptyDraft = (): NoteDraft => ({ md: '', images: [], source: '', quote: '' })
export const isDraftEmpty = (d: NoteDraft): boolean => !d.md.trim() && !d.images.length && !d.source.trim() && !d.quote

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)

export const nowIso = (): string => new Date().toISOString()

export function newBlock(by: Block['by'], md: string, extra: Partial<Block> = {}): Block {
  return { id: uid(), by, md, edited: false, source: '', quote: '', images: [], ...extra }
}

export function newLesson(title: string, extra: Partial<Lesson> = {}): Lesson {
  return {
    id: uid(), title, minutes: 45, isTask: false, done: false, review: false, summary: '',
    tasks: [], clues: { queries: [], links: [], how: [] }, blocks: [], materials: [], ...extra,
  }
}

export function newChapter(title: string, lessons: Lesson[] = []): Chapter {
  return { id: uid(), title, lessons }
}

export function newTextbook(title: string, extra: Partial<Textbook> = {}): Textbook {
  const t = nowIso()
  return {
    schemaVersion: 1, id: uid(), title, goal: '', input: { prompt: '', can: '', time: '', env: '' },
    createdAt: t, updatedAt: t, chapters: [], ...extra,
  }
}
