# @trellis/cli Grammar Parser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a hand-written recursive-descent parser for `.trellis` grammar files that produces an in-memory `GrammarAst` — no external parser dependencies.

**Architecture:** Three source files: `grammar-ast.ts` (pure TypeScript discriminated-union types), `lexer.ts` (character-by-character tokenizer), and `parser.ts` (recursive-descent parser consuming tokens and building the AST). All public surface is re-exported from `src/index.ts`. No runtime dependencies; vitest for tests. Follows the TDD + commit-per-task cadence established in Plan 1.

**Tech Stack:** TypeScript 5.x, pnpm workspaces (existing), vitest 2.x

---

## File Structure

### New files
- Create: `packages/cli/vitest.config.ts` — vitest config pointing tests at `test/**/*.test.ts`
- Create: `packages/cli/src/grammar-ast.ts` — all `GrammarAst` discriminated-union types (no logic)
- Create: `packages/cli/src/lexer.ts` — `tokenize()` + `Token`, `TokenKind`, `LexError`
- Create: `packages/cli/src/parser.ts` — `parseGrammar()` + `ParseError`, re-exports `LexError`
- Create: `packages/cli/test/lexer.test.ts`
- Create: `packages/cli/test/parser.test.ts`

### Modified files
- Modify: `packages/cli/src/index.ts` — replace stub comment with full re-exports
- Modify: `packages/cli/package.json` — change `test` script to `vitest run` (drop `--passWithNoTests`)

---

## Task 1: Setup + GrammarAst Types

No tests for pure types — TypeScript compilation is the verification.

**Files:**
- Create: `packages/cli/vitest.config.ts`
- Create: `packages/cli/src/grammar-ast.ts`
- Modify: `packages/cli/package.json`

- [ ] **Step 1: Add vitest config**

Create `packages/cli/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts']
  }
})
```

- [ ] **Step 2: Update test script**

In `packages/cli/package.json`, change the `test` script from `"vitest run --passWithNoTests"` to `"vitest run"`.

- [ ] **Step 3: Create GrammarAst types**

Create `packages/cli/src/grammar-ast.ts`:
```ts
export type Cardinality = '?' | '*' | '+'

export interface GrammarAst {
  name: string
  word?: string
  conflicts?: string[][]
  rules: ParserRule[]
  terminals: TerminalRule[]
}

export interface ParserRule {
  name: string
  isEntry: boolean
  body: Alternatives
}

export interface TerminalRule {
  name: string
  isHidden: boolean
  regex: string
}

export interface Alternatives {
  kind: 'alternatives'
  alternatives: Sequence[]
}

export interface Sequence {
  kind: 'sequence'
  elements: RuleElement[]
}

export type RuleElement =
  | Assignment
  | UnassignedRuleCall
  | Keyword
  | CrossReference
  | Group
  | PrecedenceAnnotation

export interface Assignment {
  kind: 'assignment'
  feature: string
  operator: '=' | '+=' | '?='
  terminal: AssignmentTerminal
}

export type AssignmentTerminal = UnassignedRuleCall | Keyword | CrossReference | Group

export interface CrossReference {
  kind: 'cross-ref'
  type: string
  terminal: string
  isMulti: boolean
}

export interface UnassignedRuleCall {
  kind: 'rule-call'
  rule: string
  cardinality?: Cardinality
}

export interface Keyword {
  kind: 'keyword'
  value: string
  cardinality?: Cardinality
}

export interface Group {
  kind: 'group'
  body: Alternatives
  cardinality?: Cardinality
}

export interface PrecedenceAnnotation {
  kind: 'prec'
  precedenceType: 'default' | 'left' | 'right' | 'dynamic'
  value: number
}
```

- [ ] **Step 4: Verify build**

Run: `pnpm --filter @trellis/cli build`

