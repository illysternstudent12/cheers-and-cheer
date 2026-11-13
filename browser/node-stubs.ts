/* node:fs and node:path stand-ins: server/db.ts imports them, the browser never needs them. */
export const mkdirSync = () => {}
export const existsSync = () => false
export const dirname = (p: string) => p.replace(/\/[^/]*$/, '') || '/'
export const join = (...parts: string[]) => parts.join('/')
export const resolve = join
