/** Read-only Gaia Markdown body for the DSH document preview slot. */
import { Children, isValidElement, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { AlertTriangle, Bug, Calendar, CalendarClock, CheckCircle2, CheckSquare, CircleHelp, CircleX, ClipboardList, Copy, Pencil, Quote, Flame, Hash, Info, List, ListChecks, Square, Tag, Type, Volume2, VolumeX, Zap } from 'lucide-react'
import type { DocumentPreviewProps } from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { absoluteFileAddress, isAbsoluteWorkspacePath, parseFileAddress, sessionFileAddress } from '@deepseek-ai/dsh-util-workspace-path'
import remarkObsidian from '../lib/markdown/remarkObsidian.ts'
import { parseFrontmatter, type PropEntry, type PropScalar } from '../lib/markdown/frontmatter.ts'
import { dirOf, joinPath, resolveWikiTarget } from '../lib/markdown/wikiLinks.ts'
import { getPrismLanguage, Prism } from '../lib/markdown/prismSetup.ts'
import { markdownImageUrl } from './markdownImageUrl.ts'
import type { MarkdownKey } from './locales.ts'
import css from './MarkdownBody.module.css'

interface ReadAloudSnapshot {
  enabled: boolean
  status: 'idle' | 'preparing' | 'loading' | 'speaking' | 'paused'
  sessionId: string | null
  messageId: string | null
}

interface ReadAloudStore {
  getSnapshot: () => ReadAloudSnapshot
  subscribe: (listener: () => void) => () => void
}

type MarkdownInjected = { readAloud: ReadAloudStore | undefined }

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif', 'ico'])

type MarkdownHastNode = {
  type?: string
  tagName?: string
  value?: string
  properties?: Record<string, unknown>
  children?: MarkdownHastNode[]
}

function isImageHast(node: MarkdownHastNode): boolean {
  if (node.type !== 'element') return false
  if (node.tagName === 'a') {
    const children = (node.children ?? []).filter(child => !(child.type === 'text' && !(child.value ?? '').trim()))
    return children.length === 1 && children.every(isImageHast)
  }
  if (node.tagName !== 'img') return false
  const src = node.properties?.src
  if (typeof src !== 'string') return false
  if (!src.startsWith('obsidian://embed/')) return true
  let target = ''
  try { target = decodeURIComponent(src.slice('obsidian://embed/'.length)) } catch { return false }
  const name = target.split(/[?#]/u)[0] ?? target
  const extension = name.slice(name.lastIndexOf('.') + 1).toLowerCase()
  return IMAGE_EXTENSIONS.has(extension)
}

function isImageOnlyParagraph(node: unknown): boolean {
  const children = ((node as MarkdownHastNode | undefined)?.children ?? [])
    .filter(child => !(child.type === 'text' && !(child.value ?? '').trim()))
  return children.length > 0 && children.every(isImageHast)
}

const DISABLED_READ_ALOUD: ReadAloudSnapshot = { enabled: false, status: 'idle', sessionId: null, messageId: null }
const subscribeNothing = (): (() => void) => () => {}
const getDisabledReadAloud = (): ReadAloudSnapshot => DISABLED_READ_ALOUD

export type MarkdownBodyProps = DocumentPreviewProps & PropsLocale<'gaiaMarkdown'> & MarkdownInjected

function stableId(value: string): string {
  // FNV-1a keeps protocol ids short, deterministic, and within the bridge's
  // alphanumeric/underscore/hyphen grammar.
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

function sectionsByHeadingLine(source: string): Map<number, string> {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(source)
  const headings: Array<{ line: number; depth: number }> = []
  type PositionedNode = {
    type?: string | undefined
    depth?: number | undefined
    position?: { start?: { line?: number } | undefined } | undefined
    children?: unknown[] | undefined
  }
  const visit = (node: PositionedNode): void => {
    if (node.type === 'heading' && typeof node.depth === 'number' && typeof node.position?.start?.line === 'number') {
      headings.push({ line: node.position.start.line, depth: node.depth })
    }
    for (const child of node.children ?? []) {
      if (typeof child === 'object' && child !== null) visit(child)
    }
  }
  visit(tree)
  headings.sort((left, right) => left.line - right.line)
  const lines = source.split('\n')
  return new Map(headings.map(({ line, depth }, index) => {
    const next = headings.slice(index + 1).find(heading => heading.depth <= depth)?.line
    return [line, lines.slice(line - 1, next === undefined ? undefined : next - 1).join('\n')]
  }))
}

function postReadAloud(message: Record<string, unknown>): void {
  if (window.parent === window) return
  window.parent.postMessage({ source: 'gaia-dsh', v: 1, ...message }, window.location.origin)
}

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
  if (isValidElement<{ children?: ReactNode }>(value)) return textOf(value.props.children)
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
              ? <span className={css.tags}>
                {value.map((entry, index) => key.toLowerCase() === 'tags'
                  ? <span key={`${key}:${index}`} className={css.tag}>#{String(entry).replace(/^#/u, '')}</span>
                  : <span key={`${key}:${index}`} className={css.chip}>{scalar(entry, dir, open)}</span>)}
                {value.length === 0 && <span className={css.empty}>{t('empty')}</span>}
              </span>
              : scalar(value, dir, open)}
          </div>
        </div>
      )
    })}
  </section>
}

