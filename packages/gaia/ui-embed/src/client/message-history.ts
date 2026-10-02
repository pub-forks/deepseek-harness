/** Bounded plain-text recall derived from committed human messages in one session's event window. */
import type { SessionEventLikeEntry, SessionEventSource } from '@deepseek-ai/dsh-api-session-controller/client'
import type { InputHistoryRequest } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SessionSeq } from '@deepseek-ai/dsh-session/types'
import { isAppendSurfaceEvent } from '@deepseek-ai/dsh-session/surface'

/** Security cap on retained complete-message records per mounted composer. */
export const MAX_HISTORY_MESSAGES = 100
/** Security cap on the serialized retained message list, including record metadata. */
export const MAX_HISTORY_BYTES = 512 * 1024

interface HistoryEntry {
  readonly seq: SessionSeq
  readonly text: string
  readonly bytes: number
}

type Listener = (request: InputHistoryRequest) => true | undefined

/**
 * Attach recall to a session binding without creating another persistence store.
 * @param source - committed and transient event window owned by that binding.
 * @param listen - register the session-scoped synchronous history listener.
 * @returns disposer that removes both listeners and releases retained prompts.
 */
export function observeMessageHistory(source: SessionEventSource, listen: (handler: Listener) => () => void): () => void {
  const encoder = new TextEncoder()
  let entries: HistoryEntry[] = []
  let bytes = 2
  let cursor: SessionSeq | undefined
  let disposed = false
  const ingest = (incoming: readonly SessionEventLikeEntry[]): void => {
    for (const entry of incoming) {
      if (entry.type !== 'event') continue
      const event = entry.event
      if (event.type !== 'user/message' || !isAppendSurfaceEvent(event)
        || event.data.source.kind !== 'user' || event.data.content.some(block => block.type !== 'text')) continue
      const text = event.data.content.map(block => block.type === 'text' ? block.text : '').join('')
      if (!text.trim() || entries.some(item => item.seq === event.seq)) continue
      // Measure the complete JSON record; never truncate a single message to fit.
      const recordBytes = encoder.encode(JSON.stringify({ seq: event.seq, text })).length
      if (recordBytes + 2 > MAX_HISTORY_BYTES) continue
      entries.push({ seq: event.seq, text, bytes: recordBytes })
      bytes += recordBytes + 1
      entries.sort((a, b) => a.seq - b.seq)
      // Bound retention during ingestion too, even when the initial window is large.
      while (entries.length > MAX_HISTORY_MESSAGES || bytes - 1 > MAX_HISTORY_BYTES) {
        const removed = entries.shift()
        if (removed === undefined) break
        bytes -= removed.bytes + 1
      }
    }
    if (cursor !== undefined && !entries.some(entry => entry.seq === cursor)) cursor = undefined
  }
  let revision = source.getSnapshot().revision
  ingest(source.getSnapshot().entries)
  const unsubscribe = source.subscribe(() => {
    if (disposed) return
    const snapshot = source.getSnapshot()
    if (snapshot.revision === revision) return
    revision = snapshot.revision
    const change = snapshot.change
    switch (change.kind) {
      case 'replace':
        entries = []
        bytes = 2
        cursor = undefined
        ingest(change.entries)
        break
      case 'append':
      case 'prepend':
        ingest(change.entries)
        break
      case 'settle-assistant':
        // Assistant settlement contributes no human history.
        break
      default: {
        const unexpected: never = change
        throw new Error(`Unexpected message-history delta: ${String(unexpected)}`)
      }
    }
  })
  const unlisten = listen((request) => {
    if (disposed) return undefined
    if (!request.hasCheckpoint) cursor = undefined
    const current = cursor === undefined ? entries.length : entries.findIndex(entry => entry.seq === cursor)
    if (request.direction === 'down') {
      if (!request.hasCheckpoint) return undefined
      const next = entries[current + 1]
      if (next !== undefined) {
        if (!request.replace(next.text, false)) return undefined
        cursor = next.seq
        return true
      }
      if (!request.restore()) return undefined
      cursor = undefined
      return true
    }
    const previous = entries[current - 1]
    if (previous === undefined || !request.replace(previous.text, !request.hasCheckpoint)) return undefined
    cursor = previous.seq
    return true
  })
  return () => {
    disposed = true
    unlisten()
    unsubscribe()
    entries = []
    cursor = undefined
  }
}
