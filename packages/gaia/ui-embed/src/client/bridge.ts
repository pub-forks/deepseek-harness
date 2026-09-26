/**
 * postMessage bridge protocol definitions and validation for Gaia embed mode.
 */

/** Protocol version for Gaia-DSH bridge messages. */
export const GAIA_BRIDGE_VERSION = 1 as const

/** Protocol source identifier for Gaia-DSH bridge messages. */
export const GAIA_BRIDGE_SOURCE = 'gaia-dsh' as const

/** Maximum byte length for insertText messages (8 KB). */
export const MAX_INSERT_TEXT_BYTES = 8192

/** Outgoing messages sent from the embedded DSH iframe to the Gaia parent frame. */
export type GaiaOutgoingMessage =
  | { source: typeof GAIA_BRIDGE_SOURCE; v: typeof GAIA_BRIDGE_VERSION; type: 'ready' }
  | { source: typeof GAIA_BRIDGE_SOURCE; v: typeof GAIA_BRIDGE_VERSION; type: 'status'; connected: boolean; reconnecting: boolean }
  | { source: typeof GAIA_BRIDGE_SOURCE; v: typeof GAIA_BRIDGE_VERSION; type: 'turn'; running: boolean }
  | { source: typeof GAIA_BRIDGE_SOURCE; v: typeof GAIA_BRIDGE_VERSION; type: 'title'; title: string }
  | { source: typeof GAIA_BRIDGE_SOURCE; v: typeof GAIA_BRIDGE_VERSION; type: 'error'; code: string }

/** Incoming messages accepted from the Gaia parent frame. */
export type GaiaIncomingMessage =
  | { source: typeof GAIA_BRIDGE_SOURCE; v: typeof GAIA_BRIDGE_VERSION; type: 'theme'; mode: 'light' | 'dark' }
  | { source: typeof GAIA_BRIDGE_SOURCE; v: typeof GAIA_BRIDGE_VERSION; type: 'focus' }
  | { source: typeof GAIA_BRIDGE_SOURCE; v: typeof GAIA_BRIDGE_VERSION; type: 'insertText'; text: string }
  | { source: typeof GAIA_BRIDGE_SOURCE; v: typeof GAIA_BRIDGE_VERSION; type: 'clear' }

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
    case 'theme':
      return msg.mode === 'light' || msg.mode === 'dark'
    case 'focus':
      return true
    case 'insertText': {
      if (typeof msg.text !== 'string') return false
      return new TextEncoder().encode(msg.text).length <= MAX_INSERT_TEXT_BYTES
    }
    case 'clear':
      return true
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
