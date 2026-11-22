/** Session-scoped Mermaid fence layer for Harness Chat. */
import { Component } from 'react'
import type { ReactNode } from 'react'
import type { HocShare, PropsLocale, PropsRuntime, SlotMap } from '@deepseek-ai/dsh-client-ui-slots'
import { Mermaid, isGaiaMermaidFrame } from './Mermaid.tsx'
import type { MermaidProps } from './Mermaid.tsx'
import css from './MarkdownBody.module.css'

/** Props supplied by the Chat fence slot and Gaia Markdown locale. */
export type MermaidFenceProps = PropsRuntime<'conversation.chat.markdown.fence'>
  & HocShare<SlotMap['conversation.chat.markdown.fence']>
  & PropsLocale<'gaiaMarkdown'>

interface FenceBoundaryProps {
  children: ReactNode
  fallback: ReactNode
}

interface FenceBoundaryState {
  failed: boolean
}

/** Contain render failures in this language layer and restore the code block. */
class FenceBoundary extends Component<FenceBoundaryProps, FenceBoundaryState> {
  override state: FenceBoundaryState = { failed: false }

  static getDerivedStateFromError(): FenceBoundaryState {
    return { failed: true }
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/**
 * Show source while streaming, then render Mermaid through Gaia's parent frame.
 * Errors, timeouts, and standalone Harness views retain the plain code block.
 * @param props - fence data, next inner content, and localized labels.
 * @returns the inner code block or the rendered diagram.
 */
export function MermaidFenceLayer({ code, streaming, children, t }: MermaidFenceProps): ReactNode {
  if (streaming || !isGaiaMermaidFrame()) return children
  const renderError: MermaidProps['renderError'] = () => children
  return <FenceBoundary fallback={children}>
    <Mermaid code={code} loadingLabel={t('renderingDiagram')} renderError={renderError} className={css.mermaidFence} />
  </FenceBoundary>
}
