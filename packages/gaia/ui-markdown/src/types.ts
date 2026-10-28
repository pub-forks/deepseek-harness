/** JSON response for one successful `.tasks` replacement. */
export interface GaiaTasksWriteResult {
  readonly version: string
}

/** Browser-safe error details for task document writes. */
declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** The requested path is not a `.tasks` file. */
    'gaia-tasks/invalid-extension': { readonly path: string }
    /** The new task document exceeds the maximum UTF-8 byte size. */
    'gaia-tasks/too-large': { readonly path: string; readonly limit: number }
    /** The new content is not a JSON object with a tasks array. */
    'gaia-tasks/invalid-content': Record<string, never>
    /** No existing task file is present at the requested path. */
    'gaia-tasks/not-found': { readonly path: string }
    /** The requested target is not a regular file. */
    'gaia-tasks/not-regular-file': { readonly path: string }
    /** The resolved path is outside the session workspace. */
    'gaia-tasks/outside-workspace': { readonly path: string }
    /** The file version no longer matches the client's read. */
    'gaia-tasks/stale': { readonly path: string }
  }
}

export {}
