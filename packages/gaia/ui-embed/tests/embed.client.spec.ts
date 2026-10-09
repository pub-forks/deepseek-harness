// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ThemeSnapshot } from '@deepseek-ai/dsh-client-ui-theme/client'
import {
  apply,
  inject,
  isGaiaIncomingMessage,
  isValidSessionId,
  sanitizeNotifyTitle,
  postToParent,
  GAIA_EMBED_STYLE_ID,
  GAIA_SKIN_STYLE_ID,
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

  it('validates focus, clear, and openSettings messages', () => {
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'focus' })).toBe(true)
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'clear' })).toBe(true)
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'openSettings' })).toBe(true)
  })

  it('accepts bounded parent appChords registrations and rejects malformed envelopes', () => {
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'appChords', chords: [{ code: 'KeyV', mod: true, alt: true, shift: false }] })).toBe(true)
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'appChords', chords: [{ code: 'Bad', mod: true, alt: true, shift: false }] })).toBe(true)
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'appChords', chords: new Array(33).fill({}) })).toBe(false)
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'appChords', chords: [], extra: true })).toBe(false)
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
    expect(isGaiaIncomingMessage({ source: 'other', v: 1, type: 'openSettings' })).toBe(false)
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 2, type: 'openSettings' })).toBe(false)
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'unknown' })).toBe(false)
  })
})

