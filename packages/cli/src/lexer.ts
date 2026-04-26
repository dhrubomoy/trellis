export type TokenKind =
  | 'kw_grammar' | 'kw_entry' | 'kw_terminal' | 'kw_hidden'
  | 'kw_word' | 'kw_conflicts'
  | 'ident' | 'string' | 'regex' | 'number'
  | 'eq' | 'plus_eq' | 'question_eq'
  | 'colon' | 'semi' | 'pipe'
  | 'star' | 'question' | 'plus'
  | 'lbracket' | 'rbracket'
  | 'lparen' | 'rparen'
  | 'at' | 'dot' | 'comma'
  | 'eof'

export interface Token {
  kind: TokenKind
  value: string
  offset: number
}

export class LexError extends Error {
  constructor(message: string, public readonly offset: number) {
    super(message)
    this.name = 'LexError'
  }
}

const KEYWORDS: Readonly<Record<string, TokenKind>> = {
  grammar: 'kw_grammar',
  entry: 'kw_entry',
  terminal: 'kw_terminal',
  hidden: 'kw_hidden',
  word: 'kw_word',
  conflicts: 'kw_conflicts',
}

const SINGLE_CHAR: Readonly<Partial<Record<string, TokenKind>>> = {
  '=': 'eq', ':': 'colon', ';': 'semi', '|': 'pipe',
  '*': 'star', '?': 'question', '+': 'plus',
  '[': 'lbracket', ']': 'rbracket',
  '(': 'lparen', ')': 'rparen',
  '@': 'at', '.': 'dot', ',': 'comma',
}

export function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let pos = 0

  while (pos < input.length) {
    // skip whitespace
    if (/\s/.test(input[pos]!)) { pos++; continue }

    // skip single-line comments
    if (input[pos] === '/' && input[pos + 1] === '/') {
      while (pos < input.length && input[pos] !== '\n') pos++
      continue
    }

    // skip multi-line comments
    if (input[pos] === '/' && input[pos + 1] === '*') {
      pos += 2
      while (pos < input.length && !(input[pos] === '*' && input[pos + 1] === '/')) pos++
      pos += 2
      continue
    }

    const start = pos
    const ch = input[pos]!

    // identifiers and keywords
    if (/[a-zA-Z_]/.test(ch)) {
      while (pos < input.length && /[a-zA-Z0-9_]/.test(input[pos]!)) pos++
      const value = input.slice(start, pos)
      tokens.push({ kind: KEYWORDS[value] ?? 'ident', value, offset: start })
      continue
    }

    // integer numbers
    if (/[0-9]/.test(ch)) {
      while (pos < input.length && /[0-9]/.test(input[pos]!)) pos++
      tokens.push({ kind: 'number', value: input.slice(start, pos), offset: start })
      continue
    }

    // string literals: 'value'
    if (ch === "'") {
      pos++
      while (pos < input.length && input[pos] !== "'") {
        if (input[pos] === '\\') pos++  // skip escaped char
        pos++
      }
      if (pos >= input.length) throw new LexError('Unterminated string literal', start)
      pos++ // consume closing quote
      tokens.push({ kind: 'string', value: input.slice(start + 1, pos - 1), offset: start })
      continue
    }

    // regex literals: /pattern/ — only reached after // and /* are already ruled out above
    if (ch === '/') {
      pos++
      while (pos < input.length && input[pos] !== '/') {
        if (input[pos] === '\\') pos++  // skip escaped char
        pos++
      }
      if (pos >= input.length) throw new LexError('Unterminated regex literal', start)
      pos++ // consume closing slash
      tokens.push({ kind: 'regex', value: input.slice(start + 1, pos - 1), offset: start })
      continue
    }

    // two-char operators (must be checked before single-char)
    if (ch === '+' && input[pos + 1] === '=') {
      tokens.push({ kind: 'plus_eq', value: '+=', offset: start }); pos += 2; continue
    }
    if (ch === '?' && input[pos + 1] === '=') {
      tokens.push({ kind: 'question_eq', value: '?=', offset: start }); pos += 2; continue
    }

    // single-char tokens
    const kind = SINGLE_CHAR[ch]
    if (kind !== undefined) {
      tokens.push({ kind, value: ch, offset: start }); pos++; continue
    }

    throw new LexError(`Unexpected character: '${ch}'`, start)
  }

  tokens.push({ kind: 'eof', value: '', offset: pos })
  return tokens
}
