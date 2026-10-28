import { Context } from '@deepseek-ai/cordis'
import { expect, it, vi } from 'vitest'
import { SessionInputShell } from '../../../client/ui-conversation/src/client/input/facade.ts'
import { appendDetectSpan } from '../src/client/append-detect-span.ts'

function createInput(): SessionInputShell {
  return new SessionInputShell({ actx: new Context(), defaultSink: vi.fn(), commandAttachments: {
    serialize: async () => [], release: () => {}, unsupportedNotice: () => '',
  } })
}

it.each(['insertText', 'targetedInsertText'] as const)('appends dictation through %s after a reference chip and following text', (handler) => {
  const input = createInput()
  try {
    input.setDraft('@ref trailing plain text')
    input.insertReference({
      source: 'file', ref: 'src/main.ts', label: 'main.ts', appearance: 'file',
      clipboardText: '@[main.ts](src/main.ts)',
    }, { start: 0, end: 4, draftRev: input.state.getSnapshot().draftRev })

    const snapshot = input.state.getSnapshot()
    const legacyDraftCoordinateSpan = { start: snapshot.draft.length, end: snapshot.draft.length, draftRev: snapshot.draftRev }
    expect(input.insertText(' dictated', legacyDraftCoordinateSpan)).toBe(false)

    const span = appendDetectSpan(snapshot)
    const applied = handler === 'insertText'
      ? input.insertText(' dictated', span)
      : input.actions.insertText(' dictated', span)
    expect(applied).toBe(true)
    expect(input.state.getSnapshot().draft).toBe('@[main.ts](src/main.ts) trailing plain text dictated')
    expect(input.state.getSnapshot().occurrences).toHaveLength(1)
  } finally {
    input.dispose()
  }
})

it.each([
  { name: 'empty', draft: '', expectedDetectLength: 0 },
  { name: 'text-only', draft: 'plain text', expectedDetectLength: 10 },
] as const)('keeps append coordinates for $name drafts', ({ draft, expectedDetectLength }) => {
  const input = createInput()
  try {
    input.setDraft(draft)
    const span = appendDetectSpan(input.state.getSnapshot())
    expect(span).toMatchObject({ start: expectedDetectLength, end: expectedDetectLength })
    expect(input.insertText(' dictated', span)).toBe(true)
    expect(input.state.getSnapshot().draft).toBe(`${draft} dictated`)
  } finally {
    input.dispose()
  }
})
