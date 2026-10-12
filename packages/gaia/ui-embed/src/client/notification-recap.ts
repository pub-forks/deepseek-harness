import type { SessionEventLikeEntry } from '@deepseek-ai/dsh-api-session-controller/client'
import { assistantMessageText } from './assistant-text.ts'
import { MAX_HARNESS_RECAP_LENGTH } from './bridge.ts'

/** Read the final non-interrupted answer before this turn's end; omit empty text. */
export function notificationRecap(entries: readonly SessionEventLikeEntry[], endIndex: number, turn: number): string | undefined {
  for (let i = endIndex - 1; i >= 0; i--) {
    const entry = entries[i]
    if (entry?.type !== 'event') continue
    const event = entry.event
    if (event.type !== 'assistant/message' || event.data.turn !== turn || event.data.interrupted) continue
    const text = assistantMessageText(event.data.message)
      .replace(/[\x00-\x08\x0B-\x1F\x7F-\x9F]/g, '')
      .trim().slice(0, MAX_HARNESS_RECAP_LENGTH)
    return text || undefined
  }
  return undefined
}
