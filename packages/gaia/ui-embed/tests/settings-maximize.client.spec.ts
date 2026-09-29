// @vitest-environment jsdom
import { createElement } from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GaiaSettingsMaximize,
  isSettingsMaximized,
  setSettingsMaximized,
  SETTINGS_MAXIMIZED_ATTR,
  SETTINGS_MAXIMIZED_KEY,
} from '../src/client/settings-maximize.ts'

describe('settings-maximize helpers and component', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.removeAttribute(SETTINGS_MAXIMIZED_ATTR)
  })

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
    document.documentElement.removeAttribute(SETTINGS_MAXIMIZED_ATTR)
    vi.restoreAllMocks()
  })

  it('reads and writes maximized state to localStorage and document.documentElement', () => {
    expect(isSettingsMaximized()).toBe(false)
    expect(document.documentElement.hasAttribute(SETTINGS_MAXIMIZED_ATTR)).toBe(false)

    setSettingsMaximized(true)
    expect(isSettingsMaximized()).toBe(true)
    expect(window.localStorage.getItem(SETTINGS_MAXIMIZED_KEY)).toBe('1')
    expect(document.documentElement.hasAttribute(SETTINGS_MAXIMIZED_ATTR)).toBe(true)

    setSettingsMaximized(false)
    expect(isSettingsMaximized()).toBe(false)
    expect(window.localStorage.getItem(SETTINGS_MAXIMIZED_KEY)).toBeNull()
    expect(document.documentElement.hasAttribute(SETTINGS_MAXIMIZED_ATTR)).toBe(false)
  })

  it('survives localStorage throw when reading or writing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: access denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })

    // Reading returns false on error
    expect(isSettingsMaximized()).toBe(false)

    // Writing still sets document attribute even if localStorage throws
    expect(() => { setSettingsMaximized(true) }).not.toThrow()
    expect(document.documentElement.hasAttribute(SETTINGS_MAXIMIZED_ATTR)).toBe(true)

    expect(() => { setSettingsMaximized(false) }).not.toThrow()
    expect(document.documentElement.hasAttribute(SETTINGS_MAXIMIZED_ATTR)).toBe(false)
  })

  it('renders button and toggles maximized state on click', () => {
    const view = render(createElement(GaiaSettingsMaximize))

    const button = view.getByRole('button', { name: 'Maximize settings' })
    expect(button).toBeDefined()
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(document.documentElement.hasAttribute(SETTINGS_MAXIMIZED_ATTR)).toBe(false)

    fireEvent.click(button)

    expect(button.getAttribute('aria-label')).toBe('Restore settings size')
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(document.documentElement.hasAttribute(SETTINGS_MAXIMIZED_ATTR)).toBe(true)
    expect(window.localStorage.getItem(SETTINGS_MAXIMIZED_KEY)).toBe('1')

    fireEvent.click(button)

    expect(button.getAttribute('aria-label')).toBe('Maximize settings')
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(document.documentElement.hasAttribute(SETTINGS_MAXIMIZED_ATTR)).toBe(false)
    expect(window.localStorage.getItem(SETTINGS_MAXIMIZED_KEY)).toBeNull()
  })

  it('initializes in maximized state if localStorage is already set', () => {
    window.localStorage.setItem(SETTINGS_MAXIMIZED_KEY, '1')
    const view = render(createElement(GaiaSettingsMaximize))

    const button = view.getByRole('button', { name: 'Restore settings size' })
    expect(button).toBeDefined()
    expect(button.getAttribute('aria-pressed')).toBe('true')
  })
})
