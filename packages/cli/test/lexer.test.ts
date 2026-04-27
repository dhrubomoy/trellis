import { describe, it, expect } from 'vitest'
import { tokenize, LexError } from '../src/lexer.js'

describe('tokenize', () => {
  it('returns only EOF for an empty string', () => {
    const tokens = tokenize('')
    expect(tokens).toEqual([{ kind: 'eof', value: '', offset: 0 }])
  })

  it('recognizes all six keywords', () => {
    const tokens = tokenize('grammar entry terminal hidden word conflicts')
    expect(tokens.map(t => t.kind)).toEqual([
      'kw_grammar', 'kw_entry', 'kw_terminal', 'kw_hidden', 'kw_word', 'kw_conflicts', 'eof'
    ])
  })

  it('tokenizes identifiers that start with an underscore', () => {
    const tokens = tokenize('_Foo_Bar123')
    expect(tokens[0]).toMatchObject({ kind: 'ident', value: '_Foo_Bar123' })
  })

  it('does not treat a keyword prefix as a keyword', () => {
    const tokens = tokenize('grammarian')
    expect(tokens[0]).toMatchObject({ kind: 'ident', value: 'grammarian' })
  })

  it('tokenizes a string literal and strips the quotes', () => {
    const tokens = tokenize("'hello world'")
    expect(tokens[0]).toMatchObject({ kind: 'string', value: 'hello world' })
  })

  it('tokenizes a regex literal and strips the delimiters', () => {
    const tokens = tokenize('/[a-z]+/')
    expect(tokens[0]).toMatchObject({ kind: 'regex', value: '[a-z]+' })
  })

  it('handles escaped slashes inside a regex literal', () => {
    const tokens = tokenize('/\\/\\/[^\\n\\r]*/')
    expect(tokens[0]).toMatchObject({ kind: 'regex', value: '\\/\\/[^\\n\\r]*' })
  })

  it('tokenizes integer numbers', () => {
    const tokens = tokenize('42')
    expect(tokens[0]).toMatchObject({ kind: 'number', value: '42' })
  })

  it('tokenizes the three assignment operators', () => {
    const tokens = tokenize('= += ?=')
    expect(tokens.map(t => t.kind)).toEqual(['eq', 'plus_eq', 'question_eq', 'eof'])
  })

  it('does not merge ? and = separated by whitespace', () => {
    const tokens = tokenize('? =')
    expect(tokens.map(t => t.kind)).toEqual(['question', 'eq', 'eof'])
  })

  it('tokenizes all punctuation characters', () => {
    const tokens = tokenize(': ; | * ? + [ ] ( ) @ . ,')
    expect(tokens.map(t => t.kind)).toEqual([
      'colon', 'semi', 'pipe', 'star', 'question', 'plus',
      'lbracket', 'rbracket', 'lparen', 'rparen',
      'at', 'dot', 'comma', 'eof'
    ])
  })

  it('skips whitespace and newlines', () => {
    const tokens = tokenize('  \t\n  foo')
    expect(tokens[0]).toMatchObject({ kind: 'ident', value: 'foo' })
  })

  it('skips single-line comments', () => {
    const tokens = tokenize('// ignore this\nfoo')
    expect(tokens[0]).toMatchObject({ kind: 'ident', value: 'foo' })
  })

  it('skips multi-line comments', () => {
    const tokens = tokenize('/* ignore\nall of this */foo')
    expect(tokens[0]).toMatchObject({ kind: 'ident', value: 'foo' })
  })

  it('records the byte offset of each token', () => {
    const tokens = tokenize('  foo')
    expect(tokens[0]!.offset).toBe(2)
  })

  it('throws LexError on an unrecognized character', () => {
    expect(() => tokenize('#')).toThrow(LexError)
  })

  it('throws LexError on an unterminated string literal', () => {
    expect(() => tokenize("'unterminated")).toThrow(LexError)
  })

  it('throws LexError on an unterminated regex literal', () => {
    expect(() => tokenize('/unterminated')).toThrow(LexError)
  })
})
