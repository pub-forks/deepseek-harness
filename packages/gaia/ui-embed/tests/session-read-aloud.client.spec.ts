// @vitest-environment jsdom
import { createElement } from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { SessionNodeItem, SearchResultItem } from '@deepseek-ai/dsh-client-ui-workspace/src/client/rows/Rows.tsx'
import type { SessionNode, SearchResultNode } from '@deepseek-ai/dsh-client-ui-workspace/src/client/tree.ts'
import { GaiaSessionReadAloud, type SessionReadAloudProps } from '../src/client/session-read-aloud.tsx'
import type { GaiaReadAloudState } from '../src/client/bridge.ts'
import { en } from '../src/client/read-aloud-locales.ts'

afterEach(cleanup)

const sessionId = SessionId('session-1')
const idle: GaiaReadAloudState = { enabled: true, status: 'idle', sessionId: null, messageId: null }
const active = { ...idle, sessionId, messageId: 'message-1' }

function props(player: GaiaReadAloudState, rowId = sessionId): SessionReadAloudProps {
  return {
    sessionId: rowId, t: (key: keyof typeof en) => en[key],
    useReadAloud: selector => selector(player),
  } as SessionReadAloudProps
}

test('marks only the reading session, pulses only during speech, and removes the icon on stop', () => {
  const view = render(createElement(GaiaSessionReadAloud, props(idle)))
  expect(view.queryByRole('img', { name: en.reading })).toBeNull()
  for (const status of ['preparing', 'loading', 'speaking', 'paused'] as const) {
    view.rerender(createElement(GaiaSessionReadAloud, props({ ...active, status })))
    const icon = view.getByRole('img', { name: 'Reading aloud' })
    expect(icon.hasAttribute('data-playing')).toBe(status === 'speaking')
    expect(icon.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    view.rerender(createElement(GaiaSessionReadAloud, props({ ...active, status }, SessionId('session-2'))))
    expect(view.queryByRole('img', { name: en.reading })).toBeNull()
  }
  // Disabling new narration does not hide playback that is already paused.
  view.rerender(createElement(GaiaSessionReadAloud, props({ ...active, enabled: false, status: 'paused' })))
  expect(view.getByRole('img', { name: en.reading })).toBeTruthy()
  view.rerender(createElement(GaiaSessionReadAloud, props(idle)))
  expect(view.queryByRole('img', { name: en.reading })).toBeNull()
})

test('catalog and search rows keep narration visible during activity, unread status and archive', () => {
  const node: SessionNode = {
    id: sessionId, title: 'Session one', blank: false, running: false, runningSubagentCount: 0,
    completed: false, updatedAt: 0, pinned: false, archived: false,
  }
  let player: GaiaReadAloudState = { ...active, status: 'speaking' }
  const renderSlot: Parameters<typeof SessionNodeItem>[0]['renderSlot'] = (name: string, owner: object) => {
    if (name !== 'sidebar.session.row.decoration' || !('sessionId' in owner) || typeof owner.sessionId !== 'string') return null
    return createElement(GaiaSessionReadAloud, props(player, SessionId(owner.sessionId)))
  }
  // Other seats are empty in this row fixture; the decoration gets its real owner identity.
  const renderRowSlot: Parameters<typeof SessionNodeItem>[0]['renderSlot'] = renderSlot
  const rowProps = {
    currentId: undefined, now: 0, onOpen: vi.fn(), onRenameRequest: vi.fn(), t: (key: string) => key, renderSlot: renderRowSlot,
  }
  const view = render(createElement(SessionNodeItem, { ...rowProps, node }))
  for (const state of [{}, { running: true }, { completed: true }, { archived: true }]) {
    view.rerender(createElement(SessionNodeItem, { ...rowProps, node: { ...node, ...state } }))
    expect(view.getByRole('treeitem').contains(view.getByRole('img', { name: en.reading }))).toBe(true)
  }
  const result: SearchResultNode = { ...node, workspace: 'Workspace', archived: true }
  const searchProps = { result, currentId: undefined, onOpen: vi.fn(), onUnarchive: vi.fn(), t: (key: string) => key, renderSlot }
  view.rerender(createElement(SearchResultItem, searchProps))
  expect(view.getByRole('img', { name: en.reading })).toBeTruthy()
  player = { ...active, status: 'speaking', sessionId: SessionId('session-2') }
  view.rerender(createElement(SearchResultItem, searchProps))
  expect(view.queryByRole('img', { name: en.reading })).toBeNull()
})
