/** Resolve turn-review resources for Gaia's single-session editor integration. */
import { isValidSessionId } from './bridge.ts'

/**
 * Decode bounded review coordinates without sending file contents over the bridge.
 * @param address - Sidebar resource address.
 * @param params - Optional selected file index.
 * @returns Coordinates, or undefined for another resource or malformed coordinates.
 */
export function resolveChangesReview(
  address: string, params: unknown,
): { sessionId: string; seq: number; turn: number; index: number } | undefined {
  const match = /^dsh-resource:\/\/changes-review\/session\/([a-zA-Z0-9_-]{1,128})\/(\d+)\/([1-9]\d*)$/.exec(address)
  if (match === null) return undefined
  const sessionId = match[1]
  if (sessionId === undefined) return undefined
  const seq = Number(match[2])
  const turn = Number(match[3])
  const index = params !== null && typeof params === 'object' && 'index' in params ? params.index : 0
  if (!isValidSessionId(sessionId) || !Number.isSafeInteger(seq) || !Number.isSafeInteger(turn)
    || typeof index !== 'number' || !Number.isSafeInteger(index) || index < 0) return undefined
  return { sessionId, seq, turn, index }
}
