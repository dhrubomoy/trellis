import type { SyntaxNode } from 'tree-sitter'

export interface LinkTable {
  set(refNode: SyntaxNode, resolved: SyntaxNode | undefined): void
  resolve(refNode: SyntaxNode): SyntaxNode | undefined
  has(refNode: SyntaxNode): boolean
  invalidate(nodeIds: Set<number>): void
  clear(): void
}

export class DefaultLinkTable implements LinkTable {
  // null = attempted but unresolvable; absent = never attempted
  private readonly table = new Map<number, SyntaxNode | null>()

  set(refNode: SyntaxNode, resolved: SyntaxNode | undefined): void {
    this.table.set(refNode.id, resolved ?? null)
  }

  resolve(refNode: SyntaxNode): SyntaxNode | undefined {
    const entry = this.table.get(refNode.id)
    return entry === null ? undefined : entry
  }

  has(refNode: SyntaxNode): boolean {
    return this.table.has(refNode.id)
  }

  invalidate(nodeIds: Set<number>): void {
    for (const id of nodeIds) {
      this.table.delete(id)
    }
  }

  clear(): void {
    this.table.clear()
  }
}
