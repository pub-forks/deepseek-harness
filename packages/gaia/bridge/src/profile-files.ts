/** Fixed profile configuration file access for Gaia's authenticated control API. */
import { createHash, randomUUID } from 'node:crypto'
import { chmod, lstat, open, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { parseDocument } from 'yaml'

/** Maximum UTF-8 bytes accepted for a profile configuration file. */
export const MAX_PROFILE_FILE_BYTES = 1024 * 1024

/** Names the bridge permits Gaia to read and write in the active profile directory. */
export const PROFILE_FILE_NAMES = ['cordis.patch.yml', 'cordis.yml', 'package.json', 'pnpm-workspace.yaml'] as const

let writes = Promise.resolve()

/** Compute lowercase SHA-256 for UTF-8 text. @param text - file contents. @returns hexadecimal digest. */
export function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

/**
 * Resolve a fixed profile filename beside the config document.
 * @param documentPath - active profile document.
 * @param name - allowlisted basename.
 * @returns absolute profile file path.
 */
export function profileFilePath(documentPath: string, name: string): string {
  return join(dirname(documentPath), name)
}

/**
 * Parse a profile document according to its fixed filename extension.
 * @param name - allowlisted filename.
 * @param text - contents to validate.
 * @returns no value when valid; throws a parser diagnostic when invalid.
 */
export function validateProfileText(name: string, text: string): void {
  if (name.endsWith('.yml') || name.endsWith('.yaml')) {
    const document = parseDocument(text)
    if (document.errors[0] !== undefined) throw document.errors[0]
  } else if (name.endsWith('.json')) {
    JSON.parse(text)
  }
}

async function atomicWrite(path: string, text: string): Promise<void> {
  let mode = 0o600
  try {
    const existing = await lstat(path)
    if (existing.isSymbolicLink()) throw new Error('Profile files cannot be symbolic links')
    mode = existing.mode & 0o7777
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  const temporary = join(dirname(path), `.${randomUUID()}.gaia-tmp`)
  try {
    await writeFile(temporary, text, { encoding: 'utf8', mode, flag: 'wx' })
    await chmod(temporary, mode)
    await rename(temporary, path)
  } finally {
    await rm(temporary, { force: true })
  }
}

function serializeWrite<T>(operation: () => Promise<T>): Promise<T> {
  const result = writes.then(operation, operation)
  writes = result.then(() => {}, () => {})
  return result
}

/**
 * Compare the current file hash and atomically write while holding the shared profile write queue.
 * @param path - fixed destination path.
 * @param expectedSha256 - caller's observed digest.
 * @param text - validated contents.
 * @returns the observed hash and whether the precondition matched.
 */
export function writeProfileTextIfSha(path: string, expectedSha256: string, text: string): Promise<{ sha256: string; written: boolean }> {
  return serializeWrite(async () => {
    const current = await readProfileText(path)
    const currentHash = sha256(current)
    if (currentHash !== expectedSha256) return { sha256: currentHash, written: false }
    await atomicWrite(path, text)
    return { sha256: sha256(text), written: true }
  })
}

/**
 * Read an allowlisted profile file as UTF-8 text.
 * @param path - fixed destination path.
 * @returns file text, or an empty string if absent.
 */
export async function readProfileText(path: string): Promise<string> {
  let handle: Awaited<ReturnType<typeof open>> | undefined
  try {
    const metadata = await lstat(path)
    if (metadata.isSymbolicLink() || !metadata.isFile()) throw new Error('Profile files must be regular files')
    handle = await open(path, 'r')
    return await handle.readFile('utf8')
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return ''
    throw error
  } finally {
    await handle?.close()
  }
}
