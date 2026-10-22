/**
 * Settings launcher owner for Gaia embed mode.
 * Captures the shell's openSettings function so parent postMessage 'openSettings'
 * can open the DSH Settings panel, and renders the standard sidebar Settings trigger
 * button so the launcher remains visible and functional in the DSH sidebar.
 */
import { createElement, useEffect, type ReactElement } from 'react'
import { IconSettingsOutlineMedium, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'

/** Runtime and localized props of the Gaia Settings launcher. */
export type GaiaSettingsLauncherProps = PropsRuntime<'settings.launcher'> & PropsLocale<'settings'>

let capturedOpenSettings: (() => void) | undefined
let pendingOpenSettings = false

/** Set the active openSettings handler and dispatch any queued open request.
 * @param fn - current Settings opener, or undefined when unmounted.
 */
export function setCapturedOpenSettings(fn: (() => void) | undefined): void {
  capturedOpenSettings = fn
  if (fn !== undefined && pendingOpenSettings) {
    pendingOpenSettings = false
    fn()
  }
}

/** Open the DSH Settings panel or queue the request until its handler mounts.
 * @returns whether the panel was opened immediately.
 */
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
 * Render the Gaia Settings trigger for the `settings.launcher` slot.
 * @param props - slot runtime, state, callback, and localized copy.
 * @returns the accessible Settings launcher.
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
