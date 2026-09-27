/**
 * Gaia's sparkle mark for the empty-session hero, replacing DSH's whale in a
 * drawer tab. The glyph is filled with the link alias token, which the Gaia
 * palette sets to the host accent, so it follows Gaia's light/dark theme and
 * accent variants.
 */
import { createElement, type ReactElement } from 'react'

/** Gaia logo paths (web/public/img/gaia.svg, viewBox 0 0 30 30). */
const GAIA_MARK_PATHS = [
  'M14.217,19.707l-1.112,2.547c-0.427,0.979-1.782,0.979-2.21,0l-1.112-2.547c-0.99-2.267-2.771-4.071-4.993-5.057L1.73,13.292c-0.973-0.432-0.973-1.848,0-2.28l2.965-1.316C6.974,8.684,8.787,6.813,9.76,4.47l1.126-2.714c0.418-1.007,1.81-1.007,2.228,0L14.24,4.47c0.973,2.344,2.786,4.215,5.065,5.226l2.965,1.316c0.973,0.432,0.973,1.848,0,2.28l-3.061,1.359C16.988,15.637,15.206,17.441,14.217,19.707z',
  'M24.481,27.796l-0.339,0.777c-0.248,0.569-1.036,0.569-1.284,0l-0.339-0.777c-0.604-1.385-1.693-2.488-3.051-3.092l-1.044-0.464c-0.565-0.251-0.565-1.072,0-1.323l0.986-0.438c1.393-0.619,2.501-1.763,3.095-3.195l0.348-0.84c0.243-0.585,1.052-0.585,1.294,0l0.348,0.84c0.594,1.432,1.702,2.576,3.095,3.195l0.986,0.438c0.565,0.251,0.565,1.072,0,1.323l-1.044,0.464C26.174,25.308,25.085,26.411,24.481,27.796z',
] as const

/**
 * Hero brand mark filling `conversation.hero.brand.mark`.
 * @param props.size - requested square edge in pixels.
 * @returns a decorative svg element.
 */
export function GaiaMark({ size }: { size: number; className?: string | undefined }): ReactElement {
  return createElement(
    'svg',
    { width: size, height: size, viewBox: '0 0 30 30', 'aria-hidden': true, 'data-gaia-mark': '' },
    ...GAIA_MARK_PATHS.map(d => createElement('path', { key: d.slice(0, 16), d, fill: 'var(--dsw-alias-link, #ea580c)' })),
  )
}
