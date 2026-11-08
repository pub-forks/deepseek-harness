import type { SessionId } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-typert-protocol'

/** Token totals for one provider/model within a scheduled delivery. */
export interface ScheduledModelUsage {
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  costUsd: number | null
}

/** One retained Scheduler delivery with usage read from its target Session turn. */
export interface ScheduledRunUsage {
  messageId: string
  targetSessionId: SessionId
  scheduledAt: string
  deliveredAt: string
  tasks: Array<{ id: string; title: string }>
  usageAvailable: boolean
  usage: ScheduledModelUsage[]
  totals: {
    inputTokens: number
    outputTokens: number
    cacheReadTokens: number
    cacheWriteTokens: number
    costUsd: number | null
  }
}

/** Client-safe scheduled task with its non-shared deliveries. */
export interface ScheduledTaskUsage {
  id: string
  title: string
  status: 'active' | 'paused' | 'ended'
  runs: ScheduledRunUsage[]
  sharedRunCount: number
  earlierRunsAvailable: boolean
  earlierRunsPruned: boolean
}

/** One delivery shared by multiple tasks in the same Session inbox batch. */
export interface ScheduledSharedBatch extends ScheduledRunUsage {}

/** Task and delivery-time filter for the dashboard Remote. */
export interface ScheduleUsageQuery {
  /** Task ids to include; empty or absent includes every task. */
  taskIds?: string[]
  /** Inclusive ISO instant; deliveries before it are excluded. */
  from: string
  /** Inclusive ISO instant; deliveries after it are excluded. */
  to: string
}

/** Selectable task shown by the task filter, including tasks the filter hides. */
export interface ScheduleTaskOption {
  id: string
  title: string
  status: 'active' | 'paused' | 'ended'
}

/** Read-only scheduled-task usage dashboard response. */
export interface ScheduleUsageDashboard {
  totalTaskCount: number
  taskOptions: ScheduleTaskOption[]
  tasks: ScheduledTaskUsage[]
  sharedBatches: ScheduledSharedBatch[]
  pricingUpdatedAt: number | null
  pricingAvailable: boolean
  truncated: boolean
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** The dashboard filter has an unparsable or inverted date range, or too many task ids. */
    'gaia-schedule-usage/invalid-query': { readonly reason: string }
  }
}
