import { describe, it, expect, vi } from 'vitest'
import { inject } from '../src/inject.js'

describe('inject', () => {
  it('creates a flat service from a factory', () => {
    interface S { value: string }
    const services = inject<S>({ value: () => 'hello' })
    expect(services.value).toBe('hello')
  })

  it('passes the root services object to factory functions', () => {
    interface S { a: string; b: string }
    const services = inject<S>({
      a: () => 'foo',
      b: (s) => s.a + 'bar'
    })
    expect(services.b).toBe('foobar')
  })

  it('handles nested service groups', () => {
    interface S { group: { value: string } }
    const services = inject<S>({
      group: { value: () => 'nested' }
    })
    expect(services.group.value).toBe('nested')
  })

  it('passes root services to factories inside nested groups', () => {
    interface S { name: string; greet: { message: string } }
    const services = inject<S>({
      name: () => 'world',
      greet: { message: (s) => `hello ${s.name}` }
    })
    expect(services.greet.message).toBe('hello world')
  })

  it('services are lazy — factory not called until first access', () => {
    const factory = vi.fn(() => 'value')
    interface S { x: string }
    const services = inject<S>({ x: factory })
    expect(factory).not.toHaveBeenCalled()
    void services.x
    expect(factory).toHaveBeenCalledOnce()
  })

  it('services are cached — factory called only once across multiple accesses', () => {
    const factory = vi.fn(() => ({ id: Math.random() }))
    interface S { thing: { id: number } }
    const services = inject<S>({ thing: factory })
    const first = services.thing
    const second = services.thing
    expect(first).toBe(second)
    expect(factory).toHaveBeenCalledOnce()
  })

  it('later modules override earlier modules at the same key', () => {
    interface S { value: string }
    const base = { value: () => 'base' }
    const override = { value: () => 'override' }
    const services = inject<S>(base, override)
    expect(services.value).toBe('override')
  })

  it('deep merges nested modules — override only replaces specified keys', () => {
    interface S { group: { a: string; b: string } }
    const base = { group: { a: () => 'base-a', b: () => 'base-b' } }
    const override = { group: { b: () => 'override-b' } }
    const services = inject<S>(base, override)
    expect(services.group.a).toBe('base-a')
    expect(services.group.b).toBe('override-b')
  })

  it('throws on circular dependencies', () => {
    interface S { a: string; b: string }
    const services = inject<S>({
      a: (s) => s.b,
      b: (s) => s.a
    })
    expect(() => services.a).toThrow(/[Cc]ircular/)
  })

  it('clears inProgress after factory throws — service is retryable', () => {
    let calls = 0
    interface S { x: string }
    const services = inject<S>({
      x: () => {
        calls++
        throw new Error('factory error')
      }
    })
    expect(() => services.x).toThrow('factory error')
    expect(() => services.x).toThrow('factory error')
    expect(calls).toBe(2)
  })
})
