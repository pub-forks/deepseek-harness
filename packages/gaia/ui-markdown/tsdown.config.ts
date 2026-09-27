import { dirname, join } from 'node:path'
import type { UserConfig } from 'tsdown'
import { clientBundle } from '../../client/tsdown.client.ts'

const bundle = clientBundle('@deepseek-ai/dsh-gaia-ui-markdown', ['lib/types/index.js'])

/**
 * vfile maps `#minpath`/`#minproc`/`#minurl` to node builtins under the `node`
 * condition, which the client build still selects; point them at vfile's own
 * browser variants so the browser face never requires node:path/process/url.
 */
const vfileBrowser: NonNullable<UserConfig['plugins']> = [{
  name: 'gaia-vfile-browser-subpaths',
  resolveId(source, importer) {
    const match = /^#(minpath|minproc|minurl)$/u.exec(source)
    if (match === null || importer === undefined || !importer.includes('/vfile/')) return null
    return join(dirname(importer), `${match[1]}.browser.js`)
  },
}]

export default (options: Parameters<typeof bundle>[0]): UserConfig[] => bundle(options).map(config =>
  config.name?.endsWith('/client') === true
    ? { ...config, plugins: [vfileBrowser, config.plugins] }
    : config,
)
