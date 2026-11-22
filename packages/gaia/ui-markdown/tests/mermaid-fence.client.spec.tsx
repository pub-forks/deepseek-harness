// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import { Context as CordisContext } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import { MermaidFenceLayer } from '../src/client/MermaidFence.tsx'
import type { MermaidFenceProps } from '../src/client/MermaidFence.tsx'
import { registerMermaidFence } from '../src/client/register-mermaid-fence.ts'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const contexts: Array<{ ctx: Context; directory: string }> = []
afterEach(async () => {
  for (const instance of contexts.splice(0)) {
    await instance.ctx.fiber.dispose()
    await rm(instance.directory, { recursive: true, force: true })
  }
})

function fenceProps(streaming: boolean): MermaidFenceProps {
  return {
    lang: 'mermaid', code: 'graph TD; A-->B', streaming,
    children: <pre data-testid="source">graph TD; A--&gt;B</pre>,
    t: () => 'Rendering diagram…',
  } as never
}

describe('Mermaid Chat fence layer', () => {
  it('registers the mermaid fence through Cordis and removes it when its Loader fiber is disposed', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'gaia-mermaid-fence-client-'))
    const ctx = new CordisContext()
    contexts.push({ ctx, directory })
    await ctx.plugin(Loader)
    ctx.loader.builtins.include = Include

    const entries: Array<{ options: Record<string, unknown>; component: unknown }> = []
    const slotsPlugin = {
      apply(context: Context) {
        context.provide('slots', {
          inject(_name: string, contribute: () => () => void) { return contribute() },
          register(options: Record<string, unknown>, component: unknown) {
            const entry = { options, component }
            entries.push(entry)
            return () => {
              const index = entries.indexOf(entry)
              if (index >= 0) entries.splice(index, 1)
            }
          },
        } as never)
      },
    }
    const markdownPlugin = {
      name: 'gaia-mermaid-fence-test', inject: ['slots'], apply: registerMermaidFence,
    }
    const modules = new Map<string, unknown>([
      ['test:slots', slotsPlugin], ['@deepseek-ai/dsh-gaia-ui-markdown', markdownPlugin],
    ])
    ctx.loader.internal = {
      version: 'v2',
      async import(specifier: string) {
        const module = modules.get(specifier)
        if (module === undefined) throw new Error(`Unexpected plugin: ${specifier}`)
        return module
      },
    } as never

    const config = join(directory, 'cordis.yml')
    await writeFile(config, [
      '- id: test-slots\n  name: test:slots',
      "- id: gaia-mermaid-fence-test\n  name: '@deepseek-ai/dsh-gaia-ui-markdown'\n  config: {}",
      '',
    ].join('\n'))
    await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(config).href } })
    await ctx.loader.await()
    for (const entry of ctx.loader.entries()) await entry.fiber?.await()

    expect(entries.map(entry => entry.options)).toEqual([expect.objectContaining({
      name: 'conversation.chat.markdown.fence', key: 'mermaid', id: '@deepseek-ai/dsh-gaia-ui-markdown/fence/mermaid',
    })])
    const plugin = [...ctx.loader.entries()].find(entry => entry.options.id === 'gaia-mermaid-fence-test')
    if (plugin?.fiber === undefined) throw new Error('Mermaid fence Loader entry was not mounted')
    await plugin.fiber.dispose()
    expect(entries).toHaveLength(0)
  })

  it('shows the code block during streaming without requesting a render', () => {
    const parent = { postMessage: vi.fn() }
    vi.spyOn(window, 'parent', 'get').mockReturnValue(parent as never)
    render(<MermaidFenceLayer {...fenceProps(true)} />)
    expect(screen.getByTestId('source')).toBeTruthy()
    expect(parent.postMessage).not.toHaveBeenCalled()
  })

  it('shows the code block outside a Gaia frame', () => {
    render(<MermaidFenceLayer {...fenceProps(false)} />)
    expect(screen.getByTestId('source')).toBeTruthy()
  })

  it('falls back to source when the Gaia renderer reports an error', async () => {
    const parent = { postMessage: vi.fn() }
    vi.spyOn(window, 'parent', 'get').mockReturnValue(parent as never)
    render(<MermaidFenceLayer {...fenceProps(false)} />)
    const request = parent.postMessage.mock.calls[0]?.[0] as { reqId: string }
    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: { source: 'gaia-dsh', v: 1, type: 'mermaidRendered', reqId: request.reqId, error: 'invalid diagram' },
        origin: window.location.origin, source: parent as never,
      }))
    })
    await waitFor(() => { expect(screen.getByTestId('source')).toBeTruthy() })
  })

  it('renders the parent SVG after the settled fence succeeds', async () => {
    const parent = { postMessage: vi.fn() }
    vi.spyOn(window, 'parent', 'get').mockReturnValue(parent as never)
    render(<MermaidFenceLayer {...fenceProps(false)} />)
    const request = parent.postMessage.mock.calls[0]?.[0] as { reqId: string }
    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: { source: 'gaia-dsh', v: 1, type: 'mermaidRendered', reqId: request.reqId, svg: '<svg data-testid="diagram"></svg>' },
        origin: window.location.origin, source: parent as never,
      }))
    })
    await waitFor(() => { expect(document.querySelector('svg[data-testid="diagram"]')).not.toBeNull() })
  })

  it('falls back to source when the Gaia renderer times out', async () => {
    vi.useFakeTimers()
    const parent = { postMessage: vi.fn() }
    vi.spyOn(window, 'parent', 'get').mockReturnValue(parent as never)
    render(<MermaidFenceLayer {...fenceProps(false)} />)
    await act(async () => {
      vi.advanceTimersByTime(15_000)
      await Promise.resolve()
    })
    expect(screen.getByTestId('source')).toBeTruthy()
  })
})
