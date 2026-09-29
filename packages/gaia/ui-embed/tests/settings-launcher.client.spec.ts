// @vitest-environment jsdom
import { createElement, type ComponentType } from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  GaiaSettingsLauncher,
  type GaiaSettingsLauncherProps,
  openSettings,
  resetCapturedSettings,
} from '../src/client/settings-launcher.ts'
import { apply } from '../src/client/index.ts'
import { Context } from '@deepseek-ai/cordis'

type LauncherPropsOptions = {
  wide?: boolean
  settingsOpen?: boolean
  openSettings?: () => void
  openOnboarding?: (id: string) => void
  settingsShortcut?: { keys: readonly string[]; aria: string }
  t?: (key: string) => string
}

function makeLauncherProps(overrides: LauncherPropsOptions = {}): GaiaSettingsLauncherProps {
  return {
    wide: true,
    settingsOpen: false,
    openSettings: vi.fn(),
    openOnboarding: vi.fn(),
    t: () => 'Settings',
    ...overrides,
  } as unknown as GaiaSettingsLauncherProps
}

describe('GaiaSettingsLauncher component and openSettings handler', () => {
  afterEach(() => {
    cleanup()
    resetCapturedSettings()
  })

  it('renders wide settings launcher with icon and label', () => {
    const openSettingsSpy = vi.fn()
    const view = render(createElement(GaiaSettingsLauncher, makeLauncherProps({
      wide: true,
      settingsOpen: false,
      openSettings: openSettingsSpy,
      t: () => 'Settings',
    })))

    const button = view.getByRole('button', { name: 'Settings' })
    expect(button).toBeDefined()
    expect(button.getAttribute('data-rail')).toBeNull()
    expect(button.textContent).toContain('Settings')

    fireEvent.click(button)
    expect(openSettingsSpy).toHaveBeenCalledTimes(1)
  })

  it('renders rail launcher without label when wide is false', () => {
    const openSettingsSpy = vi.fn()
    const view = render(createElement(GaiaSettingsLauncher, makeLauncherProps({
      wide: false,
      settingsOpen: false,
      openSettings: openSettingsSpy,
      t: () => 'Settings',
    })))

    const button = view.getByRole('button', { name: 'Settings' })
    expect(button).toBeDefined()
    expect(button.getAttribute('data-rail')).toBe('true')
    expect(button.querySelector('.gaia-trigger-label')).toBeNull()

    fireEvent.click(button)
    expect(openSettingsSpy).toHaveBeenCalledTimes(1)
  })

  it('captures openSettings and calls it via openSettings()', () => {
    const openSettingsSpy = vi.fn()
    const view = render(createElement(GaiaSettingsLauncher, makeLauncherProps({
      wide: true,
      settingsOpen: false,
      openSettings: openSettingsSpy,
      t: () => 'Settings',
    })))

    expect(openSettings()).toBe(true)
    expect(openSettingsSpy).toHaveBeenCalledTimes(1)

    view.unmount()
    expect(openSettings()).toBe(false)
  })

  it('queues an openSettings call made before component mounts', () => {
    const openSettingsSpy = vi.fn()
    // Called before launcher mounts
    expect(openSettings()).toBe(false)

    // When launcher mounts, the queued request is dispatched
    render(createElement(GaiaSettingsLauncher, makeLauncherProps({
      wide: true,
      settingsOpen: false,
      openSettings: openSettingsSpy,
      t: () => 'Settings',
    })))

    expect(openSettingsSpy).toHaveBeenCalledTimes(1)
  })

  it('handles postMessage openSettings from parent frame', () => {
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      value: new URL('http://localhost:3000/?gaia=full'),
      writable: true,
      configurable: true,
    })
    const fakeParent = { postMessage: vi.fn() } as unknown as Window
    Object.defineProperty(window, 'parent', { value: fakeParent, configurable: true })

    const ctx = new Context()
    const slotComponents: Array<{ name: string; component: unknown }> = []
    ctx.provide('slots', {
      inject: vi.fn((_name: string, factory: () => unknown) => factory()),
      register: vi.fn((options: { name: string }, component?: unknown) => {
        slotComponents.push({ name: options.name, component })
        return () => {}
      }),
    })
    ctx.provide('locale', { register: vi.fn(), bind: vi.fn(() => (k: string) => k), subscribe: vi.fn(() => () => {}), getSnapshot: () => ({ active: 'en', revision: 0 }) })
    ctx.provide('theme', { register: vi.fn(() => () => {}), setTheme: vi.fn(), getTheme: () => ({ preference: 'system' }), overrideTokens: vi.fn(() => () => {}) })
    ctx.provide('connection', { state: { getSnapshot: () => 'connected', subscribe: () => () => {} } })
    ctx.provide('layout', { toggleSidebar: vi.fn(), layoutInfo: { getSnapshot: () => ({ viewportWidth: 1280, sidebar: 280 }), subscribe: () => () => {} } })
    ctx.provide('uiSession', { sessionStatus: { getSnapshot: () => new Map(), subscribe: () => () => {} } })

    const dispose = apply(ctx)

    const launcherEntry = slotComponents.find(e => e.name === 'settings.launcher')
    expect(launcherEntry).toBeDefined()
    const openSettingsSpy = vi.fn()

    const view = render(createElement(
      launcherEntry!.component as ComponentType<GaiaSettingsLauncherProps>,
      makeLauncherProps({
        wide: true,
        settingsOpen: false,
        openSettings: openSettingsSpy,
        t: () => 'Settings',
      }),
    ))

    // Dispatch valid message from parent
    window.dispatchEvent(new MessageEvent('message', {
      source: fakeParent,
      origin: window.location.origin,
      data: { source: 'gaia-dsh', v: 1, type: 'openSettings' },
    }))

    expect(openSettingsSpy).toHaveBeenCalledTimes(1)

    view.unmount()
    if (typeof dispose === 'function') void dispose()
    Object.defineProperty(window, 'location', { value: originalLocation, configurable: true })
    Object.defineProperty(window, 'parent', { value: window, configurable: true })
  })
})