describe('ui-embed client plugin', () => {
  let originalLocation: Location
  let parentMessages: GaiaOutgoingMessage[]
  let fakeParent: Window
  let contexts: Context[]

  const setLocationSearch = (search: string) => {
    Object.defineProperty(window, 'location', {
      value: new URL(`http://localhost:3000/${search}`),
      writable: true,
      configurable: true,
    })
  }

  beforeEach(() => {
    parentMessages = []
    contexts = []
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

  afterEach(async () => {
    await Promise.all(contexts.map(ctx => ctx.fiber.dispose()))
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    })
    document.documentElement.removeAttribute('data-gaia-embed')
    document.documentElement.removeAttribute('data-gaia-full')
    document.getElementById(GAIA_EMBED_STYLE_ID)?.remove()
    document.getElementById(GAIA_SKIN_STYLE_ID)?.remove()
    document.querySelector('[data-gaia-favicon]')?.remove()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  function createMockContext() {
    const ctx = new Context()
    contexts.push(ctx)
    const locale = new LocaleRuntime(ctx)
    locale.register('settings.account', 'en', { backToHarness: 'Back to DeepSeek Harness' })
    locale.register('settings.account', 'zh', { backToHarness: '返回 DeepSeek Harness' })
    ctx.provide('locale', locale)

    let workspaceSnapshot = { phase: 'pending' as 'pending' | 'ready', items: [] as { workspaceId: string; path: string; title: string }[] }
    const workspaceListeners = new Set<() => void>()
    ctx.provide('workspaces', { list: {
      getSnapshot: () => workspaceSnapshot,
      subscribe: (listener: () => void) => { workspaceListeners.add(listener); return () => workspaceListeners.delete(listener) },
    } })

    let connectionState: 'connected' | 'connecting' | 'disconnected' = 'connected'
    const connectionListeners = new Set<() => void>()

    const toggleSidebarSpy = vi.fn()
    let layoutSnapshot = { viewportWidth: 1280, narrowExpanded: false, sidebar: 280 }
    const openRightbarSpy = vi.fn()
    const layout = {
      selectPanel: vi.fn(),
      closeRightbar: vi.fn(),
      toggleSidebar: toggleSidebarSpy.mockImplementation(() => {
        if (layoutSnapshot.viewportWidth < 1024) layoutSnapshot = { ...layoutSnapshot, narrowExpanded: !layoutSnapshot.narrowExpanded }
        else layoutSnapshot = { ...layoutSnapshot, sidebar: layoutSnapshot.sidebar === 0 ? 280 : 0 }
      }),
      layoutInfo: { getSnapshot: () => layoutSnapshot, subscribe: () => () => {} },
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

    type ListEntry = { id: SessionId; title?: string; displayTitle: string; cwd?: string; retainedBy?: Record<string, number> }
    let listSnapshot: { phase: string; byId: Record<string, ListEntry> } = {
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

    const bindings = new Map<SessionId, unknown>()
    const sessions = {
      fork: vi.fn(async (_options: { sessionId: SessionId; atSeq?: number; increaseTitle?: boolean }) => SessionId('fork-child')),
      list: {
        getSnapshot: () => listSnapshot,
        subscribe: (fn: () => void) => {
          listListeners.add(fn)
          return () => listListeners.delete(fn)
        },
      },
      scope: vi.fn((_id: SessionId) => sessionCtx),
      binding: vi.fn((id: SessionId) => bindings.get(id)),
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

    const slotRegistrations: { name: string; id?: string; priority?: number }[] = []
    const slotComponents: Array<{ name: string; component: unknown }> = []
    const slots = {
      inject: vi.fn((_name: string, factory: () => unknown) => {
        const result = factory()
        if (result !== null && typeof result === 'object' && Symbol.iterator in result) {
          Array.from(result as Iterable<unknown>)
        }
        return result
      }),
      register: vi.fn((options: { name: string; id?: string; priority?: number }, component?: unknown) => {
        slotRegistrations.push(options)
        slotComponents.push({ name: options.name, component })
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
      face: vi.fn(() => commandUiDisposer),
    }
    ctx.provide('commandUi', commandUi)

    return {
      ctx,
      locale,
      slotRegistrations,
      slotComponents,
      sessionCtx,
      layout,
      uiWorkspace,
      setWorkspaceList: (snapshot: typeof workspaceSnapshot) => {
        workspaceSnapshot = snapshot
        workspaceListeners.forEach((listener) => { listener() })
      },
      connection,
      setConnectionState: (s: 'connected' | 'connecting' | 'disconnected') => {
        connectionState = s
        connectionListeners.forEach((l) => {
          l()
        })
      },
      uiSession,
      setSessionStatus: (id: SessionId, running: boolean, pendingInteraction?: { key: string }) => {
        sessionStatusSnapshot = new Map([[id, {
          running,
          ...(pendingInteraction ? { pendingInteraction: { key: pendingInteraction.key, kind: 'approval', sessionId: id } } : {}),
        }]])
        sessionStatusListeners.forEach((l) => {
          l()
        })
      },
      setSessionBinding: (id: SessionId, binding: unknown) => {
        bindings.set(id, binding)
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
      setLayoutSnapshot: (snapshot: typeof layoutSnapshot) => { layoutSnapshot = snapshot },
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

  it('does not activate in a top-level window, even with full mode in the URL', () => {
    setLocationSearch('?gaia=full')
    Object.defineProperty(window, 'parent', { value: window, writable: true, configurable: true })
    const mock = createMockContext()

    expect(apply(mock.ctx)).toBeUndefined()
    expect(mock.theme.register).not.toHaveBeenCalled()
    expect(parentMessages).toEqual([])
    Object.defineProperty(window, 'parent', { value: fakeParent, writable: true, configurable: true })
  })

  it('activates shared Gaia skin and theme bridge in full mode only', async () => {
    setLocationSearch('?gaia=full')
    const mock = createMockContext()
    const dispose = apply(mock.ctx)

    expect(document.documentElement.hasAttribute('data-gaia-full')).toBe(true)
    expect(document.documentElement.hasAttribute('data-gaia-embed')).toBe(false)
    expect(document.getElementById(GAIA_SKIN_STYLE_ID)?.textContent).toContain('data-gaia-full')
    expect(document.getElementById(GAIA_EMBED_STYLE_ID)).toBeNull()
    expect(mock.theme.register).toHaveBeenCalledTimes(2)
    expect(parentMessages.filter(message => message.type === 'ready')).toHaveLength(1)
    expect(mock.uiWorkspace.openSession).not.toHaveBeenCalled()
    expect(mock.layout.selectPanel).not.toHaveBeenCalled()
    expect(mock.layout.closeRightbar).not.toHaveBeenCalled()
    expect(mock.registeredCommands).toHaveLength(0)
    expect(mock.slotRegistrations.map(({ name }) => name)).toEqual([
      'conversation.input.overlay', 'conversation.input.overlay', 'conversation.chat.assistant-actions', 'sidebar.session.row.decoration', 'settings.action', 'settings.general.item', 'settings.general.item', 'settings.launcher', 'sidebar.brand.mark', 'sidebar.brand.name',
      'conversation.hero.brand.mark',
    ])
    expect(mock.slotRegistrations).not.toContainEqual(expect.objectContaining({ id: 'gaia-maximize' }))
    expect(mock.slotRegistrations).toContainEqual(expect.objectContaining({ name: 'settings.general.item', id: 'appearance', priority: -1 }))
    expect(mock.slotRegistrations).toContainEqual(expect.objectContaining({ name: 'settings.general.item', id: 'language', priority: -1 }))
    expect(mock.slotComponents.find(({ name }) => name === 'settings.launcher')?.component)
      .toBe((await import('../src/client/settings-launcher.ts')).GaiaSettingsLauncher)
    expect(mock.slotComponents.find(({ name }) => name === 'sidebar.brand.mark')?.component)
      .toBe((await import('../src/client/brand.ts')).GaiaMark)
    expect(mock.slotComponents.find(({ name }) => name === 'sidebar.brand.name')?.component)
      .toBe((await import('../src/client/brand.ts')).GaiaBrandName)
    const blockedKey = new KeyboardEvent('keydown', { code: 'KeyB', metaKey: true, cancelable: true })
    window.dispatchEvent(blockedKey)
    expect(blockedKey.defaultPrevented).toBe(false)

    window.dispatchEvent(new MessageEvent('message', {
      source: fakeParent,
      origin: window.location.origin,
      data: {
        source: 'gaia-dsh', v: 1, type: 'theme', mode: 'dark',
        palette: { background: '#101010', foreground: '#fefefe', accent: '#f97316' },
      },
    }))
    expect(mock.theme.setTheme).toHaveBeenCalledTimes(1)
    expect(mock.theme.setTheme).toHaveBeenCalledWith('gaia-embed-dark')
    expect(mock.theme.overrideTokens).toHaveBeenCalledWith('gaia-embed-palette', expect.objectContaining({
      '--dsw-alias-bg-base': { light: '#101010', dark: '#101010' },
      '--dsw-alias-button-info-fill': { light: '#f97316', dark: '#f97316' },
    }))
    await dispose?.()
    expect(document.documentElement.hasAttribute('data-gaia-full')).toBe(false)
  })

  it.each(['full', 'embed'] as const)('debounces workspace changes after the first ready snapshot in %s mode', async (mode) => {
    vi.useFakeTimers()
    setLocationSearch(mode === 'full' ? '?gaia=full' : '?gaia=embed&session=s-test-123')
    const mock = createMockContext()
    apply(mock.ctx)
    mock.setWorkspaceList({ phase: 'ready', items: [{ workspaceId: 'w1', path: '/tmp/one', title: 'One' }] })
    mock.setWorkspaceList({ phase: 'ready', items: [{ workspaceId: 'w1', path: '/tmp/one', title: 'Renamed' }] })
    await vi.advanceTimersByTimeAsync(499)
    expect(parentMessages.filter(message => message.type === 'workspacesChanged')).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(parentMessages.filter(message => message.type === 'workspacesChanged')).toHaveLength(1)
    mock.setWorkspaceList({ phase: 'ready', items: [] })
    await vi.advanceTimersByTimeAsync(500)
    expect(parentMessages.filter(message => message.type === 'workspacesChanged')).toHaveLength(2)
    expect(parentMessages.filter(message => message.type === 'workspacesChanged')[0]).toEqual({ source: 'gaia-dsh', v: 1, type: 'workspacesChanged' })
  })

  it.each(['full', 'embed'] as const)('sets the Gaia title, favicon and brand slots in %s mode', async (mode) => {
    setLocationSearch(mode === 'full' ? '?gaia=full' : '?gaia=embed')
    const previousTitle = document.title
    const previousIcons = [...document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')]
    const priorIcon = document.createElement('link')
    priorIcon.rel = 'icon'
    priorIcon.href = '/original.ico'
    document.head.append(priorIcon)

    const mock = createMockContext()
    const dispose = apply(mock.ctx)

    expect(document.title).toBe('Gaia Harness')
    const gaiaIcon = document.querySelector<HTMLLinkElement>('link[data-gaia-favicon]')
    expect(gaiaIcon?.href).toContain('data:image/svg+xml,')
    expect(decodeURIComponent(gaiaIcon?.href.split(',')[1] ?? '')).toContain('#ea580c')
    expect(mock.slotRegistrations.map(({ name }) => name)).toContain('sidebar.brand.mark')
    expect(mock.slotRegistrations.map(({ name }) => name)).toContain('sidebar.brand.name')
    expect(mock.slotRegistrations.map(({ name }) => name)).toContain('conversation.hero.brand.mark')

    document.title = 'Session title — DeepSeek Harness'
    await Promise.resolve()
    expect(document.title).toBe('Session title · Gaia Harness')

    await dispose?.()
    expect(document.title).toBe(previousTitle)
    expect(document.querySelector('[data-gaia-favicon]')).toBeNull()
    expect(document.querySelector('link[href="/original.ico"]')).toBe(priorIcon)
    priorIcon.remove()
    for (const link of previousIcons) document.head.append(link)
  })

  it('overrides an existing product locale in English', async () => {
    setLocationSearch('?gaia=full')
    const mock = createMockContext()
    const dispose = apply(mock.ctx)
    const t = mock.locale.bind('settings.account' as string)

    mock.locale.setLocale('en')
    expect(t('backToHarness')).toBe('Back to Gaia Harness')

    await dispose?.()
    expect(t('backToHarness')).toBe('Back to DeepSeek Harness')
  })

  it('switches a zh-active locale to en at apply', async () => {
    setLocationSearch('?gaia=embed&session=session-1')
    const mock = createMockContext()
    mock.locale.setLocale('zh')
    expect(mock.locale.getLocale().active).toBe('zh')

    const dispose = apply(mock.ctx)
    expect(mock.locale.getLocale().active).toBe('en')
    if (typeof dispose === 'function') await dispose()
  })

  it('reverts a later switch to zh back to en', async () => {
    setLocationSearch('?gaia=embed&session=session-1')
    const mock = createMockContext()
    const dispose = apply(mock.ctx)
    expect(mock.locale.getLocale().active).toBe('en')

    mock.locale.setLocale('zh')
    expect(mock.locale.getLocale().active).toBe('en')
    if (typeof dispose === 'function') await dispose()
  })

  it('does not call setLocale when locale is already en', async () => {
    setLocationSearch('?gaia=embed&session=session-1')
    const mock = createMockContext()
    expect(mock.locale.getLocale().active).toBe('en')
    const setLocaleSpy = vi.spyOn(mock.locale, 'setLocale')

    const dispose = apply(mock.ctx)
    expect(setLocaleSpy).not.toHaveBeenCalled()
    if (typeof dispose === 'function') await dispose()
  })

  it('shadows the Language settings row in Gaia frames', async () => {
    setLocationSearch('?gaia=embed&session=session-1')
    const mock = createMockContext()
    const dispose = apply(mock.ctx)

    const langEntry = mock.slotRegistrations.find(
      r => r.name === 'settings.general.item' && r.id === 'language',
    )
    expect(langEntry).toBeDefined()
    expect(langEntry?.priority).toBe(-1)
    if (typeof dispose === 'function') await dispose()
  })

  it('expands a collapsed full-mode sidebar once at a 900px viewport', () => {
    setLocationSearch('?gaia=full')
    const mock = createMockContext()
    mock.setLayoutSnapshot({ viewportWidth: 900, narrowExpanded: false, sidebar: 280 })
    apply(mock.ctx)

    expect(mock.toggleSidebarSpy).toHaveBeenCalledTimes(1)
    expect(mock.layout.layoutInfo.getSnapshot().narrowExpanded).toBe(true)
    // Simulate a user collapsing it. A later theme update does not override that choice.
    mock.layout.toggleSidebar()
    expect(mock.layout.layoutInfo.getSnapshot().narrowExpanded).toBe(false)
    window.dispatchEvent(new MessageEvent('message', {
      source: fakeParent,
      origin: window.location.origin,
      data: { source: 'gaia-dsh', v: 1, type: 'theme', mode: 'light' },
    }))
    expect(mock.toggleSidebarSpy).toHaveBeenCalledTimes(2)
    expect(mock.layout.layoutInfo.getSnapshot().narrowExpanded).toBe(false)
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

  it('forwards only the exact non-repeating drawer chords in embed mode', () => {
    setLocationSearch('?gaia=embed&session=s-test-123')
    const mock = createMockContext()
    apply(mock.ctx)

    const h = new KeyboardEvent('keydown', { code: 'KeyH', ctrlKey: true, altKey: true, cancelable: true })
    const m = new KeyboardEvent('keydown', { code: 'KeyM', metaKey: true, altKey: true, cancelable: true })
    window.dispatchEvent(h)
    window.dispatchEvent(m)
    expect(h.defaultPrevented).toBe(true)
    expect(m.defaultPrevented).toBe(true)
    expect(parentMessages).toContainEqual({ source: 'gaia-dsh', v: 1, type: 'drawerShortcut', action: 'toggle' })
    expect(parentMessages).toContainEqual({ source: 'gaia-dsh', v: 1, type: 'drawerShortcut', action: 'maximize' })

    parentMessages = []
    const rejected = [
      new KeyboardEvent('keydown', { code: 'KeyH', ctrlKey: true, altKey: true, shiftKey: true, cancelable: true }),
      new KeyboardEvent('keydown', { code: 'KeyM', ctrlKey: true, cancelable: true }),
      new KeyboardEvent('keydown', { code: 'KeyH', ctrlKey: true, altKey: true, repeat: true, cancelable: true }),
      new KeyboardEvent('keydown', { code: 'KeyM', ctrlKey: true, metaKey: true, altKey: true, cancelable: true }),
      new KeyboardEvent('keydown', { code: 'KeyQ', ctrlKey: true, altKey: true, cancelable: true }),
    ]
    rejected.forEach(event => window.dispatchEvent(event))
    expect(rejected.every(event => !event.defaultPrevented)).toBe(true)
    expect(parentMessages).toEqual([])
  })

  it('forwards allowlisted appShortcut chords with exact constraints in embed mode', () => {
    setLocationSearch('?gaia=embed&session=s-test-123')
    const mock = createMockContext()
    apply(mock.ctx)

    // KeyJ and KeyE allow shift: false or true
    const jNoShift = new KeyboardEvent('keydown', { code: 'KeyJ', ctrlKey: true, altKey: true, cancelable: true })
    const jShift = new KeyboardEvent('keydown', { code: 'KeyJ', metaKey: true, altKey: true, shiftKey: true, cancelable: true })
    const eNoShift = new KeyboardEvent('keydown', { code: 'KeyE', ctrlKey: true, altKey: true, cancelable: true })
    const eShift = new KeyboardEvent('keydown', { code: 'KeyE', ctrlKey: true, altKey: true, shiftKey: true, cancelable: true })
    window.dispatchEvent(jNoShift)
    window.dispatchEvent(jShift)
    window.dispatchEvent(eNoShift)
    window.dispatchEvent(eShift)

    expect(jNoShift.defaultPrevented).toBe(true)
    expect(jShift.defaultPrevented).toBe(true)
    expect(eNoShift.defaultPrevented).toBe(true)
    expect(eShift.defaultPrevented).toBe(true)
    expect(parentMessages).toContainEqual({ source: 'gaia-dsh', v: 1, type: 'appShortcut', code: 'KeyJ', shift: false })
    expect(parentMessages).toContainEqual({ source: 'gaia-dsh', v: 1, type: 'appShortcut', code: 'KeyJ', shift: true })
    expect(parentMessages).toContainEqual({ source: 'gaia-dsh', v: 1, type: 'appShortcut', code: 'KeyE', shift: false })
    expect(parentMessages).toContainEqual({ source: 'gaia-dsh', v: 1, type: 'appShortcut', code: 'KeyE', shift: true })

    // Other allowlisted keys include the screenshot and focus-mode chords.
    const otherCodes = ['KeyS', 'KeyL', 'KeyK', 'KeyD', 'KeyZ', 'Tab', 'KeyF', 'KeyG', 'KeyP', 'KeyA', 'KeyN']
    for (const code of otherCodes) {
      parentMessages = []
      const ev = new KeyboardEvent('keydown', { code, ctrlKey: true, altKey: true, cancelable: true })
      window.dispatchEvent(ev)
      expect(ev.defaultPrevented).toBe(true)
      expect(parentMessages).toEqual([{ source: 'gaia-dsh', v: 1, type: 'appShortcut', code, shift: false }])
    }

    parentMessages = []
    const pShift = new KeyboardEvent('keydown', { code: 'KeyP', ctrlKey: true, altKey: true, shiftKey: true, cancelable: true })
    window.dispatchEvent(pShift)
    expect(pShift.defaultPrevented).toBe(true)
    expect(parentMessages).toEqual([{ source: 'gaia-dsh', v: 1, type: 'appShortcut', code: 'KeyP', shift: true }])

    parentMessages = []
    const altGraphJ = new KeyboardEvent('keydown', { code: 'KeyJ', ctrlKey: true, altKey: true, cancelable: true })
    Object.defineProperty(altGraphJ, 'getModifierState', { value: (key: string) => key === 'AltGraph' })
    window.dispatchEvent(altGraphJ)
    expect(altGraphJ.defaultPrevented).toBe(true)
    expect(parentMessages).toEqual([{ source: 'gaia-dsh', v: 1, type: 'appShortcut', code: 'KeyJ', shift: false }])

    // Rejected chords: shift outside J/E/P, unlisted, repeat, both ctrl and meta
    parentMessages = []
    const rejected = [
      new KeyboardEvent('keydown', { code: 'KeyN', ctrlKey: true, altKey: true, shiftKey: true, cancelable: true }),
      new KeyboardEvent('keydown', { code: 'KeyL', ctrlKey: true, altKey: true, shiftKey: true, cancelable: true }),
      new KeyboardEvent('keydown', { code: 'KeyP', ctrlKey: true, altKey: true, repeat: true, cancelable: true }),
      new KeyboardEvent('keydown', { code: 'KeyX', ctrlKey: true, altKey: true, cancelable: true }),
      new KeyboardEvent('keydown', { code: 'KeyJ', ctrlKey: true, altKey: true, repeat: true, cancelable: true }),
      new KeyboardEvent('keydown', { code: 'KeyJ', ctrlKey: true, metaKey: true, altKey: true, cancelable: true }),
    ]
    rejected.forEach(event => window.dispatchEvent(event))
    expect(rejected.every(event => !event.defaultPrevented)).toBe(true)
    expect(parentMessages).toEqual([])
  })

  it('forwards only registered custom chords with exact modifiers and matching releases', () => {
    setLocationSearch('?gaia=embed&session=s-test-123')
    const mock = createMockContext()
    apply(mock.ctx)
    window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      source: fakeParent,
      data: { source: 'gaia-dsh', v: 1, type: 'appChords', chords: [
        null,
        { code: 'KeyX', mod: true, alt: false, shift: true, extra: true },
        { code: 'KeyX', mod: true, alt: false, shift: true },
        { code: 'KeyQ', mod: false, alt: false, shift: false },
        { code: 'KeyJ', mod: false, alt: true, shift: false },
      ] },
    }))

    const custom = new KeyboardEvent('keydown', { code: 'KeyX', metaKey: true, shiftKey: true, cancelable: true })
    window.dispatchEvent(custom)
    expect(custom.defaultPrevented).toBe(true)
    expect(parentMessages.at(-1)).toEqual({ source: 'gaia-dsh', v: 1, type: 'appShortcut', code: 'KeyX', shift: true, mod: true, alt: false })
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyX' }))
    expect(parentMessages.at(-1)).toEqual({ source: 'gaia-dsh', v: 1, type: 'appShortcut', code: 'KeyX', shift: true, mod: true, alt: false, phase: 'keyup' })

    parentMessages = []
    const unregistered = new KeyboardEvent('keydown', { code: 'KeyY', ctrlKey: true, altKey: true, cancelable: true })
    window.dispatchEvent(unregistered)
    expect(unregistered.defaultPrevented).toBe(false)
    expect(parentMessages).toEqual([])

    const customOverridesFixed = new KeyboardEvent('keydown', { code: 'KeyJ', altKey: true, cancelable: true })
    window.dispatchEvent(customOverridesFixed)
    expect(customOverridesFixed.defaultPrevented).toBe(true)
    expect(parentMessages).toEqual([{ source: 'gaia-dsh', v: 1, type: 'appShortcut', code: 'KeyJ', shift: false, mod: false, alt: true }])
  })

  it('forwards drawer chords and appShortcut chords from full-shell mode without blocking navigation keys', () => {
    setLocationSearch('?gaia=full')
    const mock = createMockContext()
    apply(mock.ctx)

    const h = new KeyboardEvent('keydown', { code: 'KeyH', ctrlKey: true, altKey: true, cancelable: true })
    window.dispatchEvent(h)
    expect(h.defaultPrevented).toBe(true)
    expect(parentMessages).toContainEqual({ source: 'gaia-dsh', v: 1, type: 'drawerShortcut', action: 'toggle' })

    const j = new KeyboardEvent('keydown', { code: 'KeyJ', ctrlKey: true, altKey: true, cancelable: true })
    window.dispatchEvent(j)
    expect(j.defaultPrevented).toBe(true)
    expect(parentMessages).toContainEqual({ source: 'gaia-dsh', v: 1, type: 'appShortcut', code: 'KeyJ', shift: false })

    // EMBED_BLOCKED_KEYS (e.g. KeyB with bare ctrlKey) are not blocked in full mode
    const b = new KeyboardEvent('keydown', { code: 'KeyB', ctrlKey: true, cancelable: true })
    window.dispatchEvent(b)
    expect(b.defaultPrevented).toBe(false)
  })

  it.each(['embed', 'full'])('forwards voice press and release without retaining modifiers in %s mode', async (mode) => {
    setLocationSearch(`?gaia=${mode}&session=s-test-123`)
    const mock = createMockContext()
    const dispose = apply(mock.ctx)
    window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      source: fakeParent,
      data: { source: 'gaia-dsh', v: 1, type: 'appChords', chords: [
        { code: 'KeyV', mod: true, alt: true, shift: false },
        { code: 'KeyV', mod: true, alt: true, shift: true },
      ] },
    }))
    for (const shift of [false, true]) {
      parentMessages = []
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyV' }))
      expect(parentMessages).toEqual([])
      const press = new KeyboardEvent('keydown', { code: 'KeyV', metaKey: true, altKey: true, shiftKey: shift, cancelable: true })
      window.dispatchEvent(press)
      expect(press.defaultPrevented).toBe(true)
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV', metaKey: true, altKey: true, repeat: true }))
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyR' }))
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyV' }))
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyV' }))
      expect(parentMessages).toEqual([
        { source: 'gaia-dsh', v: 1, type: 'appShortcut', code: 'KeyV', shift, mod: true, alt: true },
        { source: 'gaia-dsh', v: 1, type: 'appShortcut', code: 'KeyV', shift, mod: true, alt: true, phase: 'keyup' },
      ])
    }
    const altGraph = new KeyboardEvent('keydown', { code: 'KeyJ', ctrlKey: true, altKey: true })
    Object.defineProperty(altGraph, 'getModifierState', { value: (key: string) => key === 'AltGraph' })
    parentMessages = []
    window.dispatchEvent(altGraph)
    expect(parentMessages).toEqual([{ source: 'gaia-dsh', v: 1, type: 'appShortcut', code: 'KeyJ', shift: false }])
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV', ctrlKey: true, altKey: true }))
    await dispose?.()
    parentMessages = []
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyV' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV', ctrlKey: true, altKey: true }))
    expect(parentMessages).toEqual([])
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

  it('reports connection status in full mode and stops after dispose', async () => {
    setLocationSearch('?gaia=full')
    const mock = createMockContext()
    const dispose = apply(mock.ctx)

    expect(parentMessages).toContainEqual({ source: 'gaia-dsh', v: 1, type: 'status', connected: true, reconnecting: false })
    mock.setConnectionState('connecting')
    expect(parentMessages).toContainEqual({ source: 'gaia-dsh', v: 1, type: 'status', connected: false, reconnecting: true })

    await dispose?.()
    const count = parentMessages.length
    mock.setConnectionState('connected')
    expect(parentMessages).toHaveLength(count)
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

    expect(parentMessages).toContainEqual({ source: 'gaia-dsh', v: 1, type: 'title', title: 'My Custom Title', explicit: true })
  })

  it('marks a placeholder display title as not explicit', () => {
    setLocationSearch('?gaia=embed&session=s-test-123')
    const mock = createMockContext()
    apply(mock.ctx)

    mock.setSessionList({
      phase: 'ready',
      byId: {
        's-test-123': {
          id: SessionId('s-test-123'),
          displayTitle: 'project-folder',
        },
      },
    })

    expect(parentMessages).toContainEqual({ source: 'gaia-dsh', v: 1, type: 'title', title: 'project-folder', explicit: false })
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
    expect(parentMessages.filter(m => m.type === 'branched')).toEqual([])
    // Once our Session is displayed, nothing more happens.
    mock.uiWorkspace.openSession.mockClear()
    shown.setAttribute('data-conversation-session', 's-test-123')
    await new Promise((resolve) => { setTimeout(resolve, 0) })
    expect(mock.uiWorkspace.openSession).not.toHaveBeenCalled()
    shown.remove()
    if (typeof dispose === 'function') await dispose()
  })

  it('hands this frame\'s message fork to Gaia once and restores the pinned session', async () => {
    setLocationSearch('?gaia=embed&session=pinned')
    const mock = createMockContext()
    mock.setSessionList({ phase: 'ready', byId: { pinned: { id: SessionId('pinned'), displayTitle: 'Pinned' } } })
    const originalFork = mock.sessions.fork
    const dispose = apply(mock.ctx)
    const child = await mock.ctx.sessions.fork({ sessionId: SessionId('pinned'), atSeq: 12, increaseTitle: true })
    expect(originalFork).toHaveBeenCalledWith({ sessionId: 'pinned', atSeq: 12, increaseTitle: true })
    // The fork resolves before chat opens its returned child; no list update is required.
    expect(parentMessages.filter(m => m.type === 'branched')).toEqual([])
    const shown = document.createElement('div')
    shown.setAttribute('data-conversation-session', child)
    document.body.append(shown)
    await new Promise((resolve) => { setTimeout(resolve, 0) })
    expect(parentMessages.filter(m => m.type === 'branched')).toEqual([
      { source: 'gaia-dsh', v: 1, type: 'branched', sessionId: child },
    ])
    expect(mock.uiWorkspace.openSession).toHaveBeenLastCalledWith('pinned')
    shown.setAttribute('data-conversation-session', 'pinned')
    await new Promise((resolve) => { setTimeout(resolve, 0) })
    shown.setAttribute('data-conversation-session', child)
    await new Promise((resolve) => { setTimeout(resolve, 0) })
    expect(parentMessages.filter(m => m.type === 'branched')).toHaveLength(1)
    if (typeof dispose === 'function') await dispose()
    expect(mock.sessions.fork).toBe(originalFork)
    shown.remove()
  })

  it('does not report restores, resume, subagents, unrelated forks or failed forks as branches', async () => {
    setLocationSearch('?gaia=embed&session=pinned')
    const mock = createMockContext()
    mock.setSessionList({ phase: 'ready', byId: { pinned: { id: SessionId('pinned'), displayTitle: 'Pinned' } } })
    const originalFork = mock.sessions.fork
    apply(mock.ctx)
    await mock.ctx.sessions.fork({ sessionId: SessionId('another-frame'), atSeq: 12, increaseTitle: true })
    await mock.ctx.sessions.fork({ sessionId: SessionId('pinned'), increaseTitle: true })
    await mock.ctx.sessions.fork({ sessionId: SessionId('pinned'), atSeq: 12 })
    originalFork.mockRejectedValueOnce(new Error('fork unavailable'))
    await expect(mock.ctx.sessions.fork({ sessionId: SessionId('pinned'), atSeq: 12, increaseTitle: true })).rejects.toThrow('fork unavailable')
    const shown = document.createElement('div')
    document.body.append(shown)
    for (const id of ['fork-child', 'restored', 'resumed', 'subagent']) {
      shown.setAttribute('data-conversation-session', id)
      await new Promise((resolve) => { setTimeout(resolve, 0) })
    }
    expect(parentMessages.filter(m => m.type === 'branched')).toEqual([])
    shown.remove()
  })

  it('leaves forks and navigation unchanged in full mode', async () => {
    setLocationSearch('?gaia=full')
    const mock = createMockContext()
    const originalFork = mock.sessions.fork
    apply(mock.ctx)
    expect(mock.sessions.fork).toBe(originalFork)
    const child = await mock.ctx.sessions.fork({ sessionId: SessionId('pinned'), atSeq: 12, increaseTitle: true })
    const shown = document.createElement('div')
    shown.setAttribute('data-conversation-session', child)
    document.body.append(shown)
    await new Promise((resolve) => { setTimeout(resolve, 0) })
    expect(mock.uiWorkspace.openSession).not.toHaveBeenCalled()
    expect(parentMessages.filter(m => m.type === 'branched')).toEqual([])
    shown.remove()
  })

  it('restores the fork method when disposed during a pending fork', async () => {
    setLocationSearch('?gaia=embed&session=pinned')
    const mock = createMockContext()
    let resolveFork: ((id: SessionId) => void) | undefined
    const originalFork = mock.sessions.fork
    originalFork.mockImplementationOnce(() => new Promise<SessionId>((resolve) => { resolveFork = resolve }))
    const dispose = apply(mock.ctx)
    const pending = mock.ctx.sessions.fork({ sessionId: SessionId('pinned'), atSeq: 0, increaseTitle: true })
    if (typeof dispose === 'function') await dispose()
    expect(mock.sessions.fork).toBe(originalFork)
    resolveFork?.(SessionId('late-child'))
    await expect(pending).resolves.toBe('late-child')
    expect(parentMessages.filter(m => m.type === 'branched')).toEqual([])
  })

  it('validates outgoing branch ids and rejects extra fields', () => {
    postToParent({ source: 'gaia-dsh', v: 1, type: 'branched', sessionId: 'child-1' })
    for (const sessionId of ['', '../child', 'child with spaces', 'a'.repeat(129)]) {
      postToParent({ source: 'gaia-dsh', v: 1, type: 'branched', sessionId })
    }
    const extra = { source: 'gaia-dsh', v: 1, type: 'branched', sessionId: 'child-2', path: '/secret' } as const
    postToParent(extra)
    expect(parentMessages).toEqual([{ source: 'gaia-dsh', v: 1, type: 'branched', sessionId: 'child-1' }])
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

  describe('Gaia command faces', () => {
    it.each(['embed', 'full'] as const)('registers /starred and /rename faces in %s mode', async (mode) => {
      setLocationSearch(mode === 'full' ? '?gaia=full' : '?gaia=embed&session=s-test-123')
      const mock = createMockContext()
      apply(mock.ctx)
      for (let i = 0; i < 10; i++) await Promise.resolve()

      expect(mock.commandUi.face).toHaveBeenCalledWith(expect.objectContaining({ name: 'starred' }))
      expect(mock.commandUi.face).toHaveBeenCalledWith(expect.objectContaining({ name: 'rename' }))
    })
  })

  describe('Gaia embed notifications', () => {
    it('emits turnDone when running transitions from true to false', async () => {
      setLocationSearch('?gaia=embed&session=s-test-123')
      const mock = createMockContext()
      mock.setSessionList({
        phase: 'ready',
        byId: {
          's-test-123': { id: SessionId('s-test-123'), title: 'Refactor Agent', displayTitle: 'Refactor Agent' },
        },
      })
      const dispose = apply(mock.ctx)

      // Initial mount is not running; prime running=true
      mock.setSessionStatus(SessionId('s-test-123'), true)
      expect(parentMessages.filter(m => m.type === 'notify')).toHaveLength(0)

      // Turn completes normally
      mock.setSessionStatus(SessionId('s-test-123'), false)
      expect(parentMessages).toContainEqual({
        source: 'gaia-dsh',
        v: 1,
        type: 'notify',
        event: 'turnDone',
        title: 'Refactor Agent',
        sessionId: 's-test-123',
        shown: true,
      })

      if (typeof dispose === 'function') await dispose()
    })

    it('emits turnError when the turn ended with an error event', async () => {
      setLocationSearch('?gaia=embed&session=s-test-123')
      const mock = createMockContext()
      mock.setSessionList({
        phase: 'ready',
        byId: {
          's-test-123': { id: SessionId('s-test-123'), title: 'Failing Task', displayTitle: 'Failing Task' },
        },
      })
      mock.setSessionBinding(SessionId('s-test-123'), {
        eventSource: {
          getSnapshot: () => ({
            entries: [
              {
                type: 'event',
                event: {
                  type: 'turn/end',
                  data: { reason: { kind: 'error', error: { message: 'Network timeout' } } },
                },
              },
            ],
          }),
        },
      })
      const dispose = apply(mock.ctx)

      mock.setSessionStatus(SessionId('s-test-123'), true)
      mock.setSessionStatus(SessionId('s-test-123'), false)

      expect(parentMessages).toContainEqual({
        source: 'gaia-dsh',
        v: 1,
        type: 'notify',
        event: 'turnError',
        title: 'Failing Task',
        sessionId: 's-test-123',
        shown: true,
      })

      if (typeof dispose === 'function') await dispose()
    })

    it('does not notify when the user aborted the turn', async () => {
      setLocationSearch('?gaia=embed&session=s-test-123')
      const mock = createMockContext()
      mock.setSessionBinding(SessionId('s-test-123'), {
        eventSource: {
          getSnapshot: () => ({
            entries: [{ type: 'event', event: { type: 'turn/end', data: { reason: { kind: 'aborted', reason: { kind: 'user' } } } } }],
          }),
        },
      })
      const dispose = apply(mock.ctx)

      mock.setSessionStatus(SessionId('s-test-123'), true)
      mock.setSessionStatus(SessionId('s-test-123'), false)

      expect(parentMessages.filter(m => m.type === 'notify')).toHaveLength(0)

      if (typeof dispose === 'function') await dispose()
    })

    it('emits needsInput when a pending interaction arrives and does not duplicate', async () => {
      setLocationSearch('?gaia=embed&session=s-test-123')
      const mock = createMockContext()
      mock.setSessionList({
        phase: 'ready',
        byId: {
          's-test-123': { id: SessionId('s-test-123'), title: 'Approval Session', displayTitle: 'Approval Session' },
        },
      })
      const dispose = apply(mock.ctx)

      // Pending interaction appears
      mock.setSessionStatus(SessionId('s-test-123'), true, { key: 'approval-req-1' })
      const notifyInputs = parentMessages.filter(m => m.type === 'notify' && m.event === 'needsInput')
      expect(notifyInputs).toHaveLength(1)
      expect(notifyInputs[0]).toEqual({
        source: 'gaia-dsh',
        v: 1,
        type: 'notify',
        event: 'needsInput',
        title: 'Approval Session',
        sessionId: 's-test-123',
        shown: true,
      })

      // Re-publishing the same pending interaction key must not emit again
      mock.setSessionStatus(SessionId('s-test-123'), true, { key: 'approval-req-1' })
      expect(parentMessages.filter(m => m.type === 'notify' && m.event === 'needsInput')).toHaveLength(1)

      // A new interaction key emits
      mock.setSessionStatus(SessionId('s-test-123'), true, { key: 'approval-req-2' })
      expect(parentMessages.filter(m => m.type === 'notify' && m.event === 'needsInput')).toHaveLength(2)

      if (typeof dispose === 'function') await dispose()
    })

    it('keeps one needsInput notification through question expiry and late reply, including reload', async () => {
      setLocationSearch('?gaia=embed&session=s-test-123')
      const mock = createMockContext()
      const dispose = apply(mock.ctx)

      mock.setSessionStatus(SessionId('s-test-123'), true, { key: 'question-call-1' })
      expect(parentMessages.filter(m => m.type === 'notify' && m.event === 'needsInput')).toHaveLength(1)

      // Expiry and queued or delivered replies retain the question's interaction key.
      mock.setSessionStatus(SessionId('s-test-123'), false, { key: 'question-call-1' })
      mock.setSessionStatus(SessionId('s-test-123'), true, { key: 'question-call-1' })
      mock.setSessionStatus(SessionId('s-test-123'), true)
      mock.setSessionStatus(SessionId('s-test-123'), false, { key: 'question-call-1' })
      expect(parentMessages.filter(m => m.type === 'notify' && m.event === 'needsInput')).toHaveLength(1)

      if (typeof dispose === 'function') await dispose()

      // A notifier that starts with an already-pending question records its key as seen.
      const reloaded = createMockContext()
      reloaded.setSessionStatus(SessionId('s-test-123'), false, { key: 'question-call-1' })
      const disposeReloaded = apply(reloaded.ctx)
      expect(parentMessages.filter(m => m.type === 'notify' && m.event === 'needsInput')).toHaveLength(1)
      if (typeof disposeReloaded === 'function') await disposeReloaded()
    })

    it('opens a notified session when Gaia asks the full shell to', async () => {
      setLocationSearch('?gaia=full')
      const mock = createMockContext()
      const dispose = apply(mock.ctx)
      mock.uiWorkspace.openSession.mockClear()
      const send = (data: object) => window.dispatchEvent(new MessageEvent('message', {
        source: fakeParent, origin: window.location.origin, data: { source: 'gaia-dsh', v: 1, ...data },
      }))
      send({ type: 'openSession', sessionId: 's-full-9' })
      expect(mock.uiWorkspace.openSession).toHaveBeenCalledWith('s-full-9')
      // Invalid ids and extra keys are refused by the bridge guard.
      send({ type: 'openSession', sessionId: '../etc' })
      send({ type: 'openSession', sessionId: 's-ok', extra: 1 })
      expect(mock.uiWorkspace.openSession).toHaveBeenCalledTimes(1)
      if (typeof dispose === 'function') await dispose()
    })

    it('emits notifications across sessions in full mode', async () => {
      setLocationSearch('?gaia=full')
      const mock = createMockContext()
      mock.setSessionList({
        phase: 'ready',
        byId: {
          's-full-1': { id: SessionId('s-full-1'), title: 'Full Session 1', displayTitle: 'Full Session 1', cwd: '/home/u/proj', retainedBy: {} },
          's-full-2': { id: SessionId('s-full-2'), title: 'Full Session 2', displayTitle: 'Full Session 2', retainedBy: { mainView: 1 } },
        },
      })
      const dispose = apply(mock.ctx)

      mock.setSessionStatus(SessionId('s-full-1'), true)
      mock.setSessionStatus(SessionId('s-full-1'), false)
      mock.setSessionStatus(SessionId('s-full-2'), true)
      mock.setSessionStatus(SessionId('s-full-2'), false)

      // A background session is not shown; the main-view one is.
      expect(parentMessages).toContainEqual({
        source: 'gaia-dsh',
        v: 1,
        type: 'notify',
        event: 'turnDone',
        title: 'Full Session 1',
        sessionId: 's-full-1',
        workspacePath: '/home/u/proj',
        shown: false,
      })
      expect(parentMessages).toContainEqual({
        source: 'gaia-dsh',
        v: 1,
        type: 'notify',
        event: 'turnDone',
        title: 'Full Session 2',
        sessionId: 's-full-2',
        shown: true,
      })

      if (typeof dispose === 'function') await dispose()
    })
  })
})

describe('embed styles', () => {
  it('collapses the frame to one track so the conversation column is not placed in a 0px track', async () => {
    const { GAIA_EMBED_CHROME_CSS } = await import('../src/client/styles.ts')
    expect(GAIA_EMBED_CHROME_CSS).toContain('grid-template-columns: minmax(0, 1fr) !important;')
    expect(GAIA_EMBED_CHROME_CSS).not.toMatch(/grid-template-columns:\s*0px/)
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
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'theme', mode: 'dark', palette: { primary: '#ea580c', primaryForeground: '#ffffff', destructive: '#ef4444' } })).toBe(true)
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'theme', mode: 'dark', palette: { background: 'url(x)' } })).toBe(false)
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'theme', mode: 'dark', palette: { primary: 'url(x)' } })).toBe(false)
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'theme', mode: 'dark', palette: { destructive: 'red; evil: true' } })).toBe(false)
    expect(isGaiaIncomingMessage({ source: 'gaia-dsh', v: 1, type: 'theme', mode: 'dark', palette: { unknownKey: '#fff' } })).toBe(false)
  })

  it('maps Gaia colors onto DSH alias tokens for both schemes', async () => {
    const { paletteTokens } = await import('../src/client/palette.ts')
    const tokens = paletteTokens({
      background: 'hsl(0 0% 3.9%)',
      foreground: 'hsl(0 0% 90%)',
      border: 'hsl(20 80% 45%)',
      accent: 'oklch(70.5% 0.213 47.604)',
      primary: '#ea580c',
      primaryForeground: '#ffffff',
      destructive: '#ef4444',
    })
    expect(tokens['--dsw-alias-bg-base']).toEqual({ light: 'hsl(0 0% 3.9%)', dark: 'hsl(0 0% 3.9%)' })
    expect(tokens['--dsw-alias-label-primary']?.dark).toBe('hsl(0 0% 90%)')
    expect(tokens['--dsw-alias-border-l2']?.dark).toBe('hsl(20 80% 45%)')
    expect(tokens['--dsw-alias-link']?.dark).toBe('oklch(70.5% 0.213 47.604)')
    expect(tokens['--dsw-alias-bg-layer-2']?.dark).toContain('color-mix(')
    expect(tokens['--dsw-alias-button-primary-fill']?.dark).toBe('#ea580c')
    expect(tokens['--dsw-alias-button-primary-hover']?.dark).toContain('color-mix(in srgb, #ea580c 90%')
    expect(tokens['--dsw-alias-label-primary-foreground']?.dark).toBe('#ffffff')
    expect(tokens['--dsw-alias-state-error-primary']?.dark).toBe('#ef4444')
    expect(tokens['--dsw-alias-interactive-bg-hover-danger']?.dark).toContain('color-mix(in srgb, #ef4444 12%')
    expect(paletteTokens({})).toEqual({})

    // Partial palette leaves unsupplied tokens untouched
    const partial = paletteTokens({ primary: '#ea580c' })
    expect(partial['--dsw-alias-button-primary-fill']?.dark).toBe('#ea580c')
    expect(partial['--dsw-alias-button-primary-hover']?.dark).toBe('#ea580c')
    expect(partial['--dsw-alias-label-primary-foreground']).toBeUndefined()
    expect(partial['--dsw-alias-state-error-primary']).toBeUndefined()
    expect(partial['--dsw-alias-interactive-bg-hover-danger']).toBeUndefined()
    expect(partial['--dsw-alias-bg-base']).toBeUndefined()
  })
})

