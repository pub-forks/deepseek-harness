/** Rename the invoking agent's current session through model and slash commands. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import { CommandDefinitionId } from '@deepseek-ai/dsh-commands'
import { createUserMessage, HarnessError } from '@deepseek-ai/dsh-llm'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-session-projection'
import { SessionTitleInvalidError } from '@deepseek-ai/dsh-session-title'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'

export const name = 'gaia-session-rename'
export const inject = ['agents', 'commands', 'sessionProjections', 'sessionTitle', 'tools']

const RENAME_DESCRIPTION = 'Rename the current session only when the user explicitly asks you to rename or title this session in any wording, or confirms a title you proposed. Do not use this for an inferred or unrequested title.'

/** Resolve the exact live caller and its active open-turn event cut. */
function executionContext(ctx: Context, exec: ToolRunContext) {
  const agent = exec.agent
  if (agent === undefined || ctx.agents.get(agent.id) !== agent || agent.status !== 'running'
    || ctx.agents.currentInitiator() !== agent) {
    throw new HarnessError('rename_session requires the exact live calling agent inside its active driver', 'SESSION_RENAME_DRIVER_REQUIRED')
  }
  const boundary = ctx.sessionProjections.stateOf(agent.session, 'turnBoundary')
  if (boundary === undefined || boundary.openTurnStartSeq === null) {
    throw new HarnessError('rename_session requires an open model turn', 'SESSION_RENAME_DRIVER_REQUIRED')
  }
  // oxlint-disable-next-line typescript/no-deprecated -- Existing Session history read; migration deferred.
  const events = agent.session.snapshotEvents()
  return { agent, events, openTurnStartSeq: boundary.openTurnStartSeq }
}

/** Require direct human authority in the current root agent turn. */
function requireDirectHuman(ctx: Context, exec: ToolRunContext): ReturnType<typeof executionContext> {
  const execution = executionContext(ctx, exec)
  if (!ctx.agents.roots().includes(execution.agent)) {
    throw new HarnessError('rename_session requires a direct human turn on a top-level agent', 'SESSION_RENAME_AUTHORITY_REQUIRED')
  }
  for (let seq = execution.openTurnStartSeq + 1; seq < execution.events.length; seq += 1) {
    const event: SessionEvent | undefined = execution.events[seq]
    if (event?.type === 'user/message' && event.data.source.kind === 'user') return execution
  }
  throw new HarnessError('rename_session requires a direct human message in the current turn', 'SESSION_RENAME_AUTHORITY_REQUIRED')
}

/** Convert service title validation into a stable structured tool error. */
function rename(ctx: Context, session: ReturnType<typeof executionContext>['agent']['session'], title: string): string {
  try {
    return ctx.sessionTitle.rename(session, title).title
  } catch (error) {
    if (error instanceof SessionTitleInvalidError) {
      throw new HarnessError(error.message, 'SESSION_RENAME_INVALID_TITLE')
    }
    throw error
  }
}

/** Register the model tool and the `/rename` user command. */
export function apply(ctx: Context): void {
  const renameTool = defineTool({
    name: 'rename_session',
    description: RENAME_DESCRIPTION,
    parameters: {
      title: { type: 'string', required: true, description: 'The title explicitly requested or confirmed by the user.' },
    },
    output: {
      schema: {
        type: 'object',
        properties: { title: { type: 'string', required: true } },
        additionalProperties: false,
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    execute(args, exec) {
      const execution = requireDirectHuman(ctx, exec)
      return Promise.resolve({ title: rename(ctx, execution.agent.session, args.title) })
    },
    presentCall: args => ({ card: 'generic', title: 'Rename session', kind: 'other', rawInput: args.title }),
  })
  ctx.tools.register({
    ...renameTool,
    parameters: { ...renameTool.parameters, additionalProperties: false },
    execute(args, exec) {
      if (typeof args !== 'object' || args === null || Array.isArray(args)
        || Object.keys(args).some(key => key !== 'title')) {
        throw new HarnessError('rename_session accepts only title', 'SESSION_RENAME_INVALID_ARGS')
      }
      return renameTool.execute(args, exec)
    },
  })

  ctx.commands.register({
    definitionId: CommandDefinitionId('@deepseek-ai/dsh-gaia-session-rename'),
    name: 'rename',
    description: 'Rename this session or ask the agent to suggest a title',
    input: { hint: '[title]', attachments: false },
    handler: (invocation) => {
      if (invocation.attachments.length > 0) {
        return { kind: 'error', text: 'Attachments are not supported by /rename.' }
      }
      const title = invocation.rawInput.trim()
      if (title.length > 0) {
        try {
          const accepted = rename(ctx, invocation.agent.session, title)
          return { kind: 'success', text: `renamed: ${accepted}` }
        } catch (error) {
          if (error instanceof HarnessError && error.code === 'SESSION_RENAME_INVALID_TITLE') {
            return { kind: 'error', text: error.message }
          }
          throw error
        }
      }
      invocation.agent.followup(createUserMessage({
        content: [{ type: 'text', text: 'Propose a concise title for this session based on our conversation, then apply it with rename_session.' }],
        source: { kind: 'user' },
      }))
      return { kind: 'success', text: 'asked the agent to suggest a title' }
    },
  })
}
