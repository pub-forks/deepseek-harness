/** Completion-only narration driven by synchronous live event deltas, never by historical message mounts. */
import type { SessionEventLikeEntry, SessionEventSource } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId, SessionEvent } from '@deepseek-ai/dsh-session/types'
import { MAX_CHAT_SPEECH_BYTES, postToParent } from './bridge.ts'

/**
 * Observe successful live turn closure and narrate its final assistant text once.
 * @param source - the current session binding's event window.
 * @param sessionId - owning session identity.
 * @param enabled - latest parent opt-in and output availability.
 * @returns disposal callback; unsubscribes without processing late events.
 */
export function observeCompletedAnswers(source: SessionEventSource, sessionId: SessionId, enabled: () => boolean): () => void {
  let lastRevision = source.getSnapshot().revision
  let lastEndSeq = -1
  let turn: number | undefined
  let answer: { messageId: SessionEvent<'assistant/message'>['data']['message']['id']; text: string } | undefined
  const consume = (entries: readonly SessionEventLikeEntry[], live: boolean): void => {
    for (const entry of entries) {
      if (entry.type !== 'event') continue
      const event = entry.event
      if (event.type === 'turn/start') {
        turn = event.data.turn
        answer = undefined
      } else if (event.type === 'assistant/message') {
        if (turn === undefined) turn = event.data.turn
        if (turn !== event.data.turn) continue
        const text = event.data.message.content.flatMap(block => block.type === 'text' ? [block.text] : []).join('')
        answer = !event.data.interrupted && text.trim() && text.length <= MAX_CHAT_SPEECH_BYTES
          && new TextEncoder().encode(text).length <= MAX_CHAT_SPEECH_BYTES
          ? { messageId: event.data.message.id, text } : undefined
      } else if (event.type === 'turn/end') {
        const fresh = event.seq > lastEndSeq
        lastEndSeq = Math.max(lastEndSeq, event.seq)
        if (live && fresh && event.data.turn === turn && event.data.reason.kind === 'completed' && answer && enabled()) {
          postToParent({ source: 'gaia-dsh', v: 1, type: 'autoReadAloud', sessionId, ...answer })
        }
        turn = undefined
        answer = undefined
      }
    }
  }
  consume(source.getSnapshot().entries, false)
  const unsubscribe = source.subscribe(() => {
    const snapshot = source.getSnapshot()
    if (snapshot.revision === lastRevision) return
    lastRevision = snapshot.revision
    const change = snapshot.change
    if (change.kind === 'replace') {
      turn = undefined
      answer = undefined
      consume(change.entries, false)
    } else if (change.kind === 'append') consume(change.entries, true)
    else if (change.kind === 'settle-assistant' && change.entry) consume([change.entry], true)
    // Prepending old history cannot complete a live request or change its candidate.
  })
  return () => {
    unsubscribe()
    postToParent({ source: 'gaia-dsh', v: 1, type: 'cancelReadAloudSession', sessionId })
  }
}