describe('embed integration of the palette and header entries', () => {
  it('applies a received palette and replaces desktop file actions in embed mode', async () => {
    Object.defineProperty(window, 'location', { value: new URL('http://localhost:3000/?gaia=embed&session=s-test-123'), writable: true, configurable: true })
    const ctx = new Context()
    ctx.provide('locale', new LocaleRuntime(ctx))
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
    expect(registrations).toContainEqual(expect.objectContaining({ name: 'sidebar.right.tab.document.actions', id: 'open-in-app', priority: -1 }))
    expect(registrations).toContainEqual(expect.objectContaining({ name: 'sidebar.right.tab.document.unpreviewable', id: 'open-in-app', priority: -1 }))
    expect(registrations).not.toContainEqual(expect.objectContaining({ id: 'gaia-maximize' }))
    expect(registrations).toContainEqual(expect.objectContaining({ name: 'settings.general.item', id: 'appearance', priority: -1 }))
    expect(registrations).toContainEqual(expect.objectContaining({ name: 'settings.general.item', id: 'language', priority: -1 }))
    window.dispatchEvent(new MessageEvent('message', {
      data: { source: 'gaia-dsh', v: 1, type: 'theme', mode: 'dark', palette: { background: 'hsl(0 0% 3.9%)', foreground: 'hsl(0 0% 90%)' } },
      origin: window.location.origin, source: window.parent,
    }))
    expect(overrideTokens).toHaveBeenCalledWith('gaia-embed-palette', expect.objectContaining({ '--dsw-alias-bg-base': { light: 'hsl(0 0% 3.9%)', dark: 'hsl(0 0% 3.9%)' } }))
  })
})

