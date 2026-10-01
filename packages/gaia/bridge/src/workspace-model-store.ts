/** Private per-user workspace model choices; the file never contains provider credentials. */
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { ModelSelection } from '@deepseek-ai/dsh-api-session-controller/types'

/** Persisted identifiers and the time of the latest explicit choice. */
export interface WorkspaceModelChoice extends ModelSelection {
  /** Unix timestamp in milliseconds used for retention order. */
  updatedAt: number
}

// Security bound on retained per-user metadata, independent of workspace count.
const MAX_ENTRIES = 500

function parseChoice(value: unknown): WorkspaceModelChoice | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  const { provider, model, reasoningEffort, updatedAt } = value as Record<string, unknown>
  const id = (part: unknown): part is string => typeof part === 'string' && part.length > 0 && part.length <= 4096
  if (!id(provider) || !id(model) || (reasoningEffort !== undefined && !id(reasoningEffort))
    || typeof updatedAt !== 'number' || !Number.isFinite(updatedAt) || updatedAt < 0) return undefined
  return { provider, model, ...(reasoningEffort === undefined ? {} : { reasoningEffort }), updatedAt }
}

/** Single-runtime store with serialized atomic writes and immediate in-memory recording. */
export class WorkspaceModelStore {
  private entries = new Map<string, WorkspaceModelChoice>()
  private writes: Promise<void> = Promise.resolve()
  private readonly ready: Promise<void>

  constructor(private readonly path: string) {
    this.ready = this.load()
  }

  private async load(): Promise<void> {
    let text: string
    try { text = await readFile(this.path, 'utf8') }
    catch (_error) { return /* Missing/unreadable preferences do not prevent session creation. */ }
    let value: unknown
    try { value = JSON.parse(text) }
    catch (_error) { return /* A damaged preference file starts empty. */ }
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return
    for (const [key, raw] of Object.entries(value)) {
      const choice = parseChoice(raw)
      if (key.length > 0 && choice !== undefined) this.entries.set(key, choice)
    }
    this.trim()
  }

  private trim(): void {
    this.entries = new Map([...this.entries].sort((a, b) => b[1].updatedAt - a[1].updatedAt).slice(0, MAX_ENTRIES))
  }

  /** Read a detached remembered selection after loading and prior records settle.
   * @param workspace - canonical workspace directory.
   * @returns saved identifiers, or undefined when no choice was saved.
   */
  async get(workspace: string): Promise<ModelSelection | undefined> {
    await this.ready
    await this.writes
    const value = this.entries.get(workspace)
    if (value === undefined) return undefined
    return { provider: value.provider, model: value.model,
      ...(value.reasoningEffort === undefined ? {} : { reasoningEffort: value.reasoningEffort }) }
  }

  /** Queue an explicit choice, retaining only its identifiers and the latest 500 workspaces.
   * @param workspace - canonical workspace directory.
   * @param selection - successfully committed session choice.
   * @returns fulfillment after atomic 0600 persistence; I/O failures reject only this write.
   */
  record(workspace: string, selection: ModelSelection): Promise<void> {
    const choice: WorkspaceModelChoice = { provider: selection.provider, model: selection.model,
      ...(selection.reasoningEffort === undefined ? {} : { reasoningEffort: selection.reasoningEffort }),
      updatedAt: Date.now() }
    const saved = this.writes.then(async () => {
      await this.ready
      this.entries.delete(workspace)
      this.entries = new Map([[workspace, choice], ...this.entries])
      this.trim()
      await mkdir(dirname(this.path), { recursive: true, mode: 0o700 })
      const temporary = `${this.path}.${randomUUID()}.tmp`
      try {
        await writeFile(temporary, JSON.stringify(Object.fromEntries(this.entries)) + '\n', { mode: 0o600, flag: 'wx' })
        await rename(temporary, this.path)
      } finally {
        await rm(temporary, { force: true })
      }
    })
    this.writes = saved.catch(() => {})
    return saved
  }

  /** Wait for queued preference writes, including handled I/O failures.
   * @returns fulfillment once all submitted writes have settled.
   */
  async flush(): Promise<void> {
    await this.ready
    await this.writes
  }
}
