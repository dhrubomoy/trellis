import type { SyntaxNode, Point } from 'tree-sitter'
import type { TrellisContext } from './context.js'

export abstract class TrellisNode {
  constructor(
    readonly tsNode: SyntaxNode,
    protected readonly ctx: TrellisContext
  ) {}

  get nodeType(): string {
    return this.tsNode.type
  }

  get text(): string {
    return this.tsNode.text
  }

  get startPosition(): Point {
    return this.tsNode.startPosition
  }

  get endPosition(): Point {
    return this.tsNode.endPosition
  }

  get startIndex(): number {
    return this.tsNode.startIndex
  }

  get endIndex(): number {
    return this.tsNode.endIndex
  }
}