const CALLOUTS = {
  note: [Pencil, 'Note'], abstract: [ClipboardList, 'Abstract'], info: [Info, 'Info'], todo: [CheckSquare, 'Todo'],
  tip: [Flame, 'Tip'], success: [CheckCircle2, 'Success'], question: [CircleHelp, 'Question'],
  warning: [AlertTriangle, 'Warning'], failure: [CircleX, 'Failure'], danger: [Zap, 'Danger'], bug: [Bug, 'Bug'],
  example: [List, 'Example'], quote: [Quote, 'Quote'],
} as const

const CALLOUT_ALIASES: Record<string, keyof typeof CALLOUTS> = {
  summary: 'abstract', tldr: 'abstract', hint: 'tip', important: 'tip', check: 'success', done: 'success',
  help: 'question', faq: 'question', caution: 'warning', attention: 'warning', fail: 'failure', missing: 'failure',
  error: 'danger', cite: 'quote',
}

/** Gaia's heading slug (web/src/lib/markdown/headings.ts), so TOC anchors match. */
export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/gu, '').trim().replace(/\s+/gu, '-').replace(/-+/gu, '-').replace(/^-+|-+$/gu, '')
}

/** Scroll to an in-note anchor inside this viewer; false when the target is absent. */
function scrollToAnchor(from: Element, targetId: string): boolean {
  const root = from.closest<HTMLElement>('[data-gaia-markdown]')
  const target = [...(root?.querySelectorAll<HTMLElement>('[id]') ?? [])].find(element => element.id === targetId)
  if (!target) return false
  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  return true
}

/** Click handler keeping in-note anchors inside the viewer's own scroll area. */
function anchorClick(targetId: string): (event: MouseEvent<HTMLAnchorElement>) => void {
  return (event) => {
    if (scrollToAnchor(event.currentTarget, targetId)) event.preventDefault()
  }
}

function decodeAnchor(value: string): string {
  try { return decodeURIComponent(value) } catch { return value }
}

function openTarget(target: string, dir: string | null, open: (path: string) => void): void {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/iu.test(target)) return
  const path = resolveWikiTarget(dir, target)
  if (path) open(path)
}

function isEditable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select, [contenteditable="true"]') !== null)
}

function scrollMarkdown(root: HTMLElement, key: string, shiftKey: boolean): void {
  let scroller: HTMLElement | null = root
  while (scroller) {
    const { overflowY } = getComputedStyle(scroller)
    if (/(?:auto|scroll|overlay)/u.test(overflowY) && scroller.scrollHeight > scroller.clientHeight) break
    scroller = scroller.parentElement
  }
  scroller ??= document.scrollingElement as HTMLElement | null
  if (!scroller) return
  if (key === 'Home') scroller.scrollTop = 0
  else if (key === 'End') scroller.scrollTop = scroller.scrollHeight
  else {
    const distance = key === ' ' ? scroller.clientHeight : Math.max(1, scroller.clientHeight - 48)
    scroller.scrollTop += key === 'PageUp' || (key === ' ' && shiftKey) ? -distance : distance
  }
}

