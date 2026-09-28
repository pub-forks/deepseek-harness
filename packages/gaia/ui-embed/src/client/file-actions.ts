/** Gaia-owned actions for files shown in Harness's document preview. */
import { createElement, type ReactElement } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { OpenPathActionProps } from '@deepseek-ai/dsh-client-ui-open-in-app/client'
import { postToParent } from './bridge.ts'
import css from './FileActions.module.css'

type GaiaFileActionsProps = Pick<OpenPathActionProps, 'absolutePath' | 't'>

/**
 * Open a previewed file in Gaia or reveal it in Gaia's Explorer.
 * The document preview supplies the Host-resolved absolute path.
 * @param props - the previewed absolute path and localized action labels.
 * @returns The localized Open and Show file location actions.
 */
export function GaiaFileActions(props: GaiaFileActionsProps): ReactElement {
  const { absolutePath, t } = props
  return createElement('div', { className: css.actions, 'data-gaia-file-actions': '' },
    createElement(Button, {
      variant: 'outline',
      size: 'sm',
      onClick: () => { postToParent({ source: 'gaia-dsh', v: 1, type: 'openFile', action: 'open', path: absolutePath }) },
    }, t('path.open')),
    createElement(Button, {
      variant: 'ghost',
      size: 'sm',
      onClick: () => { postToParent({ source: 'gaia-dsh', v: 1, type: 'openFile', action: 'reveal', path: absolutePath }) },
    }, t('path.reveal')),
  )
}
