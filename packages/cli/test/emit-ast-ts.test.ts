import { describe, it, expect } from 'vitest'
import { emitAstTs } from '../src/emit-ast-ts.js'
import { parseGrammar } from '../src/parser.js'

const miniGrammar = parseGrammar(`
  grammar MyLang

  entry Model:
      (elements+=Element)*;

  Element:
      name=ID ':' type=TypeRef;

  TypeRef:
      target=[Element:ID];

  BinaryExpr:
      left=Expression op=('+' | '-') right=Expression @prec.left(1);

  Expression:
      BinaryExpr | Literal;

  hidden terminal WS: /\\s+/;
  terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
`)

describe('emitAstTs', () => {
  it('imports SyntaxNode and Tree from tree-sitter', () => {
    const out = emitAstTs(miniGrammar)
    expect(out).toContain("import type { SyntaxNode, Tree } from 'tree-sitter'")
  })

  it('imports TrellisContext from @trellis/core', () => {
    const out = emitAstTs(miniGrammar)
    expect(out).toContain("import type { TrellisContext } from '@trellis/core'")
  })

  it('generates a class for each parser rule', () => {
    const out = emitAstTs(miniGrammar)
    expect(out).toContain('export class ModelNode')
    expect(out).toContain('export class ElementNode')
    expect(out).toContain('export class TypeRefNode')
    expect(out).toContain('export class BinaryExprNode')
    expect(out).toContain('export class ExpressionNode')
  })

  it('generates a constructor with tsNode and ctx on every class', () => {
    const out = emitAstTs(miniGrammar)
    const constructorCount = (out.match(/constructor\(readonly tsNode: SyntaxNode, readonly ctx: TrellisContext\)/g) ?? []).length
    expect(constructorCount).toBe(5)
  })

  it('generates a string getter for a terminal assignment', () => {
    const out = emitAstTs(miniGrammar)
    expect(out).toContain('get name(): string')
    expect(out).toContain("childForFieldName('name')!.text")
  })

  it('memoizes the terminal string getter with ??=', () => {
    const out = emitAstTs(miniGrammar)
    const nameGetterStart = out.indexOf('get name()')
    const nameGetterEnd = out.indexOf('\n  }', nameGetterStart) + 4
    expect(out.slice(nameGetterStart, nameGetterEnd)).toContain('??=')
  })

  it('generates a typed wrapper getter for a parser rule assignment', () => {
    const out = emitAstTs(miniGrammar)
    expect(out).toContain('get type(): TypeRefNode')
    expect(out).toContain('new TypeRefNode(')
    expect(out).toContain("childForFieldName('type')!")
  })

  it('generates an array getter for a list assignment of parser rule nodes', () => {
    const out = emitAstTs(miniGrammar)
    expect(out).toContain('get elements(): ElementNode[]')
    expect(out).toContain("childrenForFieldName('elements')")
    expect(out).toContain('.map(n => new ElementNode(n, this.ctx))')
  })

  it('generates a link-table lookup for a cross-reference assignment', () => {
    const out = emitAstTs(miniGrammar)
    expect(out).toContain('get target(): ElementNode | undefined')
    expect(out).toContain('this.ctx.linkTable.resolve(this.tsNode)')
    expect(out).toContain('new ElementNode(resolved, this.ctx)')
  })

  it('does not memoize the cross-reference getter', () => {
    const out = emitAstTs(miniGrammar)
    const start = out.indexOf('get target()')
    const end = out.indexOf('\n  }', start) + 4
    expect(out.slice(start, end)).not.toContain('??=')
  })

  it('generates a string getter for a group-terminal (inline alternatives) assignment', () => {
    const out = emitAstTs(miniGrammar)
    expect(out).toContain('get op(): string')
  })

  it('generates typed wrapper getters for parser-rule assignments in BinaryExpr', () => {
    const out = emitAstTs(miniGrammar)
    expect(out).toContain('get left(): ExpressionNode')
    expect(out).toContain('get right(): ExpressionNode')
  })

  it('generates a class with no getters for a pure alternation rule', () => {
    const out = emitAstTs(miniGrammar)
    const classStart = out.indexOf('export class ExpressionNode')
    const classEnd = out.indexOf('\n}', classStart) + 2
    const classBody = out.slice(classStart, classEnd)
    expect(classBody).not.toContain('get ')
  })

  it('generates createRootNode factory for the entry rule', () => {
    const out = emitAstTs(miniGrammar)
    expect(out).toContain('export function createRootNode(tree: Tree, ctx: TrellisContext): ModelNode')
    expect(out).toContain('return new ModelNode(tree.rootNode, ctx)')
  })
})