/** Parse and render accumulated text with the same remark/sanitize order as Gaia. */
export function MarkdownBody({ content, resourceAddress, useResource, useTabInfo, t, readAloud }: MarkdownBodyProps): ReactNode {
  const resource = useResource<'file'>(resourceAddress).value
  const absolutePath = resource?.absolutePath
  const dir = useMemo(() => dirOf(absolutePath), [absolutePath])
  const tab = useTabInfo().tab
  const { body, props } = useMemo(() => content.kind === 'text' ? parseFrontmatter(content.text) : { body: '', props: [] }, [content])
  const sections = useMemo(() => sectionsByHeadingLine(body), [body])
  const readState = useSyncExternalStore(readAloud?.subscribe ?? subscribeNothing,
    readAloud?.getSnapshot ?? getDisabledReadAloud, readAloud?.getSnapshot ?? getDisabledReadAloud)
  const documentName = absolutePath?.split('/').filter(Boolean).at(-1) ?? t('label')
  const documentId = `doc-${stableId(absolutePath ?? resourceAddress)}`
  const [copied, setCopied] = useState(false)
  const open = (path: string): void => {
    if (!isAbsoluteWorkspacePath(path)) return
    const source = parseFileAddress(resourceAddress)
    const address = source?.scope === 'session'
      ? sessionFileAddress(source.sessionId, path)
      : absoluteFileAddress(path)
    // Each click creates a file resource tab, matching the file tree's open flow.
    tab.actions.openResource(address, { revealIfOpened: false })
  }
  const renderHeading = (level: 1 | 2 | 3 | 4 | 5 | 6, children: ReactNode, node: unknown): ReactNode => {
    const Tag = `h${level}` as const
    const headingText = textOf(children).trim()
    const position = typeof node === 'object' && node !== null ? (node as { position?: { start?: { line?: number } } }).position : undefined
    const line = position?.start?.line
    const sectionId = `section-${line ?? 0}-${stableId(headingText)}`
    const reading = readState.status !== 'idle' && readState.sessionId === documentId && readState.messageId === sectionId
    const ariaLabel = `${t(reading ? 'stopSection' : 'readSection')} · ${documentName} · ${headingText || t('label')}`
    const text = typeof line === 'number' ? sections.get(line) ?? '' : ''
    const tooLong = text.length > 200_000 || new TextEncoder().encode(text).length > 200_000
    const onRead = (): void => {
      if (reading) {
        postReadAloud({ type: 'stopReadAloud', sessionId: documentId, messageId: sectionId })
      } else if (readState.enabled && text.trim() && !tooLong) {
        postReadAloud({ type: 'readAloud', sessionId: documentId, messageId: sectionId, text,
          label: `${documentName} · ${headingText || t('label')}`.slice(0, 256) })
      }
    }
    return <Tag id={slugify(headingText)} className={css.heading}>
      <span className={css.headingText}>{children}</span>
      {readState.enabled && <button type="button" className={css.readButton} aria-label={ariaLabel} title={ariaLabel}
        aria-pressed={reading} disabled={tooLong || (!reading && !text.trim())} onClick={(event) => { event.stopPropagation(); onRead() }}>
        {reading ? <VolumeX size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
      </button>}
    </Tag>
  }
  const components = useMemo<Components>(() => ({
    p: ({ node, children }) => <p className={isImageOnlyParagraph(node) ? css.figure : undefined}>{children}</p>,
    a: ({ href, children, title }) => {
      if (!href) return <a title={title}>{children}</a>
      if (href.startsWith('obsidian://wiki/')) {
        let target = ''
        try { target = decodeURIComponent(href.slice('obsidian://wiki/'.length)) } catch { return <span>{children}</span> }
        const hashAt = target.indexOf('#')
        if (hashAt === 0) {
          const hash = target.slice(1)
          const targetId = hash.startsWith('^') ? `block-${hash.slice(1)}` : slugify(hash)
          return <a href={`#${targetId}`} onClick={anchorClick(targetId)}>{children}</a>
        }
        return <button type="button" className={css.inlineLink} onClick={() => { openTarget(target, dir, open) }}>{children}</button>
      }
      if (href.startsWith('obsidian://tag/')) return <span className={css.tag}>{children}</span>
      if (/^https?:\/\//iu.test(href)) return <a href={href} title={title} target="_blank" rel="noopener noreferrer">{children}</a>
      if (href.startsWith('#')) {
        const targetId = decodeAnchor(href.slice(1))
        return <a href={href} title={title} onClick={anchorClick(targetId)}>{children}</a>
      }
      if (/^(?:mailto:|tel:)/iu.test(href)) return <a href={href} title={title}>{children}</a>
      // Only authored relative paths (plus same-document fragments above) become
      // file links. Unknown schemes and protocol-relative URLs remain inert.
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/iu.test(href)) return <span>{children}</span>
      return <button type="button" className={css.inlineLink} onClick={() => {
        if (!dir) return
        const encodedTarget = href.split(/[?#]/u)[0] ?? href
        let target = encodedTarget
        try { target = decodeURIComponent(encodedTarget) } catch { return }
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
            {all.length > 0 && <div className={css.calloutBody}>{all}</div>}
          </details>
        )
      }
      return (
        <aside className={css.callout} data-callout={calloutKind}>
          {heading}
          {all.length > 0 && <div className={css.calloutBody}>{all}</div>}
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
    h1: ({ children, node }) => renderHeading(1, children, node),
    h2: ({ children, node }) => renderHeading(2, children, node),
    h3: ({ children, node }) => renderHeading(3, children, node),
    h4: ({ children, node }) => renderHeading(4, children, node),
    h5: ({ children, node }) => renderHeading(5, children, node),
    h6: ({ children, node }) => renderHeading(6, children, node),
    table: ({ children }) => <div className={css.tableWrap}><table>{children}</table></div>,
    pre: ({ children }) => <>{children}</>,
    mark: ({ children }) => <mark className={css.mark}>{children}</mark>,
  }), [
    absolutePath, body, copied, dir, documentId, documentName, open, sections,
    readState.enabled, readState.messageId, readState.sessionId, readState.status, t,
  ])
  if (content.kind !== 'text') return null
  return <div className={css.root} data-gaia-markdown tabIndex={0}
    onPointerDown={(event) => {
      const target = event.target
      if (target === event.currentTarget || !(target instanceof HTMLElement && target.closest('a, button, input, select, textarea, [tabindex]'))) {
        event.currentTarget.focus()
      }
    }}
    onKeyDown={(event) => {
      if (isEditable(event.target) || !['Home', 'End', 'PageUp', 'PageDown', ' '].includes(event.key)) return
      // Space activates a focused link or button; it only pages the viewer itself.
      if (event.key === ' ' && event.target !== event.currentTarget) return
      event.preventDefault()
      event.stopPropagation()
      scrollMarkdown(event.currentTarget, event.key, event.shiftKey)
    }}>
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