Expected: Zero TypeScript errors. `packages/cli/dist/` is created (only the stub index.ts for now — that's fine).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/vitest.config.ts packages/cli/src/grammar-ast.ts packages/cli/package.json
git commit -m "feat(@trellis/cli): add GrammarAst types and vitest config"
```

---

## Task 2: Lexer

The lexer converts raw `.trellis` source text into a flat `Token[]`. It skips whitespace and comments, recognizes all six keywords (`grammar`, `entry`, `terminal`, `hidden`, `word`, `conflicts`), string literals (`'...'`), regex literals (`/pattern/` — with backslash escape support), numbers, and every operator and punctuation character used by the grammar format. On an unrecognized character it throws `LexError` with the byte offset.

**Files:**
- Create: `packages/cli/test/lexer.test.ts`
- Create: `packages/cli/src/lexer.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/cli/test/lexer.test.ts`:
```ts
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
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `pnpm --filter @trellis/cli test`

Expected: FAIL — `Cannot find module '../src/lexer.js'`

- [ ] **Step 3: Implement the lexer**

Create `packages/cli/src/lexer.ts`:
```ts
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
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `pnpm --filter @trellis/cli test`

Expected: All 19 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/lexer.ts packages/cli/test/lexer.test.ts
git commit -m "feat(@trellis/cli): add lexer — tokenize() with LexError"
```

---

## Task 3: Parser

A recursive-descent parser that consumes a `Token[]` and produces a `GrammarAst`. The grammar is: one `grammar NAME` header; optional `word: ID;` and `conflicts: [[A,B],...];` declarations; any number of parser rules (`entry? NAME: body;`) and terminal rules (`hidden? terminal NAME: /regex/;`). Rule bodies are `alternatives` (pipe-separated `sequence`s of `element`s). Elements are: assignments (`feat=X`, `feat+=X`, `feat?=X`), unassigned rule calls (`Rule`, `Rule?`, `Rule*`, `Rule+`), keywords (`'kw'`, `'kw'?`), cross-references (`[Type:TOKEN]`, `[+Type:TOKEN]`), groups (`(body)?`), and precedence annotations (`@prec(n)`, `@prec.left(n)`, `@prec.right(n)`, `@prec.dynamic(n)`). `ParseError` is thrown with the byte offset of the offending token.

**Files:**
- Create: `packages/cli/test/parser.test.ts`
- Create: `packages/cli/src/parser.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/cli/test/parser.test.ts`:
```ts
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
    expect(ast.rules).toHaveLength(4)
    expect(ast.terminals).toHaveLength(2)

    // entry rule with group + list assignment
    expect(ast.rules[0]!.name).toBe('Model')
    expect(ast.rules[0]!.isEntry).toBe(true)
    const modelGroup = ast.rules[0]!.body.alternatives[0]!.elements[0]! as Group
    expect(modelGroup.kind).toBe('group')
    expect(modelGroup.cardinality).toBe('*')

    // BinaryExpr has a precedence annotation as its last element
    const binSeq = ast.rules[2]!.body.alternatives[0]!
    const lastElem = binSeq.elements[binSeq.elements.length - 1]! as PrecedenceAnnotation
    expect(lastElem).toEqual({ kind: 'prec', precedenceType: 'left', value: 1 })

    // Expression is a pure alternation rule
    expect(ast.rules[3]!.name).toBe('Expression')
    expect(ast.rules[3]!.body.alternatives).toHaveLength(2)

    // terminals
    expect(ast.terminals[0]!.name).toBe('WS')
    expect(ast.terminals[0]!.isHidden).toBe(true)
    expect(ast.terminals[1]!.name).toBe('ID')
    expect(ast.terminals[1]!.isHidden).toBe(false)
  })

  it('throws ParseError when grammar keyword is missing', () => {
    expect(() => parseGrammar('MyLang { }')).toThrow(ParseError)
  })

  it('throws ParseError for a rule missing its semicolon', () => {
    expect(() => parseGrammar("grammar G\nFoo: 'x'")).toThrow(ParseError)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `pnpm --filter @trellis/cli test`

Expected: FAIL — `Cannot find module '../src/parser.js'`

- [ ] **Step 3: Implement the parser**

Create `packages/cli/src/parser.ts`:
```ts
import { tokenize, LexError, type Token, type TokenKind } from './lexer.js'
import type {
  GrammarAst, ParserRule, TerminalRule, Cardinality,
  Alternatives, Sequence, RuleElement,
  Assignment, AssignmentTerminal,
  CrossReference, UnassignedRuleCall, Keyword, Group, PrecedenceAnnotation
} from './grammar-ast.js'

export { LexError }

export class ParseError extends Error {
  constructor(message: string, public readonly offset: number) {
    super(message)
    this.name = 'ParseError'
  }
}

export function parseGrammar(input: string): GrammarAst {
  const tokens = tokenize(input)
  return new Parser(tokens).parseGrammar()
}

class Parser {
  private pos = 0

  constructor(private readonly tokens: Token[]) {}

  private peek(): Token {
    return this.tokens[this.pos]!
  }

  private advance(): Token {
    return this.tokens[this.pos++]!
  }

  private expect(kind: TokenKind): Token {
    const tok = this.peek()
    if (tok.kind !== kind) {
      throw new ParseError(
        `Expected '${kind}' but got '${tok.kind}' ("${tok.value}")`,
        tok.offset
      )
    }
    return this.advance()
  }

  private check(kind: TokenKind): boolean {
    return this.peek().kind === kind
  }

  private match(...kinds: TokenKind[]): boolean {
    return kinds.includes(this.peek().kind)
  }

  parseGrammar(): GrammarAst {
    this.expect('kw_grammar')
    const name = this.expect('ident').value
    let word: string | undefined
    let conflicts: string[][] | undefined
    const rules: ParserRule[] = []
    const terminals: TerminalRule[] = []

    while (!this.check('eof')) {
      if (this.check('kw_word')) {
        word = this.parseWordDecl()
      } else if (this.check('kw_conflicts')) {
        conflicts = this.parseConflictsDecl()
      } else if (this.check('kw_hidden') || this.check('kw_terminal')) {
        terminals.push(this.parseTerminalRule())
      } else if (this.check('kw_entry') || this.check('ident')) {
        rules.push(this.parseParserRule())
      } else {
        const tok = this.peek()
        throw new ParseError(`Unexpected token '${tok.kind}' ("${tok.value}")`, tok.offset)
      }
    }

    return { name, word, conflicts, rules, terminals }
  }

  private parseWordDecl(): string {
    this.expect('kw_word')
    this.expect('colon')
    const name = this.expect('ident').value
    this.expect('semi')
    return name
  }

  private parseConflictsDecl(): string[][] {
    this.expect('kw_conflicts')
    this.expect('colon')
    this.expect('lbracket')
    const groups: string[][] = []
    while (!this.check('rbracket') && !this.check('eof')) {
      if (groups.length > 0) this.expect('comma')
      this.expect('lbracket')
      const group: string[] = [this.expect('ident').value]
      while (this.check('comma')) {
        this.advance()
        group.push(this.expect('ident').value)
      }
      this.expect('rbracket')
      groups.push(group)
    }
    this.expect('rbracket')
    this.expect('semi')
    return groups
  }

  private parseTerminalRule(): TerminalRule {
    const isHidden = this.check('kw_hidden')
    if (isHidden) this.advance()
    this.expect('kw_terminal')
    const name = this.expect('ident').value
    this.expect('colon')
    const regex = this.expect('regex').value
    this.expect('semi')
    return { name, isHidden, regex }
  }

  private parseParserRule(): ParserRule {
    const isEntry = this.check('kw_entry')
    if (isEntry) this.advance()
    const name = this.expect('ident').value
    this.expect('colon')
    const body = this.parseAlternatives()
    this.expect('semi')
    return { name, isEntry, body }
  }

  private parseAlternatives(): Alternatives {
    const alternatives: Sequence[] = [this.parseSequence()]
    while (this.check('pipe')) {
      this.advance()
      alternatives.push(this.parseSequence())
    }
    return { kind: 'alternatives', alternatives }
  }

  private parseSequence(): Sequence {
    const elements: RuleElement[] = []
    while (!this.match('pipe', 'semi', 'rparen', 'eof')) {
      elements.push(this.parseElement())
    }
    return { kind: 'sequence', elements }
  }

  private parseElement(): RuleElement {
    if (this.check('at')) return this.parsePrecAnnotation()

    if (this.check('lparen')) return this.parseGroup()

    if (this.check('lbracket')) return this.parseCrossRef()

    if (this.check('string')) {
      const value = this.advance().value
      const cardinality = this.parseCardinality()
      const kw: Keyword = { kind: 'keyword', value }
      if (cardinality) kw.cardinality = cardinality
      return kw
    }

    if (this.check('ident')) {
      const name = this.advance().value
      if (this.match('eq', 'plus_eq', 'question_eq')) {
        return this.finishAssignment(name)
      }
      const cardinality = this.parseCardinality()
      const rc: UnassignedRuleCall = { kind: 'rule-call', rule: name }
      if (cardinality) rc.cardinality = cardinality
      return rc
    }

    const tok = this.peek()
    throw new ParseError(
      `Unexpected token in rule body: '${tok.kind}' ("${tok.value}")`,
      tok.offset
    )
  }

  private finishAssignment(feature: string): Assignment {
    const opTok = this.advance()
    const operator = opTok.value as '=' | '+=' | '?='
    const terminal = this.parseAssignmentTerminal()
    return { kind: 'assignment', feature, operator, terminal }
  }

  private parseAssignmentTerminal(): AssignmentTerminal {
    if (this.check('lbracket')) return this.parseCrossRef()
    if (this.check('lparen')) return this.parseGroup()
    if (this.check('string')) {
      return { kind: 'keyword', value: this.advance().value }
    }
    if (this.check('ident')) {
      return { kind: 'rule-call', rule: this.advance().value }
    }
    const tok = this.peek()
    throw new ParseError(`Expected assignment terminal but got '${tok.kind}'`, tok.offset)
  }

  private parseCrossRef(): CrossReference {
    this.expect('lbracket')
    const isMulti = this.check('plus')
    if (isMulti) this.advance()
    const type = this.expect('ident').value
    this.expect('colon')
    const terminal = this.expect('ident').value
    this.expect('rbracket')
    return { kind: 'cross-ref', type, terminal, isMulti }
  }

  private parseGroup(): Group {
    this.expect('lparen')
    const body = this.parseAlternatives()
    this.expect('rparen')
    const cardinality = this.parseCardinality()
    const group: Group = { kind: 'group', body }
    if (cardinality) group.cardinality = cardinality
    return group
  }

  private parsePrecAnnotation(): PrecedenceAnnotation {
    this.expect('at')
    const precTok = this.peek()
    if (precTok.kind !== 'ident' || precTok.value !== 'prec') {
      throw new ParseError(
        `Expected 'prec' after '@' but got '${precTok.value}'`,
        precTok.offset
      )
    }
    this.advance()
    let precedenceType: 'default' | 'left' | 'right' | 'dynamic' = 'default'
    if (this.check('dot')) {
      this.advance()
      const typeTok = this.expect('ident')
      if (typeTok.value !== 'left' && typeTok.value !== 'right' && typeTok.value !== 'dynamic') {
        throw new ParseError(`Unknown precedence type: '${typeTok.value}'`, typeTok.offset)
      }
      precedenceType = typeTok.value as 'left' | 'right' | 'dynamic'
    }
    this.expect('lparen')
    const value = parseInt(this.expect('number').value, 10)
    this.expect('rparen')
    return { kind: 'prec', precedenceType, value }
  }

  private parseCardinality(): Cardinality | undefined {
    if (this.check('question')) { this.advance(); return '?' }
    if (this.check('star')) { this.advance(); return '*' }
    if (this.check('plus')) { this.advance(); return '+' }
    return undefined
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `pnpm --filter @trellis/cli test`

Expected: All 28 tests PASS (19 lexer + 28 parser... wait, count: grammar name, word, conflicts x2, terminal, hidden terminal, keyword rule, entry rule, plain assignment, list assignment, bool flag, cross-ref, multi cross-ref, group *, group +, group ?, assignment+group terminal, rule-call+cardinality, keyword+cardinality, pure alternation, prec default, prec.left, prec.right, prec.dynamic, full mini-grammar, ParseError missing keyword, ParseError missing semi = 27 parser tests). All 19 + 27 = 46 total tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/parser.ts packages/cli/test/parser.test.ts
git commit -m "feat(@trellis/cli): add recursive-descent grammar parser with ParseError"
```

---

## Task 4: Wire Up and Final Verification

**Files:**
- Modify: `packages/cli/src/index.ts`

- [ ] **Step 1: Update index.ts exports**

Replace the contents of `packages/cli/src/index.ts` with:
```ts
export * from './grammar-ast.js'
export * from './parser.js'
```

(This re-exports `GrammarAst` and all its constituent types from `grammar-ast.ts`, plus `parseGrammar`, `ParseError`, and `LexError` from `parser.ts`.)

- [ ] **Step 2: Build the cli package**

Run: `pnpm --filter @trellis/cli build`

Expected: Zero TypeScript errors. `packages/cli/dist/` is fully built including `index.js`, `grammar-ast.js`, `lexer.js`, `parser.js` and their declaration files.

- [ ] **Step 3: Run the full test suite**

Run: `pnpm --filter @trellis/cli test`

Expected: All 46 tests PASS. Zero failures.

- [ ] **Step 4: Verify the workspace root test command still passes**

Run: `pnpm test`

Expected: All packages pass (core has 30 tests, cli has 46). Zero failures workspace-wide.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/index.ts
git commit -m "feat(@trellis/cli): wire up public exports; grammar parser complete"
```

---

## Self-Review

### Spec coverage

| `docs/spec.md` requirement | Covered by |
|---|---|
| Grammar declaration `grammar NAME` | Task 3 — `parseGrammar()` |
| `word: ID;` tree-sitter word rule | Task 3 — `parseWordDecl()` |
| `conflicts: [[A, B]];` explicit ambiguity | Task 3 — `parseConflictsDecl()` |
| `entry` rule modifier | Task 3 — `parseParserRule()` |
| Parser rules with assignments (`=`, `+=`, `?=`) | Task 3 — `finishAssignment()` |
| Cross-references `[Type:TOKEN]` and `[+Type:TOKEN]` | Task 3 — `parseCrossRef()` |
| Groups with cardinality `(body)?`, `(body)*`, `(body)+` | Task 3 — `parseGroup()` |
| Pure alternation rules (inferred supertypes) | Task 3 — `parseAlternatives()` produces multi-alt body |
| Hidden terminal rules | Task 3 — `parseTerminalRule()` |
| Regular terminal rules | Task 3 — `parseTerminalRule()` |
| Precedence annotations `@prec(n)`, `@prec.left(n)`, `@prec.right(n)`, `@prec.dynamic(n)` | Task 3 — `parsePrecAnnotation()` |
| Comments (single-line `//`, multi-line `/* */`) | Task 2 — lexer |
| `@trellis/cli` package scaffolded in Plan 1 | Pre-existing |

No spec requirement is left unimplemented.

### Placeholder scan

No TBD, TODO, "similar to", or vague "add error handling" patterns. Every step contains complete code.

### Type consistency

- `GrammarAst`, `ParserRule`, `TerminalRule` — defined in `grammar-ast.ts`; produced by `parseGrammar()` in `parser.ts`; verified by parser tests
- `Alternatives { kind: 'alternatives', alternatives: Sequence[] }` — `ParserRule.body` is `Alternatives`; tests navigate `.body.alternatives[0]!.elements[0]!`
- `Sequence { kind: 'sequence', elements: RuleElement[] }` — `Alternatives.alternatives` entries; tests access `.elements[0]`
- `Assignment { kind: 'assignment', feature, operator, terminal }` — `finishAssignment()` returns this; parser tests use `as Assignment` cast and check all three fields
- `CrossReference { kind: 'cross-ref', type, terminal, isMulti }` — `parseCrossRef()` returns this; field named `terminal` (the token rule name, e.g. `'ID'`) — not confused with `AssignmentTerminal`
- `UnassignedRuleCall { kind: 'rule-call', rule, cardinality? }` — both as `RuleElement` and as `AssignmentTerminal`; `terminal` field in `Assignment` is typed `AssignmentTerminal` which includes this
- `Group { kind: 'group', body: Alternatives, cardinality? }` — `parseGroup()` returns this; tests check `elem.kind === 'group'` and `elem.cardinality`
- `PrecedenceAnnotation { kind: 'prec', precedenceType, value }` — `parsePrecAnnotation()` returns this; tests cast as `PrecedenceAnnotation` and check all three fields
- `Cardinality = '?' | '*' | '+'` — used in `UnassignedRuleCall`, `Keyword`, `Group`; parsed by `parseCardinality()`; `Assignment` does NOT have cardinality (operator already implies repeat semantics for `+=`)
- `LexError` — thrown by `tokenize()` in `lexer.ts`; re-exported by `parser.ts`; tested in `lexer.test.ts`
- `ParseError` — thrown by `Parser` class methods; exported by `parser.ts`; tested in `parser.test.ts`

---

## Subsequent Plans

- **Plan 3: `@trellis/cli` — Code Generator** — consume `GrammarAst`, emit `grammar.js` (tree-sitter DSL) + TypeScript wrappers into `src/generated/`
- **Plan 4: `@trellis/testing`** — implement `parseHelper`, `linkHelper`, `lspHelper` using the generated artifacts
