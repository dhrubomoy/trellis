import { describe, it, expect, vi } from 'vitest'
import { lspHelper } from '../src/lsp-helper.js'
import type { SyntaxNode } from 'tree-sitter'
import type { TrellisDiagnostic } from '@trellis/core'

function mockNode(): SyntaxNode {
  return { id: 1 } as unknown as SyntaxNode
}

describe('lspHelper', () => {
  it('getDiagnostics returns diagnostics from the provider', () => {
    const root = mockNode()
    const diag: TrellisDiagnostic = {
      node: root,
      message: 'Unresolved reference',
      severity: 'error',
    }
    const getDiagnostics = vi.fn().mockReturnValue([diag])
    const helper = lspHelper({ getDiagnostics })
    const result = helper.getDiagnostics(root)
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(diag)
  })

  it('getDiagnostics calls provider with the given root node', () => {
    const root = mockNode()
    const getDiagnostics = vi.fn().mockReturnValue([])
    const helper = lspHelper({ getDiagnostics })
    helper.getDiagnostics(root)
    expect(getDiagnostics).toHaveBeenCalledWith(root)
  })

  it('getDiagnostics returns an empty array when there are no diagnostics', () => {
    const root = mockNode()
    const getDiagnostics = vi.fn().mockReturnValue([])
    const helper = lspHelper({ getDiagnostics })
    expect(helper.getDiagnostics(root)).toHaveLength(0)
  })
})
