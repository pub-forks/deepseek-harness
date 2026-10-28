/** Gaia's read-only Obsidian Markdown viewer for DSH document previews. */
import type { Context } from '@deepseek-ai/cordis'
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
export const inject = ['locale', 'slots', 'documentPreviews', 'gaiaReadAloud'] as const

/** Register a higher-priority document definition and its keyed renderer body. */
export function apply(ctx: Context): void {
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
    const removeTasks = ctx.slots.register(
      { name: 'sidebar.right.tab.document', key: TASKS_BODY_ID, locale: 'gaiaMarkdown' }, TasksBody,
    )
    return () => { removeMarkdown(); removeTasks() }
  }), 'gaia-markdown: body')
}
