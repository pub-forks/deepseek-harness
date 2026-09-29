/**
 * Gaia iframe embed client plugin.
 * Activates single-session embed presentation when ?gaia=embed&session=<id> is present.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
// Type-only: the ctx.sidebarRight Context merge.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
// Type-only: the `settings` locale namespace the document action reads.
import type {} from '@deepseek-ai/dsh-client-ui-settings-general/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-open-in-app/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/client'
import type { SessionInput, TokenSpan } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type { SelectOption } from '@deepseek-ai/dsh-client-ui-commands/client'
import { IconClockOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import { isAppShortcutCandidate, isGaiaIncomingMessage, isValidSessionId, postToParent } from './bridge.ts'
import { lineParam, resolveFileAddress } from './open-file.ts'
import { GaiaDocumentAction } from './document-action.ts'
import { GaiaFileActions } from './file-actions.ts'
import { injectEmbedChrome, injectGaiaSkin } from './styles.ts'
import { GaiaBrandName, GaiaMark } from './brand.ts'
import { GAIA_PALETTE_LAYER, paletteTokens } from './palette.ts'
import { registerGaiaLocaleOverrides } from './branding-locales.ts'
import { GaiaSettingsLauncher, openSettings, resetCapturedSettings } from './settings-launcher.ts'
import { GaiaSettingsMaximize, isSettingsMaximized, SETTINGS_MAXIMIZED_ATTR } from './settings-maximize.ts'
import { GaiaAppearanceRow } from './appearance-row.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    connection: ConnectionHandle
  }
}

export * from './bridge.ts'
export * from './styles.ts'
export * from './palette.ts'
export * from './settings-launcher.ts'
export * from './settings-maximize.ts'
export * from './appearance-row.ts'

/**
 * Format a timestamp into relative human-readable time (e.g. "5m ago").
 * @param updatedAt - Epoch timestamp or ISO date string, or null.
 * @returns Formatted relative time string, or undefined if unavailable.
 */
