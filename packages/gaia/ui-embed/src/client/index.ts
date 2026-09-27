/**
 * Gaia iframe embed client plugin.
 * Activates single-session embed presentation when ?gaia=embed&session=<id> is present.
 */
import type { Context } from '@deepseek-ai/cordis'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-open-in-app/client'
import type { SessionInput, TokenSpan } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type { SelectOption } from '@deepseek-ai/dsh-client-ui-commands/client'
import { IconClockOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import { isGaiaIncomingMessage, isValidSessionId, postToParent } from './bridge.ts'
import { injectEmbedStyles } from './styles.ts'
import { GaiaMark } from './brand.ts'
import { GAIA_PALETTE_LAYER, paletteTokens } from './palette.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    connection: ConnectionHandle
  }
}

export * from './bridge.ts'
export * from './styles.ts'
export * from './palette.ts'

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
export const inject = ['layout', 'uiWorkspace', 'sessions', 'connection', 'uiSession', 'theme', 'slots'] as const

/**
 * Mount the Gaia embed plugin into the client context.
 * Reads location.search once at startup; if gaia !== 'embed', does nothing.
 * @param ctx - client root context with layout, workspace, session, and theme services.
 * @returns lifecycle disposer when activated, or void.
 */
export function apply(ctx: Context): (() => void | Promise<void>) | void {
  if (typeof window === 'undefined') return

  const params = new URLSearchParams(window.location.search)
  if (params.get('gaia') !== 'embed') return

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
    return
  }

  const sessionId = SessionId(rawSession)

  // Mark the root document for scoped embed CSS.
  document.documentElement.setAttribute('data-gaia-embed', '')
  const removeStyles = injectEmbedStyles()

  // Neutralize chrome via public layout seam.
  ctx.layout.selectPanel(null)
  ctx.layout.closeRightbar()
  // oxlint-disable-next-line typescript/unbound-method -- method saved to restore on teardown
  const originalToggleSidebar = ctx.layout.toggleSidebar
  // oxlint-disable-next-line typescript/unbound-method -- method saved to restore on teardown
  const originalOpenRightbar = ctx.layout.openRightbar
  ctx.layout.toggleSidebar = () => {}
  ctx.layout.openRightbar = () => {}

  // Intercept keyboard shortcuts that would open navigation or new sessions.
  const onKeyDown = (e: KeyboardEvent): void => {
    if ((e.metaKey || e.ctrlKey) && EMBED_BLOCKED_KEYS.has(e.code)) {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
    }
  }
  window.addEventListener('keydown', onKeyDown, { capture: true })

  // "Open in Files" launches a file manager on the machine running the
  // harness, which a drawer tab in a browser cannot use. Shadow its header
  // entry (same slot and id, lower priority renders) with nothing; the full
  // shell outside the embed keeps it.
  ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
    name: 'conversation.session.header.utilities', id: 'open-in-app', order: -10, priority: -1,
  }, HiddenEntry))

  // The empty-session hero shows Gaia's mark instead of DSH's whale.
  ctx.slots.inject('conversation.hero.brand.mark', () => ctx.slots.register({
    name: 'conversation.hero.brand.mark',
  }, GaiaMark))

  // Register Gaia themes once at activation (only in embed mode).
  // Non-built-in ids ('gaia-embed-dark' / 'gaia-embed-light') ensure setTheme does not
  // persist the user's preference (ui-theme setTheme only persists built-in ids: 'light' | 'dark' | 'system').
  const disposeDarkTheme = ctx.theme.register({ id: 'gaia-embed-dark', colorScheme: 'dark', tokens: {} })
  const disposeLightTheme = ctx.theme.register({ id: 'gaia-embed-light', colorScheme: 'light', tokens: {} })

  // The theme service adopts the user's persisted preference whenever its
  // settings scope loads or changes, which can land after Gaia's override and
  // silently revert the embed to the saved (or system) theme. Keep re-applying
  // the mode Gaia asked for; setTheme is a no-op when the id already matches.
  let desiredTheme: string | undefined
  let disposePalette: (() => void) | undefined
  ctx.on('theme/change', (snapshot) => {
    if (desiredTheme !== undefined && snapshot.preference !== desiredTheme) ctx.theme.setTheme(desiredTheme)
  })

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

  // Notify parent of readiness.
  postToParent({ source: 'gaia-dsh', v: 1, type: 'ready' })

  // Track connection status.
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
      case 'theme': {
        desiredTheme = event.data.mode === 'dark' ? 'gaia-embed-dark' : 'gaia-embed-light'
        ctx.theme.setTheme(desiredTheme)
        // Gaia's own colors ride along; one override layer, replaced on each
        // message, so the tab follows theme and accent changes live.
        if (event.data.palette !== undefined) {
          disposePalette = ctx.theme.overrideTokens(GAIA_PALETTE_LAYER, paletteTokens(event.data.palette))
        }
        break
      }
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
    return () => {
      document.documentElement.removeAttribute('data-gaia-embed')
      removeStyles()
      ctx.layout.toggleSidebar = originalToggleSidebar
      ctx.layout.openRightbar = originalOpenRightbar
      window.removeEventListener('keydown', onKeyDown, { capture: true })
      window.removeEventListener('message', onMessage)
      disposePalette?.()
      disposeDarkTheme()
      disposeLightTheme()
      unsubConnection?.()
      unsubSessionStatus()
      unsubList()
      sessionObserver.disconnect()
    }
  }, 'gaia-ui-embed: lifecycle')
}