describe('embed composer styles', () => {
  it('applies the composer skin in both modes, with a reduced-motion fallback', async () => {
    const { GAIA_SKIN_CSS } = await import('../src/client/styles.ts')
    expect(GAIA_SKIN_CSS).toContain(':is(html[data-gaia-embed], html[data-gaia-full]) [data-composer-card] {')
    expect(GAIA_SKIN_CSS).toContain('background: var(--dsw-alias-bg-base) !important;')
    expect(GAIA_SKIN_CSS).toContain('border: 1px solid var(--dsw-alias-border-l2) !important;')
    expect(GAIA_SKIN_CSS).toMatch(/prefers-reduced-motion: reduce[\s\S]*animation: none/)
    for (const rule of GAIA_SKIN_CSS.split('}').filter(r => r.includes('data-composer-card') && r.includes('{'))) {
      expect(rule.trim().startsWith(':is(html[data-gaia-embed], html[data-gaia-full])') || rule.includes('@media') || rule.includes('@property') || rule.includes('@keyframes')).toBe(true)
    }
  })
})

describe('Gaia hero styles', () => {
  it('hides the stock headline in both frames while keeping workspace chrome embed-only', async () => {
    const { GAIA_SKIN_CSS, GAIA_EMBED_CHROME_CSS } = await import('../src/client/styles.ts')
    const headlineSelector = ':is(html[data-gaia-embed], html[data-gaia-full]) [data-hero-headline] {'
    const start = GAIA_SKIN_CSS.indexOf(headlineSelector)
    expect(start).toBeGreaterThan(-1)
    expect(GAIA_SKIN_CSS.slice(start, GAIA_SKIN_CSS.indexOf('}', start))).toContain('display: none !important;')
    expect(GAIA_EMBED_CHROME_CSS).toContain('html[data-gaia-embed] [data-hero-workspace] {')
    expect(GAIA_EMBED_CHROME_CSS).not.toContain('[data-hero-headline]')
  })
})

