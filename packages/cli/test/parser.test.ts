import { describe, it, expect } from 'vitest'
import { parseGrammar, ParseError } from '../src/parser.js'
import type { Assignment, Group, PrecedenceAnnotation } from '../src/grammar-ast.js'

describe('parseGrammar', () => {
  it('parses a grammar name', () => {
    const ast = parseGrammar('grammar MyLang')
    expect(ast.name).toBe('MyLang')
    expect(ast.rules).toHaveLength(0)
    expect(ast.terminals).toHaveLength(0)
  })

  it('parses a word declaration', () => {
    const ast = parseGrammar('grammar G\nword: ID;')
    expect(ast.word).toBe('ID')
  })

  it('parses a single-group conflicts declaration', () => {
    const ast = parseGrammar('grammar G\nconflicts: [[TypeRef, Identifier]];')
    expect(ast.conflicts).toEqual([['TypeRef', 'Identifier']])
  })

  it('parses a multi-group conflicts declaration', () => {
    const ast = parseGrammar('grammar G\nconflicts: [[A, B], [C, D]];')
    expect(ast.conflicts).toEqual([['A', 'B'], ['C', 'D']])
  })

  it('parses a terminal rule', () => {
    const ast = parseGrammar('grammar G\nterminal ID: /[a-zA-Z_]+/;')
    expect(ast.terminals).toHaveLength(1)
    expect(ast.terminals[0]).toEqual({ name: 'ID', isHidden: false, regex: '[a-zA-Z_]+' })
  })

  it('parses a hidden terminal rule', () => {
    const ast = parseGrammar('grammar G\nhidden terminal WS: /\\s+/;')
    expect(ast.terminals[0]).toEqual({ name: 'WS', isHidden: true, regex: '\\s+' })
  })

  it('parses a simple rule with a keyword', () => {
    const ast = parseGrammar("grammar G\nFoo: 'foo';")
    const rule = ast.rules[0]!
    expect(rule.name).toBe('Foo')
    expect(rule.isEntry).toBe(false)
    expect(rule.body.alternatives[0]!.elements[0]).toEqual({ kind: 'keyword', value: 'foo' })
  })

  it('parses an entry rule', () => {
    const ast = parseGrammar("grammar G\nentry Model: 'x';")
    expect(ast.rules[0]!.isEntry).toBe(true)
    expect(ast.rules[0]!.name).toBe('Model')
  })

  it('parses a plain assignment', () => {
    const ast = parseGrammar('grammar G\nFoo: name=ID;')
    const elem = ast.rules[0]!.body.alternatives[0]!.elements[0]!
    expect(elem).toEqual({
      kind: 'assignment',
      feature: 'name',
      operator: '=',
      terminal: { kind: 'rule-call', rule: 'ID' }
    })
  })

  it('parses a list assignment', () => {
    const ast = parseGrammar('grammar G\nFoo: items+=Item;')
    const elem = ast.rules[0]!.body.alternatives[0]!.elements[0]! as Assignment
    expect(elem.operator).toBe('+=')
    expect(elem.feature).toBe('items')
    expect(elem.terminal).toEqual({ kind: 'rule-call', rule: 'Item' })
  })

  it('parses a boolean flag assignment', () => {
    const ast = parseGrammar("grammar G\nFoo: optional?='abstract';")
    const elem = ast.rules[0]!.body.alternatives[0]!.elements[0]! as Assignment
    expect(elem.operator).toBe('?=')
    expect(elem.feature).toBe('optional')
    expect(elem.terminal).toEqual({ kind: 'keyword', value: 'abstract' })
  })

  it('parses a cross-reference assignment', () => {
    const ast = parseGrammar('grammar G\nFoo: target=[Element:ID];')
    const elem = ast.rules[0]!.body.alternatives[0]!.elements[0]! as Assignment
    expect(elem.terminal).toEqual({ kind: 'cross-ref', type: 'Element', terminal: 'ID', isMulti: false })
  })

  it('parses a multi cross-reference assignment', () => {
    const ast = parseGrammar('grammar G\nFoo: targets=[+Element:ID];')
    const elem = ast.rules[0]!.body.alternatives[0]!.elements[0]! as Assignment
    expect(elem.terminal).toEqual({ kind: 'cross-ref', type: 'Element', terminal: 'ID', isMulti: true })
  })

  it('parses a group with * cardinality', () => {
    const ast = parseGrammar("grammar G\nFoo: ('x')*;")
    const elem = ast.rules[0]!.body.alternatives[0]!.elements[0]! as Group
    expect(elem.kind).toBe('group')
    expect(elem.cardinality).toBe('*')
    expect(elem.body.alternatives[0]!.elements[0]).toEqual({ kind: 'keyword', value: 'x' })
  })

  it('parses a group with + cardinality', () => {
    const ast = parseGrammar('grammar G\nFoo: (Item)+;')
    const elem = ast.rules[0]!.body.alternatives[0]!.elements[0]! as Group
    expect(elem.cardinality).toBe('+')
  })

  it('parses a group with ? cardinality', () => {
    const ast = parseGrammar("grammar G\nFoo: ('x')?;")
    const elem = ast.rules[0]!.body.alternatives[0]!.elements[0]! as Group
    expect(elem.cardinality).toBe('?')
  })

  it('parses an assignment with a group terminal (inline alternatives)', () => {
    const ast = parseGrammar("grammar G\nFoo: op=('+' | '-');")
    const elem = ast.rules[0]!.body.alternatives[0]!.elements[0]! as Assignment
    expect(elem.feature).toBe('op')
    expect(elem.operator).toBe('=')
    const group = elem.terminal as Group
    expect(group.kind).toBe('group')
    expect(group.body.alternatives).toHaveLength(2)
    expect(group.body.alternatives[0]!.elements[0]).toEqual({ kind: 'keyword', value: '+' })
    expect(group.body.alternatives[1]!.elements[0]).toEqual({ kind: 'keyword', value: '-' })
  })

  it('parses a rule call with + cardinality', () => {
    const ast = parseGrammar('grammar G\nFoo: Item+;')
    expect(ast.rules[0]!.body.alternatives[0]!.elements[0]).toEqual({
      kind: 'rule-call', rule: 'Item', cardinality: '+'
    })
  })

  it('parses a keyword with ? cardinality', () => {
    const ast = parseGrammar("grammar G\nFoo: 'x'?;")
    expect(ast.rules[0]!.body.alternatives[0]!.elements[0]).toEqual({
      kind: 'keyword', value: 'x', cardinality: '?'
    })
  })

  it('parses a pure alternation rule (supertype pattern)', () => {
    const ast = parseGrammar('grammar G\nExpr: Foo | Bar | Baz;')
    const rule = ast.rules[0]!
    expect(rule.body.alternatives).toHaveLength(3)
    expect(rule.body.alternatives[0]!.elements[0]).toMatchObject({ kind: 'rule-call', rule: 'Foo' })
    expect(rule.body.alternatives[1]!.elements[0]).toMatchObject({ kind: 'rule-call', rule: 'Bar' })
    expect(rule.body.alternatives[2]!.elements[0]).toMatchObject({ kind: 'rule-call', rule: 'Baz' })
  })

  it('parses a default precedence annotation', () => {
    const ast = parseGrammar("grammar G\nFoo: 'x' @prec(2);")
    const prec = ast.rules[0]!.body.alternatives[0]!.elements[1]! as PrecedenceAnnotation
    expect(prec).toEqual({ kind: 'prec', precedenceType: 'default', value: 2 })
  })

  it('parses @prec.left(n)', () => {
    const ast = parseGrammar("grammar G\nFoo: 'x' @prec.left(1);")
    const prec = ast.rules[0]!.body.alternatives[0]!.elements[1]! as PrecedenceAnnotation
    expect(prec).toEqual({ kind: 'prec', precedenceType: 'left', value: 1 })
  })

  it('parses @prec.right(n)', () => {
    const ast = parseGrammar("grammar G\nFoo: 'x' @prec.right(3);")
    const prec = ast.rules[0]!.body.alternatives[0]!.elements[1]! as PrecedenceAnnotation
    expect(prec).toEqual({ kind: 'prec', precedenceType: 'right', value: 3 })
  })

  it('parses @prec.dynamic(n)', () => {
    const ast = parseGrammar("grammar G\nFoo: 'x' @prec.dynamic(1);")
    const prec = ast.rules[0]!.body.alternatives[0]!.elements[1]! as PrecedenceAnnotation
    expect(prec).toEqual({ kind: 'prec', precedenceType: 'dynamic', value: 1 })
  })

  it('parses a full mini-grammar', () => {
    const input = `
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
      terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
    `
    const ast = parseGrammar(input)
    expect(ast.name).toBe('MyLang')
    expect(ast.word).toBe('ID')
    expect(ast.conflicts).toEqual([['TypeRef', 'Id']])
    expect(ast.rules).toHaveLength(5)
    expect(ast.terminals).toHaveLength(2)

    // entry rule with group + list assignment
    expect(ast.rules[0]!.name).toBe('Model')
    expect(ast.rules[0]!.isEntry).toBe(true)
    const modelGroup = ast.rules[0]!.body.alternatives[0]!.elements[0]! as Group
    expect(modelGroup.kind).toBe('group')
    expect(modelGroup.cardinality).toBe('*')

    // BinaryExpr has a precedence annotation as its last element
    const binSeq = ast.rules[3]!.body.alternatives[0]!
    const lastElem = binSeq.elements[binSeq.elements.length - 1]! as PrecedenceAnnotation
    expect(lastElem).toEqual({ kind: 'prec', precedenceType: 'left', value: 1 })

    // Expression is a pure alternation rule
    expect(ast.rules[4]!.name).toBe('Expression')
    expect(ast.rules[4]!.body.alternatives).toHaveLength(2)

    // terminals
    expect(ast.terminals[0]!.name).toBe('WS')
    expect(ast.terminals[0]!.isHidden).toBe(true)
    expect(ast.terminals[1]!.name).toBe('ID')
    expect(ast.terminals[1]!.isHidden).toBe(false)
  })

  it('throws ParseError when grammar keyword is missing', () => {
    expect(() => parseGrammar('Foo: bar;')).toThrow(ParseError)
  })

  it('throws ParseError for a rule missing its semicolon', () => {
    expect(() => parseGrammar("grammar G\nFoo: 'x'")).toThrow(ParseError)
  })
})
