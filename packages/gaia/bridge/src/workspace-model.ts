/** Workspace model memory for the Gaia bridge and the full drawer's shared Host create path. */
import { AsyncLocalStorage } from 'node:async_hooks'
import type { Context } from '@deepseek-ai/cordis'
import type { CreateAgentOptions } from '@deepseek-ai/dsh-agent'
import type { Session } from '@deepseek-ai/dsh-session'
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { WorkspaceModelStore } from './workspace-model-store.ts'

/** Cordis child-plugin identity. */
export const name = 'gaia-workspace-model'
/** Services whose public creation methods are decorated for the plugin lifetime. */
export const inject = ['sessionController', 'agents', 'llm', 'sessionProjections']

function hasOwnChoice(ctx: Context, session: Session): boolean {
  const state = ctx.sessionProjections.stateOf(session, 'modelSelection')
  return state?.pending != null || state?.lastUsed != null
}

/** Install recording and creation-time selection before API prompt-routing setup.
 * @param ctx - Gaia Host context; the child shares the overlay's lifecycle.
 */
export function apply(ctx: Context): void {
  const store = new WorkspaceModelStore(dshHomePath('gaia-workspace-models.json'))
  const creating = new AsyncLocalStorage<boolean>()
  const automatic = new WeakSet<Session>()
  ctx.on('session/event', (session, event) => {
    if (event.type !== 'model/selection' || automatic.has(session)
      || session.header.origin === 'subagent' || session.header.cwd === undefined) return
    void store.record(session.header.cwd, event.data).catch(() => {
      ctx.logger(name).warn('Could not persist workspace model preference')
    })
  })
  ctx.on('session/flush', () => store.flush())

  ctx.effect(() => {
    const controller = ctx.sessionController
    const agents = ctx.agents
    // oxlint-disable-next-line typescript/unbound-method -- saved for call with the original receiver and teardown
    const originalCreate = controller.create
    // oxlint-disable-next-line typescript/unbound-method -- saved for call with the caller-traced receiver and teardown
    const originalAgentCreate = agents.create
    controller.create = function (request) {
      return creating.run(true, () => originalCreate.call(this, request))
    }
    agents.create = function (options: CreateAgentOptions) {
      if (!creating.getStore() || options.parentAgent !== undefined || options.meta?.origin === 'subagent'
        || options.meta?.parentSession !== undefined || options.meta?.isSeeded || options.seed !== undefined) {
        return originalAgentCreate.call(this, options)
      }
      const setup = options.setup
      return originalAgentCreate.call(this, {
        ...options,
        setup: async (agentCtx, agent) => {
          const session = agent.session
          const cwd = session.header.cwd
          if (cwd !== undefined && !hasOwnChoice(ctx, session)) {
            const remembered = await store.get(cwd)
            if (remembered !== undefined) {
              try {
                const advertised = ctx.llm.listProviders().some(provider => provider.id === remembered.provider)
                  && (await ctx.llm.listModels(remembered.provider)).some(model => model.id === remembered.model)
                if (advertised) {
                  const resolved = await ctx.llm.resolveCallConfig({ provider: remembered.provider, model: remembered.model,
                    ...(remembered.reasoningEffort === undefined
                      ? {} : { reasoningEffort: ReasoningEffortId(remembered.reasoningEffort) }) })
                  // Recheck after asynchronous catalog resolution so an explicit choice always wins.
                  if (!hasOwnChoice(ctx, session)) {
                    automatic.add(session)
                    try {
                      session.append('model/selection', {
                        provider: resolved.provider, model: resolved.model,
                        ...(resolved.reasoningEffort === undefined ? {} : { reasoningEffort: resolved.reasoningEffort }),
                      })
                    } finally { automatic.delete(session) }
                  }
                }
              } catch (_error) { /* Stale routes/efforts silently retain normal default routing. */ }
            }
          }
          return setup?.(agentCtx, agent)
        },
      })
    }
    return async () => {
      controller.create = originalCreate
      agents.create = originalAgentCreate
      await store.flush()
      creating.disable()
    }
  }, 'gaia workspace model creation hooks')
}
