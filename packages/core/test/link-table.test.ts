import { describe, it, expect } from 'vitest'
import { DefaultLinkTable } from '../src/link-table.js'
import type { SyntaxNode } from 'tree-sitter'

function mockNode(id: number): SyntaxNode {
  return { id } as unknown as SyntaxNode
}

describe('DefaultLinkTable', () => {
  it('returns undefined for a node that was never resolved', () => {
    const table = new DefaultLinkTable()
    expect(table.resolve(mockNode(1))).toBeUndefined()
  })

  it('has() returns false for a node that was never resolved', () => {
    const table = new DefaultLinkTable()
    expect(table.has(mockNode(1))).toBe(false)
  })

  it('stores and resolves a successful cross-reference', () => {
    const table = new DefaultLinkTable()
    const ref = mockNode(1)
    const target = mockNode(99)
    table.set(ref, target)
    expect(table.resolve(ref)).toBe(target)
  })

  it('stores an unresolvable reference (undefined) and has() returns true', () => {
    const table = new DefaultLinkTable()
    const ref = mockNode(1)
    table.set(ref, undefined)
    expect(table.has(ref)).toBe(true)
    expect(table.resolve(ref)).toBeUndefined()
  })

  it('invalidates specific node IDs, leaving others intact', () => {
    const table = new DefaultLinkTable()
    const ref1 = mockNode(1)
    const ref2 = mockNode(2)
    table.set(ref1, mockNode(99))
    table.set(ref2, mockNode(100))
    table.invalidate(new Set([1]))
    expect(table.has(ref1)).toBe(false)
    expect(table.has(ref2)).toBe(true)
  })

  it('clear() removes all entries', () => {
    const table = new DefaultLinkTable()
    const ref1 = mockNode(1)
    const ref2 = mockNode(2)
    table.set(ref1, mockNode(99))
    table.set(ref2, mockNode(100))
    table.clear()
    expect(table.has(ref1)).toBe(false)
    expect(table.has(ref2)).toBe(false)
  })
})
