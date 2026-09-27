/** Read-only Gaia Markdown body for the DSH document preview slot. */
import { Children, isValidElement, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { AlertTriangle, Bug, Calendar, CalendarClock, CheckCircle2, CheckSquare, CircleHelp, CircleX, ClipboardList, Copy, FileText, Flame, Hash, Info, List, ListChecks, Square, Tag, Type, Zap } from 'lucide-react'
import type { DocumentPreviewProps } from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { absoluteFileAddress, isAbsoluteWorkspacePath } from '@deepseek-ai/dsh-util-workspace-path'
import remarkObsidian from '../lib/markdown/remarkObsidian.ts'
import { parseFrontmatter, type PropEntry, type PropScalar } from '../lib/markdown/frontmatter.ts'
import { dirOf, joinPath, resolveWikiTarget } from '../lib/markdown/wikiLinks.ts'
import { getPrismLanguage, Prism } from '../lib/markdown/prismSetup.ts'
import { markdownImageUrl } from './markdownImageUrl.ts'
import type { MarkdownKey } from './locales.ts'
import css from './MarkdownBody.module.css'

export type MarkdownBodyProps = DocumentPreviewProps & PropsLocale<'gaiaMarkdown'>

/** Gaia's raw-HTML sanitizer schema, extended for the remark plugin's nodes. */
export const markdownSanitizeSchema: typeof defaultSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'mark'],
  protocols: {
    ...defaultSchema.protocols,
    href: [...(defaultSchema.protocols?.href ?? []), 'obsidian'],
    src: [...(defaultSchema.protocols?.src ?? []), 'obsidian'],
  },
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] ?? []), 'data-callout', 'data-callout-fold', 'data-callout-title', 'dataCallout', 'dataCalloutFold', 'dataCalloutTitle'],
  },
}

function textOf(value: ReactNode): string {
  if (value === null || value === undefined || typeof value === 'boolean') return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map(textOf).join('')
  return ''
}

function scalar(value: PropScalar, dir: string | null, open: (path: string) => void): ReactNode {
  if (value === null) return <span className={css.empty}>—</span>
  if (typeof value === 'boolean') return value ? <CheckSquare size={15} aria-label="true" /> : <Square size={15} aria-label="false" />
  if (typeof value === 'number') return <code>{value}</code>
  if (value.startsWith('#')) return <span className={css.tag}>{value}</span>
  if (dir && !/^(?:[a-z][a-z\d+.-]*:|\/\/)/iu.test(value) && /[./\\]/u.test(value)) {
    return <button type="button" className={css.inlineLink} onClick={() => { open(joinPath(dir, value)) }}>{value}</button>
  }
  return value
}

type PropertyKind = 'text' | 'number' | 'checkbox' | 'date' | 'datetime' | 'list' | 'tags'
function propertyKind(key: string, value: PropEntry['value']): PropertyKind {
  if (Array.isArray(value)) return key.toLowerCase() === 'tags' ? 'tags' : 'list'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'checkbox'
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/u.test(value)) return 'datetime'
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(value)) return 'date'
  return 'text'
}

const PROPERTY_ICONS = {
  text: Type, number: Hash, checkbox: CheckSquare, date: Calendar,
  datetime: CalendarClock, list: ListChecks, tags: Tag,
}

interface PropertiesProps {
  entries: PropEntry[]
  dir: string | null
  open: (path: string) => void
  t: (key: MarkdownKey) => string
}

function Properties({ entries, dir, open, t }: PropertiesProps): ReactNode {
  if (entries.length === 0) return null
  return <section className={css.properties} aria-label={t('properties')} data-frontmatter-properties>
    {entries.map(({ key, value }) => {
      const Icon = PROPERTY_ICONS[propertyKind(key, value)]
      return (
        <div className={css.property} key={key}>
          <div className={css.key}><Icon size={14} aria-hidden="true" /> {key}</div>
          <div className={css.value}>
            {Array.isArray(value)
              ? <span className={css.tags}>{value.map((entry, index) => (
                <span key={`${key}:${index}`}>
                  {key.toLowerCase() === 'tags' ? `#${String(entry).replace(/^#/u, '')}` : scalar(entry, dir, open)}
                </span>
              ))}</span>
              : scalar(value, dir, open)}
          </div>
        </div>
      )
    })}
  </section>
}

const CALLOUTS = {
  note: [FileText, 'Note'], abstract: [ClipboardList, 'Abstract'], info: [Info, 'Info'], todo: [CheckSquare, 'Todo'],
  tip: [Flame, 'Tip'], success: [CheckCircle2, 'Success'], question: [CircleHelp, 'Question'],
  warning: [AlertTriangle, 'Warning'], failure: [CircleX, 'Failure'], danger: [Zap, 'Danger'], bug: [Bug, 'Bug'],
  example: [List, 'Example'], quote: [FileText, 'Quote'],
} as const

