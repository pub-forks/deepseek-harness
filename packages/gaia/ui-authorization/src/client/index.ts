/** Gaia sign-in Settings contribution. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import remoteContribution from '@deepseek-ai/dsh-gaia-api-authorization/remote'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-gaia-api-authorization/remote'
import { AuthorizationSection, type AuthorizationSectionInjected } from './AuthorizationSection.tsx'
import { en, zh, type AuthorizationKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'settings.gaiaAuthorization': AuthorizationKey }
}
export const inject = ['remote', 'slots', 'locale']
/** @param ctx - browser context with the Remote carrier and Settings slots. @returns after registration. */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const dispose = await ctx.remote.$mount(remoteContribution)
  const t = ctx.locale.bind('settings.gaiaAuthorization')
  ctx.effect(() => ctx.locale.register('settings.gaiaAuthorization', { en, zh }), 'gaia-authorization: dictionaries')
  const operations: AuthorizationSectionInjected = {
    async listFlows() {
      const result = await ctx.remote.gaiaAuthorization.listFlows()
      if (!result.ok) throw result.error
      return result.value
    },
    start(request, signal) { return ctx.remote.gaiaAuthorization.start(request, signal) },
    async answer(attemptId, promptId, value) {
      const result = await ctx.remote.gaiaAuthorization.answer({ attemptId, promptId, value })
      if (!result.ok) throw result.error
      return result.value
    },
    async cancel(attemptId) {
      const result = await ctx.remote.gaiaAuthorization.cancel({ attemptId })
      if (!result.ok) throw result.error
    },
    async signOut(key) {
      const result = await ctx.remote.gaiaAuthorization.signOut({ key })
      if (!result.ok) throw result.error
    },
  }
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'gaia-authorization', order: 5,
    label: () => t('nav'), locale: 'settings.gaiaAuthorization', inject: () => operations,
  }, AuthorizationSection))
  return dispose
}
