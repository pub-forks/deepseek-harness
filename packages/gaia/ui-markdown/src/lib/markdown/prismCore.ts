// Ported from gaia web/src/lib/markdown/prismCore.ts — keep in sync.
import Prism from 'prismjs'

;(globalThis as unknown as { Prism?: typeof Prism }).Prism = Prism
export default Prism
