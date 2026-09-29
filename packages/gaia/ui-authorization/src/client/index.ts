/** Gaia sign-in Settings contribution. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import remoteContribution from '@deepseek-ai/dsh-gaia-api-authorization/remote'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { FlowView } from '@deepseek-ai/dsh-gaia-api-authorization/types'
import { AuthorizationSection, type AuthorizationSectionInjected } from './AuthorizationSection.tsx'
import { en, zh, type AuthorizationKey } from './locales.ts'
import { determineFlowAuthKind } from './oauth.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'settings.gaiaAuthorization': AuthorizationKey }
  interface SlotMap {
    'settings.models.auth-provider': { kind: 'single'; scope: 'root' }
  }
}
export const inject = ['remote', 'slots', 'locale']
/** @param ctx - browser context with the Remote carrier and Settings slots. @returns after registration. */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const dispose = await ctx.remote.$mount(remoteContribution)
  const t = ctx.locale.bind('settings.gaiaAuthorization')
  ctx.effect(() => ctx.locale.register('settings.gaiaAuthorization', { en, zh }), 'gaia-authorization: dictionaries')
  // This plugin mounts its own namespace, so it cannot list
  // 'remote.gaiaAuthorization' in `inject` (activation would wait on itself).
  // Cordis refuses undeclared sub-service access, so the section is registered
  // in a scope that declares the namespace once the mount above provides it.
  ctx.inject(['remote.gaiaAuthorization', 'slots'], (actx) => {
    let cachedFlowsPromise: Promise<FlowView[]> | undefined
    const fetchFlows = (): Promise<FlowView[]> => {
      return actx.remote.gaiaAuthorization.listFlows().then(
        r => (r.ok ? r.value : []),
        () => [],
      )
    }
    const invalidateFlows = (): void => {
      cachedFlowsPromise = undefined
      actx.emit('slots/changed', 'settings.models.auth-provider')
    }

    const operations: AuthorizationSectionInjected = {
      async listFlows() {
        const result = await actx.remote.gaiaAuthorization.listFlows()
        if (!result.ok) throw result.error
        cachedFlowsPromise = Promise.resolve(result.value)
        actx.emit('slots/changed', 'settings.models.auth-provider')
        return result.value
      },
      start(request, signal) { return actx.remote.gaiaAuthorization.start(request, signal) },
      async answer(attemptId, promptId, value) {
        const result = await actx.remote.gaiaAuthorization.answer({ attemptId, promptId, value })
        if (!result.ok) throw result.error
        return result.value
      },
      async cancel(attemptId) {
        const result = await actx.remote.gaiaAuthorization.cancel({ attemptId })
        if (!result.ok) throw result.error
      },
      async signOut(key) {
        const result = await actx.remote.gaiaAuthorization.signOut({ key })
        if (!result.ok) throw result.error
        invalidateFlows()
      },
      async createAccount(source, accountId, label) {
        const result = await actx.remote.gaiaAuthorization.createAccount({ source, accountId, label })
        if (!result.ok) throw result.error
        invalidateFlows()
      },
      async createApiKeyAccount(source, accountId, label, apiKey) {
        const result = await actx.remote.gaiaAuthorization.createAccount({ source, accountId, label, apiKey })
        if (!result.ok) throw result.error
        invalidateFlows()
      },
      async removeAccount(key) {
        const result = await actx.remote.gaiaAuthorization.removeAccount({ key })
        if (!result.ok) throw result.error
        invalidateFlows()
      },
    }
    actx.slots.inject('settings.section', () => actx.slots.register({
      name: 'settings.section', id: 'gaia-authorization', order: 5,
      label: () => t('nav'), locale: 'settings.gaiaAuthorization', inject: () => operations,
    }, AuthorizationSection))
    actx.slots.inject('settings.models.auth-provider', () => actx.slots.register({
      name: 'settings.models.auth-provider',
      inject: () => ({
        async getAuthKind(provider: string) {
          cachedFlowsPromise ??= fetchFlows()
          const flows = await cachedFlowsPromise
          queueMicrotask(() => { cachedFlowsPromise = undefined })
          return determineFlowAuthKind(provider, flows)
        },
      }),
    }, () => null))
  })
  return dispose
}
