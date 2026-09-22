import { AnthropicProvider } from './anthropic'
import { DemoProvider } from './demo'
import { AiError, type AiProvider, type AiSettings } from './types'

/** 接続先アダプタ。画面側はここから得た AiProvider だけを呼ぶ。 */
export function getProvider(s: AiSettings): AiProvider {
  if (s.kind === 'demo') return new DemoProvider()
  if (s.kind === 'anthropic') return new AnthropicProvider(s)
  throw new AiError('unsupported', 'この接続先はまだ使用できません（Phase 2で対応予定です）。Anthropic API かデモ応答をお選びください。')
}

export * from './types'