describe('embed send button', () => {
  it('shows an accent outline at rest and an accent fill on hover, never DSH blue', async () => {
    const { GAIA_SKIN_CSS } = await import('../src/client/styles.ts')
    const selector = ':is(html[data-gaia-embed], html[data-gaia-full]) [data-composer-primary]'
    const ruleOf = (target: string) => GAIA_SKIN_CSS.split(`${target} {`)[1]?.split('}')[0] ?? ''
    const rest = ruleOf(selector)
    expect(rest).toContain('background: var(--dsw-alias-bg-base) !important;')
    expect(rest).toContain('color: var(--dsw-alias-button-info-fill) !important;')
    const hover = ruleOf(`${selector}:hover:not(:disabled)`)
    expect(hover).toContain('background: var(--dsw-alias-button-info-fill) !important;')
    expect(hover).toContain('color: var(--dsw-alias-bg-base) !important;')
    const { paletteTokens } = await import('../src/client/palette.ts')
    expect(paletteTokens({ accent: '#e8590c' })['--dsw-alias-button-info-hover']?.dark).toBe('color-mix(in oklch, #e8590c, black 12%)')
    const tokens = paletteTokens({ accent: '#e8590c' })
    expect(tokens['--dsw-alias-scrollbar-bg-l1']?.dark).toBe('color-mix(in srgb, #e8590c 40%, transparent)')
    expect(tokens['--dsw-alias-scrollbar-bg-l2']?.light).toBe('color-mix(in srgb, #e8590c 40%, transparent)')
    expect(tokens['--dsw-alias-scrollbar-hover-l1']?.dark).toBe('color-mix(in srgb, #e8590c 70%, transparent)')
    expect(tokens['--dsw-alias-scrollbar-hover-l2']?.light).toBe('color-mix(in srgb, #e8590c 70%, transparent)')
  })
})

