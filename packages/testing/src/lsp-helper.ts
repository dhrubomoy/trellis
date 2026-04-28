import type { SyntaxNode } from 'tree-sitter'
import type { DiagnosticProvider, TrellisDiagnostic } from '@trellis/core'

export interface LspHelper {
  getDiagnostics(rootNode: SyntaxNode): readonly TrellisDiagnostic[]
}

export function lspHelper(diagnosticProvider: DiagnosticProvider): LspHelper {
  return {
    getDiagnostics(rootNode: SyntaxNode): readonly TrellisDiagnostic[] {
      return diagnosticProvider.getDiagnostics(rootNode)
    },
  }
}
