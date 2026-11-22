import type { Agent, AgentStatus } from '@deepseek-ai/dsh-agent'
import type { SessionEvent, SessionId } from '@deepseek-ai/dsh-session'
import type { ContextFormed } from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-user-approval'
import type {
  ScheduleCatalogEntry, ScheduleDeliveryHistoryRequest, ScheduleDeliveryHistoryResult, ScheduleDeliveryRecord,
} from '@deepseek-ai/dsh-schedule'
import type {} from '@deepseek-ai/dsh-schedule'
import type {} from '@deepseek-ai/dsh-session-query'
import type {} from '@deepseek-ai/dsh-workspace'

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'schedule': { kind: 'schedule' } & ContextFormed
  }
}

const MAX_TASKS = 100
const RECEIPTS_PER_TASK = 20
const HISTORY_MS = 7 * 24 * 60 * 60 * 1000

/** Decide whether committed history permits archiving, requires another check, or excludes a delivery.
 * @param events - Committed Session history for the target.
 * @param messageId - Scheduled delivery message id to locate.
 * @param keepFailed - Whether a failed scheduled turn stays visible.
 * @returns The archive, wait, or skip decision.
 */
export function decision(events: readonly SessionEvent[], messageId: string, keepFailed: boolean): 'archive' | 'wait' | 'skip' {
  let messageSeq: number | undefined
  let turn: number | undefined
  let turnEnded = false
  let turnFailed = false
  let turnCompleted = false
  let takeover = false
  let activeTurn: number | undefined
  const approvals = new Set<string>()
  const questions = new Set<string>()

  for (const event of events) {
    if (event.type === 'turn/start') activeTurn = event.data.turn
    if (event.type === 'user/message') {
      if (String(event.data.id) === messageId) {
        messageSeq = event.seq
        turn = activeTurn
        if (event.data.source.kind !== 'schedule') return 'skip'
      } else if (messageSeq !== undefined && event.seq > messageSeq && event.data.source.kind === 'user') {
        // Only a human message is a takeover; plugins also append system-sourced user/message events.
        takeover = true
      }
    }
    if (event.type === 'turn/end') {
      if (event.data.turn === turn) {
        turnEnded = true
        turnFailed = event.data.reason.kind === 'error'
        turnCompleted = event.data.reason.kind === 'completed'
      }
      if (event.data.turn === activeTurn) activeTurn = undefined
    }
    if (event.type === 'approval/asked') approvals.add(String(event.data.id))
    if (event.type === 'approval/decided') approvals.delete(String(event.data.id))
    if (event.type === 'tool/call' && event.data.name === 'ask_user_question') questions.add(String(event.data.callId))
    if (event.type === 'tool/result' && questions.has(String(event.data.message.toolCallId))) {
      const text = event.data.message.content.find(block => block.type === 'text')
      let pending = false
      if (text?.type === 'text') {
        try {
          const parsed: unknown = JSON.parse(text.text)
          pending = typeof parsed === 'object' && parsed !== null && 'pending' in parsed && parsed.pending === true
        } catch (error: unknown) {
          // Non-JSON tool text is a settled failure, never a pending question.
          void error
        }
      }
      if (!pending && event.data.error?.code !== 'TOOL_OUTCOME_UNKNOWN') questions.delete(String(event.data.message.toolCallId))
    }
  }

  if (messageSeq === undefined || turn === undefined || takeover) return 'skip'
  if (!turnEnded) return 'wait'
  if (turnFailed && keepFailed) return 'skip'
  if (!turnCompleted && !turnFailed) return 'skip'
  if (approvals.size > 0 || questions.size > 0) return 'wait'
  return 'archive'
}

interface Candidate {
  readonly task: ScheduleCatalogEntry
  readonly receipt: ScheduleDeliveryRecord
}

/** Narrow Host services used by the controller, also making its lifecycle independently testable. */
export interface ArchiveContext {
  readonly agents: { get(sessionId: SessionId): Agent | undefined }
  readonly logger: { warn(message: string): void }
  readonly schedule: {
    catalog(): Promise<ScheduleCatalogEntry[]>
    history(request: ScheduleDeliveryHistoryRequest): Promise<ScheduleDeliveryHistoryResult>
  }
  readonly sessionQuery: { readSession(sessionId: SessionId): Promise<{ events: readonly SessionEvent[] }> }
  readonly workspaceRegistry: {
    readonly archivedSessionIds: readonly SessionId[]
    readonly pinnedSessionIds: readonly SessionId[]
    archiveSession(sessionId: SessionId): Promise<void>
  }
  onScheduleChanged(listener: () => void): () => void
  onAgentStatus(listener: (sessionId: SessionId, status: AgentStatus) => void): () => void
}

