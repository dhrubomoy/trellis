import type { SyntaxNode } from 'tree-sitter'

export interface Scope {
  lookup(name: string, type: string): SyntaxNode | undefined
  define(name: string, type: string, node: SyntaxNode): void
  createChildScope(): Scope
}

export interface ScopeProvider {
  buildScope(rootNode: SyntaxNode): Scope
  resolve(refNode: SyntaxNode, scope: Scope): SyntaxNode | undefined
}

export class DefaultScope implements Scope {
  private readonly definitions = new Map<string, SyntaxNode>()

  constructor(private readonly parent?: Scope) {}

  define(name: string, type: string, node: SyntaxNode): void {
    this.definitions.set(scopeKey(name, type), node)
  }

  lookup(name: string, type: string): SyntaxNode | undefined {
    return this.definitions.get(scopeKey(name, type)) ?? this.parent?.lookup(name, type)
  }

  createChildScope(): Scope {
    return new DefaultScope(this)
  }
}

function scopeKey(name: string, type: string): string {
  // '\0' cannot appear in source identifiers or tree-sitter type strings, making the key collision-free
  return `${type}\0${name}`
}
