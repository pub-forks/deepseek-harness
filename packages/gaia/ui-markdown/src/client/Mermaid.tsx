/** Render Mermaid through the Gaia parent frame without bundling Mermaid. */
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import css from './MarkdownBody.module.css'

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

/** Whether this document can ask its Gaia parent to render Mermaid.
 * @returns whether the current document is framed by another same-origin page.
 */
export function isGaiaMermaidFrame(): boolean {
  return window.parent !== window
}

/**
 * Ask the Gaia parent frame to render a diagram with its own Mermaid at strict
 * security level. The request expires after 15 seconds.
 * @param code - Mermaid source.
 * @param dark - whether the Harness currently paints dark.
 * @returns the rendered SVG markup.
 */
function renderMermaid(code: string, dark: boolean): Promise<string> {
  if (!isGaiaMermaidFrame()) return Promise.reject(new Error('Diagrams render inside Gaia only.'))
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

/** Props for the shared Gaia Mermaid renderer. */
export interface MermaidProps {
  /** Mermaid source. */
  code: string
  /** Localized loading label. */
  loadingLabel: string
  /** Render a source fallback after a bridge failure. */
  renderError: (error: string) => ReactNode
  /** Extra class for the diagram root, e.g. to drop block margins inside a Chat fence. */
  className?: string | undefined
}

/**
 * Render a diagram through the Gaia parent and use the supplied fallback on
 * failure or outside a Gaia frame.
 * @param props - source, localized loading copy, and failure renderer.
 * @returns rendered SVG, loading copy, or the caller's source fallback.
 */
export function Mermaid({ code, loadingLabel, renderError, className }: MermaidProps): ReactNode {
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
    renderMermaid(code, dark).then((markup) => {
      if (active) { setSvg(markup); setError(undefined) }
    }, (reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : String(reason))
    })
    return () => { active = false }
  }, [code, dark])
  if (!isGaiaMermaidFrame()) return <>{renderError('Diagrams render inside Gaia only.')}</>
  if (error) return <>{renderError(error)}</>
  // Parent output comes from Mermaid's strict mode, as in Gaia's document viewer.
  const rootClass = className ? `${css.mermaid} ${className}` : css.mermaid
  return svg ? <div className={rootClass} dangerouslySetInnerHTML={{ __html: svg }} /> : <div className={rootClass} aria-busy="true">{loadingLabel}</div>
}
