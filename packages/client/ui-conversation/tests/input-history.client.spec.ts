// @vitest-environment jsdom
import { Context } from '@deepseek-ai/cordis'
import { expect, it, onTestFinished, vi } from 'vitest'
import { $getRoot, $getSelection, $isRangeSelection, HISTORY_PUSH_TAG, KEY_ARROW_UP_COMMAND, UNDO_COMMAND, REDO_COMMAND } from 'lexical'
import type { EditorState } from 'lexical'
import type { DraftAttachmentId, InputHistoryRequest } from '../src/client/contract/input.ts'
import { SessionInputShell } from '../src/client/input/facade.ts'

function bench(draft = 'unsent\nsecond line', provider = true) {
  const ctx = new Context()
  const shell = new SessionInputShell({ actx: ctx, defaultSink: async () => ({ kind: 'success' }),
    commandAttachments: { serialize: async () => [], release: () => {}, unsupportedNotice: token => token },
  })
  const listener = vi.fn((request: InputHistoryRequest) => {
    const applied = request.direction === 'up' ? request.replace('recalled\nmessage', !request.hasCheckpoint) : request.restore()
    return applied ? true as const : undefined
  })
  if (provider) {
    const dispose = ctx.on('conversation/input-history', listener)
    onTestFinished(() => { dispose() })
  }
  shell.setDraft(draft)
  const start = () => shell.editor.update(() => { $getRoot().selectStart() }, { discrete: true })
  const end = () => shell.editor.update(() => { $getRoot().selectEnd() }, { discrete: true })
  onTestFinished(() => { shell.dispose() })
  return { ctx, shell, listener, start, end }
}

function selectionOf(state: EditorState) {
  return state.read(() => {
    const selection = $getSelection()
    return $isRangeSelection(selection) ? {
      anchor: { key: selection.anchor.key, offset: selection.anchor.offset, type: selection.anchor.type },
      focus: { key: selection.focus.key, offset: selection.focus.offset, type: selection.focus.type },
    } : null
  })
}

it('leaves arrows native without a provider, away from edges, or with a range selection', () => {
  const native = bench('draft', false)
  native.start(); expect(native.shell.navigateHistory('up')).toBe(false)
  const b = bench()
  expect(b.shell.navigateHistory('up')).toBe(false)
  b.shell.editor.update(() => { $getRoot().getAllTextNodes()[0]!.select(1, 1) }, { discrete: true })
  expect(b.shell.navigateHistory('up')).toBe(false)
  b.shell.editor.update(() => { $getRoot().getAllTextNodes()[0]!.select(0, 2) }, { discrete: true })
  expect(b.shell.navigateHistory('up')).toBe(false)
  expect(b.listener).not.toHaveBeenCalled()
})

it('restores exact editor structure, whitespace, formatting and selection after reversing traversal', () => {
  const b = bench('  draft  \n\n second ')
  b.shell.editor.update(() => { $getRoot().getAllTextNodes()[0]!.setFormat('bold'); $getRoot().selectStart() }, { discrete: true })
  const original = b.shell.editor.getEditorState()
  expect(b.shell.navigateHistory('up')).toBe(true)
  expect(b.shell.snapshot.draft).toBe('recalled\nmessage')
  expect(b.shell.navigateHistory('down')).toBe(true)
  const restored = b.shell.editor.getEditorState()
  expect(restored.toJSON()).toEqual(original.toJSON())
  expect(selectionOf(restored)).toEqual(selectionOf(original))
  expect(b.shell.snapshot.draft).toBe('  draft  \n\n second ')
})

