import { describe, it, expect, vi } from 'vitest'
import { parseHelper } from '../src/parse-helper.js'
import type { SyntaxNode, Tree } from 'tree-sitter'
import type { TrellisContext } from '@trellis/core'

function mockNode(opts: Partial<{
  id: number
  type: string
  isMissing: boolean
  hasError: boolean
  childCount: number
  child: (i: number) => SyntaxNode | null
  startPosition: { row: number; column: number }
  endPosition: { row: number; column: number }
}> = {}): SyntaxNode {
  return {
    id: 1,
    type: 'model',
    text: '',
    isMissing: false,
    hasError: false,
    childCount: 0,
    child: () => null,
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 0, column: 0 },
    ...opts,
  } as unknown as SyntaxNode
}

function mockTree(rootNode: SyntaxNode): Tree {
  return { rootNode } as unknown as Tree
}

describe('parseHelper', () => {
  it('calls parser.parse with the source text', () => {
    const root = mockNode()
    const parser = { parse: vi.fn().mockReturnValue(mockTree(root)) }
    const createRoot = vi.fn().mockReturnValue({ tsNode: root })
    const parse = parseHelper({ parser, createRoot })
    parse('hello world')
    expect(parser.parse).toHaveBeenCalledWith('hello world')
  })

  it('returns the root node returned by createRoot', () => {
    const root = mockNode()
    const parser = { parse: vi.fn().mockReturnValue(mockTree(root)) }
    const expectedRoot = { tsNode: root, text: 'hello' }
    const createRoot = vi.fn().mockReturnValue(expectedRoot)
    const parse = parseHelper({ parser, createRoot })
    const result = parse('hello world')
    expect(result.root).toBe(expectedRoot)
  })

  it('passes the tree and a TrellisContext to createRoot', () => {
    const root = mockNode()
    const tree = mockTree(root)
    const parser = { parse: vi.fn().mockReturnValue(tree) }
    const createRoot = vi.fn().mockReturnValue({ tsNode: root })
    const parse = parseHelper({ parser, createRoot })
    parse('hello')
    const [calledTree, calledCtx] = createRoot.mock.calls[0]!
    expect(calledTree).toBe(tree)
    expect(calledCtx).toHaveProperty('linkTable')
  })

  it('returns empty parseErrors when root has no errors', () => {
    const root = mockNode({ hasError: false, isMissing: false, childCount: 0 })
    const parser = { parse: vi.fn().mockReturnValue(mockTree(root)) }
    const parse = parseHelper({ parser, createRoot: vi.fn().mockReturnValue({}) })
    const result = parse('hello')
    expect(result.parseErrors).toHaveLength(0)
  })

  it('collects ERROR nodes as parse errors', () => {
    const errorNode = mockNode({ id: 2, type: 'ERROR', isMissing: false, childCount: 0 })
    const root = mockNode({
      id: 1,
      type: 'model',
      hasError: true,
      childCount: 1,
      child: (i: number) => (i === 0 ? errorNode : null),
    })
    const parser = { parse: vi.fn().mockReturnValue(mockTree(root)) }
    const parse = parseHelper({ parser, createRoot: vi.fn().mockReturnValue({}) })
    const result = parse('hello')
    expect(result.parseErrors).toHaveLength(1)
    expect(result.parseErrors[0]!.message).toBe('Syntax error')
  })

  it('collects MISSING nodes as parse errors', () => {
    const missingNode = mockNode({ id: 2, type: 'identifier', isMissing: true, childCount: 0 })
    const root = mockNode({
      id: 1,
      type: 'model',
      hasError: true,
      childCount: 1,
      child: (i: number) => (i === 0 ? missingNode : null),
    })
    const parser = { parse: vi.fn().mockReturnValue(mockTree(root)) }
    const parse = parseHelper({ parser, createRoot: vi.fn().mockReturnValue({}) })
    const result = parse('hello')
    expect(result.parseErrors).toHaveLength(1)
    expect(result.parseErrors[0]!.message).toBe('Missing identifier')
  })

  it('provides a TrellisContext with a DefaultLinkTable when no createContext is supplied', () => {
    const root = mockNode()
    const parser = { parse: vi.fn().mockReturnValue(mockTree(root)) }
    let capturedCtx: TrellisContext | undefined
    const createRoot = vi.fn().mockImplementation((_tree: Tree, ctx: TrellisContext) => {
      capturedCtx = ctx
      return {}
    })
    const parse = parseHelper({ parser, createRoot })
    parse('hello')
    expect(capturedCtx!.linkTable).toBeDefined()
    expect(typeof capturedCtx!.linkTable.resolve).toBe('function')
  })

  it('uses a custom createContext when provided', () => {
    const root = mockNode()
    const parser = { parse: vi.fn().mockReturnValue(mockTree(root)) }
    const customCtx: TrellisContext = {
      linkTable: { set: vi.fn(), resolve: vi.fn(), has: vi.fn(), invalidate: vi.fn(), clear: vi.fn() },
    }
    const createContext = vi.fn().mockReturnValue(customCtx)
    let capturedCtx: TrellisContext | undefined
    const createRoot = vi.fn().mockImplementation((_tree: Tree, ctx: TrellisContext) => {
      capturedCtx = ctx
      return {}
    })
    const parse = parseHelper({ parser, createRoot, createContext })
    parse('hello')
    expect(capturedCtx).toBe(customCtx)
  })

  it('exposes the tree and ctx on the result', () => {
    const root = mockNode()
    const tree = mockTree(root)
    const parser = { parse: vi.fn().mockReturnValue(tree) }
    const parse = parseHelper({ parser, createRoot: vi.fn().mockReturnValue({}) })
    const result = parse('hello')
    expect(result.tree).toBe(tree)
    expect(result.ctx).toHaveProperty('linkTable')
  })
})
