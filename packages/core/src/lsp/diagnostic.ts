import type { SyntaxNode } from 'tree-sitter'

export type DiagnosticSeverity = 'error' | 'warning' | 'information' | 'hint'

export interface TrellisDiagnostic {
  readonly node: SyntaxNode
  readonly message: string
  readonly severity: DiagnosticSeverity
  readonly source?: string
}

export interface DiagnosticProvider {
  getDiagnostics(rootNode: SyntaxNode): readonly TrellisDiagnostic[]
}