describe('embed table styles', () => {
  it('colors chat table column titles with the accent and rules the header in the app border', async () => {
    const { GAIA_SKIN_CSS } = await import('../src/client/styles.ts')
    const selector = ':is(html[data-gaia-embed], html[data-gaia-full]) table:not([data-gaia-markdown] table) th {'
    const start = GAIA_SKIN_CSS.indexOf(selector)
    expect(start).toBeGreaterThan(-1)
    const rule = [undefined, GAIA_SKIN_CSS.slice(start, GAIA_SKIN_CSS.indexOf('}', start))]
    expect(rule[1]).toContain('color: var(--dsw-alias-link);')
    expect(rule[1]).toContain('border-bottom: 1px solid var(--dsw-alias-border-l2);')
  })
})

describe('active session title style', () => {
  it('colors only the selected session row title with Gaia accent', async () => {
    const { GAIA_SKIN_CSS } = await import('../src/client/styles.ts')
    const selector = ':is(html[data-gaia-embed], html[data-gaia-full]) [data-row-key^="session:"][role="treeitem"][aria-selected="true"] > span:nth-child(2) {'
    const start = GAIA_SKIN_CSS.indexOf(selector)
    expect(start).toBeGreaterThan(-1)
    const rule = GAIA_SKIN_CSS.slice(start, GAIA_SKIN_CSS.indexOf('}', start))
    expect(rule).toContain('color: var(--dsw-alias-link);')
  })
})

