import type { IconProps } from '@deepseek-ai/dsh-client-ui-primitives'

/** Outline star used by Gaia's /starred Host command in the slash menu. */
export function StarIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M8 1.5L9.98 5.52L14.42 6.16L11.21 9.29L11.97 13.71L8 11.62L4.03 13.71L4.79 9.29L1.58 6.16L6.02 5.52L8 1.5Z" stroke="currentColor" strokeLinejoin="round" />
    </svg>
  )
}
