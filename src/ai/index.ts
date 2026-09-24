import { DemoProvider } from './demo'
import { AI_MSG } from '../lib/messages'
import { AiError, type AiProvider, type AiSettings } from './types'

/**
 * 接続先アダプタ。画面側はここから得た AiProvider だけを呼ぶ。
 * Anthropic は動的 import で読む。SDK と zod ヘルパーを初回表示のチャンクから外すため（#10）
 */
export async function getProvider(s: AiSettings): Promise<AiProvider> {
  if (s.kind === 'demo') return new DemoProvider()
  if (s.kind === 'anthropic') {
    const { AnthropicProvider } = await import('./anthropic')
    return new AnthropicProvider(s)
  }
  throw new AiError('unsupported', AI_MSG.unsupported)
}

export * from './types'