/** Observe bounded Scheduler receipts and archive eligible idle target Sessions. */
export class ScheduleArchiveController {
  private readonly candidates = new Map<SessionId, Candidate>()
  private readonly skippedUntil = new Map<SessionId, number>()
  private readonly inFlight = new Set<SessionId>()
  private disposed = false
  private activeSweep: Promise<void> | undefined

  /** @param ctx - Host services used for Scheduler reads and Workspace archive writes.
   * @param keepFailed - Whether failed turns remain visible.
   */
  constructor(private readonly ctx: ArchiveContext, private readonly keepFailed: boolean) {}

  /** Attach listeners and begin the bounded restart sweep.
   * @returns Listener disposer.
   */
  start(): () => void {
    const onScheduleChanged = this.ctx.onScheduleChanged(() => { this.sweep() })
    const onAgentStatus = this.ctx.onAgentStatus((sessionId, status) => {
      if (status === 'idle') this.archiveOne(sessionId)
    })
    this.sweep()
    return () => {
      this.disposed = true
      onScheduleChanged()
      onAgentStatus()
      this.candidates.clear()
      this.skippedUntil.clear()
    }
  }

  private sweep(): void {
    if (this.disposed || this.activeSweep !== undefined) return
    const task = this.readRecentTargets()
    this.activeSweep = task
    void task.catch((error: unknown) => {
      this.ctx.logger.warn('schedule-archive: receipt sweep failed: ' + String(error))
    }).finally(() => {
      this.activeSweep = undefined
      if (!this.disposed) this.archiveCandidates()
    })
  }

  private async readRecentTargets(): Promise<void> {
    const tasks = (await this.ctx.schedule.catalog()).filter(task => task.target.kind === 'new').slice(0, MAX_TASKS)
    const eligibleTaskIds = new Set(tasks.map(task => String(task.id)))
    const cutoff = Date.now() - HISTORY_MS
    for (const [sessionId, expiresAt] of this.skippedUntil) {
      if (expiresAt < Date.now()) this.skippedUntil.delete(sessionId)
    }
    for (const [sessionId, candidate] of this.candidates) {
      if (!eligibleTaskIds.has(String(candidate.task.id)) || Date.parse(candidate.receipt.deliveredAt) < cutoff) {
        this.candidates.delete(sessionId)
      }
    }
    for (const task of tasks) {
      if (this.disposed) return
      const result = await this.ctx.schedule.history({ id: task.id, limit: RECEIPTS_PER_TASK })
      if ('code' in result) continue
      for (const receipt of result.records) {
        if (Date.parse(receipt.deliveredAt) < cutoff) break
        if (this.skippedUntil.has(receipt.targetSessionId)) continue
        this.candidates.set(receipt.targetSessionId, { task, receipt })
      }
    }
  }

  private archiveCandidates(): void {
    if (this.disposed) return
    for (const sessionId of this.candidates.keys()) this.archiveOne(sessionId)
  }

  private archiveOne(sessionId: SessionId): void {
    if (this.inFlight.has(sessionId)) return
    this.inFlight.add(sessionId)
    void this.archive(sessionId).catch((error: unknown) => {
      this.ctx.logger.warn('schedule-archive: could not archive Session "' + sessionId + '": ' + String(error))
    }).finally(() => this.inFlight.delete(sessionId))
  }

  private async archive(sessionId: SessionId): Promise<void> {
    if (this.disposed || this.ctx.workspaceRegistry.archivedSessionIds.includes(sessionId)) {
      this.candidates.delete(sessionId)
      return
    }
    const agent: Agent | undefined = this.ctx.agents.get(sessionId)
    if (agent !== undefined && agent.status !== 'idle') return
    const candidate = this.candidates.get(sessionId)
    if (candidate === undefined || candidate.task.target.kind !== 'new') return
    if (this.ctx.workspaceRegistry.pinnedSessionIds.includes(sessionId)) return
    const snapshot = await this.ctx.sessionQuery.readSession(sessionId)
    if (!this.isActive()) return
    const result = decision(snapshot.events, String(candidate.receipt.messageId), this.keepFailed)
    if (result === 'skip') {
      this.candidates.delete(sessionId)
      this.skippedUntil.set(sessionId, Date.parse(candidate.receipt.deliveredAt) + HISTORY_MS)
      return
    }
    if (result === 'wait') {
      return
    }
    // The registry refuses active Sessions unless stopActivity is explicitly requested.
    await this.ctx.workspaceRegistry.archiveSession(sessionId)
    this.candidates.delete(sessionId)
  }

  private isActive(): boolean {
    return !this.disposed
  }

}
