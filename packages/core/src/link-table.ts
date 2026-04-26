import type { SyntaxNode } from 'tree-sitter'

export interface LinkTable {
  set(nodeId: number, resolved: SyntaxNode | undefined): void
  resolve(nodeId: number): SyntaxNode | undefined
  has(nodeId: number): boolean
  invalidate(nodeIds: Set<number>): void
  clear(): void
}

export class DefaultLinkTable implements LinkTable {
  // null = attempted but unresolvable; absent = never attempted
  private readonly table = new Map<number, SyntaxNode | null>()

  set(nodeId: number, resolved: SyntaxNode | undefined): void {
    this.table.set(nodeId, resolved ?? null)
  }

  resolve(nodeId: number): SyntaxNode | undefined {
    return this.table.get(nodeId) ?? undefined
  }

  has(nodeId: number): boolean {
    return this.table.has(nodeId)
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
