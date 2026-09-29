/**
 * postMessage bridge protocol definitions and validation for Gaia embed mode.
 */

/** Protocol version for Gaia-DSH bridge messages. */
export const GAIA_BRIDGE_VERSION = 1 as const

/** Protocol source identifier for Gaia-DSH bridge messages. */
export const GAIA_BRIDGE_SOURCE = 'gaia-dsh' as const

/** Maximum byte length for insertText messages (8 KB). */
export const MAX_INSERT_TEXT_BYTES = 8192

/** Outgoing messages sent from the embedded DSH iframe to the Gaia parent frame.
 * Drawer shortcuts are closed intents; key data is never forwarded.
 */
export type GaiaOutgoingMessage =
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

/** Keys of the Gaia palette a theme message may carry. */
export const GAIA_PALETTE_KEYS = ['background', 'surface', 'border', 'foreground', 'mutedForeground', 'accent'] as const

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
