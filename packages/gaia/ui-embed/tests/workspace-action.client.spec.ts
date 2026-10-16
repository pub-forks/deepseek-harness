// @vitest-environment jsdom
import { createElement } from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { GaiaWorkspaceAction } from '../src/client/workspace-action.ts'

type Props = Parameters<typeof GaiaWorkspaceAction>[0]
const SESSION = 's1' as SessionId

function props(cwd: string | undefined): Props {
  const state: SessionListState = {
    ids: [SESSION],
    byId: cwd === undefined ? {} : { [SESSION]: { id: SESSION, displayTitle: 'Workspace', cwd, running: false, retainedBy: {}, blank: false, updatedAt: 0 } },
    phase: 'ready',
    projectionsBySession: {},
  }
  function useSessions<T>(select: (snapshot: SessionListState) => T): T {
    return select(state)
  }
  return { sessionId: SESSION, useSessions, t: () => 'Show file location' }
}

describe('Gaia workspace header action', () => {
  afterEach(() => {
    cleanup()
    Object.defineProperty(window, 'parent', { value: window, configurable: true })
  })

  it('asks the Gaia parent to reveal the Session workspace', () => {
    const postMessage = vi.fn()
    Object.defineProperty(window, 'parent', { value: { postMessage }, configurable: true })
    const view = render(createElement(GaiaWorkspaceAction, props('/home/u/project')))

    fireEvent.click(view.getByRole('button', { name: 'Show file location' }))

    expect(postMessage).toHaveBeenCalledWith({
      source: 'gaia-dsh', v: 1, type: 'openFile', action: 'reveal', path: '/home/u/project',
    }, window.location.origin)
  })

  it('renders nothing until the Session workspace is a known absolute path', () => {
    expect(render(createElement(GaiaWorkspaceAction, props(undefined))).container.innerHTML).toBe('')
    expect(render(createElement(GaiaWorkspaceAction, props('relative'))).container.innerHTML).toBe('')
  })
})
