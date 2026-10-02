import { expect, it, onTestFinished, vi } from 'vitest'
import { MutableSessionEventSource, type SessionEventLikeEntry, type SessionEventSource } from '@deepseek-ai/dsh-api-session-controller/client'
import type { InputHistoryRequest } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { MAX_HISTORY_BYTES, MAX_HISTORY_MESSAGES, observeMessageHistory } from '../src/client/message-history.ts'
import { historyMessage as message } from './message-history-fixtures.client.ts'

function bench(initial: readonly SessionEventLikeEntry[] = [], override?: (source: MutableSessionEventSource) => SessionEventSource) {
  const source = new MutableSessionEventSource()
  source.replace(initial, false)
  let listener: ((request: InputHistoryRequest) => true | undefined) | undefined
  let hasCheckpoint = false
  let text = 'unsent draft'
  let revision = 0
  const replace = vi.fn((next: string, _fresh: boolean) => { text = next; hasCheckpoint = true; revision++; return true })
  const restore = vi.fn(() => { text = 'unsent draft'; hasCheckpoint = false; revision++; return true })
  const unlisten = vi.fn(() => { listener = undefined })
  const dispose = observeMessageHistory(override?.(source) ?? source, handle => { listener = handle; return unlisten })
  onTestFinished(dispose)
  const request = (direction: 'up' | 'down'): InputHistoryRequest => ({ direction, draftRev: revision, hasCheckpoint, replace, restore })
  return { source, replace, restore, dispose, unlisten, request,
    handler: () => listener!, text: () => text, navigate: (direction: 'up' | 'down') => listener?.(request(direction)),
    edit: () => { text = 'new edit'; hasCheckpoint = false; revision++ },
  }
}

it('recalls complete committed blocks newest first and restores the unsent draft', () => {
  const first = message(1, 'old')
  const latest = message(2, '', { content: [{ type: 'text', text: 'first block' }, { type: 'text', text: '\nsecond block' }] })
  const b = bench([first, latest])
  expect(b.navigate('down')).toBeUndefined()
  expect(b.navigate('up')).toBe(true)
  expect(b.text()).toBe('first block\nsecond block')
  expect(b.navigate('up')).toBe(true)
  expect(b.text()).toBe('old')
  expect(b.navigate('up')).toBeUndefined()
  expect(b.navigate('down')).toBe(true)
  expect(b.text()).toBe('first block\nsecond block')
  expect(b.navigate('down')).toBe(true)
  expect(b.text()).toBe('unsent draft')
  expect(b.replace.mock.calls.map(call => call[1])).toEqual([true, false, false])
})

it('ignores injected, replacement, non-surface, empty, assistant and mixed attachment messages', () => {
  const injected = message(2, 'injected', { source: { kind: 'model', provider: 'test', model: 'test' } })
  const replacement = message(3, 'replacement', {}, { op: 'replace', startSeq: message(1, '').event.seq, endSeq: message(1, '').event.seq })
  const mixed = message(5, '', { content: [{ type: 'text', text: 'mixed' }, { type: 'reasoning', text: 'not plain text' }] })
  const b = bench([message(1, 'only human'), injected, replacement, mixed, message(6, ' \n')])
  b.source.append({ type: 'event', event: { type: 'turn/start', seq: message(7, '').event.seq, time: 7, data: { turn: 1 } } })
  expect(b.navigate('up')).toBe(true)
  expect(b.text()).toBe('only human')
  expect(b.navigate('up')).toBeUndefined()
})

it('keeps the selected message identity across prepend and append, deduplicates and restarts after editing', () => {
  const b = bench([message(4, 'four'), message(6, 'six')])
  b.navigate('up')
  b.source.prepend([message(1, 'one'), message(2, 'two'), message(4, 'duplicate')], false)
  b.source.append(message(8, 'eight'))
  b.navigate('up'); expect(b.text()).toBe('four')
  b.navigate('up'); expect(b.text()).toBe('two')
  b.navigate('down'); expect(b.text()).toBe('four')
  b.edit()
  b.navigate('up'); expect(b.text()).toBe('eight')
  expect(b.replace).toHaveBeenLastCalledWith('eight', true)
})

