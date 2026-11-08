import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import remoteContribution from '@deepseek-ai/dsh-gaia-schedule-usage/remote'
import { ScheduleUsageIcon } from './ScheduleUsageIcon.tsx'
import type { ScheduleUsageDashboard, ScheduleUsageQuery } from '../types.ts'
import { ScheduleUsagePanel } from './ScheduleUsagePanel.tsx'
import { NS, en, zh, type ScheduleUsageKey } from './locales.ts'

const PANEL_ID = 'schedule-usage' as MainPanelId

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Automation usage page labels. */
    'gaia.scheduleUsage': ScheduleUsageKey
  }
}

/** Client services required for Remote access, translations, panel navigation, and slot registrations. */
export const inject = ['remote', 'slots', 'locale']

/** Mount the scheduled-task usage page and its Remote contribution.
 * @param ctx - Client context for Remote, locale, and Slot registrations.
 * @returns A disposer for the mounted Remote contribution.
 */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const disposeRemote = await ctx.remote.$mount(remoteContribution)
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'gaia-schedule-usage: dictionaries')
  const t = ctx.locale.bind(NS)
  ctx.inject(['remote.gaiaScheduleUsage', 'slots'], (actx) => {
    const load = async (query: ScheduleUsageQuery): Promise<ScheduleUsageDashboard> => {
      const result = await actx.remote.gaiaScheduleUsage.dashboard(query)
      if (!result.ok) throw result.error
      return result.value
    }
    actx.effect(function* () {
      yield actx.slots.inject('main', () => actx.slots.register({
        name: 'main',
        key: PANEL_ID,
        locale: NS,
        inject: () => ({ load }),
      }, ScheduleUsagePanel))
      yield actx.slots.inject('sidebar.panellist', () => actx.slots.register({
        name: 'sidebar.panellist',
        id: PANEL_ID,
        order: 30,
        locale: NS,
        label: () => t('panel'),
      }, ScheduleUsageIcon))
    })
  })
  return async () => { await disposeRemote() }
}
