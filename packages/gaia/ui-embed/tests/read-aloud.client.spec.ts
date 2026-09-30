// @vitest-environment jsdom
import { createElement } from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ChatSnapshot } from '@deepseek-ai/dsh-client-ui-chat/client'
import { GaiaReadAloudActions, readableAssistantText, type ReadAloudActionProps } from '../src/client/read-aloud-actions.tsx'
import { isGaiaIncomingMessage, MAX_CHAT_SPEECH_BYTES, type GaiaReadAloudState } from '../src/client/bridge.ts'
import { en } from '../src/client/read-aloud-locales.ts'

const messageId = 'message-1' as ReadAloudActionProps['messageId']
const sessionId = SessionId('session-1')
const snapshot = { legacy: { nodes: [{ kind: 'assistant', seq: 3, time: 10, turn: 1, step: 1, messageId, blocks: [
  { kind: 'reasoning', text: 'private reasoning' }, { kind: 'text', text: '# Hello ' }, { kind: 'text', text: '**world**' },
] }] } } as ChatSnapshot

afterEach(() => { cleanup(); Object.defineProperty(window, 'parent', { value: window, configurable: true }) })

function props(player: GaiaReadAloudState): ReadAloudActionProps {
  // Presentation tests supply only the framework seats read by this entry.
  return { messageId, sessionId, t: (key: keyof typeof en) => en[key],
    useChat: selector => selector(snapshot), useReadAloud: selector => selector(player),
  } as ReadAloudActionProps
}

it('reads only durable assistant prose, refusing absent and oversized responses', () => {
  expect(readableAssistantText(snapshot, messageId)).toBe('# Hello **world**')
  expect(readableAssistantText(snapshot, 'other' as ReadAloudActionProps['messageId'])).toBeNull()
  const assistant = snapshot.legacy.nodes[0]!
  if (assistant.kind !== 'assistant') throw new Error('fixture must be assistant')
  const large = { ...snapshot, legacy: { ...snapshot.legacy, nodes: [{ ...assistant, blocks: [{ kind: 'text' as const, text: 'é'.repeat(MAX_CHAT_SPEECH_BYTES / 2 + 1) }] }] } }
  expect(readableAssistantText(large, messageId)).toBeNull()
})

it('read, stop and settings use the same-origin bridge; disabled output cannot start', () => {
  const postMessage = vi.fn()
  Object.defineProperty(window, 'parent', { value: { postMessage }, configurable: true })
  const idle: GaiaReadAloudState = { enabled: true, status: 'idle', sessionId: null, messageId: null }
  const view = render(createElement(GaiaReadAloudActions, props(idle)))
  expect(view.getAllByRole('button').map(button => ({ label: button.getAttribute('aria-label'), disabled: button.hasAttribute('disabled') }))).toMatchInlineSnapshot(
    `
    [
      {
        "disabled": false,
        "label": "Read aloud",
      },
      {
        "disabled": false,
        "label": "Read-aloud instructions",
      },
    ]
  `,
  )
  fireEvent.click(view.getByRole('button', { name: en.read }))
  expect(postMessage).toHaveBeenLastCalledWith({ source: 'gaia-dsh', v: 1, type: 'readAloud', sessionId, messageId, text: '# Hello **world**' }, window.location.origin)
  fireEvent.click(view.getByRole('button', { name: en.settings }))
  expect(postMessage).toHaveBeenLastCalledWith({ source: 'gaia-dsh', v: 1, type: 'readAloudSettings' }, window.location.origin)
  view.rerender(createElement(GaiaReadAloudActions, props({ ...idle, enabled: false })))
  expect(view.getByRole('button', { name: en.read }).hasAttribute('disabled')).toBe(true)
  view.rerender(createElement(GaiaReadAloudActions, props({ enabled: false, status: 'paused', sessionId, messageId })))
  fireEvent.click(view.getByRole('button', { name: en.stop }))
  expect(postMessage).toHaveBeenLastCalledWith({ source: 'gaia-dsh', v: 1, type: 'stopReadAloud', sessionId, messageId }, window.location.origin)
  postMessage.mockClear(); view.unmount()
  expect(postMessage).toHaveBeenCalledWith({ source: 'gaia-dsh', v: 1, type: 'stopReadAloud', sessionId, messageId }, window.location.origin)
})

it('validates parent playback status and paired bounded message identities', () => {
  const state = { source: 'gaia-dsh', v: 1, type: 'readAloudState', enabled: true, status: 'idle', sessionId: null, messageId: null }
  expect(isGaiaIncomingMessage(state)).toBe(true)
  expect(isGaiaIncomingMessage({ ...state, status: 'speaking', sessionId, messageId })).toBe(true)
  for (const invalid of [{ ...state, status: 'other' }, { ...state, status: ['idle'] }, { ...state, enabled: 1 }, { ...state, sessionId },
    { ...state, status: 'speaking' }, { ...state, messageId: 'bad/id', sessionId }, { ...state, extra: true }]) {
    expect(isGaiaIncomingMessage(invalid)).toBe(false)
  }
})
