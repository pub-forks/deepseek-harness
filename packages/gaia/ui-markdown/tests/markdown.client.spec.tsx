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
