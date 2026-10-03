/**
 * Expand `/starred` into an ordinary user follow-up without accessing project files.
 * @module @deepseek-ai/dsh-gaia-command-starred
 */
import type { Context } from '@deepseek-ai/cordis'
import { CommandDefinitionId } from '@deepseek-ai/dsh-commands'
import { createUserMessage } from '@deepseek-ai/dsh-llm'

export const name = 'gaia-command-starred'
export const inject = ['commands']

/** Parsed execution preferences; model text is used only in subagent prompts. */
export interface StarredArgs {
  mode: 'inline' | 'subagent'
  model: string
  release: boolean
}

/**
 * Parse whitespace-separated words, recognizing mode only at the first non-flag word.
 * @param raw - Text following `/starred`.
 * @returns Execution mode, normalized model text, and release preference.
 */
export function parseArgs(raw: string): StarredArgs {
  const words = raw.trim().split(/\s+/u).filter(Boolean)
  const release = words.includes('--release')
  const remaining = words.filter(word => word !== '--release')
  const first = remaining[0]?.toLowerCase()
  const mode = first === 'inline' || first === 'subagent' ? first : 'subagent'
  if (first === 'inline' || first === 'subagent') remaining.shift()
  return { mode, model: remaining.join(' '), release }
}

/**
 * Build the task workflow instructions sent as a user message.
 * @param args - Parsed execution preferences.
 * @returns Newline-separated instructions for the invoking agent.
 */
export function buildPrompt(args: StarredArgs): string {
  const lines = [
    'Find this project\'s tasks file: the `tasks.default` entry in `.gaia/settings.json`, or `.ai/ToDo.tasks` when that is missing. Deal with the important/starred tasks ONLY (`important: true`, not completed). Group related tasks for planning/implementation where it helps.',
  ]
  if (args.mode === 'inline') {
    lines.push('Implement each task or group yourself (do not delegate), then commit before dealing with the next one.')
  } else {
    lines.push(`Delegate each task or group to a subagent with your subagent tool${args.model ? ` on the model ${args.model}` : ''}, then review its work and commit.`)
    lines.push('DO NOT RUN SUBAGENTS IN PARALLEL. WAIT FOR ONE TO FINISH -> REVIEW -> COMMIT -> NEXT TASK.')
  }
  lines.push('Once a task\'s commit lands, mark it complete in the tasks file (`status: "done"`, `completed: true`, `completedAt` = now); re-read the file right before writing and keep every other field and task unchanged.')
  if (args.release) lines.push('When every starred task is committed, create a release following this project\'s release rules.')
  return lines.join('\n')
}

/**
 * Describe the selected workflow for the command result.
 * @param args - Parsed execution preferences.
 * @returns A single-line confirmation for the user.
 */
export function summary(args: StarredArgs): string {
  const text = args.mode === 'inline'
    ? 'starred: inline'
    : `starred: subagent${args.model ? ` ${args.model}` : ''} · sequential`
  return text + (args.release ? ' · release after' : '')
}

/** Register `/starred` in the Host command registry. */
export function apply(ctx: Context): void {
  ctx.commands.register({
    definitionId: CommandDefinitionId('@deepseek-ai/dsh-gaia-command-starred'),
    name: 'starred',
    description: "Work through the starred tasks in this project's tasks file, one at a time",
    input: { hint: '[inline|subagent] [model] [--release]', attachments: false },
    handler: (invocation) => {
      if (invocation.attachments.length > 0) {
        return { kind: 'error', text: 'Attachments are not supported by /starred.' }
      }
      const args = parseArgs(invocation.rawInput)
      invocation.agent.followup(createUserMessage({
        content: [{ type: 'text', text: buildPrompt(args) }],
        source: { kind: 'user' },
      }))
      return { kind: 'success', text: summary(args) }
    },
  })
}
