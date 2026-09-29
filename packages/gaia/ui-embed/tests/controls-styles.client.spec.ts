// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import {
  GAIA_CONTROLS_CSS,
  GAIA_SETTINGS_CSS,
  GAIA_SKIN_CSS,
  GAIA_SKIN_STYLE_ID,
  injectGaiaSkin,
} from '../src/client/styles.ts'

describe('GAIA_CONTROLS_CSS and settings controls styling', () => {
  afterEach(() => {
    document.getElementById(GAIA_SKIN_STYLE_ID)?.remove()
  })

  it('exports GAIA_CONTROLS_CSS as a non-empty string', () => {
    expect(typeof GAIA_CONTROLS_CSS).toBe('string')
    expect(GAIA_CONTROLS_CSS.length).toBeGreaterThan(0)
  })

  it('scopes controls to Gaia frames and settings/modal containers', () => {
    const expectedScope = ':is(html[data-gaia-embed], html[data-gaia-full]) :is([data-shortcut-modal="settings"], [data-dsh-modal])'
    expect(GAIA_CONTROLS_CSS).toContain(expectedScope)
    expect(GAIA_CONTROLS_CSS).toContain('[data-dsh-modal]')
  })

  it('includes Button styles for primary, outline, size sm, and danger', () => {
    expect(GAIA_CONTROLS_CSS).toContain('[data-dsh-button="primary"]')
    expect(GAIA_CONTROLS_CSS).toContain('var(--dsw-alias-button-primary-fill)')
    expect(GAIA_CONTROLS_CSS).toContain('[data-dsh-button="outline"]')
    expect(GAIA_CONTROLS_CSS).toContain('[data-dsh-size="sm"]')
    expect(GAIA_CONTROLS_CSS).toContain('var(--dsw-alias-state-error-primary)')
  })

  it('includes close button styles with destructive hover', () => {
    expect(GAIA_CONTROLS_CSS).toContain('[data-dsh-modal-close]')
    expect(GAIA_CONTROLS_CSS).toContain('[data-dsh-modal-close]:hover:not(:disabled)')
    expect(GAIA_CONTROLS_CSS).toContain('#fafafa')
  })

  it('includes select trigger styles for outline dropdown presentation', () => {
    expect(GAIA_CONTROLS_CSS).toContain('[data-dsh-select-trigger]')
    expect(GAIA_CONTROLS_CSS).toContain('height: 36px')
    expect(GAIA_CONTROLS_CSS).toContain('border: 1px solid var(--dsw-alias-border-l2)')
  })

  it('includes input and textarea styles', () => {
    expect(GAIA_CONTROLS_CSS).toContain('span:has(> [data-dsh-input])')
    expect(GAIA_CONTROLS_CSS).toContain('textarea')
  })

  it('includes focus ring styling with link token and excludes automatic focus', () => {
    expect(GAIA_CONTROLS_CSS).toContain('box-shadow: 0 0 0 1px var(--dsw-alias-link)')
    expect(GAIA_CONTROLS_CSS).toContain(':not([data-dsh-automatic-focus])')
    expect(GAIA_SETTINGS_CSS).toContain(':not([data-dsh-automatic-focus])')
  })

  it('includes box-sizing border-box on controls and styles font-size input and add provider button', () => {
    expect(GAIA_CONTROLS_CSS).toContain('box-sizing: border-box')
    expect(GAIA_CONTROLS_CSS).toContain('div[data-dsh-input]')
    expect(GAIA_CONTROLS_CSS).toContain(':is([data-dsh-add-provider], button[class*="_addButton"])')
  })

  it('includes modal footer rules with amber hover for cancelOutline buttons', () => {
    expect(GAIA_CONTROLS_CSS).toContain('[data-dsh-modal-footer]')
    expect(GAIA_CONTROLS_CSS).toContain('#f59e0b')
    expect(GAIA_CONTROLS_CSS).toContain('#451a03')
  })

  it('styles settings nav active tab with accent link token at rest, hover, and combines ring on keyboard focus', () => {
    expect(GAIA_SETTINGS_CSS).toContain('nav button[aria-current="true"]')
    expect(GAIA_SETTINGS_CSS).toContain('color: var(--dsw-alias-link)')
    expect(GAIA_SETTINGS_CSS).toContain('nav button[aria-current="true"]:hover')
    expect(GAIA_SETTINGS_CSS).toContain('box-shadow: inset 2px 0 0 var(--dsw-alias-link), 0 0 0 1px var(--dsw-alias-link)')
  })

  it('is included in GAIA_SKIN_CSS and injected by injectGaiaSkin', () => {
    expect(GAIA_SKIN_CSS).toContain(GAIA_CONTROLS_CSS)

    const remove = injectGaiaSkin()
    const styleEl = document.getElementById(GAIA_SKIN_STYLE_ID)
    expect(styleEl).not.toBeNull()
    expect(styleEl?.textContent).toContain(GAIA_CONTROLS_CSS)

    remove()
    expect(document.getElementById(GAIA_SKIN_STYLE_ID)).toBeNull()
  })
})
