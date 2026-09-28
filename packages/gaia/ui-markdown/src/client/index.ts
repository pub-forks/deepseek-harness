/** Gaia's read-only Obsidian Markdown viewer for DSH document previews. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { en, zh } from './locales.ts'
import { MARKDOWN_BODY_ID } from './markdown-definition.ts'
import { markdownDefinition } from './markdown-definition.ts'
import { MarkdownBody } from './MarkdownBody.tsx'

export const name = 'gaia-ui-markdown'
export const inject = ['locale', 'slots', 'documentPreviews'] as const

/** Register a higher-priority document definition and its keyed renderer body. */
export function apply(ctx: Context): void {
  const t = ctx.locale.bind('gaiaMarkdown')
  ctx.effect(() => ctx.locale.register('gaiaMarkdown', { en, zh }), 'gaia-markdown: dictionaries')
  ctx.effect(() => ctx.documentPreviews.register(markdownDefinition(() => t('label'))), 'gaia-markdown: metadata')
  ctx.effect(() => ctx.slots.inject('sidebar.right.tab.document', () => ctx.slots.register(
    { name: 'sidebar.right.tab.document', key: MARKDOWN_BODY_ID, locale: 'gaiaMarkdown' }, MarkdownBody,
  )), 'gaia-markdown: body')
}
