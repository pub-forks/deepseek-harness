/** Remote methods Gaia may call through the loopback control API. */
export const REMOTE_ALLOWLIST = {
  // @deepseek-ai/dsh-client-ui-settings and dsh-client-ui-settings-models consume this namespace.
  settings: { describe: 'unary', update: 'unary', replace: 'unary', mutate: 'unary' },
  // @deepseek-ai/dsh-client-ui-settings-models and dsh-client-ui-settings-web-search consume this namespace.
  credentials: { describe: 'unary', set: 'unary', unset: 'unary' },
  // @deepseek-ai/dsh-client-ui-settings-models consumes model provider reads and discovery.
  llm: { listProviders: 'unary', listConfigurableProviders: 'unary', discoverModels: 'unary' },
  // @deepseek-ai/dsh-client-ui-plugin-manager consumes plugin inventory and profile mutations.
  pluginManager: {
    listVersionExemptions: 'unary', setVersionExemption: 'unary', listPlugins: 'unary', listBundles: 'unary',
    registries: 'unary', inspect: 'unary', setPluginEnabled: 'unary', setBundleEnabled: 'unary',
    installBundle: 'unary', waitForInstall: 'unary', cancelInstall: 'unary', removeBundle: 'unary',
  },
  // @deepseek-ai/dsh-client-ui-settings-plugin-inventory and dsh-client-ui-plugin-manager consume this namespace.
  pluginInventory: { list: 'unary' },
  // @deepseek-ai/dsh-client-ui-plugin-manager consumes registry probing.
  pluginRegistryProbe: { fastest: 'unary' },
  // @deepseek-ai/dsh-client-ui-agent-preset consumes preset list and document reads.
  agentPresets: { list: 'unary', read: 'unary' },
  // @deepseek-ai/dsh-client-ui-permission-presets consumes the selectable permission catalog.
  permissionPresets: { catalog: 'unary' },
  // @deepseek-ai/dsh-client-ui-subagent uses turn operations; this settings bridge exposes none.
  subagents: {},
  // @deepseek-ai/dsh-gaia-ui-authorization consumes Gaia sign-in flow operations.
  gaiaAuthorization: { listFlows: 'unary', start: 'stream', answer: 'unary', cancel: 'unary', signOut: 'unary' },
} as const satisfies Readonly<Record<string, Readonly<Record<string, 'unary' | 'stream'>>>>

/**
 * Return the allowed call kind, or undefined when the endpoint is not exposed.
 * @param namespace - Remote namespace requested by Gaia.
 * @param method - method requested within that namespace.
 * @returns the permitted invocation kind, if present.
 */
export function allowedRemoteKind(namespace: string, method: string): 'unary' | 'stream' | undefined {
  if (!Object.prototype.hasOwnProperty.call(REMOTE_ALLOWLIST, namespace)) return undefined
  const methods: Readonly<Record<string, 'unary' | 'stream'>> = REMOTE_ALLOWLIST[namespace as keyof typeof REMOTE_ALLOWLIST]
  // Own keys only: an inherited name such as `toString` is never an endpoint.
  return Object.prototype.hasOwnProperty.call(methods, method) ? methods[method] : undefined
}