export function formatRelativeTime(updatedAt: number | string | null): string | undefined {
  if (updatedAt === null) return undefined
  const ms = typeof updatedAt === 'number' ? updatedAt : new Date(updatedAt).getTime()
  if (Number.isNaN(ms)) return undefined
  const diff = Math.max(0, Date.now() - ms)
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

/** Renders nothing; used to shadow slot entries that make no sense in a drawer tab. */
function HiddenEntry(): null { return null }

/** Keyboard shortcuts neutralized in embed mode to prevent opening hidden navigation chrome. */
const EMBED_BLOCKED_KEYS = new Set(['KeyB', 'KeyN', 'KeyO', 'KeyK'])

/** Services required for embed mode. */
export const inject = ['layout', 'uiWorkspace', 'sessions', 'connection', 'uiSession', 'theme', 'slots', 'locale'] as const

const GAIA_TITLE = 'Gaia Harness'
const GAIA_FAVICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30"><path fill="#ea580c" d="M14.217 19.707l-1.112 2.547c-.427.979-1.782.979-2.21 0l-1.112-2.547c-.99-2.267-2.771-4.071-4.993-5.057L1.73 13.292c-.973-.432-.973-1.848 0-2.28l2.965-1.316C6.974 8.684 8.787 6.813 9.76 4.47l1.126-2.714c.418-1.007 1.81-1.007 2.228 0L14.24 4.47c.973 2.344 2.786 4.215 5.065 5.226l2.965 1.316c.973.432.973 1.848 0 2.28l-3.061 1.359c-2.221.986-4.003 2.79-4.992 5.056zM24.481 27.796l-.339.777c-.248.569-1.036.569-1.284 0l-.339-.777c-.604-1.385-1.693-2.488-3.051-3.092l-1.044-.464c-.565-.251-.565-1.072 0-1.323l.986-.438c1.393-.619 2.501-1.763 3.095-3.195l.348-.84c.243-.585 1.052-.585 1.294 0l.348.84c.594 1.432 1.702 2.576 3.095 3.195l.986.438c.565.251.565 1.072 0 1.323l-1.044.464c-1.358.604-2.447 1.707-3.051 3.092z"/></svg>'

/** Set Gaia's browser title while retaining DSH session titles as a prefix. */
export function setGaiaDocumentTitle(): () => void {
  const originalTitle = document.title
  const applyTitle = (): void => {
    const current = document.title.trim()
    const prefix = current
      .replace(/\s*[—·|]\s*(?:DeepSeek Harness|DSH|Gaia Harness)\s*$/i, '')
      .replace(/^(?:DeepSeek Harness|DSH|Gaia Harness)$/i, '')
      .trim()
    const next = prefix ? `${prefix} · ${GAIA_TITLE}` : GAIA_TITLE
    if (document.title !== next) document.title = next
  }
  applyTitle()
  const titleObserver = new MutationObserver(applyTitle)
  titleObserver.observe(document.head, { subtree: true, childList: true, characterData: true })
  return () => {
    titleObserver.disconnect()
    document.title = originalTitle
  }
}

/** Replace page icon links with the fixed-color Gaia mark and restore on dispose. */
export function setGaiaFavicon(): () => void {
  const previous = [...document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')]
    .map(link => ({ link, nextSibling: link.nextSibling }))
  for (const { link } of previous) link.remove()
  const icon = document.createElement('link')
  icon.rel = 'icon'
  icon.type = 'image/svg+xml'
  icon.href = `data:image/svg+xml,${encodeURIComponent(GAIA_FAVICON_SVG)}`
  icon.dataset.gaiaFavicon = ''
  document.head.append(icon)
  return () => {
    icon.remove()
    for (const { link, nextSibling } of previous) {
      if (nextSibling?.parentNode) nextSibling.parentNode.insertBefore(link, nextSibling)
      else document.head.append(link)
    }
  }
}

/**
 * Mount the Gaia embed plugin into the client context.
 * Reads location.search once at startup; Gaia frames share theme integration,
 * while only embed mode activates the single-session drawer behavior.
 * @param ctx - client root context with layout, workspace, session, and theme services.
 * @returns lifecycle disposer when activated, or void.
 */
export function apply(ctx: Context): (() => void | Promise<void>) | void {
  if (typeof window === 'undefined') return

  const params = new URLSearchParams(window.location.search)
  const mode = params.get('gaia')
  const inGaiaFrame = (mode === 'embed' || mode === 'full') && window.parent !== window
  if (!inGaiaFrame) return

  const disposeLocaleOverrides = registerGaiaLocaleOverrides(ctx.locale)

  // Enforce English in all Gaia frames: Gaia is English-only.
  let unsubLocaleChange: (() => void) | undefined
  try {
    const locale = ctx.locale
    if (locale.getLocale().active !== 'en') {
      locale.setLocale('en')
    }
    unsubLocaleChange = ctx.on('locale/change', (snapshot) => {
      if (snapshot.active !== 'en') {
        try {
          if (locale.getLocale().active !== 'en') {
            locale.setLocale('en')
          }
        } catch (error) {
          console.error('Failed to restore English locale:', error)
        }
      }
    })
  } catch (error) {
    console.error('Failed to enforce English locale:', error)
  }

  // Both Gaia frames use Gaia's editor for the profile document action.
  ctx.slots.inject('settings.action', () => ctx.slots.register({
    name: 'settings.action', id: 'open-document', order: 0, priority: -1, locale: 'settings',
  }, GaiaDocumentAction))

  // Both Gaia frames add a maximize/restore toggle in the settings action bar.
  ctx.slots.inject('settings.action', () => ctx.slots.register({
    name: 'settings.action', id: 'gaia-maximize', order: 1, priority: -1, locale: 'settings',
  }, GaiaSettingsMaximize))

  // Shadow the stock Appearance row: theme follows Gaia.
  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item', id: 'appearance', order: 10, priority: -1, locale: 'settings.theme',
  }, GaiaAppearanceRow))

  // Shadow the stock Language row: English only, a single-option row is noise.
  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item', id: 'language', order: 0, priority: -1, locale: 'settings.locale',
  }, HiddenEntry))

  // Gaia frame settings launcher captures openSettings and preserves the sidebar Settings trigger.
  ctx.slots.inject('settings.launcher', () => ctx.slots.register({
    name: 'settings.launcher', priority: -1, locale: 'settings',
  }, GaiaSettingsLauncher))

  // Declare the mark first, then register both sidebar brand slots together,
  // matching the ordering used by ui-brand-official.
  ctx.slots.inject('sidebar.brand.mark', () =>
    ctx.slots.inject('sidebar.brand.name', function* () {
      yield ctx.slots.register({ name: 'sidebar.brand.mark' }, GaiaMark)
      yield ctx.slots.register({ name: 'sidebar.brand.name' }, GaiaBrandName)
    }))
  ctx.slots.inject('conversation.hero.brand.mark', () => ctx.slots.register({
    name: 'conversation.hero.brand.mark',
  }, GaiaMark))

  const restoreTitle = setGaiaDocumentTitle()
  const restoreFavicon = setGaiaFavicon()

  const workspaces = ctx.get('workspaces')
  let workspaceTimer: ReturnType<typeof setTimeout> | undefined
  let previousWorkspaceFingerprint: string | undefined
  let workspaceListLoaded = false
  const disposeWorkspaceSubscription = workspaces?.list.subscribe(() => {
    const snapshot = workspaces.list.getSnapshot()
    if (snapshot.phase !== 'ready') return
    const fingerprint = JSON.stringify(snapshot.items.map(({ workspaceId, path, title }) => [workspaceId, path, title]))
    if (workspaceListLoaded && fingerprint === previousWorkspaceFingerprint) return
    workspaceListLoaded = true
    previousWorkspaceFingerprint = fingerprint
    clearTimeout(workspaceTimer)
    workspaceTimer = setTimeout(() => { postToParent({ source: 'gaia-dsh', v: 1, type: 'workspacesChanged' }) }, 500)
  })
  if (workspaces) {
    const snapshot = workspaces.list.getSnapshot()
    if (snapshot.phase === 'ready') {
      workspaceListLoaded = true
      previousWorkspaceFingerprint = JSON.stringify(snapshot.items.map(({ workspaceId, path, title }) => [workspaceId, path, title]))
      workspaceTimer = setTimeout(() => { postToParent({ source: 'gaia-dsh', v: 1, type: 'workspacesChanged' }) }, 500)
    }
  }

  const root = document.documentElement
  const rootAttribute = mode === 'full' ? 'data-gaia-full' : 'data-gaia-embed'
  root.setAttribute(rootAttribute, '')
  if (isSettingsMaximized()) root.setAttribute(SETTINGS_MAXIMIZED_ATTR, '')
  const removeSkin = injectGaiaSkin()

  // Registered ids are deliberately non-built-in so Gaia's preference is not
  // persisted over the user's DSH theme setting.
  const disposeDarkTheme = ctx.theme.register({ id: 'gaia-embed-dark', colorScheme: 'dark', tokens: {} })
  const disposeLightTheme = ctx.theme.register({ id: 'gaia-embed-light', colorScheme: 'light', tokens: {} })
  let desiredTheme: string | undefined
  let disposePalette: (() => void) | undefined
  ctx.on('theme/change', (snapshot) => {
    if (desiredTheme !== undefined && snapshot.preference !== desiredTheme) ctx.theme.setTheme(desiredTheme)
  })

  // Theme updates and frame-level commands have their own listener so embed
  // controls can never process the same message a second time.
  const onIncomingMessage = (event: MessageEvent): void => {
    if (event.source !== window.parent || event.origin !== window.location.origin) return
    if (!isGaiaIncomingMessage(event.data)) return
    if (event.data.type === 'theme') {
      desiredTheme = event.data.mode === 'dark' ? 'gaia-embed-dark' : 'gaia-embed-light'
      ctx.theme.setTheme(desiredTheme)
      if (event.data.palette !== undefined) {
        disposePalette = ctx.theme.overrideTokens(GAIA_PALETTE_LAYER, paletteTokens(event.data.palette))
      }
    } else if (event.data.type === 'openSettings') {
      openSettings()
    }
  }
  window.addEventListener('message', onIncomingMessage)
  postToParent({ source: 'gaia-dsh', v: 1, type: 'ready' })

  // Both frame modes report the connection, so Gaia's drawer and embeds
  // show a live status dot.
  const connection = ctx.get('connection')
  const emitStatus = (): void => {
    const state = connection?.state.getSnapshot()
    postToParent({
      source: 'gaia-dsh',
      v: 1,
      type: 'status',
      connected: state === 'connected',
      reconnecting: state === 'connecting',
    })
  }
  emitStatus()
  const unsubConnection = connection?.state.subscribe(emitStatus)

  // Narrow layouts auto-collapse; toggle only at activation, so later user
  // choices remain authoritative for the lifetime of this page.
  if (mode === 'full') {
    const layout = ctx.layout.layoutInfo?.getSnapshot()
    const collapsed = layout !== undefined
      && (layout.viewportWidth < 1024 ? !layout.narrowExpanded : layout.sidebar === 0)
    if (collapsed) ctx.layout.toggleSidebar()
  }

  // Intercept keyboard shortcuts that match Gaia app/drawer shortcuts or navigation chrome.
  const onKeyDown = (e: KeyboardEvent): void => {
    // Only closed drawer intents and allowlisted app shortcuts cross the bridge;
    // never forward arbitrary key data. Requiring exactly one platform modifier also
    // excludes AltGr and accidental Ctrl+Cmd combinations.
    const platformModifier = e.ctrlKey !== e.metaKey
    if (!e.repeat && e.altKey && platformModifier && !e.getModifierState('AltGraph')) {
      if (!e.shiftKey && (e.code === 'KeyH' || e.code === 'KeyM')) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        postToParent({ source: 'gaia-dsh', v: 1, type: 'drawerShortcut', action: e.code === 'KeyH' ? 'toggle' : 'maximize' })
        return
      }
      if (isAppShortcutCandidate(e.code, e.shiftKey)) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        postToParent({ source: 'gaia-dsh', v: 1, type: 'appShortcut', code: e.code, shift: e.shiftKey })
        return
      }
    }
    if (mode === 'embed' && !e.altKey && (e.metaKey || e.ctrlKey) && EMBED_BLOCKED_KEYS.has(e.code)) {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
    }
  }
  window.addEventListener('keydown', onKeyDown, { capture: true })

  const commonDisposer = ctx.effect(() => () => {
    window.removeEventListener('keydown', onKeyDown, { capture: true })
    unsubConnection?.()
    unsubLocaleChange?.()
    root.removeAttribute(rootAttribute)
    root.removeAttribute(SETTINGS_MAXIMIZED_ATTR)
    removeSkin()
    restoreTitle()
    restoreFavicon()
    disposeLocaleOverrides()
    window.removeEventListener('message', onIncomingMessage)
    resetCapturedSettings()
    disposeWorkspaceSubscription?.()
    clearTimeout(workspaceTimer)
    disposePalette?.()
    disposeDarkTheme()
    disposeLightTheme()
  }, 'gaia-ui-embed: shared Gaia frame lifecycle')
  if (mode !== 'embed') return commonDisposer

  const rawSession = params.get('session')
  if (!rawSession || !isValidSessionId(rawSession)) {
    postToParent({
      source: 'gaia-dsh',
      v: 1,
      type: 'status',
      connected: false,
      reconnecting: false,
    })
    postToParent({
      source: 'gaia-dsh',
      v: 1,
      type: 'error',
      code: !rawSession ? 'missing_session' : 'invalid_session',
    })
    return commonDisposer
  }

  const sessionId = SessionId(rawSession)

  // Mark the root document for scoped embed CSS.
  const removeChrome = injectEmbedChrome()

  // Neutralize chrome via public layout seam.
  ctx.layout.selectPanel(null)
  ctx.layout.closeRightbar()
  // oxlint-disable-next-line typescript/unbound-method -- method saved to restore on teardown
  const originalToggleSidebar = ctx.layout.toggleSidebar
  // oxlint-disable-next-line typescript/unbound-method -- method saved to restore on teardown
  const originalOpenRightbar = ctx.layout.openRightbar
  ctx.layout.toggleSidebar = () => {}
  ctx.layout.openRightbar = () => {}


  // "Open in Files" launches a file manager on the machine running the
  // harness, which a drawer tab in a browser cannot use. Shadow its header
  // entry (same slot and id, lower priority renders) with nothing; the full
  // shell outside the embed keeps it.
  ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
    name: 'conversation.session.header.utilities', id: 'open-in-app', order: -10, priority: -1,
  }, HiddenEntry))

  // The document preview actions normally call the Host's native desktop
  // routes. In an embedded browser, replace both path-action slots with Gaia
  // actions that send their already-resolved absolute path to the parent.
  for (const name of ['sidebar.right.tab.document.actions', 'sidebar.right.tab.document.unpreviewable'] as const) {
    ctx.slots.inject(name, () => ctx.slots.register({
      name, id: 'open-in-app', order: -10, priority: -1, locale: 'open-in-app',
    }, GaiaFileActions))
  }

  // Track title, existence, and session opening.
  let openedSession = false
  let lastTitle: string | undefined
  let reportedNotFound = false

  // openSession() synchronously notifies the Session list, whose subscriber
  // calls back into this function; the flag must be set before the call or the
  // two recurse until the stack overflows. A failed open is retried on the next
  // list change; "not found" is reported only once the list has loaded (below).
  let opening = false
  const attemptOpenSession = (): void => {
    if (openedSession || opening) return
    opening = true
    try {
      ctx.uiWorkspace.openSession(sessionId)
      openedSession = true
    } catch {
      // The Session may not be in the list yet; the list subscriber retries.
    } finally {
      opening = false
    }
  }

  // Attempt initial session opening.
  attemptOpenSession()

  // Track turn running status.
  let lastRunning: boolean | undefined
  const emitTurn = (): void => {
    const snapshot = ctx.uiSession.sessionStatus.getSnapshot()
    const status = snapshot.get(sessionId)
    const running = status?.running ?? false
    if (running !== lastRunning) {
      lastRunning = running
      postToParent({ source: 'gaia-dsh', v: 1, type: 'turn', running })
    }
  }
  emitTurn()
  const unsubSessionStatus = ctx.uiSession.sessionStatus.subscribe(emitTurn)

  const emitTitleAndExistence = (): void => {
    const list = ctx.sessions.list.getSnapshot()
    const summary = list.byId[sessionId]
    if (summary !== undefined) {
      if (!openedSession) {
        attemptOpenSession()
      }
      const title = summary.title ?? summary.displayTitle
      if (title !== lastTitle) {
        lastTitle = title
        postToParent({ source: 'gaia-dsh', v: 1, type: 'title', title })
      }
    } else if (list.phase === 'ready' && !reportedNotFound) {
      reportedNotFound = true
      postToParent({ source: 'gaia-dsh', v: 1, type: 'error', code: 'session_not_found' })
    }
  }
  emitTitleAndExistence()
  const unsubList = ctx.sessions.list.subscribe(emitTitleAndExistence)

  // DSH restores the last selected Session once its lists load, asynchronously.
  // That selection is persisted per origin, so every harness iframe shares it:
  // when the restore lands after this tab's open (a just-created Session may
  // not be openable yet), the tab shows whichever Session another tab opened
  // last. The displayed conversation carries its Session id, so re-assert this
  // tab's Session whenever a different one is shown and ours is known.
  const enforceSession = (): void => {
    const shown = document.querySelector('[data-conversation-session]')?.getAttribute('data-conversation-session')
    if (shown === undefined || shown === null || shown === sessionId) return
    if (ctx.sessions.list.getSnapshot().byId[sessionId] === undefined) return
    openedSession = false
    attemptOpenSession()
  }
  const sessionObserver = new MutationObserver(enforceSession)
  sessionObserver.observe(document.body, {
    subtree: true, childList: true, attributes: true, attributeFilter: ['data-conversation-session'],
  })

  // A drawer tab hides DSH's right Sidebar, where file links, tool rows and
  // deliverables open files; hand file opens to Gaia's editor instead. Other
  // resource types still go to the (hidden) Sidebar.
  ctx.inject(['sidebarRight'], (scope: Context) => {
    scope.effect(() => scope.sidebarRight.setOpenInterceptor((address, options) => {
      const path = resolveFileAddress(address, id => ctx.sessions.list.getSnapshot().byId[SessionId(id)]?.cwd)
      if (path === undefined) return false
      const line = lineParam(options.params)
      postToParent({ source: 'gaia-dsh', v: 1, type: 'openFile', path, ...(line === undefined ? {} : { line }) })
      return true
    }), 'gaia-ui-embed: open files in the Gaia editor')
  })

  /** Resolve SessionInput through the Session scope context. */
  const getSessionInput = (): { actx: Context; input: SessionInput } | undefined => {
    const actx = ctx.sessions.scope(sessionId)
    if (actx === undefined) return undefined
    const conversation = actx.get('conversation')
    if (conversation === undefined) return undefined
    return { actx, input: conversation.input.for(actx) }
  }

  // Listen to incoming messages from the parent frame.
  const onMessage = (event: MessageEvent): void => {
    if (event.source !== window.parent || event.origin !== window.location.origin) return
    if (!isGaiaIncomingMessage(event.data)) return

    switch (event.data.type) {
      case 'theme': break
      case 'openSettings': break
      case 'focus': {
        const session = getSessionInput()
        session?.input.focus()
        break
      }
      case 'insertText': {
        const text = event.data.text
        const session = getSessionInput()
        let applied = false
        if (session !== undefined) {
          const snapshot = session.input.state.getSnapshot()
          const at = snapshot.draft.length
          const span: TokenSpan = {
            start: at,
            end: at,
            draftRev: snapshot.draftRev,
          }
          applied = session.actx.bail(session.actx, 'slash/input-insert-text', { text, span }) === true
        }
        if (!applied) {
          postToParent({ source: 'gaia-dsh', v: 1, type: 'error', code: 'insert_unsupported' })
        }
        break
      }
      case 'clear': {
        const scrollEl = document.querySelector<HTMLElement>('[data-conversation-scroll]')
        if (scrollEl) {
          scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' })
        }
        break
      }
      case 'resumeSessions':
        break
    }
  }
  window.addEventListener('message', onMessage)

  if (window.parent !== window) {
    ctx.inject(['commandUi'], (scope: Context) => {
      scope.effect(() => scope.commandUi.register({
        name: 'resume',
        label: () => 'Resume',
        description: () => 'Switch this tab to a previous session',
        icon: IconClockOutlineRegular,
        available: () => true,
        ui: {
          kind: 'popupSelect',
          options: async (_session, signal) => {
            return new Promise<readonly SelectOption[]>((resolve, reject) => {
              if (signal.aborted) {
                reject(signal.reason instanceof Error ? signal.reason : new Error('Aborted'))
                return
              }

              const reqId = Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

              const onAbort = () => {
                cleanup()
                reject(signal.reason instanceof Error ? signal.reason : new Error('Aborted'))
              }

              const onReply = (event: MessageEvent) => {
                if (event.source !== window.parent || event.origin !== window.location.origin) return
                if (!isGaiaIncomingMessage(event.data)) return
                if (event.data.type !== 'resumeSessions' || event.data.reqId !== reqId) return

                cleanup()
                if ('error' in event.data && typeof event.data.error === 'string') {
                  reject(new Error(event.data.error))
                  return
                }
                if ('sessions' in event.data && Array.isArray(event.data.sessions)) {
                  if (event.data.sessions.length === 0) {
                    reject(new Error('No previous sessions in this project'))
                    return
                  }
                  const options: SelectOption[] = event.data.sessions.map((row) => {
                    const detail = formatRelativeTime(row.updatedAt)
                    const badge = row.open ? 'open' : row.archived ? 'archived' : undefined
                    return {
                      id: row.sessionId,
                      label: row.title.trim() || 'Untitled session',
                      ...(detail === undefined ? {} : { detail }),
                      ...(badge === undefined ? {} : { badge }),
                    }
                  })
                  resolve(options)
                }
              }

              const timer = setTimeout(() => {
                cleanup()
                reject(new Error('Timed out waiting for session list'))
              }, 10_000)

              function cleanup() {
                clearTimeout(timer)
                signal.removeEventListener('abort', onAbort)
                window.removeEventListener('message', onReply)
              }

              signal.addEventListener('abort', onAbort, { once: true })
              window.addEventListener('message', onReply)

              postToParent({
                source: 'gaia-dsh',
                v: 1,
                type: 'resumeList',
                reqId,
              })
            })
          },
          onSelect: (option) => {
            postToParent({
              source: 'gaia-dsh',
              v: 1,
              type: 'resume',
              sessionId: option.id,
            })
          },
        },
      }), 'gaia-ui-embed: /resume command')
    })
  }

  // Scope effect for teardown.
  return ctx.effect(() => {
    return async () => {
      removeChrome()
      ctx.layout.toggleSidebar = originalToggleSidebar
      ctx.layout.openRightbar = originalOpenRightbar
      window.removeEventListener('message', onMessage)
      unsubSessionStatus()
      unsubList()
      sessionObserver.disconnect()
      await commonDisposer()
    }
  }, 'gaia-ui-embed: lifecycle')
}
