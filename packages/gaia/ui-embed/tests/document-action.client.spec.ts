// @vitest-environment jsdom
import { createElement } from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GaiaDocumentAction } from '../src/client/document-action.ts'

describe('Gaia configuration document action', () => {
  afterEach(() => {
    cleanup()
    Object.defineProperty(window, 'parent', { value: window, configurable: true })
  })

  it('asks the Gaia parent to open its configuration editor', () => {
    const postMessage = vi.fn()
    Object.defineProperty(window, 'parent', { value: { postMessage }, configurable: true })
    const view = render(createElement(GaiaDocumentAction, { t: () => 'Open configuration file' }))
    fireEvent.click(view.getByText('Open configuration file'))
    expect(postMessage).toHaveBeenCalledWith({ source: 'gaia-dsh', v: 1, type: 'openConfigEditor' }, window.location.origin)
  })
})
