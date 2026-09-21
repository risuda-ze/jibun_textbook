import Anthropic from '@anthropic-ai/sdk'
import { zodResponseFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'

let client: Anthropic | null = null

export function setAPIKey(key: string) {
  client = new Anthropic({
    apiKey: key,
    dangerouslyAllowBrowser: true
  })
}

export function hasAPIKey(): boolean {
  return client !== null
}

export async function askConfirmation(
  learning: string,
  current: string,
  time: string,
  tools: string
): Promise<string[]> {
  if (!client) throw new Error('API key not set')

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `ユーザーが以下について学びたいと言っています。2〜3個の確認質問を日本語で返してください。
学びたいこと: ${learning}
今できること: ${current}
使える時間・期限: ${time}
道具・環境: ${tools}`
      }
    ]
  })

  const text = message.content.find(b => b.type === 'text')?.text || ''
  return text.split('\n').filter(q => q.trim().length > 0)
}

const CourseDesignSchema = z.object({
  chapters: z.array(
    z.object({
      title: z.string(),
      sections: z.array(
        z.object({
          title: z.string(),
          goal: z.string(),
          estimatedTime: z.number()
        })
      )
    })
  ),
  practiceExercises: z.array(z.string())
})

export async function designCourse(
  learning: string,
  current: string,
  time: string,
  tools: string,
  answers: string
): Promise<z.infer<typeof CourseDesignSchema>> {
  if (!client) throw new Error('API key not set')

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `以下の情報に基づいて、学習コースを設計してください。

学びたいこと: ${learning}
今できること: ${current}
使える時間・期限: ${time}
道具・環境: ${tools}
ユーザーの質問への回答: ${answers}

JSON形式で章・節・所要時間・実践課題を返してください。`
      }
    ]
  })

  const text = message.content.find(b => b.type === 'text')?.text || '{}'
  try {
    return CourseDesignSchema.parse(JSON.parse(text))
  } catch {
    return { chapters: [], practiceExercises: [] }
  }
}
