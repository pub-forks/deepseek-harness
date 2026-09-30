// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { MutableSessionEventSource, type SessionLiveEventEntry } from '@deepseek-ai/dsh-api-session-controller/client'
import { SessionId, SessionSeq, type SessionEvent, type TurnEndReason } from '@deepseek-ai/dsh-session/types'
type LlmAttemptId = Parameters<MutableSessionEventSource['settleAssistant']>[0]
import { observeCompletedAnswers } from '../src/client/auto-read-aloud.ts'
import { MAX_CHAT_SPEECH_BYTES, type GaiaOutgoingMessage } from '../src/client/bridge.ts'

const sessionId = SessionId('session-1')
function start(seq: number, turn: number): SessionLiveEventEntry { return { type: 'event', event: { type: 'turn/start', seq: SessionSeq(seq), time: seq, data: { turn } } } }
function answer(seq: number, turn: number, text: string): { type: 'event'; event: SessionEvent<'assistant/message'> } {
  const event: SessionEvent<'assistant/message'> = { type: 'assistant/message', seq: SessionSeq(seq), time: seq, surfaceOp: 'append', data: {
    turn, step: seq, stream: [], message: { role: 'assistant', id: (`m-${seq}`) as SessionEvent<'assistant/message'>['data']['message']['id'],
      source: { kind: 'model', provider: 'test', model: 'test' }, content: [{ type: 'reasoning', text: 'private reasoning' }, { type: 'text', text }] },
  } }
  return { type: 'event', event }
}
function end(seq: number, turn: number, reason: TurnEndReason = { kind: 'completed' }): SessionLiveEventEntry { return { type: 'event', event: { type: 'turn/end', seq: SessionSeq(seq), time: seq, data: { turn, reason } } } }
function setup() {
  const postMessage = vi.fn<(message: GaiaOutgoingMessage, origin: string) => void>()
  Object.defineProperty(window, 'parent', { value: { postMessage }, configurable: true })
  const source = new MutableSessionEventSource()
  return { source, postMessage, append: (entries: readonly SessionLiveEventEntry[]) => { for (const entry of entries) source.append(entry) }, requests: () => postMessage.mock.calls.filter(call => call[0].type === 'autoReadAloud') }
}
afterEach(() => { Object.defineProperty(window, 'parent', { value: window, configurable: true }) })

it('reads only the finalized successful answer after turn end, never intermediate or reasoning text', () => {
  const view = setup()
  const dispose = observeCompletedAnswers(view.source, sessionId, () => true)
  view.append([start(1, 1), answer(2, 1, 'Working...')])
  expect(view.requests()).toHaveLength(0)
  view.source.settleAssistant('attempt' as LlmAttemptId, answer(3, 1, '# Final **answer**'))
  expect(view.requests()).toHaveLength(0)
  view.append([end(4, 1)])
  expect(view.requests()).toEqual([[{ source: 'gaia-dsh', v: 1, type: 'autoReadAloud', sessionId, messageId: 'm-3', text: '# Final **answer**' }, window.location.origin]])
  view.append([end(4, 1)])
  expect(view.requests()).toHaveLength(1)
  dispose(); expect(view.postMessage).toHaveBeenLastCalledWith({ source: 'gaia-dsh', v: 1, type: 'cancelReadAloudSession', sessionId }, window.location.origin)
  view.append([start(5, 2), answer(6, 2, 'After dispose'), end(7, 2)])
  expect(view.requests()).toHaveLength(1)
})

it('never narrates history, reconnect replacement, prepending, remount or enabling after completion', () => {
  const view = setup(); let enabled = false
  const history = [start(1, 1), answer(2, 1, 'Old answer'), end(3, 1)]
  view.source.replace(history, true)
  let dispose = observeCompletedAnswers(view.source, sessionId, () => enabled)
  enabled = true; view.source.prepend(history, false); view.source.replace(history, false)
  expect(view.requests()).toHaveLength(0)
  view.append([start(4, 2), answer(5, 2, 'Live answer'), end(6, 2)])
  expect(view.requests()).toHaveLength(1)
  dispose(); dispose = observeCompletedAnswers(view.source, sessionId, () => true)
  expect(view.requests()).toHaveLength(1)
  view.source.replace([...history, start(4, 2), answer(5, 2, 'Live answer'), end(6, 2)], false)
  view.append([end(6, 2)])
  expect(view.requests()).toHaveLength(1)
  enabled = false; dispose(); dispose = observeCompletedAnswers(view.source, sessionId, () => enabled)
  view.append([start(7, 3), answer(8, 3, 'Disabled answer'), end(9, 3)])
  enabled = true; expect(view.requests()).toHaveLength(1); dispose()
})

it('skips failed aborted blocked empty interrupted and oversized answers', () => {
  const view = setup(); const dispose = observeCompletedAnswers(view.source, sessionId, () => true)
  const reasons: TurnEndReason[] = [{ kind: 'error', error: { code: 'UNKNOWN', message: 'failed' } }, { kind: 'blocked' }, { kind: 'interrupted' }, { kind: 'aborted', reason: { kind: 'user' } }]
  let seq = 1; let turn = 1
  for (const reason of reasons) { view.append([start(seq++, turn), answer(seq++, turn, 'Do not read'), end(seq++, turn++, reason)]) }
  for (const text of ['', ' ', 'é'.repeat(MAX_CHAT_SPEECH_BYTES / 2 + 1)]) { view.append([start(seq++, turn), answer(seq++, turn, text), end(seq++, turn++)]) }
  view.append([start(seq++, turn)])
  const partial = answer(seq++, turn, 'Partial answer')
  view.source.settleAssistant('partial' as LlmAttemptId, { ...partial, event: { ...partial.event, data: { ...partial.event.data, interrupted: true as const } } })
  view.append([end(seq++, turn)])
  expect(view.requests()).toHaveLength(0); dispose()
})
