import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'

/** Decorative bar-chart icon for the sidebar panel row.
 * @param props - Sidebar Slot props containing the icon dimensions.
 * @returns An accessible-hidden chart glyph.
 */
export function ScheduleUsageIcon({ size }: PropsRuntime<'sidebar.panellist'>) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5h16" /><path d="M6.5 16V9" /><path d="M12 16V4.5" /><path d="M17.5 16v-4" />
  </svg>
}
