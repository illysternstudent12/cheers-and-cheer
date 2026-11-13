/*
 * A tiny Express stand-in for the static (GitHub Pages) build.
 * It supports exactly what server/app.ts uses: Router, use/get/post/put/delete,
 * `:param` paths, middleware chains, error handlers (4 args) and express.json().
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
type Fn = (...args: any[]) => void
interface Layer {
  method?: string
  path: string
  fns: Fn[]
}

export interface ShimReq {
  method: string
  path: string
  query: Record<string, string>
  params: Record<string, string>
  headers: Record<string, string>
  body: any
  ip: string
  user?: unknown
  is(type: string): boolean
}

function matchPath(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split('/').filter(Boolean)
  const b = path.split('/').filter(Boolean)
  if (a.length !== b.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i])
    else if (a[i] !== b[i]) return null
  }
  return params
}

function Router() {
  const layers: Layer[] = []
  const r: any = (req: ShimReq, res: unknown, done: Fn) => r.handle(req, res, done)
  for (const m of ['get', 'post', 'put', 'delete'])
    r[m] = (path: string, ...fns: Fn[]) => layers.push({ method: m.toUpperCase(), path, fns })
  r.use = (first: string | Fn, ...rest: Fn[]) =>
    typeof first === 'string' ? layers.push({ path: first, fns: rest }) : layers.push({ path: '', fns: [first, ...rest] })
  r.disable = () => {}
  r.set = () => {}

  r.handle = (req: ShimReq, res: unknown, done: Fn) => {
    let i = 0
    const next = (err?: unknown): void => {
      while (i < layers.length) {
        const L = layers[i++]
        let params: Record<string, string> | null = null
        if (L.method) {
          if (L.method !== req.method) continue
          params = matchPath(L.path, req.path)
          if (!params) continue
        } else if (L.path && req.path !== L.path && !req.path.startsWith(L.path + '/')) continue

        // a mounted prefix: strip it while the layer runs, restore it after
        const outer = req.path
        const restore = () => void (req.path = outer)
        if (!L.method && L.path) req.path = req.path.slice(L.path.length) || '/'
        if (params) req.params = params

        const run = (j: number, e?: unknown): void => {
          if (j >= L.fns.length) {
            restore()
            return next(e)
          }
          const fn = L.fns[j]
          const step = (e2?: unknown) => run(j + 1, e2)
          try {
            if (e !== undefined) fn.length === 4 ? fn(e, req, res, step) : step(e)
            else fn.length === 4 ? step() : fn(req, res, step)
          } catch (thrown) {
            step(thrown)
          }
        }
        return run(0, err)
      }
      done(err)
    }
    next()
  }
  return r
}

function express() {
  return Router()
}
express.Router = Router
express.json = () => (_req: unknown, _res: unknown, next: Fn) => next()

export default express
