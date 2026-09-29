/**
 * Settings launcher owner for Gaia embed mode.
 * Captures the shell's openSettings function so parent postMessage 'openSettings'
 * can open the DSH Settings panel, and renders the standard sidebar Settings trigger
 * button so the launcher remains visible and functional in the DSH sidebar.
 */
import { createElement, useEffect, type ReactElement } from 'react'
import { IconSettingsOutlineMedium, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'

export type GaiaSettingsLauncherProps = PropsRuntime<'settings.launcher'> & PropsLocale<'settings'>

let capturedOpenSettings: (() => void) | undefined
let pendingOpenSettings = false

/** Set the active openSettings handler. Dispatches any pending open request. */
export function setCapturedOpenSettings(fn: (() => void) | undefined): void {
  capturedOpenSettings = fn
  if (fn !== undefined && pendingOpenSettings) {
    pendingOpenSettings = false
    fn()
  }
}

/** Open the DSH Settings panel if the handler is captured, or queue the request. */
export function openSettings(): boolean {
  if (capturedOpenSettings !== undefined) {
    capturedOpenSettings()
    return true
  }
  pendingOpenSettings = true
  return false
}

/** Reset internal state (for testing and teardown). */
export function resetCapturedSettings(): void {
  capturedOpenSettings = undefined
  pendingOpenSettings = false
}

/**
 * Settings launcher contribution for the `settings.launcher` slot.
 * Renders the sidebar trigger button matching the shell's stock trigger and captures openSettings.
 */
export function GaiaSettingsLauncher(props: GaiaSettingsLauncherProps): ReactElement {
  const { wide, settingsOpen, settingsShortcut, openSettings: handler, t } = props

  useEffect(() => {
    setCapturedOpenSettings(handler)
    return () => {
      if (capturedOpenSettings === handler) {
        setCapturedOpenSettings(undefined)
      }
    }
  }, [handler])

  const label = typeof t === 'function' ? t('trigger') : 'Settings'
  const shortcutKeys = settingsShortcut?.keys

  const button = createElement(
    'button',
    {
      type: 'button',
      'data-rail': !wide || undefined,
      'data-gaia-settings-launcher': '',
      'aria-label': label,
      'aria-keyshortcuts': settingsShortcut?.aria,
      'aria-haspopup': 'dialog',
      'aria-expanded': settingsOpen,
      onClick: () => { handler() },
    },
    createElement(IconSettingsOutlineMedium, { size: wide ? 16 : 18 }),
    wide ? createElement('span', { className: 'gaia-trigger-label' }, label) : null,
  )

  return createElement(Tooltip, {
    disabled: settingsOpen,
    label,
    shortcutKeys,
    children: button,
  })
}
