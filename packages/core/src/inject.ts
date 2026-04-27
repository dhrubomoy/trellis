export type Module<I, T> = {
  [K in keyof T]: Module<I, T[K]> | ((injector: I) => T[K])
}

export function inject<T extends object>(...modules: Array<Partial<Module<T, T>>>): T {
  const merged = modules.reduce((a, b) => mergeModules(a, b), {} as Partial<Module<T, T>>) as Module<T, T>
  // proxy is declared before assignment so the lazy getter closure captures the binding
  const proxy: T = createProxy(merged, () => proxy) as T
  return proxy
}

function createProxy<I extends object, T extends object>(
  module: Module<I, T>,
  getRoot: () => I
): T {
  const cache = new Map<string, unknown>()
  const inProgress = new Set<string>()

  return new Proxy({} as T, {
    has(_target, prop) {
      if (typeof prop === 'symbol') return false
      return Object.prototype.hasOwnProperty.call(module, prop)
    },
    set(_target, prop: string | symbol) {
      throw new Error(`Services container is immutable — cannot set "${String(prop)}"`)
    },
    get(_target, prop: string | symbol) {
      if (typeof prop === 'symbol') return undefined
      if (cache.has(prop)) return cache.get(prop)

      if (!Object.prototype.hasOwnProperty.call(module, prop)) return undefined
      const entry = (module as Record<string, unknown>)[prop]
      if (entry === undefined) return undefined

      if (typeof entry === 'function') {
        if (inProgress.has(prop)) {
          throw new Error(`Circular dependency detected for service: "${prop}"`)
        }
        inProgress.add(prop)
        let value: unknown
        try {
          value = (entry as (i: I) => unknown)(getRoot())
        } finally {
          inProgress.delete(prop)
        }
        cache.set(prop, value!)
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
