/** Gaia-owned Session-header action that shows the Session workspace in Gaia's Explorer. */
import { createElement, type ReactElement } from 'react'
import { IconFolderOpenOutlineRegular, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { OpenPathActionProps } from '@deepseek-ai/dsh-client-ui-open-in-app/client'
import { postToParent } from './bridge.ts'
import css from './WorkspaceAction.module.css'

type GaiaWorkspaceActionProps =
  Pick<PropsRuntime<'conversation.session.header.utilities'>, 'sessionId' | 'useSessions'>
  & Pick<OpenPathActionProps, 't'>

/**
 * Replace the native "Open in Files" header button inside Gaia frames: the
 * native opener runs on the Harness host, not where the browser is, so the
 * workspace path is sent to Gaia, which reveals it in its Explorer.
 * @param props - the header's Session id, Session list hook, and localized labels.
 * @returns the reveal button, or null while the Session workspace is unknown.
 */
export function GaiaWorkspaceAction(props: GaiaWorkspaceActionProps): ReactElement | null {
  const { sessionId, useSessions, t } = props
  const cwd = useSessions(state => state.byId[sessionId]?.cwd)
  if (cwd === undefined || !cwd.startsWith('/')) return null
  const label = t('path.reveal')
  const button = createElement('button', {
    type: 'button',
    className: css.button,
    'aria-label': label,
    'data-gaia-workspace-action': '',
    onClick: () => { postToParent({ source: 'gaia-dsh', v: 1, type: 'openFile', action: 'reveal', path: cwd }) },
  }, createElement(IconFolderOpenOutlineRegular, { size: 13 }))
  return createElement(Tooltip, { portal: true, label, side: 'bottom', delayMs: 500, children: button })
}
