import { describe, it, expect, vi } from 'vitest'
import { linkHelper } from '../src/link-helper.js'
import type { SyntaxNode } from 'tree-sitter'
import { DefaultLinkTable, type TrellisContext, type Scope } from '@trellis/core'

function mockNode(id: number, children: SyntaxNode[] = []): SyntaxNode {
  return {
    id,
    type: 'node',
    childCount: children.length,
    child: (i: number) => children[i] ?? null,
  } as unknown as SyntaxNode
}

function mockCtx(): TrellisContext {
  return { linkTable: new DefaultLinkTable() }
}

function mockScope(): Scope {
  return {
    lookup: vi.fn().mockReturnValue(undefined),
    define: vi.fn(),
    createChildScope: vi.fn(),
  }
}

describe('linkHelper', () => {
  it('calls scopeProvider.buildScope with the root node', () => {
    const scope = mockScope()
    const buildScope = vi.fn().mockReturnValue(scope)
    const resolve = vi.fn().mockReturnValue(undefined)
    const link = linkHelper({ buildScope, resolve })
    const root = mockNode(1)
    link(root, mockCtx())
    expect(buildScope).toHaveBeenCalledWith(root)
  })

  it('calls scopeProvider.resolve for the root node', () => {
    const scope = mockScope()
    const buildScope = vi.fn().mockReturnValue(scope)
    const resolve = vi.fn().mockReturnValue(undefined)
    const link = linkHelper({ buildScope, resolve })
    const root = mockNode(1)
    link(root, mockCtx())
    expect(resolve).toHaveBeenCalledWith(root, scope)
  })

  it('calls scopeProvider.resolve for each child node', () => {
    const scope = mockScope()
    const child1 = mockNode(2)
    const child2 = mockNode(3)
    const root = mockNode(1, [child1, child2])
    const buildScope = vi.fn().mockReturnValue(scope)
    const resolve = vi.fn().mockReturnValue(undefined)
    const link = linkHelper({ buildScope, resolve })
    link(root, mockCtx())
    expect(resolve).toHaveBeenCalledWith(child1, scope)
    expect(resolve).toHaveBeenCalledWith(child2, scope)
  })

  it('walks grandchildren recursively', () => {
    const scope = mockScope()
    const grandchild = mockNode(3)
    const child = mockNode(2, [grandchild])
    const root = mockNode(1, [child])
    const buildScope = vi.fn().mockReturnValue(scope)
    const resolve = vi.fn().mockReturnValue(undefined)
    const link = linkHelper({ buildScope, resolve })
    link(root, mockCtx())
    expect(resolve).toHaveBeenCalledWith(grandchild, scope)
  })

  it('stores resolved nodes in the link table', () => {
    const scope = mockScope()
    const target = mockNode(99)
    const refNode = mockNode(2)
    const root = mockNode(1, [refNode])
    const buildScope = vi.fn().mockReturnValue(scope)
    const resolve = vi.fn().mockImplementation((n: SyntaxNode) =>
      n === refNode ? target : undefined
    )
    const link = linkHelper({ buildScope, resolve })
    const ctx = mockCtx()
    link(root, ctx)
    expect(ctx.linkTable.resolve(refNode)).toBe(target)
  })

  it('does not store undefined resolutions in the link table', () => {
    const scope = mockScope()
    const root = mockNode(1)
    const buildScope = vi.fn().mockReturnValue(scope)
    const resolve = vi.fn().mockReturnValue(undefined)
    const link = linkHelper({ buildScope, resolve })
    const ctx = mockCtx()
    link(root, ctx)
    expect(ctx.linkTable.has(root)).toBe(false)
  })
})
