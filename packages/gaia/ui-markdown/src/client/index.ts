/** Gaia's read-only Obsidian Markdown viewer for DSH document previews. */
import type { Context } from '@deepseek-ai/cordis'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import type {} from '../types.ts'
import remoteContribution from '@deepseek-ai/dsh-gaia-ui-markdown/remote'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { en, zh } from './locales.ts'
import { MARKDOWN_BODY_ID, TASKS_BODY_ID, markdownDefinition, tasksDefinition } from './markdown-definition.ts'
import { MarkdownBody } from './MarkdownBody.tsx'
import { TasksBody } from './TasksBody.tsx'

export const name = 'gaia-ui-markdown'
export const inject = ['locale', 'slots', 'documentPreviews', 'gaiaReadAloud', 'remote'] as const

/** Register a higher-priority document definition and its keyed renderer body. */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const disposeRemote = await ctx.remote.$mount(remoteContribution)
  const t = ctx.locale.bind('gaiaMarkdown')
  ctx.effect(() => ctx.locale.register('gaiaMarkdown', { en, zh }), 'gaia-markdown: dictionaries')
  ctx.effect(() => {
    const removeMarkdown = ctx.documentPreviews.register(markdownDefinition(() => t('label')))
    const removeTasks = ctx.documentPreviews.register(tasksDefinition(() => t('tasksLabel')))
    return () => { removeMarkdown(); removeTasks() }
  }, 'gaia-markdown: metadata')
  ctx.effect(() => ctx.slots.inject('sidebar.right.tab.document', () => {
    const removeMarkdown = ctx.slots.register(
      { name: 'sidebar.right.tab.document', key: MARKDOWN_BODY_ID, locale: 'gaiaMarkdown',
        inject: () => ({ readAloud: ctx.get('gaiaReadAloud') as import('./MarkdownBody.tsx').MarkdownBodyProps['readAloud'] }) }, MarkdownBody,
    )
    return removeMarkdown
  }), 'gaia-markdown: body')
  ctx.inject(['remote.gaiaTasks', 'remote.workspaceFiles'], (scope) => {
    ctx.slots.inject('sidebar.right.tab.document', () => ctx.slots.register(
      { name: 'sidebar.right.tab.document', key: TASKS_BODY_ID, locale: 'gaiaMarkdown', inject: () => ({
        tasksRemote: {
          write: async (sessionId: string, path: string, text: string, version: string, signal: AbortSignal) => {
            const result = await scope.remote.gaiaTasks.write(SessionId(sessionId), path, text, version, signal)
            if (!result.ok) throw result.error
            return result.value
          },
          read: async (sessionId: string, path: string, signal: AbortSignal) => {
            const result = await scope.remote.workspaceFiles.readBytes(SessionId(sessionId), path, {}, signal)
            if (!result.ok) throw result.error
            return { text: new TextDecoder('utf-8', { fatal: true }).decode(result.value.data), version: result.value.version }
          },
        },
      }) }, TasksBody,
    ))
  })
  return disposeRemote
}
