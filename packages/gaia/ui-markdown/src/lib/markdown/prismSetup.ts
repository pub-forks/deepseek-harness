// Ported from gaia web/src/lib/markdown/prismSetup.ts — keep in sync.
import './prismCore.ts'
import Prism from 'prismjs'
import 'prismjs/components/prism-clike'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-markup'
import 'prismjs/components/prism-markdown'
import 'prismjs/components/prism-c'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-objectivec'
import 'prismjs/components/prism-sql'
import 'prismjs/components/prism-powershell'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-rust'
import 'prismjs/components/prism-swift'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-java'
import 'prismjs/components/prism-cpp'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-go'
import 'prismjs/components/prism-csharp'
import 'prismjs/components/prism-markup-templating'
import 'prismjs/components/prism-php'
import 'prismjs/components/prism-ruby'
import 'prismjs/components/prism-docker'
import 'prismjs/components/prism-graphql'
import 'prismjs/components/prism-diff'

const ALIASES: Record<string, string> = { js: 'javascript', html: 'markup', xml: 'markup', svg: 'markup', md: 'markdown', objc: 'objectivec', py: 'python', ts: 'typescript', sh: 'bash', shell: 'bash', yml: 'yaml', cs: 'csharp', dotnet: 'csharp', rb: 'ruby', dockerfile: 'docker', ps1: 'powershell', 'c++': 'cpp' }
for (const [alias, id] of Object.entries(ALIASES)) {
  const grammar = Prism.languages[id]
  if (grammar && !Prism.languages[alias]) Prism.languages[alias] = grammar
}

export function getPrismLanguage(lang: string | undefined): { id: string; grammar: Prism.Grammar } | undefined {
  if (!lang) return undefined
  const id = lang.toLowerCase()
  const grammar = Prism.languages[id]
  return grammar ? { id, grammar } : undefined
}

export { Prism }
