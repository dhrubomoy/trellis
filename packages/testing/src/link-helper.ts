import type { SyntaxNode } from 'tree-sitter'
import type { TrellisContext, ScopeProvider } from '@trellis/core'
import { walkTree } from './walk-tree.js'

export function linkHelper(
  scopeProvider: ScopeProvider
): (rootNode: SyntaxNode, ctx: TrellisContext) => void {
  return (rootNode: SyntaxNode, ctx: TrellisContext): void => {
    const scope = scopeProvider.buildScope(rootNode)
    walkTree(rootNode, (node) => {
      const resolved = scopeProvider.resolve(node, scope)
      if (resolved !== undefined) {
        ctx.linkTable.set(node, resolved)
      }
    })
  }
}
