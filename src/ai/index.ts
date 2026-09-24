import { AnthropicProvider } from './anthropic'
import { DemoProvider } from './demo'
import { AI_MSG } from '../lib/messages'
import { AiError, type AiProvider, type AiSettings } from './types'

/** 接続先アダプタ。画面側はここから得た AiProvider だけを呼ぶ。 */
export function getProvider(s: AiSettings): AiProvider {
  if (s.kind === 'demo') return new DemoProvider()
  if (s.kind === 'anthropic') return new AnthropicProvider(s)
  throw new AiError('unsupported', AI_MSG.unsupported)
}

export * from './types'
