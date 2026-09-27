/**
 * "Open configuration file" inside Gaia: the stock action asks the Host to open
 * the profile document in a desktop editor, which a browser-served harness
 * cannot do. In a Gaia frame the action asks Gaia to open its own
 * configuration editor instead.
 */
import { createElement, type ReactElement } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { postToParent } from './bridge.ts'

/**
 * Settings header action shadowing `settings.action` / `open-document`.
 * @param props.t - the `settings` namespace translator.
 * @returns the button.
 */
export function GaiaDocumentAction({ t }: { t: (key: 'openDocument') => string }): ReactElement {
  return createElement(Button, {
    variant: 'outline',
    size: 'sm',
    onClick: () => { postToParent({ source: 'gaia-dsh', v: 1, type: 'openConfigEditor' }) },
  }, t('openDocument'))
}
