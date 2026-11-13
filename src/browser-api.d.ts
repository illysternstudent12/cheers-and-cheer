/** The in-browser API (browser/index.ts), resolved by vite.config.ts only in the GitHub Pages build. */
declare module 'virtual:browser-api' {
  export function request(method: string, path: string, body?: unknown): Promise<{ status: number; data: unknown }>
}
