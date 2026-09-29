// @vitest-environment jsdom
import { createElement } from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GaiaAppearanceRow } from '../src/client/appearance-row.ts'

describe('GaiaAppearanceRow component', () => {
  afterEach(() => {
    cleanup()
    Object.defineProperty(window, 'parent', { value: window, configurable: true })
  })

  it('renders title, description and posts openGaiaSettings on button click', () => {
    const postMessage = vi.fn()
    Object.defineProperty(window, 'parent', { value: { postMessage }, configurable: true })

    const t = (key: string) => {
      if (key === 'appearance.title') return 'Appearance'
      if (key === 'appearance.followsGaia') return 'Follows Gaia’s theme'
      if (key === 'appearance.openGaiaSettings') return 'Open Gaia appearance settings'
      return key
    }

    const closeSpy = vi.fn()
    const view = render(createElement(GaiaAppearanceRow, {
      t,
      close: closeSpy,
    }))

    expect(view.getByText('Appearance')).toBeDefined()
    expect(view.getByText('Follows Gaia’s theme')).toBeDefined()

    const button = view.getByRole('button', { name: 'Open Gaia appearance settings' })
    expect(button).toBeDefined()

    fireEvent.click(button)

    expect(postMessage).toHaveBeenCalledWith(
      { source: 'gaia-dsh', v: 1, type: 'openGaiaSettings', section: 'appearance' },
      window.location.origin,
    )
    expect(closeSpy).toHaveBeenCalledTimes(1)
  })

  it('falls back to default English copy when t does not translate keys', () => {
    const postMessage = vi.fn()
    Object.defineProperty(window, 'parent', { value: { postMessage }, configurable: true })

    const view = render(createElement(GaiaAppearanceRow, {}))

    expect(view.getByText('Appearance')).toBeDefined()
    expect(view.getByText('Follows Gaia’s theme')).toBeDefined()

    const escapes: KeyboardEvent[] = []
    const onKeydown = (event: KeyboardEvent): void => { escapes.push(event) }
    document.addEventListener('keydown', onKeydown)
    const button = view.getByRole('button', { name: 'Open Gaia appearance settings' })
    fireEvent.click(button)
    document.removeEventListener('keydown', onKeydown)

    expect(postMessage).toHaveBeenCalledWith(
      { source: 'gaia-dsh', v: 1, type: 'openGaiaSettings', section: 'appearance' },
      window.location.origin,
    )
    // Without a close action the row asks the top modal layer to close via Escape.
    expect(escapes.map(event => event.key)).toEqual(['Escape'])
  })
})
