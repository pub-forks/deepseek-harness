import type { InputState, TokenSpan } from '@deepseek-ai/dsh-client-ui-conversation/client'

/** Build a collapsed append span in the editor's detect-text coordinates. */
export function appendDetectSpan(snapshot: Pick<InputState, 'draft' | 'draftRev' | 'occurrences'>): TokenSpan {
  const at = snapshot.draft.length - snapshot.occurrences.reduce((total, occurrence) => total + occurrence.length, 0)
    + snapshot.occurrences.length
  return { start: at, end: at, draftRev: snapshot.draftRev }
}
