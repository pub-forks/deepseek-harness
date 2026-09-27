// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ThemeSnapshot } from '@deepseek-ai/dsh-client-ui-theme/client'
import {
  apply,
  inject,
  isGaiaIncomingMessage,
  isValidSessionId,
  GAIA_EMBED_STYLE_ID,
  type GaiaOutgoingMessage,
} from '../src/client/index.ts'

describe('isValidSessionId', () => {
  it('accepts valid session identifiers', () => {
    expect(isValidSessionId('session-1')).toBe(true)
    expect(isValidSessionId('abc_123-XYZ')).toBe(true)
    expect(isValidSessionId('a'.repeat(128))).toBe(true)
  })

  it('rejects invalid or unsafe session identifiers', () => {
    expect(isValidSessionId('')).toBe(false)
    expect(isValidSessionId('with/slash')).toBe(false)
    expect(isValidSessionId('with space')).toBe(false)
    expect(isValidSessionId('with.dot')).toBe(false)
    expect(isValidSessionId('a'.repeat(129))).toBe(false)
  })
})

describe('isGaiaIncomingMessage', () => {
  it('validates theme messages', () => {
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'theme', mode: 'light' })).toBe(true)
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'theme', mode: 'dark' })).toBe(true)
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'theme', mode: 'blue' })).toBe(false)
  })

  it('validates focus and clear messages', () => {
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'focus' })).toBe(true)
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'clear' })).toBe(true)
  })

  it('validates insertText messages with length bounds', () => {
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'insertText', text: 'Hello' })).toBe(true)
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'insertText', text: 'a'.repeat(8192) })).toBe(true)
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'insertText', text: 'a'.repeat(8193) })).toBe(false)
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'insertText', text: 123 })).toBe(false)
  })

  it('validates resumeSessions messages with session rows and errors', () => {
    const validRow = { sessionId: 's-123', title: 'My session', archived: false, open: true, updatedAt: 1000 }
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'resumeSessions', reqId: 'req-1', sessions: [validRow] })).toBe(true)
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'resumeSessions', reqId: 'req-1', sessions: [] })).toBe(true)
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'resumeSessions', reqId: 'req-1', error: 'failed to load' })).toBe(true)

    // Invalid reqId
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'resumeSessions', reqId: '', sessions: [] })).toBe(false)
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'resumeSessions', reqId: 'a'.repeat(65), sessions: [] })).toBe(false)
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'resumeSessions', reqId: 123, sessions: [] })).toBe(false)

    // Invalid error
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'resumeSessions', reqId: 'req-1', error: 'a'.repeat(513) })).toBe(false)
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'resumeSessions', reqId: 'req-1', error: 'err', sessions: [] })).toBe(false)

    // Invalid sessions
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'resumeSessions', reqId: 'req-1', sessions: 'not-array' })).toBe(false)
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'resumeSessions', reqId: 'req-1', sessions: new Array(501).fill(validRow) })).toBe(false)
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'resumeSessions', reqId: 'req-1', sessions: [{ ...validRow, sessionId: 'bad/id!' }] })).toBe(false)
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'resumeSessions', reqId: 'req-1', sessions: [{ ...validRow, title: 'a'.repeat(513) }] })).toBe(false)
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'resumeSessions', reqId: 'req-1', sessions: [{ ...validRow, archived: 'yes' }] })).toBe(false)
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'resumeSessions', reqId: 'req-1', sessions: [{ ...validRow, open: 1 }] })).toBe(false)
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'resumeSessions', reqId: 'req-1', sessions: [{ ...validRow, updatedAt: {} }] })).toBe(false)
  })

  it('rejects unrecognized or malformed payloads', () => {
    expect(isGaiaIncomingMessage(null)).toBe(false)
    expect(isGaiaIncomingMessage({})).toBe(false)
    expect(isGaiaIncomingMessage({ source: 'other', v: 1, type: 'focus' })).toBe(false)
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 2, type: 'focus' })).toBe(false)
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'unknown' })).toBe(false)
  })
})

