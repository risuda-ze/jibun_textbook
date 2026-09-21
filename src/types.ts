import { z } from 'zod'

export const BlockSchema = z.object({
  id: z.string(),
  type: z.enum(['text', 'image', 'drawing', 'quote', 'checklist']),
  content: z.string(),
  author: z.enum(['AI', '自']),
  notes: z.array(
    z.object({
      id: z.string(),
      type: z.enum(['text', 'image', 'drawing', 'quote', 'url']),
      content: z.string(),
      timestamp: z.number()
    })
  ).default([])
})

export const SectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  goal: z.string(),
  status: z.enum(['未作成', 'AIの下書き', '書き込みあり', '完了']),
  done: z.boolean().default(false),
  review: z.boolean().default(false),
  blocks: z.array(BlockSchema).default([]),
  hints: z.array(z.object({
    query: z.string(),
    sources: z.array(z.object({
      title: z.string(),
      url: z.string()
    }))
  })).default([]),
  checklist: z.array(z.object({
    id: z.string(),
    text: z.string(),
    checked: z.boolean().default(false)
  })).default([]),
  updatedAt: z.number()
})

export const ChapterSchema = z.object({
  id: z.string(),
  title: z.string(),
  sections: z.array(SectionSchema)
})

export const TextbookSchema = z.object({
  id: z.string(),
  title: z.string(),
  goal: z.string(),
  context: z.string(),
  chapters: z.array(ChapterSchema),
  schemaVersion: z.literal(1),
  createdAt: z.number(),
  updatedAt: z.number()
})

export type Block = z.infer<typeof BlockSchema>
export type Section = z.infer<typeof SectionSchema>
export type Chapter = z.infer<typeof ChapterSchema>
export type Textbook = z.infer<typeof TextbookSchema>
