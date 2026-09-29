/**
 * Maximize/restore action for the Settings modal header inside Gaia frames.
 * Contributed to the `settings.action` slot; persists the maximized choice
 * in localStorage and applies it as a data attribute on document.documentElement.
 *
 * NOTE: Registration is currently disabled in index.ts because the settings modal
 * content is not responsive yet. The module is kept intact so it can be re-enabled.
 */
import { createElement, useCallback, useEffect, useState, type ReactElement } from 'react'
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'

/** Key used to persist the settings maximized state in localStorage. */
export const SETTINGS_MAXIMIZED_KEY = 'gaia.harness.settings.maximized'

/** Document root attribute applied when settings modal is maximized. */
export const SETTINGS_MAXIMIZED_ATTR = 'data-gaia-settings-maximized'

/**
 * Read whether the Settings modal is maximized from localStorage.
 * Wrapped in try/catch to gracefully handle storage access failures.
 * @returns true if the modal should be maximized.
 */
export function isSettingsMaximized(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(SETTINGS_MAXIMIZED_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Persist the maximized state and toggle the root attribute.
 * Wrapped in try/catch to survive private browsing or storage errors.
 * @param maximized - target maximized state.
 */
export function setSettingsMaximized(maximized: boolean): void {
  try {
    if (typeof window !== 'undefined') {
      if (maximized) {
        window.localStorage.setItem(SETTINGS_MAXIMIZED_KEY, '1')
      } else {
        window.localStorage.removeItem(SETTINGS_MAXIMIZED_KEY)
      }
    }
  } catch {
    // Ignore storage failure
  }
  if (typeof document !== 'undefined') {
    if (maximized) {
      document.documentElement.setAttribute(SETTINGS_MAXIMIZED_ATTR, '')
    } else {
      document.documentElement.removeAttribute(SETTINGS_MAXIMIZED_ATTR)
    }
  }
}

function MaximizeGlyph(): ReactElement {
  return createElement(
    'svg',
    {
      width: 14,
      height: 14,
      viewBox: '0 0 14 14',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
    },
    createElement('path', { d: 'M8.5 1.5H12.5V5.5' }),
    createElement('path', { d: 'M5.5 12.5H1.5V8.5' }),
    createElement('path', { d: 'M12.5 1.5L8 6' }),
    createElement('path', { d: 'M1.5 12.5L6 8' }),
  )
}

function RestoreGlyph(): ReactElement {
  return createElement(
    'svg',
    {
      width: 14,
      height: 14,
      viewBox: '0 0 14 14',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
    },
    createElement('path', { d: 'M12.5 5.5H8.5V1.5' }),
    createElement('path', { d: 'M1.5 8.5H5.5V12.5' }),
    createElement('path', { d: 'M8.5 5.5L13 1' }),
    createElement('path', { d: 'M5.5 8.5L1 13' }),
  )
}

/**
 * Settings action contribution that toggles the maximized state of the settings dialog.
 * @returns the button wrapped in a Tooltip.
 */
export function GaiaSettingsMaximize(): ReactElement {
  const [maximized, setMaximizedState] = useState(() => isSettingsMaximized())

  useEffect(() => {
    if (typeof document === 'undefined') return
    const observer = new MutationObserver(() => {
      const current = document.documentElement.hasAttribute(SETTINGS_MAXIMIZED_ATTR)
      setMaximizedState(current)
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: [SETTINGS_MAXIMIZED_ATTR] })
    return () => { observer.disconnect() }
  }, [])

  const toggle = useCallback(() => {
    const next = !maximized
    setMaximizedState(next)
    setSettingsMaximized(next)
  }, [maximized])

  const label = maximized ? 'Restore settings size' : 'Maximize settings'

  const button = createElement(
    'button',
    {
      type: 'button',
      'data-gaia-settings-maximize': '',
      'aria-label': label,
      'aria-pressed': maximized,
      onClick: toggle,
    },
    maximized ? createElement(RestoreGlyph) : createElement(MaximizeGlyph),
  )

  return createElement(Tooltip, {
    label,
    children: button,
  })
}
