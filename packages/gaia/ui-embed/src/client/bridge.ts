/**
 * postMessage bridge protocol definitions and validation for Gaia embed mode.
 */

/** Protocol version for Gaia-DSH bridge messages. */
export const GAIA_BRIDGE_VERSION = 1 as const

/** Protocol source identifier for Gaia-DSH bridge messages. */
export const GAIA_BRIDGE_SOURCE = 'gaia-dsh' as const

/** Maximum byte length for insertText messages (8 KB). */
export const MAX_INSERT_TEXT_BYTES = 8192

/** Maximum UTF-8 bytes in a complete chat narration request. */
export const MAX_CHAT_SPEECH_BYTES = 200_000

/** Shared Gaia player state received by chat actions. */
export interface GaiaReadAloudState {
  enabled: boolean
  /** Persisted opt-in; omitted by older Gaia hosts means disabled. */
  autoRead?: boolean
  status: 'idle' | 'preparing' | 'loading' | 'speaking' | 'paused'
  sessionId: string | null
  messageId: string | null
}

/** Closed requests from a Gaia iframe to its same-origin parent. */
export type GaiaOutgoingMessage =
  | { source: typeof GAIA_BRIDGE_SOURCE; v: typeof GAIA_BRIDGE_VERSION; type: 'openChangesReview'; sessionId: string; seq: number; turn: number; index: number }
  | { source: typeof GAIA_BRIDGE_SOURCE; v: typeof GAIA_BRIDGE_VERSION; type: 'readAloud' | 'autoReadAloud'; sessionId: string; messageId: string; text: string }
  | { source: typeof GAIA_BRIDGE_SOURCE; v: typeof GAIA_BRIDGE_VERSION; type: 'stopReadAloud'; sessionId: string; messageId: string }
  | { source: typeof GAIA_BRIDGE_SOURCE; v: typeof GAIA_BRIDGE_VERSION; type: 'cancelReadAloudSession'; sessionId: string }
  | { source: typeof GAIA_BRIDGE_SOURCE; v: typeof GAIA_BRIDGE_VERSION; type: 'readAloudSettings' }
  | { source: typeof GAIA_BRIDGE_SOURCE; v: typeof GAIA_BRIDGE_VERSION; type: 'ready' }
  | { source: typeof GAIA_BRIDGE_SOURCE; v: typeof GAIA_BRIDGE_VERSION; type: 'status'; connected: boolean; reconnecting: boolean }
  | { source: typeof GAIA_BRIDGE_SOURCE; v: typeof GAIA_BRIDGE_VERSION; type: 'turn'; running: boolean }
  | { source: typeof GAIA_BRIDGE_SOURCE; v: typeof GAIA_BRIDGE_VERSION; type: 'title'; title: string }
  | { source: typeof GAIA_BRIDGE_SOURCE; v: typeof GAIA_BRIDGE_VERSION; type: 'error'; code: string }
  | { source: typeof GAIA_BRIDGE_SOURCE; v: typeof GAIA_BRIDGE_VERSION; type: 'resumeList'; reqId: string }
  | { source: typeof GAIA_BRIDGE_SOURCE; v: typeof GAIA_BRIDGE_VERSION; type: 'resume'; sessionId: string }
  | { source: typeof GAIA_BRIDGE_SOURCE; v: typeof GAIA_BRIDGE_VERSION; type: 'openFile'; path: string; action?: 'open' | 'reveal'; line?: number }
  | { source: typeof GAIA_BRIDGE_SOURCE; v: typeof GAIA_BRIDGE_VERSION; type: 'openConfigEditor' }
  | { source: typeof GAIA_BRIDGE_SOURCE; v: typeof GAIA_BRIDGE_VERSION; type: 'workspacesChanged' }
  | { source: typeof GAIA_BRIDGE_SOURCE; v: typeof GAIA_BRIDGE_VERSION; type: 'drawerShortcut'; action: 'toggle' | 'maximize' }
  | { source: typeof GAIA_BRIDGE_SOURCE; v: typeof GAIA_BRIDGE_VERSION; type: 'appShortcut'; code: AppShortcutCode; shift: boolean }
  | { source: typeof GAIA_BRIDGE_SOURCE; v: typeof GAIA_BRIDGE_VERSION; type: 'openGaiaSettings'; section: 'appearance' }
  | { source: typeof GAIA_BRIDGE_SOURCE; v: typeof GAIA_BRIDGE_VERSION; type: 'notify'; event: 'turnDone' | 'needsInput' | 'turnError'; title: string }