describe('Gaia settings modal skin and maximize styles', () => {
  it('defines 960x880 panel geometry, maximize state, and token overrides', async () => {
    const { GAIA_SETTINGS_CSS } = await import('../src/client/styles.ts')
    expect(GAIA_SETTINGS_CSS).toContain('[data-shortcut-modal="settings"]')
    expect(GAIA_SETTINGS_CSS).toContain('width: min(960px, calc(100vw - 48px))')
    expect(GAIA_SETTINGS_CSS).toContain('height: min(880px, calc(100vh - 2 * max(24px, var(--dsh-frame-top-clearance, 24px))))')
    expect(GAIA_SETTINGS_CSS).toContain('html[data-gaia-settings-maximized] [data-shortcut-modal="settings"]')
    expect(GAIA_SETTINGS_CSS).toContain('--dsw-alias-brand-primary: var(--dsw-alias-link)')
    expect(GAIA_SETTINGS_CSS).toContain('--dsw-radius-md: 6px')
    expect(GAIA_SETTINGS_CSS).toContain('--dsw-radius-sm: 6px')
    expect(GAIA_SETTINGS_CSS).toContain('box-shadow: 0 0 0 1px var(--dsw-alias-link)')
    expect(GAIA_SETTINGS_CSS).not.toContain('inset 2px 0 0')
  })
})

