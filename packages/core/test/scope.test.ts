import { describe, it, expect } from 'vitest'
import { DefaultScope } from '../src/scope.js'
import type { SyntaxNode } from 'tree-sitter'

function mockNode(id: number): SyntaxNode {
  return { id } as unknown as SyntaxNode
}

describe('DefaultScope', () => {
  it('returns undefined for an unknown name', () => {
    const scope = new DefaultScope()
    expect(scope.lookup('Foo', 'Element')).toBeUndefined()
  })

  it('resolves a defined name and type', () => {
    const scope = new DefaultScope()
    const node = mockNode(1)
    scope.define('Foo', 'Element', node)
    expect(scope.lookup('Foo', 'Element')).toBe(node)
  })

  it('does not confuse the same name with different types', () => {
    const scope = new DefaultScope()
    const a = mockNode(1)
    const b = mockNode(2)
    scope.define('Foo', 'Element', a)
    scope.define('Foo', 'TypeAlias', b)
    expect(scope.lookup('Foo', 'Element')).toBe(a)
    expect(scope.lookup('Foo', 'TypeAlias')).toBe(b)
  })

  it('child scope resolves definitions from parent', () => {
    const parent = new DefaultScope()
    const parentNode = mockNode(1)
    parent.define('ParentDef', 'Element', parentNode)

    const child = parent.createChildScope()
    expect(child.lookup('ParentDef', 'Element')).toBe(parentNode)
  })

  it('parent scope cannot see child definitions', () => {
    const parent = new DefaultScope()
    const child = parent.createChildScope()
    child.define('ChildDef', 'Element', mockNode(1))
    expect(parent.lookup('ChildDef', 'Element')).toBeUndefined()
  })

  it('child scope shadows parent definition with same name and type', () => {
    const parent = new DefaultScope()
    parent.define('Foo', 'Element', mockNode(1))

    const child = parent.createChildScope()
    const childNode = mockNode(2)
    child.define('Foo', 'Element', childNode)

    expect(child.lookup('Foo', 'Element')).toBe(childNode)
  })
})
