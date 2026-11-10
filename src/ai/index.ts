import { DemoProvider } from './demo'
import type { AiProvider, AiSettings } from './types'

/**
 * 接続先アダプタ。画面側はここから得た AiProvider だけを呼ぶ。
 * Anthropic は動的 import で読む。SDK と zod ヘルパーを初回表示のチャンクから外すため（#10）
 */
export async function getProvider(s: AiSettings): Promise<AiProvider> {
  if (s.kind === 'demo') return new DemoProvider()
  const { AnthropicProvider } = await import('./anthropic')
  return new AnthropicProvider(s)
}