it('uses live nested-command selection and rejects content edits still in progress', () => {
  const b = bench('draft')
  b.start()
  b.shell.editor.update(() => {
    $getRoot().getAllTextNodes()[0]!.select(2, 2)
    expect(b.shell.navigateHistory('up')).toBe(false)
  }, { discrete: true })
  b.shell.editor.update(() => {
    $getRoot().getAllTextNodes()[0]!.select(0, 1)
    expect(b.shell.navigateHistory('up')).toBe(false)
  }, { discrete: true })
  b.shell.editor.update(() => {
    $getRoot().getAllTextNodes()[0]!.setTextContent('changed')
    $getRoot().selectStart()
    expect(b.shell.navigateHistory('up')).toBe(false)
  }, { discrete: true })
  const original = b.shell.editor.getEditorState()
  b.end()
  b.shell.editor.update(() => {
    $getRoot().selectStart()
    expect(b.shell.navigateHistory('up')).toBe(true)
  }, { discrete: true })
  expect(b.shell.navigateHistory('down')).toBe(true)
  expect(b.shell.editor.getEditorState().toJSON()).toEqual(original.toJSON())
  b.shell.editor.getEditorState().read(() => {
    const selection = $getSelection()
    expect($isRangeSelection(selection) && selection.anchor.offset).toBe(0)
  })
})

it('exits traversal on content edits but retains it through selection-only commits', () => {
  const b = bench()
  b.start(); b.shell.navigateHistory('up')
  b.end(); expect(b.shell.navigateHistory('down')).toBe(true)
  b.start(); b.shell.navigateHistory('up')
  b.shell.setDraft('new edit')
  b.end(); expect(b.shell.navigateHistory('down')).toBe(false)
  expect(b.shell.snapshot.draft).toBe('new edit')
  b.start(); b.shell.navigateHistory('up')
  expect(b.listener.mock.calls.at(-1)?.[0].hasCheckpoint).toBe(false)
  b.shell.navigateHistory('down'); expect(b.shell.snapshot.draft).toBe('new edit')
})

it('expires callbacks synchronously and rejects callbacks after revision changes', () => {
  const b = bench('draft', false)
  let saved: InputHistoryRequest | undefined
  const disposeSave = b.ctx.on('conversation/input-history', request => { saved = request; return undefined })
  onTestFinished(() => { disposeSave() })
  b.start(); expect(b.shell.navigateHistory('up')).toBe(false)
  expect(saved!.replace('late', true)).toBe(false)
  expect(saved!.restore()).toBe(false)
  const disposeEdit = b.ctx.on('conversation/input-history', request => {
    b.shell.setDraft('external edit')
    expect(request.replace('stale', true)).toBe(false)
    return undefined
  })
  onTestFinished(() => { disposeEdit() })
  b.start(); expect(b.shell.navigateHistory('up')).toBe(false)
  expect(b.shell.snapshot.draft).toBe('external edit')
})

it('refuses recall for attachments, read-only editors, or a disposed shell', () => {
  const b = bench()
  b.start(); b.shell.addAttachments(['image-1' as DraftAttachmentId])
  expect(b.shell.navigateHistory('up')).toBe(false)
  const locked = bench()
  locked.start(); locked.shell.editor.setEditable(false)
  expect(locked.shell.navigateHistory('up')).toBe(false)
  const disposed = bench()
  disposed.start(); disposed.shell.dispose()
  expect(disposed.shell.navigateHistory('up')).toBe(false)
  expect(b.listener).not.toHaveBeenCalled(); expect(locked.listener).not.toHaveBeenCalled()
})

it('keeps recall snapshots out of undo history across repeated cycles and preserves user undo/redo', async () => {
  const b = bench('before edit')
  b.shell.editor.update(() => { $getRoot().getAllTextNodes()[0]!.setTextContent('after edit'); $getRoot().selectStart() }, { discrete: true, tag: HISTORY_PUSH_TAG })
  for (let index = 0; index < 30; index++) {
    expect(b.shell.navigateHistory('up')).toBe(true)
    expect(b.shell.navigateHistory('down')).toBe(true)
  }
  b.shell.editor.dispatchCommand(UNDO_COMMAND, undefined)
  await Promise.resolve()
  expect(b.shell.snapshot.draft).toBe('before edit')
  b.shell.editor.dispatchCommand(REDO_COMMAND, undefined)
  await Promise.resolve()
  expect(b.shell.snapshot.draft).toBe('after edit')
  // Native Lexical dispatch remains available when no custom keymap is mounted.
  expect(b.shell.editor.dispatchCommand(KEY_ARROW_UP_COMMAND, new KeyboardEvent('keydown', { key: 'ArrowUp' }))).toBe(false)
})