/** Allowlisted keyboard shortcut codes forwarded from the iframe to Gaia. */
export const APP_SHORTCUT_CODES = [
  'KeyJ',
  'KeyE',
  'KeyL',
  'KeyK',
  'KeyD',
  'KeyZ',
  'KeyF',
  'KeyG',
  'KeyP',
  'KeyA',
  'KeyN',
] as const

/** Union type of all allowlisted app shortcut codes. */
export type AppShortcutCode = typeof APP_SHORTCUT_CODES[number]

/**
 * Check whether a code and shift modifier match the app shortcut allowlist.
 * Shift is permitted only with KeyJ and KeyE.
 */
export function isAppShortcutCandidate(code: string, shift: boolean): code is AppShortcutCode {
  if (shift) return code === 'KeyJ' || code === 'KeyE'
  return (APP_SHORTCUT_CODES as readonly string[]).includes(code)
}

/** Keys of the Gaia palette a theme message may carry. */
export const GAIA_PALETTE_KEYS = ['background', 'surface', 'border', 'foreground', 'mutedForeground', 'accent', 'primary', 'primaryForeground', 'destructive'] as const

/** Gaia's resolved theme colors, as CSS color strings. */
export type GaiaPalette = Partial<Record<typeof GAIA_PALETTE_KEYS[number], string>>

/**
 * Whether a value is a plain CSS color: a hex color or an rgb/hsl/oklch/lab/
 * color() function of numbers, units and separators. The values become inline
 * CSS variables, so anything able to close a declaration or load a resource
 * (`;`, braces, quotes, `url(`) is refused.
 * @param value - untrusted candidate.
 * @returns true when the value is safe to apply as a color.
 */
export function isSafeCssColor(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 96) return false
  return /^#[0-9a-f]{3,8}$/i.test(value)
    || /^(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\([a-z0-9.,%\s/+-]*\)$/i.test(value)
}

/** One session row in a resume session list reply. */
export interface ResumeSessionRow {
  sessionId: string
  title: string
  archived: boolean
  open: boolean
  updatedAt: number | string | null
}

/** Incoming messages accepted from the Gaia parent frame. */
export type GaiaIncomingMessage =
  | ({ source: typeof GAIA_BRIDGE_SOURCE; v: typeof GAIA_BRIDGE_VERSION; type: 'readAloudState' } & GaiaReadAloudState)
  | { source: typeof GAIA_BRIDGE_SOURCE; v: typeof GAIA_BRIDGE_VERSION; type: 'theme'; mode: 'light' | 'dark'; palette?: GaiaPalette }
  | { source: typeof GAIA_BRIDGE_SOURCE; v: typeof GAIA_BRIDGE_VERSION; type: 'focus' }
  | { source: typeof GAIA_BRIDGE_SOURCE; v: typeof GAIA_BRIDGE_VERSION; type: 'insertText'; text: string }
  | { source: typeof GAIA_BRIDGE_SOURCE; v: typeof GAIA_BRIDGE_VERSION; type: 'clear' }
  | { source: typeof GAIA_BRIDGE_SOURCE; v: typeof GAIA_BRIDGE_VERSION; type: 'resumeSessions'; reqId: string; sessions: ResumeSessionRow[] }
  | { source: typeof GAIA_BRIDGE_SOURCE; v: typeof GAIA_BRIDGE_VERSION; type: 'resumeSessions'; reqId: string; error: string }
  | { source: typeof GAIA_BRIDGE_SOURCE; v: typeof GAIA_BRIDGE_VERSION; type: 'openSettings' }

/**
 * Validate that a session string conforms to the safe session identifier grammar.
 * Safe alphanumeric characters, underscores, and hyphens up to 128 characters.
 * @param id - candidate session identifier string.
 * @returns true if the identifier is valid.
 */
