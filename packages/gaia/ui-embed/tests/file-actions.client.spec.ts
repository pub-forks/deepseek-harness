// @vitest-environment jsdom
import { createElement } from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GaiaFileActions } from '../src/client/file-actions.ts'

describe('Gaia Harness file actions', () => {
  afterEach(() => {
    cleanup()
    Object.defineProperty(window, 'parent', { value: window, configurable: true })
  })

  it('routes open and reveal actions to the same-origin Gaia parent', () => {
    const postMessage = vi.fn()
    Object.defineProperty(window, 'parent', { value: { postMessage }, configurable: true })
    const path = '/home/u/project/file with spaces.ts'
    const t = (key: string): string => key === 'path.open' ? 'Open' : 'Show file location'
    const view = render(createElement(GaiaFileActions, { absolutePath: path, t }))

    fireEvent.click(view.getByRole('button', { name: 'Open' }))
    fireEvent.click(view.getByRole('button', { name: 'Show file location' }))

    expect(postMessage).toHaveBeenNthCalledWith(1, {
      source: 'gaia-dsh', v: 1, type: 'openFile', action: 'open', path,
    }, window.location.origin)
    expect(postMessage).toHaveBeenNthCalledWith(2, {
      source: 'gaia-dsh', v: 1, type: 'openFile', action: 'reveal', path,
    }, window.location.origin)
  })
})