it('rebuilds replacement windows and restores before restarting from a removed selection', () => {
  const b = bench([message(1, 'old')])
  b.navigate('up')
  b.source.replace([message(2, 'new')], false)
  b.navigate('down'); expect(b.text()).toBe('unsent draft')
  b.navigate('up'); expect(b.text()).toBe('new')
  b.source.replace([], false)
  b.navigate('down'); expect(b.text()).toBe('unsent draft')
  expect(b.navigate('up')).toBeUndefined()
})

it('does not advance its cursor when replacement or restoration is declined', () => {
  const b = bench([message(1, 'first'), message(2, 'last')])
  b.replace.mockReturnValueOnce(false)
  expect(b.navigate('up')).toBeUndefined()
  b.navigate('up'); expect(b.text()).toBe('last')
  b.restore.mockReturnValueOnce(false)
  expect(b.navigate('down')).toBeUndefined()
  expect(b.navigate('down')).toBe(true)
  expect(b.text()).toBe('unsent draft')
})

it('bounds counts including initial windows and discards oversized messages without truncation', () => {
  const b = bench(Array.from({ length: MAX_HISTORY_MESSAGES + 4 }, (_, index) => message(index + 1, `text-${index + 1}`)))
  b.source.append(message(MAX_HISTORY_MESSAGES + 5, 'é'.repeat(MAX_HISTORY_BYTES)))
  const recalled: string[] = []
  while (b.navigate('up')) recalled.push(b.text())
  expect(recalled).toHaveLength(MAX_HISTORY_MESSAGES)
  expect(recalled[0]).toBe(`text-${MAX_HISTORY_MESSAGES + 4}`)
  expect(recalled.at(-1)).toBe('text-5')
})

it('enforces complete UTF-8 JSON-record byte limits exactly and evicts oldest records', () => {
  const metadataBytes = new TextEncoder().encode(JSON.stringify({ seq: 1, text: '' })).length + 2
  const exact = 'a'.repeat(MAX_HISTORY_BYTES - metadataBytes)
  const b = bench([message(1, exact)])
  b.navigate('up'); expect(b.text()).toBe(exact)
  b.source.append(message(2, 'next'))
  b.edit(); b.navigate('up'); expect(b.text()).toBe('next')
  expect(b.navigate('up')).toBeUndefined()
  const oversized = bench([message(1, exact + 'é')])
  expect(oversized.navigate('up')).toBeUndefined()
  const multibyte = 'é'.repeat(Math.floor((MAX_HISTORY_BYTES - metadataBytes) / 2))
  const utf8 = bench([message(1, multibyte), message(2, 'last')])
  utf8.navigate('up'); expect(utf8.text()).toBe('last')
  expect(utf8.navigate('up')).toBeUndefined()
})

it('never scans the full event window on incremental publication', () => {
  const b = bench([message(1, 'first')], source => ({
    subscribe: listener => source.subscribe(listener),
    getSnapshot: () => {
      const snapshot = source.getSnapshot()
      return { ...snapshot, get entries() {
        if (snapshot.change.kind === 'append') throw new Error('append must use its delta')
        return snapshot.entries
      } }
    },
  }))
  b.source.append(message(2, 'last'))
  b.navigate('up'); expect(b.text()).toBe('last')
})

it('isolates sessions and removes subscriptions and stale callbacks on disposal', () => {
  const first = bench([message(1, 'session one')])
  const second = bench([message(1, 'session two')])
  first.navigate('up'); second.navigate('up')
  expect(first.text()).toBe('session one'); expect(second.text()).toBe('session two')
  const oldHandler = first.handler()
  first.dispose()
  expect(first.unlisten).toHaveBeenCalledTimes(1)
  first.source.append(message(2, 'after disposal'))
  expect(oldHandler(first.request('up'))).toBeUndefined()
  second.source.append(message(2, 'still active'))
  second.navigate('down'); expect(second.text()).toBe('still active')
})
