/**
 * File opens in the Gaia drawer embed: DSH's right Sidebar, where files
 * normally open, is hidden in a drawer tab, so a file address is resolved to an
 * absolute path and handed to Gaia, which opens it in its own editor.
 */
import { parseFileAddress } from '@deepseek-ai/dsh-util-workspace-path'

/**
 * Resolve a `dsh-resource://file/…` address to an absolute POSIX path.
 * @param address - the resource address being opened.
 * @param cwdOf - workspace root of a Session, when known.
 * @returns the absolute file path, or undefined for a non-file address, an
 * unknown workspace, or the workspace root itself (a directory).
 */
export function resolveFileAddress(address: string, cwdOf: (sessionId: string) => string | undefined): string | undefined {
  const file = parseFileAddress(address)
  if (file === undefined || file.path === '') return undefined
  if (file.path.startsWith('/')) return file.path
  if (file.scope === 'absolute') return undefined
  const cwd = cwdOf(file.sessionId)
  if (cwd === undefined || !cwd.startsWith('/')) return undefined
  return `${cwd.replace(/\/+$/, '')}/${file.path}`
}

/**
 * Read the 1-based line a caller asked the file to open at.
 * @param params - the open call's navigation parameters.
 * @returns a positive integer line, or undefined.
 */
export function lineParam(params: unknown): number | undefined {
  if (params === null || typeof params !== 'object' || !('line' in params)) return undefined
  const { line } = params
  return typeof line === 'number' && Number.isInteger(line) && line > 0 ? line : undefined
}
