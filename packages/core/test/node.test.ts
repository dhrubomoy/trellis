import { describe, it, expect } from 'vitest'
import { TrellisNode } from '../src/node.js'
import type { TrellisContext } from '../src/context.js'
import { DefaultLinkTable } from '../src/link-table.js'
import type { SyntaxNode, Point } from 'tree-sitter'

function mockNode(overrides: Partial<{
  id: number
  type: string
  text: string
  startPosition: Point
  endPosition: Point
  startIndex: number
  endIndex: number
}> = {}): SyntaxNode {
  return {
    id: 1,
    type: 'test_node',
    text: 'foo',
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 0, column: 3 },
    startIndex: 0,
    endIndex: 3,
    ...overrides
  } as unknown as SyntaxNode
}

function makeContext(): TrellisContext {
  return { linkTable: new DefaultLinkTable() }
}

class ConcreteNode extends TrellisNode {}

describe('TrellisNode', () => {
  it('exposes the underlying tsNode', () => {
    const tsNode = mockNode()
    const node = new ConcreteNode(tsNode, makeContext())
    expect(node.tsNode).toBe(tsNode)
  })

  it('exposes nodeType from tsNode.type', () => {
    const node = new ConcreteNode(mockNode({ type: 'element' }), makeContext())
    expect(node.nodeType).toBe('element')
  })

  it('exposes text from tsNode.text', () => {
    const node = new ConcreteNode(mockNode({ text: 'myName' }), makeContext())
    expect(node.text).toBe('myName')
  })

  it('exposes startPosition from tsNode', () => {
    const node = new ConcreteNode(
      mockNode({ startPosition: { row: 2, column: 5 } }),
      makeContext()
    )
    expect(node.startPosition).toEqual({ row: 2, column: 5 })
  })

  it('exposes endPosition from tsNode', () => {
    const node = new ConcreteNode(
      mockNode({ endPosition: { row: 2, column: 10 } }),
      makeContext()
    )
    expect(node.endPosition).toEqual({ row: 2, column: 10 })
  })

  it('exposes startIndex and endIndex from tsNode', () => {
    const node = new ConcreteNode(mockNode({ startIndex: 10, endIndex: 20 }), makeContext())
    expect(node.startIndex).toBe(10)
    expect(node.endIndex).toBe(20)
  })
})
