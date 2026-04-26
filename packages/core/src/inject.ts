export type Module<I, T> = {
  [K in keyof T]: T[K] extends object
    ? Module<I, T[K]>
    : (injector: I) => T[K]
}

export function inject<T extends object>(...modules: Array<Partial<Module<T, T>>>): T {
  const merged = modules.reduce((a, b) => mergeModules(a, b), {} as Partial<Module<T, T>>) as Module<T, T>
  // proxy is assigned before any factory can be called (factories are invoked lazily on first access)
  let proxy!: T
  proxy = createProxy(merged, () => proxy) as T
  return proxy
}

function createProxy<I extends object, T extends object>(
  module: Module<I, T>,
  getRoot: () => I
): T {
  const cache = new Map<string, unknown>()
  const inProgress = new Set<string>()

  return new Proxy({} as T, {
    get(_target, prop: string | symbol) {
      if (typeof prop === 'symbol') return undefined
      if (cache.has(prop)) return cache.get(prop)

      const entry = (module as Record<string, unknown>)[prop]
      if (entry === undefined) return undefined

      if (typeof entry === 'function') {
        if (inProgress.has(prop)) {
          throw new Error(`Circular dependency detected for service: "${prop}"`)
        }
        inProgress.add(prop)
        const value = (entry as (i: I) => unknown)(getRoot())
        inProgress.delete(prop)
        cache.set(prop, value)
        return value
      }

      if (isPlainObject(entry)) {
        const nested = createProxy(entry as Module<I, Record<string, unknown>>, getRoot)
        cache.set(prop, nested)
        return nested
      }

      cache.set(prop, entry)
      return entry
    }
  })
}

function mergeModules<T extends object>(target: T, source: Partial<T>): T {
  const result = Object.assign({}, target)
  for (const key of Object.keys(source) as Array<keyof T>) {
    const s = source[key]
    const t = result[key]
    if (isPlainObject(s) && isPlainObject(t)) {
      result[key] = mergeModules(
        t as Record<string, unknown>,
        s as Partial<Record<string, unknown>>
      ) as T[keyof T]
    } else if (s !== undefined) {
      result[key] = s as T[keyof T]
    }
  }
  return result
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