const CALLOUT_ALIASES: Record<string, keyof typeof CALLOUTS> = {
  summary: 'abstract', tldr: 'abstract', hint: 'tip', important: 'tip', check: 'success', done: 'success',
  help: 'question', faq: 'question', caution: 'warning', attention: 'warning', fail: 'failure', missing: 'failure',
  error: 'danger', cite: 'quote',
}

function openTarget(target: string, dir: string | null, open: (path: string) => void): void {
  const path = resolveWikiTarget(dir, target)
  if (path) open(path)
}

/** Parse and render accumulated text with the same remark/sanitize order as Gaia. */
export function MarkdownBody({ content, resourceAddress, useResource, useTabInfo, t }: MarkdownBodyProps): ReactNode {
  const resource = useResource<'file'>(resourceAddress).value
  const absolutePath = resource?.absolutePath
  const dir = useMemo(() => dirOf(absolutePath), [absolutePath])
  const tab = useTabInfo().tab
  const { body, props } = useMemo(() => content.kind === 'text' ? parseFrontmatter(content.text) : { body: '', props: [] }, [content])
  const [copied, setCopied] = useState(false)
  const open = (path: string): void => {
    if (isAbsoluteWorkspacePath(path)) tab.actions.openResource(absoluteFileAddress(path))
  }
  const components = useMemo<Components>(() => ({
    a: ({ href, children, ...props }) => {
      if (!href) return <a {...props}>{children}</a>
      if (href.startsWith('obsidian://wiki/')) {
        let target = ''
        try { target = decodeURIComponent(href.slice('obsidian://wiki/'.length)) } catch { return <span>{children}</span> }
        return <button type="button" className={css.inlineLink} onClick={() => { openTarget(target, dir, open) }}>{children}</button>
      }
      if (href.startsWith('obsidian://tag/')) return <span className={css.tag}>{children}</span>
      if (/^https?:\/\//iu.test(href)) return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>
      if (href.startsWith('#')) return <a href={href} {...props}>{children}</a>
      if (/^(?:mailto:|tel:)/iu.test(href)) return <a href={href} {...props}>{children}</a>
      return <button type="button" className={css.inlineLink} onClick={() => {
        if (!dir) return
        const target = href.split(/[?#]/u)[0] ?? href
        open(isAbsoluteWorkspacePath(target) ? target : joinPath(dir, target))
      }}>{children}</button>
    },
    img: ({ src, alt }) => {
      if (!src) return null
      if (src.startsWith('obsidian://embed/')) {
        let target = ''
        try { target = decodeURIComponent(src.slice('obsidian://embed/'.length)) } catch { return null }
        if (/\.(?:md|markdown)$/iu.test(target) || !/\.[a-z\d]{2,8}(?:[#?].*)?$/iu.test(target)) {
          return <button type="button" className={css.inlineLink} onClick={() => { openTarget(target, dir, open) }}>{alt || target}</button>
        }
        const image = dir ? markdownImageUrl(document.baseURI, absolutePath, target) : undefined
        return image ? <img src={image} alt={alt ?? ''} loading="lazy" /> : null
      }
      const image = markdownImageUrl(document.baseURI, absolutePath, src)
      return image ? <img src={image} alt={alt ?? ''} loading="lazy" /> : null
    },
    input: ({ type, checked }) => type === 'checkbox' ? <input type="checkbox" checked={checked} disabled readOnly /> : null,
    blockquote: ({ node, children }) => {
      const properties = (node?.properties ?? {}) as Record<string, unknown>
      const kind = properties['data-callout'] ?? properties.dataCallout
      if (typeof kind !== 'string') return <blockquote>{children}</blockquote>
      const foldValue = properties['data-callout-fold'] ?? properties.dataCalloutFold
      const fold = typeof foldValue === 'string' ? foldValue : ''
      const rawKind = kind.toLowerCase()
      const calloutKind = CALLOUT_ALIASES[rawKind]
        ?? (Object.hasOwn(CALLOUTS, rawKind) ? rawKind as keyof typeof CALLOUTS : 'note')
      const callout = CALLOUTS[calloutKind]
      const [Icon, label] = callout
      const all = Children.toArray(children)
      const firstIndex = all.findIndex(child => !(typeof child === 'string' && child.trim() === ''))
      const first = all[firstIndex]
      let title: ReactNode = label
      if (isValidElement<{ children?: ReactNode; 'data-callout-title'?: string; dataCalloutTitle?: string }>(first)) {
        const childProps = first.props
        if (childProps['data-callout-title'] === 'true' || childProps.dataCalloutTitle === 'true') {
          title = textOf(childProps.children).trim() || label
          all.splice(firstIndex, 1)
        }
      }
      const heading = <div className={css.calloutTitle}><Icon size={16} />{title}</div>
      if (fold) {
        return (
          <details className={css.callout} data-callout={calloutKind} open={fold === 'expanded'}>
            <summary className={css.calloutSummary}>{heading}</summary>
            {all}
          </details>
        )
      }
      return (
        <aside className={css.callout} data-callout={calloutKind}>
          {heading}
          {all}
        </aside>
      )
    },
    code: ({ className, children }) => {
      const match = /language-([\w+-]+)/u.exec(className ?? '')
      const code = textOf(children).replace(/\n$/u, '')
      if (match?.[1]?.toLowerCase() === 'mermaid') return <Mermaid code={code} />
      if (!match && !code.includes('\n')) return <code>{children}</code>
      const language = match?.[1]
      const prism = language ? getPrismLanguage(language) : undefined
      const html = prism ? Prism.highlight(code, prism.grammar, prism.id) : undefined
      const copyCode = (): void => {
        void (async () => {
          try {
            await navigator.clipboard.writeText(code)
            setCopied(true)
            window.setTimeout(() => { setCopied(false) }, 1200)
          } catch { /* Clipboard access may be unavailable in this frame. */ }
        })()
      }
      return (
        <div className={css.codeFrame}>
          <div className={css.codeToolbar}>
            <span>{language ?? 'text'}</span>
            <button type="button" className={css.copyButton} onClick={copyCode} aria-label={t(copied ? 'copied' : 'copy')}>
              {copied ? t('copied') : t('copy')} <Copy size={13} />
            </button>
          </div>
          <pre className={css.prism}><code>{html === undefined ? code : <span dangerouslySetInnerHTML={{ __html: html }} />}</code></pre>
        </div>
      )
    },
    table: ({ children }) => <div className={css.tableWrap}><table>{children}</table></div>,
    pre: ({ children }) => <>{children}</>,
    mark: ({ children }) => <mark className={css.mark}>{children}</mark>,
  }), [absolutePath, copied, dir, open, t])
  if (content.kind !== 'text') return null
  return <div className={css.root} data-gaia-markdown>
    <Properties entries={props} dir={dir} open={open} t={t} />
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkObsidian]} rehypePlugins={[rehypeRaw, [rehypeSanitize, markdownSanitizeSchema]]}
      urlTransform={url => url.startsWith('obsidian://') ? url : defaultUrlTransform(url)} components={components}>
      {body}
    </ReactMarkdown>
  </div>
}

let mermaidSequence = 0

/** Gaia's reply to a `renderMermaid` request, validated before use. */
function mermaidReply(data: unknown, reqId: string): { svg: string } | { error: string } | undefined {
  if (typeof data !== 'object' || data === null) return undefined
  const message = data as Record<string, unknown>
  if (message.source !== 'gaia-dsh' || message.v !== 1 || message.type !== 'mermaidRendered' || message.reqId !== reqId) return undefined
  if (typeof message.svg === 'string') return { svg: message.svg }
  if (typeof message.error === 'string') return { error: message.error }
  return undefined
}

/**
 * Ask the Gaia parent frame to render a diagram with its own Mermaid (strict
 * security level). Bundling Mermaid here would split it into async chunks the
 * client module loader cannot serve. Outside a Gaia frame the source is shown.
 * @param code - diagram source.
 * @param dark - whether the harness currently paints dark.
 * @returns the rendered SVG markup.
 */
function renderInGaia(code: string, dark: boolean): Promise<string> {
  if (window.parent === window) return Promise.reject(new Error('Diagrams render inside Gaia only.'))
  const reqId = `m${mermaidSequence++}-${Date.now().toString(36)}`
  return new Promise((resolve, reject) => {
    const cleanup = (): void => {
      window.clearTimeout(timer)
      window.removeEventListener('message', onMessage)
    }
    const onMessage = (event: MessageEvent): void => {
      if (event.source !== window.parent || event.origin !== window.location.origin) return
      const reply = mermaidReply(event.data, reqId)
      if (reply === undefined) return
      cleanup()
      if ('svg' in reply) resolve(reply.svg)
      else reject(new Error(reply.error))
    }
    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error('Timed out waiting for Gaia to render the diagram.'))
    }, 15_000)
    window.addEventListener('message', onMessage)
    window.parent.postMessage({ source: 'gaia-dsh', v: 1, type: 'renderMermaid', reqId, code, dark }, window.location.origin)
  })
}

function Mermaid({ code }: { code: string }): ReactNode {
  const [svg, setSvg] = useState<string>()
  const [error, setError] = useState<string>()
  const [dark, setDark] = useState(() => document.body.hasAttribute('data-ds-dark-theme'))
  useEffect(() => {
    const observer = new MutationObserver(() => { setDark(document.body.hasAttribute('data-ds-dark-theme')) })
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] })
    return () => { observer.disconnect() }
  }, [])
  useEffect(() => {
    let active = true
    renderInGaia(code, dark).then((markup) => {
      if (active) { setSvg(markup); setError(undefined) }
    }, (reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : String(reason))
    })
    return () => { active = false }
  }, [code, dark])
  if (error) return <pre className={css.mermaid} title={error}>{code}</pre>
  // Same-origin parent output from Mermaid's strict mode, as in Gaia's own viewer.
  return svg ? <div className={css.mermaid} dangerouslySetInnerHTML={{ __html: svg }} /> : <div className={css.mermaid} aria-busy="true">Rendering diagram…</div>
}
