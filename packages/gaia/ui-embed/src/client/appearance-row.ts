/**
 * Appearance settings row for Gaia frames.
 * Replaces the stock theme preference cubes (Light / Dark / System) with an
 * indicator that the theme follows Gaia and a shortcut action to open Gaia's
 * own Appearance settings.
 */
import { createElement, type ReactElement } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { postToParent } from './bridge.ts'

/** Props for the Gaia appearance settings row. */
export type GaiaAppearanceRowProps = Partial<PropsRuntime<'settings.general.item'>> & Partial<PropsLocale<'settings.theme'>> & {
  close?: () => void
}

/**
 * Render the Appearance row inside Gaia frames.
 * Posts an openGaiaSettings message to the host window when clicked.
 * @param props - slot props from settings.general.item.
 * @returns row element tree.
 */
export function GaiaAppearanceRow(props: GaiaAppearanceRowProps): ReactElement {
  const { t, close } = props
  const tr = t as ((key: string) => string) | undefined
  const title = typeof t === 'function' ? t('appearance.title') : 'Appearance'
  const description = typeof tr === 'function' ? tr('appearance.followsGaia') : 'Follows Gaia’s theme'
  const actionLabel = typeof tr === 'function' ? tr('appearance.openGaiaSettings') : 'Open Gaia appearance settings'

  const onClick = (event: { currentTarget: EventTarget }): void => {
    postToParent({ source: 'gaia-dsh', v: 1, type: 'openGaiaSettings', section: 'appearance' })
    if (typeof close === 'function') {
      close()
      return
    }
    // General rows receive no close action; the top modal layer closes on Escape.
    event.currentTarget.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  }

  return createElement(
    'div',
    { 'data-gaia-appearance': '' },
    createElement('div', { 'data-gaia-appearance-title': '' }, title),
    createElement(
      'div',
      { 'data-gaia-appearance-body': '' },
      createElement('span', { 'data-gaia-appearance-desc': '' }, description),
      createElement(
        Button,
        {
          variant: 'outline',
          size: 'sm',
          onClick,
        },
        actionLabel,
      ),
    ),
  )
}
