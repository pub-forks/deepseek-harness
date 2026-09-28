// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import remarkObsidian from '../src/lib/markdown/remarkObsidian.ts'
import { markdownDefinition, MARKDOWN_BODY_ID } from '../src/client/markdown-definition.ts'
import { MarkdownBody } from '../src/client/MarkdownBody.tsx'
import type { MarkdownBodyProps } from '../src/client/MarkdownBody.tsx'
import { markdownSanitizeSchema } from '../src/client/MarkdownBody.tsx'

afterEach(cleanup)

async function renderHtml(markdown: string): Promise<string> {
  const result = await unified().use(remarkParse).use(remarkObsidian).use(remarkRehype).use(rehypeRaw)
    .use(rehypeSanitize, markdownSanitizeSchema).use(rehypeStringify).process(markdown)
  return String(result)
}

function props(text: string, openResource = vi.fn()): MarkdownBodyProps {
  return {
    content: { kind: 'text', text, pages: [], eof: true }, resourceAddress: 'dsh-resource://file/session/s1/docs/readme.md',
    useResource: () => ({ status: 'ready', value: { absolutePath: '/workspace/docs/readme.md' } }),
    useTabInfo: () => ({ tab: { actions: { openResource } } }),
    t: (key: string) => key,
  } as unknown as MarkdownBodyProps
}

describe('Gaia Markdown remark port', () => {
  it('converts wikilinks, image embeds, tags, and callouts into structured nodes', async () => {
    const html = await renderHtml('[[Notes/Plan|the plan]] ![[images/map.png]] #project/tag\n\n> [!warning]- Watch\n> Careful')
    expect(html).toContain('href="obsidian://wiki/Notes%2FPlan">the plan</a>')
    expect(html).toContain('obsidian://embed/images%2Fmap.png')
    expect(html).toContain('obsidian://tag/project%2Ftag')
    expect(html).toContain('data-callout="warning"')
    expect(html).toContain('data-callout-fold="collapsed"')
    expect(html).toContain('data-callout-title="true"')
  })

  it('sanitizes scripts, event handlers, and unsafe URL protocols', async () => {
    const html = await renderHtml('<script>alert(1)</script>\n\n<img src="x" onerror="alert(1)">\n\n[bad](javascript:alert(1))')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('javascript:')
  })

  it('opens a resolved wikilink through the tab resource action', () => {
    const open = vi.fn()
    const input = props('[[Notes/Plan|open plan]]', open)
    render(<MarkdownBody {...input} />)
    fireEvent.click(screen.getByRole('button', { name: 'open plan' }))
    expect(open).toHaveBeenCalledWith('dsh-resource://file/absolute/workspace/docs/Notes/Plan.md')
  })

  it('renders frontmatter Properties above the body', () => {
    const input = props('---\ntitle: Example\ntags:\n  - alpha\n  - beta\n---\nBody text')
    render(<MarkdownBody {...input} />)
    expect(screen.getByLabelText('properties')).toBeTruthy()
    expect(screen.getByText('title')).toBeTruthy()
    expect(screen.getByText('Example')).toBeTruthy()
    expect(screen.getByText('#alpha')).toBeTruthy()
    expect(screen.getByText('#beta')).toBeTruthy()
  })

  it('selects the extension-band definition ahead of DSH builtin Markdown', () => {
    const own = markdownDefinition(() => 'Gaia Markdown')
    expect(own.id).toBe(MARKDOWN_BODY_ID)
    expect(own.priority).toBe('extension')
  })
})

describe('Mermaid diagrams', () => {
  it('asks the Gaia parent to render and shows its SVG', async () => {
    const parent = { postMessage: vi.fn() }
    vi.spyOn(window, 'parent', 'get').mockReturnValue(parent as unknown as Window)
    render(<MarkdownBody {...props('```mermaid\ngraph TD; A-->B\n```')} />)
    expect(parent.postMessage).toHaveBeenCalledTimes(1)
    const [request, origin] = parent.postMessage.mock.calls[0] as [{ type: string; reqId: string; code: string }, string]
    expect(origin).toBe(window.location.origin)
    expect(request).toMatchObject({ source: 'gaia-dsh', v: 1, type: 'renderMermaid', code: 'graph TD; A-->B' })
    window.dispatchEvent(new MessageEvent('message', {
      data: { source: 'gaia-dsh', v: 1, type: 'mermaidRendered', reqId: request.reqId, svg: '<svg data-test="diagram"></svg>' },
      origin: window.location.origin, source: parent as unknown as Window,
    }))
    expect(await screen.findByText((_, element) => element?.getAttribute('data-test') === 'diagram')).toBeTruthy()
    vi.restoreAllMocks()
  })

  it('shows the diagram source outside a Gaia frame', async () => {
    render(<MarkdownBody {...props('```mermaid\ngraph TD; A-->B\n```')} />)
    expect(await screen.findByText('graph TD; A-->B')).toBeTruthy()
  })
})

describe('plugin activation', () => {
  it('reads only services it declares in inject, as Cordis enforces', async () => {
    const { apply, inject } = await import('../src/client/index.ts')
    const services: Record<string, unknown> = {
      locale: { bind: () => (key: string) => key, register: () => () => {} },
      slots: { inject: () => () => {}, register: () => () => {} },
      documentPreviews: { register: () => () => {} },
    }
    const allowed = new Set<string>([...inject, 'effect'])
    const ctx = new Proxy({ effect: (run: () => unknown) => run() }, {
      get(target, key) {
        if (typeof key !== 'string') return undefined
        if (!allowed.has(key)) throw new Error(`undeclared service ctx.${key}`)
        return key === 'effect' ? target.effect : services[key]
      },
    })
    expect(() => { apply(ctx as never) }).not.toThrow()
  })
})

describe('in-note navigation', () => {
  it('gives headings Gaia slugs and scrolls table-of-contents links inside the viewer', async () => {
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    render(<MarkdownBody {...props('## Table of contents\n\n- [Code block](#code-block)\n\n## Code **block**\n')} />)
    const heading = document.querySelector('h2#code-block')
    expect(heading).not.toBeNull()
    const link = screen.getByRole('link', { name: 'Code block' })
    expect(link.hasAttribute('node')).toBe(false)
    fireEvent.click(link)
    expect(scroll).toHaveBeenCalledTimes(1)
    expect(scroll.mock.contexts[0]).toBe(heading)
  })

  it('scrolls same-note wikilinks [[#Heading]]', async () => {
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    render(<MarkdownBody {...props('[[#Setup steps]]\n\n## Setup steps\n')} />)
    fireEvent.click(screen.getByRole('link', { name: '#Setup steps' }))
    expect(scroll.mock.contexts[0]).toBe(document.querySelector('h2#setup-steps'))
  })

  it('is labelled Obsidian in the viewer menu', async () => {
    const { en, zh } = await import('../src/client/locales.ts')
    expect(en.label).toBe('Obsidian')
    expect(zh.label).toBe('Obsidian')
  })
})
