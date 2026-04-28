import type { SyntaxNode } from 'tree-sitter'

export function walkTree(node: SyntaxNode, visitor: (n: SyntaxNode) => void): void {
  visitor(node)
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (child !== null) walkTree(child, visitor)
  }
}