describe('ui-embed client plugin', () => {
  let originalLocation: Location
  let parentMessages: GaiaOutgoingMessage[]
  let fakeParent: Window

  const setLocationSearch = (search: string) => {
    Object.defineProperty(window, 'location', {
      value: new URL(`http://localhost:3000/${search}`),
      writable: true,
      configurable: true,
    })
  }

  beforeEach(() => {
    parentMessages = []
    originalLocation = window.location
    setLocationSearch('')

    fakeParent = {
      postMessage: vi.fn((msg: GaiaOutgoingMessage, origin: string) => {
        if (origin === window.location.origin) {
          parentMessages.push(msg)
        }
      }),
    } as unknown as Window

    Object.defineProperty(window, 'parent', {
      value: fakeParent,
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    })
    document.documentElement.removeAttribute('data-gaia-embed')
    document.getElementById(GAIA_EMBED_STYLE_ID)?.remove()
    vi.restoreAllMocks()
  })

  function createMockContext() {
    const ctx = new Context()

    let connectionState: 'connected' | 'connecting' | 'disconnected' = 'connected'
    const connectionListeners = new Set<() => void>()

    const toggleSidebarSpy = vi.fn()
    const openRightbarSpy = vi.fn()
    const layout = {
      selectPanel: vi.fn(),
      closeRightbar: vi.fn(),
      toggleSidebar: toggleSidebarSpy,
      openRightbar: openRightbarSpy,
      beginNavigation: vi.fn(() => new AbortController().signal),
      panelInfo: { getSnapshot: () => ({ current: null }), subscribe: () => () => {} },
    }
    ctx.provide('layout', layout)

    const uiWorkspace = {
      openSession: vi.fn(),
    }
    ctx.provide('uiWorkspace', uiWorkspace)

    const connection = {
      state: {
        getSnapshot: () => connectionState,
        subscribe: (fn: () => void) => {
          connectionListeners.add(fn)
          return () => connectionListeners.delete(fn)
        },
      },
    }
    ctx.provide('connection', connection)

    let sessionStatusSnapshot = new Map<SessionId, { running: boolean }>()
    const sessionStatusListeners = new Set<() => void>()
    const uiSession = {
      sessionStatus: {
        getSnapshot: () => sessionStatusSnapshot,
        subscribe: (fn: () => void) => {
          sessionStatusListeners.add(fn)
          return () => sessionStatusListeners.delete(fn)
        },
      },
    }
    ctx.provide('uiSession', uiSession)

    let listSnapshot: { phase: string; byId: Record<string, { id: SessionId; title?: string; displayTitle: string }> } = {
      phase: 'ready',
      byId: {},
    }
    const listListeners = new Set<() => void>()

    const sessionCtx = new Context()
    const focusSpy = vi.fn()
    let draftValue = 'existing draft'
    let draftRevValue = 2
    let insertTextShouldSucceed = true

    const insertTextSpy = vi.fn((req: { text: string; span: { start: number; end: number; draftRev: number } }) => {
      if (!insertTextShouldSucceed) return undefined
      draftValue += req.text
      draftRevValue += 1
      return true
    })
    sessionCtx.on('slash/input-insert-text', insertTextSpy)

    const sessionInput = {
      focus: focusSpy,
      state: {
        getSnapshot: () => ({
          draft: draftValue,
          draftRev: draftRevValue,
        }),
      },
    }

    const conversation = {
      input: {
        for: vi.fn(() => sessionInput),
      },
    }
    sessionCtx.provide('conversation', conversation)

    const sessions = {
      list: {
        getSnapshot: () => listSnapshot,
        subscribe: (fn: () => void) => {
          listListeners.add(fn)
          return () => listListeners.delete(fn)
        },
      },
      scope: vi.fn((_id: SessionId) => sessionCtx),
    }
    ctx.provide('sessions', sessions)

    const registeredThemes: Array<{ id: string; colorScheme: string }> = []
    const disposePaletteSpy = vi.fn()
    const disposeDarkSpy = vi.fn()
    const disposeLightSpy = vi.fn()
    let currentTheme = 'system'
    const theme = {
      register: vi.fn((def: { id: string; colorScheme: string }) => {
        if (registeredThemes.some(t => t.id === def.id)) throw new Error('already registered')
        registeredThemes.push(def)
        return def.id === 'gaia-embed-dark' ? disposeDarkSpy : disposeLightSpy
      }),
      setTheme: vi.fn((id: string) => {
        currentTheme = id
      }),
      getTheme: () => ({ preference: currentTheme }),
      overrideTokens: vi.fn((_source: string, _tokens: Record<string, { light: string; dark: string }>) => disposePaletteSpy),
    }
    ctx.provide('theme', theme)

    const slotRegistrations: { name: string; id: string; priority?: number }[] = []
    const slots = {
      inject: vi.fn((_name: string, factory: () => () => void) => factory()),
      register: vi.fn((options: { name: string; id: string; priority?: number }) => {
        slotRegistrations.push(options)
        return () => {}
      }),
    }
    ctx.provide('slots', slots)

    const registeredCommands: Array<{
      name: string
      label?: () => string
      description?: () => string
      available: (session: unknown) => boolean
      ui: { kind: string; options: (session: unknown, signal: AbortSignal) => Promise<unknown>; onSelect: (option: { id: string }) => void }
    }> = []
    const commandUiDisposer = vi.fn()
    const commandUi = {
      register: vi.fn((cmd: typeof registeredCommands[number]) => {
        registeredCommands.push(cmd)
        return commandUiDisposer
      }),
    }
    ctx.provide('commandUi', commandUi)

    return {
      ctx,
      slotRegistrations,
      sessionCtx,
      layout,
      uiWorkspace,
      connection,
      setConnectionState: (s: 'connected' | 'connecting' | 'disconnected') => {
        connectionState = s
        connectionListeners.forEach((l) => {
          l()
        })
      },
      uiSession,
      setSessionStatus: (id: SessionId, running: boolean) => {
        sessionStatusSnapshot = new Map([[id, { running }]])
        sessionStatusListeners.forEach((l) => {
          l()
        })
      },
      sessions,
      setSessionList: (l: typeof listSnapshot) => {
        listSnapshot = l
        listListeners.forEach((l) => {
          l()
        })
      },
      theme,
      disposeDarkSpy,
      disposePaletteSpy,
      disposeLightSpy,
      toggleSidebarSpy,
      openRightbarSpy,
      focusSpy,
      insertTextSpy,
      setInsertTextShouldSucceed: (s: boolean) => {
        insertTextShouldSucceed = s
      },
      commandUi,
      registeredCommands,
      commandUiDisposer,
    }
  }

  it('declares theme in inject list', () => {
    expect(inject).toContain('theme')
  })

  it('does nothing when gaia !== embed', () => {
    setLocationSearch('')
    const mock = createMockContext()
    const dispose = apply(mock.ctx)

    expect(dispose).toBeUndefined()
    expect(document.documentElement.hasAttribute('data-gaia-embed')).toBe(false)
    expect(parentMessages).toEqual([])
  })

  it('posts error when session query param is missing', () => {
    setLocationSearch('?gaia=embed')
    const mock = createMockContext()
    apply(mock.ctx)

    expect(parentMessages).toContainEqual({
      source: 'gaia-dsh',
      v: 1,
      type: 'status',
      connected: false,
      reconnecting: false,
    })
    expect(parentMessages).toContainEqual({
      source: 'gaia-dsh',
      v: 1,
      type: 'error',
      code: 'missing_session',
    })
  })

  it('posts error when session query param is invalid', () => {
    setLocationSearch('?gaia=embed&session=bad/session!')
    const mock = createMockContext()
    apply(mock.ctx)

    expect(parentMessages).toContainEqual({
      source: 'gaia-dsh',
      v: 1,
      type: 'error',
      code: 'invalid_session',
    })
  })

  it('activates embed mode, applies scoped styles, and opens session', () => {
    setLocationSearch('?gaia=embed&session=s-test-123')
    const mock = createMockContext()
    apply(mock.ctx)

    expect(document.documentElement.hasAttribute('data-gaia-embed')).toBe(true)
    expect(document.getElementById(GAIA_EMBED_STYLE_ID)).not.toBeNull()
    expect(mock.uiWorkspace.openSession).toHaveBeenCalledWith('s-test-123')
    expect(mock.layout.selectPanel).toHaveBeenCalledWith(null)
    expect(mock.layout.closeRightbar).toHaveBeenCalled()
  })

  it('neutralizes sidebar and rightbar layout toggles', () => {
    setLocationSearch('?gaia=embed&session=s-test-123')
    const mock = createMockContext()
    apply(mock.ctx)

    mock.ctx.layout.toggleSidebar()
    mock.ctx.layout.openRightbar(true, false)
    expect(mock.toggleSidebarSpy).not.toHaveBeenCalled()
    expect(mock.openRightbarSpy).not.toHaveBeenCalled()
  })

  it('neutralizes blocked keyboard shortcuts', () => {
    setLocationSearch('?gaia=embed&session=s-test-123')
    const mock = createMockContext()
    apply(mock.ctx)

    const event = new KeyboardEvent('keydown', {
      code: 'KeyB',
      metaKey: true,
      cancelable: true,
    })
    const prevented = !window.dispatchEvent(event)
    expect(prevented).toBe(true)
  })

  it('posts ready, status, and turn events', () => {
    setLocationSearch('?gaia=embed&session=s-test-123')
    const mock = createMockContext()
    apply(mock.ctx)

    expect(parentMessages).toContainEqual({ source: 'gaia-dsh', v: 1, type: 'ready' })
    expect(parentMessages).toContainEqual({ source: 'gaia-dsh', v: 1, type: 'status', connected: true, reconnecting: false })
    expect(parentMessages).toContainEqual({ source: 'gaia-dsh', v: 1, type: 'turn', running: false })

    mock.setSessionStatus(SessionId('s-test-123'), true)
    expect(parentMessages).toContainEqual({ source: 'gaia-dsh', v: 1, type: 'turn', running: true })

    mock.setConnectionState('connecting')
    expect(parentMessages).toContainEqual({ source: 'gaia-dsh', v: 1, type: 'status', connected: false, reconnecting: true })
  })

  it('posts title when session becomes available in sessions.list', () => {
    setLocationSearch('?gaia=embed&session=s-test-123')
    const mock = createMockContext()
    apply(mock.ctx)

    mock.setSessionList({
      phase: 'ready',
      byId: {
        's-test-123': {
          id: SessionId('s-test-123'),
          title: 'My Custom Title',
          displayTitle: 'Fallback Title',
        },
      },
    })

    expect(parentMessages).toContainEqual({ source: 'gaia-dsh', v: 1, type: 'title', title: 'My Custom Title' })
  })

  it('does not recurse when openSession synchronously notifies the Session list', () => {
    setLocationSearch('?gaia=embed&session=s-test-123')
    const mock = createMockContext()
    mock.setSessionList({ phase: 'ready', byId: { 's-test-123': { id: SessionId('s-test-123'), title: 'T', displayTitle: 'T' } } })
    // The real openSession replaces the main panel, which notifies list
    // subscribers before it returns; the plugin's subscriber calls back in.
    mock.uiWorkspace.openSession.mockImplementation(() => {
      mock.setSessionList({ phase: 'ready', byId: { 's-test-123': { id: SessionId('s-test-123'), title: 'T', displayTitle: 'T' } } })
    })
    expect(() => apply(mock.ctx)).not.toThrow()
    expect(mock.uiWorkspace.openSession).toHaveBeenCalledTimes(1)
    expect(parentMessages).not.toContainEqual({ source: 'gaia-dsh', v: 1, type: 'error', code: 'session_not_found' })
  })

  it('re-applies the Gaia theme when the persisted preference is adopted later', () => {
    setLocationSearch('?gaia=embed&session=s-test-123')
    const mock = createMockContext()
    apply(mock.ctx)
    window.dispatchEvent(new MessageEvent('message', {
      data: { source: 'gaia-dsh', v: 1, type: 'theme', mode: 'dark' },
      origin: window.location.origin,
      source: window.parent,
    }))
    expect(mock.theme.setTheme).toHaveBeenLastCalledWith('gaia-embed-dark')
    mock.theme.setTheme.mockClear()
    // Settings scope loads and the service adopts the user's saved preference.
    mock.ctx.emit('theme/change', { preference: 'system' } as ThemeSnapshot)
    expect(mock.theme.setTheme).toHaveBeenCalledWith('gaia-embed-dark')
    mock.theme.setTheme.mockClear()
    mock.ctx.emit('theme/change', { preference: 'gaia-embed-dark' } as unknown as ThemeSnapshot)
    expect(mock.theme.setTheme).not.toHaveBeenCalled()
  })

  it('re-opens its own Session when the restored selection shows another one', async () => {
    setLocationSearch('?gaia=embed&session=s-test-123')
    const mock = createMockContext()
    mock.setSessionList({ phase: 'ready', byId: { 's-test-123': { id: SessionId('s-test-123'), title: 'T', displayTitle: 'T' } } })
    const dispose = apply(mock.ctx)
    mock.uiWorkspace.openSession.mockClear()
    // DSH's startup restore shows the Session another tab opened last.
    const shown = document.createElement('div')
    shown.setAttribute('data-conversation-session', 'session-other')
    document.body.appendChild(shown)
    await new Promise((resolve) => { setTimeout(resolve, 0) })
    expect(mock.uiWorkspace.openSession).toHaveBeenCalledWith('s-test-123')
    // Once our Session is displayed, nothing more happens.
    mock.uiWorkspace.openSession.mockClear()
    shown.setAttribute('data-conversation-session', 's-test-123')
    await new Promise((resolve) => { setTimeout(resolve, 0) })
    expect(mock.uiWorkspace.openSession).not.toHaveBeenCalled()
    shown.remove()
    if (typeof dispose === 'function') await dispose()
  })

  it('emits session_not_found error when list is ready and session is missing', () => {
    setLocationSearch('?gaia=embed&session=missing-session')
    const mock = createMockContext()
    mock.setSessionList({ phase: 'ready', byId: {} })
    apply(mock.ctx)

    expect(parentMessages).toContainEqual({ source: 'gaia-dsh', v: 1, type: 'error', code: 'session_not_found' })
  })

  it('registers themes once at activation and switches theme without persisting built-in ids', async () => {
    setLocationSearch('?gaia=embed&session=s-test-123')
    const mock = createMockContext()
    const dispose = apply(mock.ctx)

    // Registered once at startup
    expect(mock.theme.register).toHaveBeenCalledTimes(2)
    expect(mock.theme.register).toHaveBeenCalledWith(expect.objectContaining({ id: 'gaia-embed-dark', colorScheme: 'dark' }))
    expect(mock.theme.register).toHaveBeenCalledWith(expect.objectContaining({ id: 'gaia-embed-light', colorScheme: 'light' }))

    // Incoming theme message switches theme using non-built-in id
    window.dispatchEvent(new MessageEvent('message', {
      source: fakeParent,
      origin: window.location.origin,
      data: { source: 'gaia-dsh', v: 1, type: 'theme', mode: 'dark' },
    }))

    // No extra registration calls on message
    expect(mock.theme.register).toHaveBeenCalledTimes(2)
    expect(mock.theme.setTheme).toHaveBeenCalledWith('gaia-embed-dark')

    // Disposers called on teardown
    await dispose?.()
    expect(mock.disposeDarkSpy).toHaveBeenCalled()
    expect(mock.disposeLightSpy).toHaveBeenCalled()
  })

  it('handles incoming focus message using SessionInput.focus', () => {
    setLocationSearch('?gaia=embed&session=s-test-123')
    const mock = createMockContext()
    apply(mock.ctx)

    window.dispatchEvent(new MessageEvent('message', {
      source: fakeParent,
      origin: window.location.origin,
      data: { source: 'gaia-dsh', v: 1, type: 'focus' },
    }))

    expect(mock.sessions.scope).toHaveBeenCalledWith('s-test-123')
    expect(mock.focusSpy).toHaveBeenCalled()
  })

  it('handles incoming insertText message using slash/input-insert-text with collapsed end span', () => {
    setLocationSearch('?gaia=embed&session=s-test-123')
    const mock = createMockContext()
    apply(mock.ctx)

    window.dispatchEvent(new MessageEvent('message', {
      source: fakeParent,
      origin: window.location.origin,
      data: { source: 'gaia-dsh', v: 1, type: 'insertText', text: ' additional text' },
    }))

    // 'existing draft' has length 14, draftRev is 2
    expect(mock.insertTextSpy).toHaveBeenCalledWith({
      text: ' additional text',
      span: {
        start: 14,
        end: 14,
        draftRev: 2,
      },
    })
    expect(parentMessages.some(m => m.type === 'error' && m.code === 'insert_unsupported')).toBe(false)
  })

  it('reports insert_unsupported error when insert text event is rejected or unhandled', () => {
    setLocationSearch('?gaia=embed&session=s-test-123')
    const mock = createMockContext()
    mock.setInsertTextShouldSucceed(false)
    apply(mock.ctx)

    window.dispatchEvent(new MessageEvent('message', {
      source: fakeParent,
      origin: window.location.origin,
      data: { source: 'gaia-dsh', v: 1, type: 'insertText', text: 'cannot insert' },
    }))

    expect(parentMessages).toContainEqual({
      source: 'gaia-dsh',
      v: 1,
      type: 'error',
      code: 'insert_unsupported',
    })
  })

  it('handles incoming clear message by scrolling conversation view without touching history or private APIs', () => {
    setLocationSearch('?gaia=embed&session=s-test-123')
    const mock = createMockContext()

    const scrollEl = document.createElement('div')
    scrollEl.setAttribute('data-conversation-scroll', '')
    const scrollToSpy = vi.fn()
    scrollEl.scrollTo = scrollToSpy
    document.body.appendChild(scrollEl)

    apply(mock.ctx)

    window.dispatchEvent(new MessageEvent('message', {
      source: fakeParent,
      origin: window.location.origin,
      data: { source: 'gaia-dsh', v: 1, type: 'clear' },
    }))

    expect(scrollToSpy).toHaveBeenCalled()
    scrollEl.remove()
  })

  it('ignores incoming messages from wrong origin or source', () => {
    setLocationSearch('?gaia=embed&session=s-test-123')
    const mock = createMockContext()
    apply(mock.ctx)

    // Wrong origin
    window.dispatchEvent(new MessageEvent('message', {
      source: fakeParent,
      origin: 'http://malicious.test',
      data: { source: 'gaia-dsh', v: 1, type: 'focus' },
    }))
    expect(mock.focusSpy).not.toHaveBeenCalled()

    // Wrong source
    window.dispatchEvent(new MessageEvent('message', {
      source: window,
      origin: window.location.origin,
      data: { source: 'gaia-dsh', v: 1, type: 'focus' },
    }))
    expect(mock.focusSpy).not.toHaveBeenCalled()
  })

  it('cleans up styles and attributes on teardown', async () => {
    setLocationSearch('?gaia=embed&session=s-test-123')
    const mock = createMockContext()
    const dispose = apply(mock.ctx)

    expect(document.documentElement.hasAttribute('data-gaia-embed')).toBe(true)
    expect(document.getElementById(GAIA_EMBED_STYLE_ID)).not.toBeNull()

    // Teardown
    await dispose?.()

    expect(document.documentElement.hasAttribute('data-gaia-embed')).toBe(false)
    expect(document.getElementById(GAIA_EMBED_STYLE_ID)).toBeNull()
  })

  describe('/resume command contribution', () => {
    beforeEach(() => {
      setLocationSearch('?gaia=embed&session=s-test-123')
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    const flushTicks = async () => {
      for (let i = 0; i < 10; i++) await Promise.resolve()
    }

    it('registers /resume command contribution in embed mode when running in iframe', async () => {
      const mock = createMockContext()
      apply(mock.ctx)
      await flushTicks()

      expect(mock.commandUi.register).toHaveBeenCalledTimes(1)
      const cmd = mock.registeredCommands[0]
      expect(cmd?.name).toBe('resume')
      expect(cmd?.label?.()).toBe('Resume')
      expect(cmd?.description?.()).toBe('Switch this tab to a previous session')
      expect(cmd?.available(undefined)).toBe(true)
      expect(cmd?.ui.kind).toBe('popupSelect')
    })

    it('does not register /resume command when window.parent === window', () => {
      Object.defineProperty(window, 'parent', {
        value: window,
        writable: true,
        configurable: true,
      })
      const mock = createMockContext()
      apply(mock.ctx)

      expect(mock.commandUi.register).not.toHaveBeenCalled()
    })

    it('queries sessions via postMessage and maps to select options', async () => {
      const mock = createMockContext()
      apply(mock.ctx)
      await flushTicks()
      const cmd = mock.registeredCommands[0]!

      const ac = new AbortController()
      const optionsPromise = cmd.ui.options({}, ac.signal)

      const listMsg = parentMessages.find(m => m.type === 'resumeList') as { type: 'resumeList'; reqId: string } | undefined
      expect(listMsg).toBeTruthy()
      expect(typeof listMsg?.reqId).toBe('string')

      const now = Date.now()
      window.dispatchEvent(new MessageEvent('message', {
        source: fakeParent,
        origin: window.location.origin,
        data: {
          source: 'gaia-dsh',
          v: 1,
          type: 'resumeSessions',
          reqId: listMsg!.reqId,
          sessions: [
            { sessionId: 's-open', title: 'Open Session', archived: false, open: true, updatedAt: now - 300_000 },
            { sessionId: 's-archived', title: '', archived: true, open: false, updatedAt: null },
          ],
        },
      }))

      const options = await optionsPromise as Array<{ id: string; label: string; detail?: string; badge?: string }>
      expect(options).toEqual([
        { id: 's-open', label: 'Open Session', detail: '5m ago', badge: 'open' },
        { id: 's-archived', label: 'Untitled session', badge: 'archived' },
      ])
    })

    it('throws an error when session list is empty', async () => {
      const mock = createMockContext()
      apply(mock.ctx)
      await flushTicks()
      const cmd = mock.registeredCommands[0]!

      const ac = new AbortController()
      const optionsPromise = cmd.ui.options({}, ac.signal)
      const listMsg = parentMessages.find(m => m.type === 'resumeList') as { type: 'resumeList'; reqId: string }

      window.dispatchEvent(new MessageEvent('message', {
        source: fakeParent,
        origin: window.location.origin,
        data: {
          source: 'gaia-dsh',
          v: 1,
          type: 'resumeSessions',
          reqId: listMsg.reqId,
          sessions: [],
        },
      }))

      await expect(optionsPromise).rejects.toThrow('No previous sessions in this project')
    })

    it('throws an error when reply carries error message', async () => {
      const mock = createMockContext()
      apply(mock.ctx)
      await flushTicks()
      const cmd = mock.registeredCommands[0]!

      const ac = new AbortController()
      const optionsPromise = cmd.ui.options({}, ac.signal)
      const listMsg = parentMessages.find(m => m.type === 'resumeList') as { type: 'resumeList'; reqId: string }

      window.dispatchEvent(new MessageEvent('message', {
        source: fakeParent,
        origin: window.location.origin,
        data: {
          source: 'gaia-dsh',
          v: 1,
          type: 'resumeSessions',
          reqId: listMsg.reqId,
          error: 'Backend failure',
        },
      }))

      await expect(optionsPromise).rejects.toThrow('Backend failure')
    })

    it('rejects on abort signal', async () => {
      const mock = createMockContext()
      apply(mock.ctx)
      await flushTicks()
      const cmd = mock.registeredCommands[0]!

      const ac = new AbortController()
      const optionsPromise = cmd.ui.options({}, ac.signal)
      ac.abort()

      await expect(optionsPromise).rejects.toThrow(/abort/i)
    })

    it('rejects after 10 second timeout', async () => {
      vi.useFakeTimers()
      const mock = createMockContext()
      apply(mock.ctx)
      await flushTicks()
      const cmd = mock.registeredCommands[0]!

      const ac = new AbortController()
      const optionsPromise = cmd.ui.options({}, ac.signal)

      vi.advanceTimersByTime(10_000)

      await expect(optionsPromise).rejects.toThrow('Timed out waiting for session list')
    })

    it('posts resume message on onSelect', async () => {
      const mock = createMockContext()
      apply(mock.ctx)
      await flushTicks()
      const cmd = mock.registeredCommands[0]!

      cmd.ui.onSelect({ id: 's-selected-42' })
      expect(parentMessages).toContainEqual({
        source: 'gaia-dsh',
        v: 1,
        type: 'resume',
        sessionId: 's-selected-42',
      })
    })
  })
})

describe('embed styles', () => {
  it('collapses the frame to one track so the conversation column is not placed in a 0px track', async () => {
    const { GAIA_EMBED_CSS } = await import('../src/client/styles.ts')
    expect(GAIA_EMBED_CSS).toContain('grid-template-columns: minmax(0, 1fr) !important;')
    expect(GAIA_EMBED_CSS).not.toMatch(/grid-template-columns:\s*0px/)
  })
})

describe('Gaia palette', () => {
  it('accepts plain CSS colors and refuses anything that could escape a declaration', async () => {
    const { isSafeCssColor } = await import('../src/client/bridge.ts')
    for (const ok of ['#0a0a0a', 'hsl(0 0% 3.9%)', 'rgb(21, 21, 23)', 'oklch(70.5% 0.213 47.604)', 'hsl(20 80% 45% / 0.5)']) {
      expect(isSafeCssColor(ok)).toBe(true)
    }
    for (const bad of ['red; background: url(x)', 'url(https://x)', 'var(--x)', 'hsl(0 0% 0%) }', '"#fff"', '', 'x'.repeat(200)]) {
      expect(isSafeCssColor(bad)).toBe(false)
    }
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'theme', mode: 'dark', palette: { background: 'hsl(0 0% 3.9%)' } })).toBe(true)
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'theme', mode: 'dark', palette: { background: 'url(x)' } })).toBe(false)
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'theme', mode: 'dark', palette: { unknownKey: '#fff' } })).toBe(false)
  })

  it('maps Gaia colors onto DSH alias tokens for both schemes', async () => {
    const { paletteTokens } = await import('../src/client/palette.ts')
    const tokens = paletteTokens({ background: 'hsl(0 0% 3.9%)', foreground: 'hsl(0 0% 90%)', border: 'hsl(20 80% 45%)', accent: 'oklch(70.5% 0.213 47.604)' })
    expect(tokens['--dsw-alias-bg-base']).toEqual({ light: 'hsl(0 0% 3.9%)', dark: 'hsl(0 0% 3.9%)' })
    expect(tokens['--dsw-alias-label-primary']?.dark).toBe('hsl(0 0% 90%)')
    expect(tokens['--dsw-alias-border-l2']?.dark).toBe('hsl(20 80% 45%)')
    expect(tokens['--dsw-alias-link']?.dark).toBe('oklch(70.5% 0.213 47.604)')
    expect(tokens['--dsw-alias-bg-layer-2']?.dark).toContain('color-mix(')
    expect(paletteTokens({})).toEqual({})
  })
})

