import type { SessionEvent } from '@deepseek-ai/dsh-session/types'

/** Join message text blocks in source order without changing their whitespace.
 * @param message - assistant message content.
 * @returns concatenated text blocks.
 */
export function assistantMessageText(message: SessionEvent<'assistant/message'>['data']['message']): string {
  return message.content.flatMap(block => block.type === 'text' ? [block.text] : []).join('')
}