describe('Gaia frame settings registrations and maximize lifecycle', () => {
  it('registers settings action and appearance item only in Gaia frames and handles maximize attribute', async () => {
    const { SETTINGS_MAXIMIZED_ATTR, SETTINGS_MAXIMIZED_KEY } = await import('../src/client/settings-maximize.ts')

    // 1. Outside an iframe (window.parent === window), apply returns undefined and registers nothing
    Object.defineProperty(window, 'parent', { value: window, configurable: true })
    Object.defineProperty(window, 'location', { value: new URL('http://localhost:3000/?gaia=full'), configurable: true })
    const outsideCtx = new Context()
    const outsideRegistrations: { name: string; id: string }[] = []
    outsideCtx.provide('slots', { inject: (_n: string, f: () => () => void) => f(), register: (o: { name: string; id: string }) => { outsideRegistrations.push(o); return () => {} } })
    const outsideResult = apply(outsideCtx)
    expect(outsideResult).toBeUndefined()
    expect(outsideRegistrations).toHaveLength(0)

    // 2. Inside an iframe with maximized stored in localStorage
    window.localStorage.setItem(SETTINGS_MAXIMIZED_KEY, '1')
    const fakeParent = { postMessage: vi.fn() } as unknown as Window
    Object.defineProperty(window, 'parent', { value: fakeParent, configurable: true })
    const insideCtx = new Context()
    insideCtx.provide('locale', new LocaleRuntime(insideCtx))
    insideCtx.provide('theme', { register: vi.fn(() => () => {}), setTheme: vi.fn(), overrideTokens: vi.fn(() => () => {}) })
    insideCtx.provide('connection', { state: { getSnapshot: () => 'connected', subscribe: () => () => {} } })
    insideCtx.provide('layout', { toggleSidebar: vi.fn(), layoutInfo: { getSnapshot: () => ({ viewportWidth: 1280, sidebar: 280 }), subscribe: () => () => {} } })
    insideCtx.provide('uiSession', { sessionStatus: { getSnapshot: () => new Map(), subscribe: () => () => {} } })
    const insideRegistrations: { name: string; id: string }[] = []
    insideCtx.provide('slots', { inject: (_n: string, f: () => () => void) => f(), register: (o: { name: string; id: string }) => { insideRegistrations.push(o); return () => {} } })

    const dispose = apply(insideCtx)
    expect(insideRegistrations).not.toContainEqual(expect.objectContaining({ id: 'gaia-maximize' }))
    expect(insideRegistrations).toContainEqual(expect.objectContaining({ name: 'settings.general.item', id: 'appearance' }))
    expect(insideRegistrations).toContainEqual(expect.objectContaining({ name: 'settings.general.item', id: 'language' }))
    expect(document.documentElement.hasAttribute(SETTINGS_MAXIMIZED_ATTR)).toBe(false)
    expect(window.localStorage.getItem(SETTINGS_MAXIMIZED_KEY)).toBeNull()

    if (typeof dispose === 'function') await dispose()
    expect(document.documentElement.hasAttribute(SETTINGS_MAXIMIZED_ATTR)).toBe(false)
    window.localStorage.clear()
    Object.defineProperty(window, 'parent', { value: window, configurable: true })
  })
})

describe('sanitizeNotifyTitle', () => {
  it('strips control characters, trims, and bounds length to 200 characters', () => {
    expect(sanitizeNotifyTitle(undefined)).toBe('')
    expect(sanitizeNotifyTitle('')).toBe('')
    expect(sanitizeNotifyTitle('   hello world   ')).toBe('hello world')
    expect(sanitizeNotifyTitle('hello\x00\x07\x1F world\x7F')).toBe('hello world')
    expect(sanitizeNotifyTitle('a'.repeat(250))).toBe('a'.repeat(200))
  })
})
