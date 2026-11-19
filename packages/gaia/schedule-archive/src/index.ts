/** Archive completed per-delivery Sessions created by scheduled tasks. */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { ScheduleArchiveController } from './archive.ts'

export const name = 'gaia-schedule-archive'
export const inject = ['agents', 'schedule', 'sessionQuery', 'workspaceRegistry']

/** Runtime policy for automatic archiving. */
export interface Config {
  /** Whether completed scheduled Sessions are archived. */
  enabled: boolean
  /** Whether failed delivery turns stay visible. */
  keepFailed: boolean
}

export const Config = z.object({
  enabled: z.boolean().default(true),
  keepFailed: z.boolean().default(true),
})

/** Install the Host-only scheduled Session archiver. */
export function apply(ctx: Context, config: Config): void {
  if (!config.enabled) return
  const controller = new ScheduleArchiveController({
    agents: ctx.agents,
    logger: ctx.logger,
    schedule: ctx.schedule,
    sessionQuery: ctx.sessionQuery,
    workspaceRegistry: ctx.workspaceRegistry,
    onScheduleChanged: listener => ctx.on('schedule/changed', listener),
    onAgentStatus: listener => ctx.on('agent/status', ({ agent, status }) => { listener(agent.session.id, status) }),
  }, config.keepFailed)
  ctx.effect(() => controller.start(), 'gaia-schedule-archive.lifecycle()')
}