describe('embed integration of the palette and header entries', () => {
  it('applies a received palette as one override layer and shadows Open in Files', async () => {
    Object.defineProperty(window, 'location', { value: new URL('http://localhost:3000/?gaia=embed&session=s-test-123'), writable: true, configurable: true })
    const ctx = new Context()
    const overrideTokens = vi.fn(() => () => {})
    const registrations: { name: string; id: string; priority?: number }[] = []
    ctx.provide('layout', { selectPanel: vi.fn(), closeRightbar: vi.fn(), toggleSidebar: vi.fn(), openRightbar: vi.fn() })
    ctx.provide('uiWorkspace', { openSession: vi.fn() })
    ctx.provide('connection', { state: { getSnapshot: () => 'connected', subscribe: () => () => {} } })
    ctx.provide('uiSession', { sessionStatus: { getSnapshot: () => new Map(), subscribe: () => () => {} } })
    ctx.provide('sessions', { list: { getSnapshot: () => ({ phase: 'ready', byId: {} }), subscribe: () => () => {} }, scope: () => undefined })
    ctx.provide('theme', { register: vi.fn(() => () => {}), setTheme: vi.fn(), overrideTokens })
    ctx.provide('slots', { inject: (_n: string, f: () => () => void) => f(), register: (o: { name: string; id: string; priority?: number }) => { registrations.push(o); return () => {} } })
    apply(ctx)
    expect(registrations).toContainEqual(expect.objectContaining({ name: 'conversation.session.header.utilities', id: 'open-in-app', priority: -1 }))
    window.dispatchEvent(new MessageEvent('message', {
      data: { source: 'gaia-dsh', v: 1, type: 'theme', mode: 'dark', palette: { background: 'hsl(0 0% 3.9%)', foreground: 'hsl(0 0% 90%)' } },
      origin: window.location.origin, source: window.parent,
    }))
    expect(overrideTokens).toHaveBeenCalledWith('gaia-embed-palette', expect.objectContaining({ '--dsw-alias-bg-base': { light: 'hsl(0 0% 3.9%)', dark: 'hsl(0 0% 3.9%)' } }))
  })
})

