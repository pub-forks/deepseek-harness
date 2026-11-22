/** Register Gaia's Mermaid Chat fence layer for the plugin lifetime. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { MermaidFenceLayer } from './MermaidFence.tsx'

/**
 * Register the language-keyed Mermaid renderer through the Chat fence slot.
 * @param ctx - client context with Slots and effect services.
 */
export function registerMermaidFence(ctx: Context): void {
  ctx.effect(() => ctx.slots.inject('conversation.chat.markdown.fence', () => ctx.slots.register({
    name: 'conversation.chat.markdown.fence', key: 'mermaid', id: '@deepseek-ai/dsh-gaia-ui-markdown/fence/mermaid', locale: 'gaiaMarkdown',
  }, MermaidFenceLayer)), 'gaia-markdown: mermaid fence')
}
