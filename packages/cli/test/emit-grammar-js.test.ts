import { describe, it, expect } from 'vitest'
import { emitGrammarJs } from '../src/emit-grammar-js.js'
import { parseGrammar } from '../src/parser.js'

const miniGrammar = parseGrammar(`
  grammar MyLang
  word: ID;
  conflicts: [[TypeRef, Id]];

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
  hidden terminal SL_COMMENT: /\\/\\/[^\\n\\r]*/;
  terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
`)

describe('emitGrammarJs', () => {
  it('wraps output in module.exports = grammar({ ... })', () => {
    const out = emitGrammarJs(miniGrammar)
    expect(out.trimStart()).toMatch(/^module\.exports = grammar\(\{/)
    expect(out.trimEnd()).toMatch(/\}\)$/)
  })

  it('emits the grammar name in snake_case', () => {
    const out = emitGrammarJs(miniGrammar)
    expect(out).toContain("name: 'my_lang'")
  })

  it('emits a word declaration', () => {
    const out = emitGrammarJs(miniGrammar)
    expect(out).toContain('word: $ => $.id')
  })

  it('emits hidden terminals in extras', () => {
    const out = emitGrammarJs(miniGrammar)
    expect(out).toContain('extras: $ => [')
    expect(out).toContain('$.ws')
    expect(out).toContain('$.sl_comment')
  })

  it('does not include non-hidden terminals in extras', () => {
    const out = emitGrammarJs(miniGrammar)
    const extrasStart = out.indexOf('extras:')
    const extrasEnd = out.indexOf('],', extrasStart)
    const extrasBlock = out.slice(extrasStart, extrasEnd)
    expect(extrasBlock).not.toContain('$.id')
  })

  it('emits conflicts', () => {
    const out = emitGrammarJs(miniGrammar)
    expect(out).toContain('conflicts: $ => [')
    expect(out).toContain('[$.type_ref, $.id]')
  })

  it('emits supertypes for pure alternation rules', () => {
    const out = emitGrammarJs(miniGrammar)
    expect(out).toContain('supertypes: $ => [')
    expect(out).toContain('$.expression')
  })

  it('does not include non-alternation rules in supertypes', () => {
    const out = emitGrammarJs(miniGrammar)
    const supertypesStart = out.indexOf('supertypes:')
    const supertypesEnd = out.indexOf('],', supertypesStart)
    const supertypesBlock = out.slice(supertypesStart, supertypesEnd)
    expect(supertypesBlock).not.toContain('$.model')
    expect(supertypesBlock).not.toContain('$.element')
  })

  it('emits a list assignment wrapped in repeat from group cardinality', () => {
    const out = emitGrammarJs(miniGrammar)
    expect(out).toContain("repeat(field('elements', $.element))")
  })

  it('emits plain assignments as field() calls', () => {
    const out = emitGrammarJs(miniGrammar)
    expect(out).toContain("field('name', $.id)")
    expect(out).toContain("field('type', $.type_ref)")
  })

  it('emits a keyword literal in a sequence', () => {
    const out = emitGrammarJs(miniGrammar)
    expect(out).toContain("':'")
  })

  it('emits a cross-reference assignment using the terminal name', () => {
    const out = emitGrammarJs(miniGrammar)
    expect(out).toContain("field('target', $.id)")
  })

  it('emits a precedence annotation wrapping the sequence', () => {
    const out = emitGrammarJs(miniGrammar)
    expect(out).toContain('prec.left(1,')
    expect(out).toContain("field('left', $.expression)")
    expect(out).toContain("field('right', $.expression)")
  })

  it('emits a group terminal (inline alternatives) as choice()', () => {
    const out = emitGrammarJs(miniGrammar)
    expect(out).toContain("field('op', choice(")
    expect(out).toContain("'+'")
    expect(out).toContain("'-'")
  })

  it('emits a pure alternation rule body as choice()', () => {
    const out = emitGrammarJs(miniGrammar)
    expect(out).toContain('$.binary_expr')
    expect(out).toContain('$.literal')
  })

  it('emits terminal rules as regex patterns', () => {
    const out = emitGrammarJs(miniGrammar)
    expect(out).toContain('ws: $ => /\\s+/')
    expect(out).toContain('id: $ => /[a-zA-Z_][a-zA-Z0-9_]*/')
  })
})