describe('embed composer styles', () => {
  it('restyles only the composer card inside the embed, with a reduced-motion fallback', async () => {
    const { GAIA_EMBED_CSS } = await import('../src/client/styles.ts')
    expect(GAIA_EMBED_CSS).toContain('html[data-gaia-embed] [data-composer-card] {')
    expect(GAIA_EMBED_CSS).toContain('background: var(--dsw-alias-bg-base) !important;')
    expect(GAIA_EMBED_CSS).toContain('border: 1px solid var(--dsw-alias-border-l2) !important;')
    expect(GAIA_EMBED_CSS).toMatch(/prefers-reduced-motion: reduce[\s\S]*animation: none/)
    for (const rule of GAIA_EMBED_CSS.split('}').filter(r => r.includes('data-composer-card') && r.includes('{'))) {
      expect(rule.trim().startsWith('html[data-gaia-embed]') || rule.includes('@media')).toBe(true)
    }
  })
})

describe('embed send button', () => {
  it('shows an accent outline at rest and an accent fill on hover, never DSH blue', async () => {
    const { GAIA_EMBED_CSS } = await import('../src/client/styles.ts')
    const ruleOf = (selector: string) => GAIA_EMBED_CSS.split(`${selector} {`)[1]?.split('}')[0] ?? ''
    const rest = ruleOf('html[data-gaia-embed] [data-composer-primary]')
    expect(rest).toContain('background: var(--dsw-alias-bg-base) !important;')
    expect(rest).toContain('color: var(--dsw-alias-button-info-fill) !important;')
    const hover = ruleOf('html[data-gaia-embed] [data-composer-primary]:hover:not(:disabled)')
    expect(hover).toContain('background: var(--dsw-alias-button-info-fill) !important;')
    expect(hover).toContain('color: var(--dsw-alias-bg-base) !important;')
    const { paletteTokens } = await import('../src/client/palette.ts')
    expect(paletteTokens({ accent: '#e8590c' })['--dsw-alias-button-info-hover']?.dark).toBe('color-mix(in oklch, #e8590c, black 12%)')
  })
})


