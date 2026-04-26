import type { SyntaxNode } from 'tree-sitter'

export type DiagnosticSeverity = 'error' | 'warning' | 'information' | 'hint'

export interface TrellisDiagnostic {
  readonly node: SyntaxNode
  readonly message: string
  readonly severity: DiagnosticSeverity
}

export interface DiagnosticProvider {
  getDiagnostics(rootNode: SyntaxNode): TrellisDiagnostic[]
}