export function isValidSessionId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{1,128}$/.test(id)
}

/**
 * Type guard for incoming messages from the Gaia parent frame.
 * Validates message source, version, discriminant type, and payload constraints.
 * @param data - untrusted deserialized postMessage data.
 * @returns true if data satisfies the GaiaIncomingMessage shape.
 */
export function isGaiaIncomingMessage(data: unknown): data is GaiaIncomingMessage {
  if (typeof data !== 'object' || data === null) return false
  const msg = data as Record<string, unknown>
  if (msg.source !== GAIA_BRIDGE_SOURCE || msg.v !== GAIA_BRIDGE_VERSION || typeof msg.type !== 'string') {
    return false
  }

  switch (msg.type) {
    case 'readAloudState':
      return typeof msg.enabled === 'boolean'
        && (msg.autoRead === undefined || typeof msg.autoRead === 'boolean')
        && typeof msg.status === 'string'
        && ['idle', 'preparing', 'loading', 'speaking', 'paused'].includes(msg.status)
        && (msg.sessionId === null || (typeof msg.sessionId === 'string' && isValidSessionId(msg.sessionId)))
        && (msg.messageId === null || (typeof msg.messageId === 'string' && isValidSessionId(msg.messageId)))
        && ((msg.sessionId === null) === (msg.messageId === null))
        && (msg.status === 'idle' ? msg.messageId === null : msg.messageId !== null)
        && Object.keys(msg).every(key => ['source', 'v', 'type', 'enabled', 'autoRead', 'status', 'sessionId', 'messageId'].includes(key))
    case 'theme': {
      if (msg.mode !== 'light' && msg.mode !== 'dark') return false
      if (msg.palette === undefined) return true
      if (typeof msg.palette !== 'object' || msg.palette === null || Array.isArray(msg.palette)) return false
      return Object.entries(msg.palette).every(([key, value]) =>
        (GAIA_PALETTE_KEYS as readonly string[]).includes(key) && isSafeCssColor(value))
    }
    case 'focus':
      return true
    case 'openSettings':
      return true
    case 'insertText': {
      if (typeof msg.text !== 'string') return false
      return new TextEncoder().encode(msg.text).length <= MAX_INSERT_TEXT_BYTES
    }
    case 'clear':
      return true
    case 'resumeSessions': {
      if (typeof msg.reqId !== 'string' || msg.reqId.length === 0 || msg.reqId.length > 64) {
        return false
      }
      if (typeof msg.error === 'string') {
        return msg.error.length <= 512 && msg.sessions === undefined
      }
      if (!Array.isArray(msg.sessions) || msg.sessions.length > 500) {
        return false
      }
      return msg.sessions.every((row: unknown) => {
        if (typeof row !== 'object' || row === null) return false
        const r = row as Record<string, unknown>
        if (typeof r.sessionId !== 'string' || !isValidSessionId(r.sessionId)) return false
        if (typeof r.title !== 'string' || r.title.length > 512) return false
        if (typeof r.archived !== 'boolean' || typeof r.open !== 'boolean') return false
        return r.updatedAt === null || typeof r.updatedAt === 'number' || typeof r.updatedAt === 'string'
      })
    }
    default:
      return false
  }
}

/**
 * Send a typed message to the host window when running inside an iframe.
 * @param msg - bridge payload to post to window.parent.
 */
export function postToParent(msg: GaiaOutgoingMessage): void {
  if (typeof window !== 'undefined' && window.parent !== window) {
    window.parent.postMessage(msg, window.location.origin)
  }
}

/** Maximum character length for notify message titles. */
export const MAX_NOTIFY_TITLE_CHARS = 200

/**
 * Sanitize session title for safe transport over the bridge:
 * strips ASCII control characters (0-31 and 127), trims, and bounds length to 200 chars.
 * @param raw - candidate raw title string.
 * @returns sanitized plain-text title string.
 */
export function sanitizeNotifyTitle(raw: string | undefined): string {
  if (!raw) return ''
  return raw.replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, MAX_NOTIFY_TITLE_CHARS)
}
