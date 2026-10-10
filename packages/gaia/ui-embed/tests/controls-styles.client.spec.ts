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

  it('includes Button styles for primary, outline, ghost, size sm, and danger with sm sizing', () => {
    expect(GAIA_CONTROLS_CSS).toContain('[data-dsh-button="primary"]')
    expect(GAIA_CONTROLS_CSS).toContain('var(--dsw-alias-button-primary-fill)')
    expect(GAIA_CONTROLS_CSS).toContain('[data-dsh-button="outline"]')
    expect(GAIA_CONTROLS_CSS).toContain('[data-dsh-button="ghost"]')
    expect(GAIA_CONTROLS_CSS).toContain('[data-dsh-size="sm"]')
    expect(GAIA_CONTROLS_CSS).toContain('var(--dsw-alias-state-error-primary)')
    expect(GAIA_CONTROLS_CSS).toContain('height: 32px')
    expect(GAIA_CONTROLS_CSS).toContain('padding: 0 12px')
    expect(GAIA_CONTROLS_CSS).toContain('font-size: 12px')
    expect(GAIA_CONTROLS_CSS).toContain('line-height: 16px')
    expect(GAIA_CONTROLS_CSS).toContain('gap: 8px')
    expect(GAIA_CONTROLS_CSS).toContain('width: auto')
    expect(GAIA_CONTROLS_CSS).toContain('[data-dsh-button]:not([data-dsh-modal-close])')
    expect(GAIA_CONTROLS_CSS).toContain('button[class*="_danger"]')
    expect(GAIA_CONTROLS_CSS).toContain('button[class*="_deleteConfirm"]')
    expect(GAIA_CONTROLS_CSS).toContain('button[class*="_addButton"]')
    expect(GAIA_CONTROLS_CSS).not.toContain('button:not(nav button)')
    expect(GAIA_CONTROLS_CSS).not.toContain(':has(> svg)')
    expect(GAIA_CONTROLS_CSS).not.toContain('button[class*="_cardContent"]')
    expect(GAIA_CONTROLS_CSS).not.toContain('[class*="_creditActions"] > button')
    const primaryButtonRule = GAIA_CONTROLS_CSS.match(/\/\* Button default: primary buttons \*\/([\s\S]*?)\n\}/)?.[1]
    expect(primaryButtonRule).not.toContain('height: 36px')
    expect(GAIA_CONTROLS_CSS).not.toMatch(/\[data-dsh-button="primary"\]\s*\{[^}]*padding:\s*0 16px/)
    expect(GAIA_CONTROLS_CSS).not.toMatch(/data-dsh-button="outline"[^}]*height:\s*36px/)
    expect(GAIA_CONTROLS_CSS).not.toMatch(/data-dsh-button="ghost"[^}]*height:\s*36px/)
  })

  it('limits compact geometry to DSH buttons and explicit legacy controls', () => {
    const frame = document.createElement('div')
    const settings = document.createElement('div')
    settings.setAttribute('data-shortcut-modal', 'settings')
    const plain = document.createElement('button')
    plain.textContent = 'Save'
    const primary = document.createElement('button')
    primary.setAttribute('data-dsh-button', 'primary')
    const outline = document.createElement('button')
    outline.setAttribute('data-dsh-button', 'outline')
    const svgText = document.createElement('button')
    svgText.append(document.createElementNS('http://www.w3.org/2000/svg', 'svg'), document.createTextNode('Let the agent help me create a preset'))
    const toggle = document.createElement('button')
    toggle.setAttribute('role', 'switch')
    toggle.append(document.createElement('span'))
    const tablist = document.createElement('div')
    tablist.setAttribute('role', 'tablist')
    const tab = document.createElement('button')
    tab.setAttribute('role', 'tab')
    tablist.append(tab)
    settings.append(plain, primary, outline, svgText, toggle, tablist)
    frame.append(settings)
    document.body.append(frame)

    const previousEmbed = document.documentElement.getAttribute('data-gaia-embed')
    document.documentElement.setAttribute('data-gaia-embed', '')
    try {
      const geometrySelector = GAIA_CONTROLS_CSS.match(/\/\* DSH buttons and explicit legacy controls use Gaia's compact geometry\. \*\/\s*([^\{]+)\{/u)?.[1]?.trim()
      const geometryRule = GAIA_CONTROLS_CSS.match(/\/\* DSH buttons and explicit legacy controls use Gaia's compact geometry\. \*\/\s*[^\{]+\{([^}]+)\}/u)?.[1]
      expect(geometrySelector).toBeDefined()
      expect(geometryRule).toContain('height: 32px')
      expect(geometryRule).toContain('padding: 0 12px')
      expect(plain.matches(geometrySelector!)).toBe(false)
      expect(primary.matches(geometrySelector!)).toBe(true)
      expect(outline.matches(geometrySelector!)).toBe(true)
      expect(svgText.matches(geometrySelector!)).toBe(false)
      expect(toggle.matches(geometrySelector!)).toBe(false)
      expect(tab.matches(geometrySelector!)).toBe(false)
    } finally {
      if (previousEmbed === null) document.documentElement.removeAttribute('data-gaia-embed')
      else document.documentElement.setAttribute('data-gaia-embed', previousEmbed)
      frame.remove()
    }
  })

  it('includes close button styles with destructive hover', () => {
    expect(GAIA_CONTROLS_CSS).toContain('[data-dsh-modal-close]')
    expect(GAIA_CONTROLS_CSS).toContain('[data-dsh-modal-close]:hover:not(:disabled)')
    expect(GAIA_CONTROLS_CSS).toContain('#fafafa')
  })

  it('includes select trigger styles for outline dropdown presentation with 36px height unchanged', () => {
    expect(GAIA_CONTROLS_CSS).toContain('[data-dsh-select-trigger]')
    expect(GAIA_CONTROLS_CSS).toContain('height: 36px')
    expect(GAIA_CONTROLS_CSS).toContain('border: 1px solid var(--gaia-input-border, var(--dsw-alias-border-l2))')
    expect(GAIA_CONTROLS_CSS).toMatch(/\[data-dsh-select-trigger\]\s*\{[^}]*height:\s*36px/)
  })

  it('keeps the add-account primary button at 32px', () => {
    expect(GAIA_CONTROLS_CSS).toMatch(/\[data-dsh-button="primary"\]\s*\{[^}]*height:\s*32px/)
    expect(GAIA_CONTROLS_CSS).not.toContain('form[data-gaia-auth-account-form] [data-dsh-button="primary"]')
  })

  it('includes input and textarea styles with 36px height unchanged', () => {
    expect(GAIA_CONTROLS_CSS).toContain('span:has(> [data-dsh-input])')
    expect(GAIA_CONTROLS_CSS).toContain('textarea')
    expect(GAIA_CONTROLS_CSS).toMatch(/input:not\([^}]*height:\s*36px/)
    expect(GAIA_CONTROLS_CSS).toContain('var(--gaia-input-border, var(--dsw-alias-border-l2))')
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

  it('styles settings nav active tab with accent link token at rest and focus ring without left accent bar', () => {
    expect(GAIA_SETTINGS_CSS).toContain('nav button[aria-current="true"]')
    expect(GAIA_SETTINGS_CSS).toContain('color: var(--dsw-alias-link)')
    expect(GAIA_SETTINGS_CSS).toContain('nav button[aria-current="true"]:hover')
    expect(GAIA_SETTINGS_CSS).toContain('box-shadow: 0 1px 3px rgb(0 0 0 / 0.1);')
    expect(GAIA_SETTINGS_CSS).not.toContain('inset 2px 0 0')
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
