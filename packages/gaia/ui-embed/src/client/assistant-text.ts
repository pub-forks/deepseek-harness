import type { SessionEvent } from '@deepseek-ai/dsh-session/types'

/** Join only text blocks, preserving their original order and whitespace. */
export function assistantMessageText(message: SessionEvent<'assistant/message'>['data']['message']): string {
  return message.content.flatMap(block => block.type === 'text' ? [block.text] : []).join('')
}
