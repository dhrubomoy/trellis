import { describe, it, expect } from 'vitest'
import { DefaultLinkTable } from '../src/link-table.js'
import type { SyntaxNode } from 'tree-sitter'

function mockNode(id: number): SyntaxNode {
  return { id } as unknown as SyntaxNode
}

describe('DefaultLinkTable', () => {
  it('returns undefined for a node that was never resolved', () => {
    const table = new DefaultLinkTable()
    expect(table.resolve(1)).toBeUndefined()
  })

  it('has() returns false for a node that was never resolved', () => {
    const table = new DefaultLinkTable()
    expect(table.has(1)).toBe(false)
  })

  it('stores and resolves a successful cross-reference', () => {
    const table = new DefaultLinkTable()
    const target = mockNode(99)
    table.set(1, target)
    expect(table.resolve(1)).toBe(target)
  })

  it('stores an unresolvable reference (undefined) and has() returns true', () => {
    const table = new DefaultLinkTable()
    table.set(1, undefined)
    expect(table.has(1)).toBe(true)
    expect(table.resolve(1)).toBeUndefined()
  })

  it('invalidates specific node IDs, leaving others intact', () => {
    const table = new DefaultLinkTable()
    table.set(1, mockNode(99))
    table.set(2, mockNode(100))
    table.invalidate(new Set([1]))
    expect(table.has(1)).toBe(false)
    expect(table.has(2)).toBe(true)
  })

  it('clear() removes all entries', () => {
    const table = new DefaultLinkTable()
    table.set(1, mockNode(99))
    table.set(2, mockNode(100))
    table.clear()
    expect(table.has(1)).toBe(false)
    expect(table.has(2)).toBe(false)
  })
})
