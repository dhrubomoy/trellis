# @trellis/cli Code Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `trellis generate` command that reads a `.trellis` grammar file and emits `grammar.js` (tree-sitter DSL) and `ast.ts` (typed TypeScript wrapper classes) into `src/generated/` next to the grammar file.

**Architecture:** Five source files: `to-snake-case.ts` (naming utility), `emit-grammar-js.ts` (string-template emitter for tree-sitter DSL), `emit-ast-ts.ts` (string-template emitter for TypeScript wrappers), `generator.ts` (orchestrator that calls both emitters and writes files), and `cli.ts` (commander entry point). Each emitter takes a `GrammarAst` and returns a string. No Stage 1 (`tree-sitter generate` subprocess) in this plan — just file emission.

**Tech Stack:** TypeScript 5.x, pnpm workspaces (existing), vitest 2.x, commander ^12.0.0

---

## File Structure

### New files
- Create: `packages/cli/src/to-snake-case.ts` — `toSnakeCase(name: string): string` utility
- Create: `packages/cli/src/emit-grammar-js.ts` — `emitGrammarJs(ast: GrammarAst): string`
- Create: `packages/cli/src/emit-ast-ts.ts` — `emitAstTs(ast: GrammarAst): string`
- Create: `packages/cli/src/generator.ts` — `generateGrammarFiles(ast: GrammarAst, outDir: string): void`
- Create: `packages/cli/src/cli.ts` — commander entry point with `#!/usr/bin/env node`
- Create: `packages/cli/test/to-snake-case.test.ts`
- Create: `packages/cli/test/emit-grammar-js.test.ts`
- Create: `packages/cli/test/emit-ast-ts.test.ts`

### Modified files
- Modify: `packages/cli/src/index.ts` — add emitter and generator re-exports
- Modify: `packages/cli/package.json` — add `commander` dependency; update `bin` to `./dist/cli.js`

---

## Key design decisions (agreed during planning)

- **`+=` assignment** emits `field('feature', $.rule)` — no `repeat()`. The repeat comes from the surrounding group cardinality (e.g. `(elements+=Element)*` → `repeat(field('elements', $.element))`). This avoids double-wrapping.
- **Pure alternation rules** (every alternative is a single rule-call) are auto-detected and listed in `supertypes`.
- **Cross-reference properties** read the live link table on every access — not memoized, because the link table is updated incrementally.
- **Structural properties** (`=`, `+=`, `?=`) are memoized with `??=`.
- **Entry rule** gets an exported `createRootNode(tree, ctx)` factory function.
- **Terminal vs parser rule** distinction is resolved at emit time by checking `ast.terminals`.

---

## Task 1: `to-snake-case.ts` + `commander` dependency

**Files:**
- Create: `packages/cli/src/to-snake-case.ts`
- Create: `packages/cli/test/to-snake-case.test.ts`
- Modify: `packages/cli/package.json`

- [ ] **Step 1: Update `package.json`**

Replace the contents of `packages/cli/package.json`:

```json
{
  "name": "@trellis/cli",
  "version": "0.0.1",
  "type": "module",
  "bin": {
    "trellis": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@trellis/core": "workspace:*",
    "commander": "^12.0.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

Run: `pnpm install`

Expected: `commander` installed in `node_modules`.

- [ ] **Step 2: Write failing tests**

Create `packages/cli/test/to-snake-case.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { toSnakeCase } from '../src/to-snake-case.js'

describe('toSnakeCase', () => {
  it('converts PascalCase to snake_case', () => {
    expect(toSnakeCase('TypeRef')).toBe('type_ref')
    expect(toSnakeCase('BinaryExpr')).toBe('binary_expr')
    expect(toSnakeCase('Model')).toBe('model')
  })

  it('groups consecutive capitals correctly', () => {
    expect(toSnakeCase('HTMLParser')).toBe('html_parser')
  })

  it('lowercases screaming-snake terminal names', () => {
    expect(toSnakeCase('SL_COMMENT')).toBe('sl_comment')
    expect(toSnakeCase('ML_COMMENT')).toBe('ml_comment')
    expect(toSnakeCase('ID')).toBe('id')
    expect(toSnakeCase('WS')).toBe('ws')
  })

  it('handles single-word PascalCase', () => {
    expect(toSnakeCase('Literal')).toBe('literal')
    expect(toSnakeCase('Expression')).toBe('expression')
  })
})
```

- [ ] **Step 3: Run tests to confirm they fail**

Run: `pnpm --filter @trellis/cli test`

Expected: FAIL — `Cannot find module '../src/to-snake-case.js'`

- [ ] **Step 4: Implement `to-snake-case.ts`**

Create `packages/cli/src/to-snake-case.ts`:

```ts
export function toSnakeCase(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase()
}
```

- [ ] **Step 5: Run tests to confirm they pass**

Run: `pnpm --filter @trellis/cli test`

Expected: All tests PASS (previously passing lexer/parser tests + new `toSnakeCase` tests).

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/to-snake-case.ts packages/cli/test/to-snake-case.test.ts packages/cli/package.json pnpm-lock.yaml
git commit -m "feat(@trellis/cli): add toSnakeCase utility and commander dependency"
```

---

## Task 2: `emit-grammar-js.ts`

Walks a `GrammarAst` and produces the `grammar.js` string using tree-sitter's JavaScript DSL.

Key mappings:
- Grammar-level: `name`, `word`, hidden terminals → `extras`, `conflicts`, pure-alternation rules → `supertypes`
- Parser rules → `ruleName: $ => <body>` entries using `toSnakeCase`
- Terminal rules → `terminalName: $ => /regex/` entries
- `Alternatives` with 1 branch → emit the sequence directly; with N branches → `choice(...)`
- `Sequence` with 1 element → emit the element directly; with N → `seq(...)`
- `PrecedenceAnnotation` in a sequence → filter it out from elements, wrap the body in `prec(n, ...)` / `prec.left(n, ...)` / `prec.right(n, ...)` / `prec.dynamic(n, ...)`
- `Assignment =` → `field('feature', <terminal>)`
- `Assignment +=` → `field('feature', <terminal>)` — **no repeat here**; repeat comes from surrounding group cardinality
- `Assignment ?=` → `field('feature', optional(<terminal>))`
- `Group` with cardinality → `optional(body)` / `repeat(body)` / `repeat1(body)`
- `CrossReference` as a standalone element → `$.terminalName`
- `CrossReference` as an assignment terminal → `$.terminalName`
- `Group` as an assignment terminal → emit its `Alternatives` (the group's cardinality is ignored here; only used as an inline choice)

**Files:**
- Create: `packages/cli/test/emit-grammar-js.test.ts`
- Create: `packages/cli/src/emit-grammar-js.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/cli/test/emit-grammar-js.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `pnpm --filter @trellis/cli test`

Expected: FAIL — `Cannot find module '../src/emit-grammar-js.js'`

- [ ] **Step 3: Implement `emit-grammar-js.ts`**

Create `packages/cli/src/emit-grammar-js.ts`:

```ts
import type {
  GrammarAst, ParserRule, Alternatives, Sequence, RuleElement,
  Assignment, AssignmentTerminal, PrecedenceAnnotation
} from './grammar-ast.js'
import { toSnakeCase } from './to-snake-case.js'

export function emitGrammarJs(ast: GrammarAst): string {
  const hiddenTerminals = ast.terminals.filter(t => t.isHidden)
  const supertypeNames = ast.rules
    .filter(isPureAlternation)
    .map(r => toSnakeCase(r.name))

  const parts: string[] = [
    `module.exports = grammar({`,
    `  name: '${toSnakeCase(ast.name)}',`,
  ]

  if (ast.word) {
    parts.push(``, `  word: $ => $.${toSnakeCase(ast.word)},`)
  }

  if (hiddenTerminals.length > 0) {
    parts.push(``, `  extras: $ => [`)
    for (const t of hiddenTerminals) parts.push(`    $.${toSnakeCase(t.name)},`)
    parts.push(`  ],`)
  }

  if (ast.conflicts && ast.conflicts.length > 0) {
    parts.push(``, `  conflicts: $ => [`)
    for (const group of ast.conflicts) {
      parts.push(`    [${group.map(n => `$.${toSnakeCase(n)}`).join(', ')}],`)
    }
    parts.push(`  ],`)
  }

  if (supertypeNames.length > 0) {
    parts.push(``, `  supertypes: $ => [`)
    for (const name of supertypeNames) parts.push(`    $.${name},`)
    parts.push(`  ],`)
  }

  parts.push(``, `  rules: {`)

  for (const rule of ast.rules) {
    const body = emitAlternatives(rule.body, `    `)
    parts.push(`    ${toSnakeCase(rule.name)}: $ => ${body},`, ``)
  }

  for (const terminal of ast.terminals) {
    parts.push(`    ${toSnakeCase(terminal.name)}: $ => /${terminal.regex}/,`, ``)
  }

  while (parts[parts.length - 1] === ``) parts.pop()
  parts.push(`  }`, `})`)

  return parts.join('\n') + '\n'
}

function isPureAlternation(rule: ParserRule): boolean {
  return (
    rule.body.alternatives.length > 1 &&
    rule.body.alternatives.every(
      alt => alt.elements.length === 1 && alt.elements[0]!.kind === 'rule-call'
    )
  )
}

function emitAlternatives(alts: Alternatives, indent: string): string {
  if (alts.alternatives.length === 1) return emitSequence(alts.alternatives[0]!, indent)
  const inner = `${indent}  `
  const choices = alts.alternatives.map(a => emitSequence(a, inner)).join(`,\n${inner}`)
  return `choice(\n${inner}${choices}\n${indent})`
}

function emitSequence(seq: Sequence, indent: string): string {
  const annotation = seq.elements.find((e): e is PrecedenceAnnotation => e.kind === 'prec')
  const elems = seq.elements.filter(e => e.kind !== 'prec')

  let body: string
  if (elems.length === 1) {
    body = emitElement(elems[0]!, indent)
  } else {
    const inner = `${indent}  `
    const items = elems.map(e => emitElement(e, inner)).join(`,\n${inner}`)
    body = `seq(\n${inner}${items}\n${indent})`
  }

  if (!annotation) return body
  const fn = annotation.precedenceType === 'default' ? 'prec' : `prec.${annotation.precedenceType}`
  return `${fn}(${annotation.value}, ${body})`
}

function emitElement(elem: RuleElement, indent: string): string {
  switch (elem.kind) {
    case 'keyword':
      return withCardinality(`'${elem.value}'`, elem.cardinality)
    case 'rule-call':
      return withCardinality(`$.${toSnakeCase(elem.rule)}`, elem.cardinality)
    case 'assignment':
      return emitAssignment(elem, indent)
    case 'group':
      return withCardinality(emitAlternatives(elem.body, `${indent}  `), elem.cardinality)
    case 'cross-ref':
      return `$.${toSnakeCase(elem.terminal)}`
    case 'prec':
      return ''
  }
}

function emitAssignment(assign: Assignment, indent: string): string {
  const terminal = emitAssignmentTerminal(assign.terminal, indent)
  switch (assign.operator) {
    case '=':  return `field('${assign.feature}', ${terminal})`
    case '+=': return `field('${assign.feature}', ${terminal})`
    case '?=': return `field('${assign.feature}', optional(${terminal}))`
  }
}

function emitAssignmentTerminal(terminal: AssignmentTerminal, indent: string): string {
  switch (terminal.kind) {
    case 'keyword':   return `'${terminal.value}'`
    case 'rule-call': return `$.${toSnakeCase(terminal.rule)}`
    case 'cross-ref': return `$.${toSnakeCase(terminal.terminal)}`
    case 'group':     return emitAlternatives(terminal.body, indent)
  }
}

function withCardinality(base: string, cardinality: string | undefined): string {
  if (cardinality === '?') return `optional(${base})`
  if (cardinality === '*') return `repeat(${base})`
  if (cardinality === '+') return `repeat1(${base})`
  return base
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `pnpm --filter @trellis/cli test`

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/emit-grammar-js.ts packages/cli/test/emit-grammar-js.test.ts
git commit -m "feat(@trellis/cli): add grammar.js emitter"
```

---

## Task 3: `emit-ast-ts.ts`

Generates one TypeScript class per parser rule. Assignments become typed property getters.

Key rules:
- `=` with a **terminal** rule (name in `ast.terminals`) → `string` getter using `.text`, memoized
- `=` with a **parser** rule → typed wrapper getter, memoized with `??=`
- `+=` with a terminal → `string[]` getter using `.map(n => n.text)`, memoized
- `+=` with a parser rule → wrapper array getter, memoized with `??=`
- `?=` → `boolean` getter, memoized with `??=`
- `=` with a **cross-reference** → `TypeNode | undefined` getter reading the live link table — **not memoized**
- `=` with a **group** terminal (inline keyword alternatives) → `string` getter using `.text`, memoized
- Assignments nested inside groups are collected recursively
- Same feature name appearing in multiple alternatives is deduplicated (first occurrence wins)
- Entry rule gets an exported `createRootNode(tree: Tree, ctx: TrellisContext): EntryNode` factory

**Files:**
- Create: `packages/cli/test/emit-ast-ts.test.ts`
- Create: `packages/cli/src/emit-ast-ts.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/cli/test/emit-ast-ts.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `pnpm --filter @trellis/cli test`

Expected: FAIL — `Cannot find module '../src/emit-ast-ts.js'`

- [ ] **Step 3: Implement `emit-ast-ts.ts`**

Create `packages/cli/src/emit-ast-ts.ts`:

```ts
import type {
  GrammarAst, ParserRule, Alternatives, RuleElement,
  Assignment, AssignmentTerminal
} from './grammar-ast.js'

export function emitAstTs(ast: GrammarAst): string {
  const terminalNames = new Set(ast.terminals.map(t => t.name))
  const entryRule = ast.rules.find(r => r.isEntry)

  const parts: string[] = [
    `import type { SyntaxNode, Tree } from 'tree-sitter'`,
    `import type { TrellisContext } from '@trellis/core'`,
    ``,
  ]

  for (const rule of ast.rules) {
    parts.push(...emitRuleClass(rule, terminalNames), ``)
  }

  if (entryRule) {
    const cls = `${entryRule.name}Node`
    parts.push(
      `export function createRootNode(tree: Tree, ctx: TrellisContext): ${cls} {`,
      `  return new ${cls}(tree.rootNode, ctx)`,
      `}`,
      ``,
    )
  }

  return parts.join('\n')
}

function emitRuleClass(rule: ParserRule, terminalNames: Set<string>): string[] {
  const className = `${rule.name}Node`
  const assignments = collectAssignments(rule.body)
  const structural = assignments.filter(a => a.terminal.kind !== 'cross-ref')
  const crossRefs = assignments.filter(a => a.terminal.kind === 'cross-ref')

  const lines: string[] = [`export class ${className} {`]

  for (const assign of structural) {
    lines.push(`  private _${assign.feature}: ${memoType(assign, terminalNames)} | undefined`)
  }
  if (structural.length > 0) lines.push(``)

  lines.push(`  constructor(readonly tsNode: SyntaxNode, readonly ctx: TrellisContext) {}`)

  for (const assign of structural) {
    lines.push(``, ...emitStructuralGetter(assign, terminalNames))
  }
  for (const assign of crossRefs) {
    lines.push(``, ...emitCrossRefGetter(assign))
  }

  lines.push(`}`)
  return lines
}

function collectAssignments(alts: Alternatives): Assignment[] {
  const seen = new Set<string>()
  const result: Assignment[] = []

  function walk(elems: RuleElement[]): void {
    for (const e of elems) {
      if (e.kind === 'assignment') {
        if (!seen.has(e.feature)) { seen.add(e.feature); result.push(e) }
      } else if (e.kind === 'group') {
        walk(e.body.alternatives.flatMap(a => a.elements))
      }
    }
  }

  walk(alts.alternatives.flatMap(a => a.elements))
  return result
}

function memoType(assign: Assignment, terminalNames: Set<string>): string {
  if (assign.operator === '?=') return 'boolean'
  const base = elementTsType(assign.terminal, terminalNames)
  return assign.operator === '+=' ? `${base}[]` : base
}

function elementTsType(terminal: AssignmentTerminal, terminalNames: Set<string>): string {
  switch (terminal.kind) {
    case 'keyword':   return 'string'
    case 'group':     return 'string'
    case 'cross-ref': return `${terminal.type}Node`
    case 'rule-call': return terminalNames.has(terminal.rule) ? 'string' : `${terminal.rule}Node`
  }
}

function emitStructuralGetter(assign: Assignment, terminalNames: Set<string>): string[] {
  const retType = memoType(assign, terminalNames)

  if (assign.operator === '?=') {
    return [
      `  get ${assign.feature}(): boolean {`,
      `    return this._${assign.feature} ??= this.tsNode.childForFieldName('${assign.feature}') !== null`,
      `  }`,
    ]
  }

  if (assign.operator === '+=') {
    const t = assign.terminal
    const isTerminal = t.kind === 'rule-call' && terminalNames.has(t.rule)
    const mapExpr = isTerminal
      ? `n => n.text`
      : `n => new ${elementTsType(t, terminalNames)}(n, this.ctx)`
    return [
      `  get ${assign.feature}(): ${retType} {`,
      `    return this._${assign.feature} ??= this.tsNode.childrenForFieldName('${assign.feature}').map(${mapExpr})`,
      `  }`,
    ]
  }

  // '=' operator
  const t = assign.terminal
  if (t.kind === 'rule-call' && !terminalNames.has(t.rule)) {
    return [
      `  get ${assign.feature}(): ${retType} {`,
      `    return this._${assign.feature} ??= new ${retType}(this.tsNode.childForFieldName('${assign.feature}')!, this.ctx)`,
      `  }`,
    ]
  }

  return [
    `  get ${assign.feature}(): string {`,
    `    return this._${assign.feature} ??= this.tsNode.childForFieldName('${assign.feature}')!.text`,
    `  }`,
  ]
}

function emitCrossRefGetter(assign: Assignment): string[] {
  if (assign.terminal.kind !== 'cross-ref') return []
  const targetClass = `${assign.terminal.type}Node`
  return [
    `  get ${assign.feature}(): ${targetClass} | undefined {`,
    `    const resolved = this.ctx.linkTable.resolve(this.tsNode)`,
    `    return resolved ? new ${targetClass}(resolved, this.ctx) : undefined`,
    `  }`,
  ]
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `pnpm --filter @trellis/cli test`

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/emit-ast-ts.ts packages/cli/test/emit-ast-ts.test.ts
git commit -m "feat(@trellis/cli): add ast.ts emitter with typed wrapper classes"
```

---

## Task 4: Wire up — `generator.ts`, `cli.ts`, exports, build

**Files:**
- Create: `packages/cli/src/generator.ts`
- Create: `packages/cli/src/cli.ts`
- Modify: `packages/cli/src/index.ts`

- [ ] **Step 1: Implement `generator.ts`**

Create `packages/cli/src/generator.ts`:

```ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { GrammarAst } from './grammar-ast.js'
import { emitGrammarJs } from './emit-grammar-js.js'
import { emitAstTs } from './emit-ast-ts.js'

export function generateGrammarFiles(ast: GrammarAst, outDir: string): void {
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'grammar.js'), emitGrammarJs(ast), 'utf-8')
  writeFileSync(join(outDir, 'ast.ts'), emitAstTs(ast), 'utf-8')
}
```

- [ ] **Step 2: Implement `cli.ts`**

Create `packages/cli/src/cli.ts`:

```ts
#!/usr/bin/env node
import { program } from 'commander'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { parseGrammar } from './parser.js'
import { generateGrammarFiles } from './generator.js'

program
  .name('trellis')
  .description('Trellis LSP generator')

program
  .command('generate <grammar-file>')
  .description('Generate grammar.js and ast.ts from a .trellis grammar file')
  .action((grammarFile: string) => {
    const filePath = resolve(grammarFile)
    const input = readFileSync(filePath, 'utf-8')
    const ast = parseGrammar(input)
    const outDir = join(dirname(filePath), 'src', 'generated')
    generateGrammarFiles(ast, outDir)
    console.log(`Generated files in ${outDir}`)
  })

program.parse()
```

- [ ] **Step 3: Update `index.ts` exports**

Replace the contents of `packages/cli/src/index.ts`:

```ts
export * from './grammar-ast.js'
export * from './parser.js'
export * from './to-snake-case.js'
export * from './emit-grammar-js.js'
export * from './emit-ast-ts.js'
export * from './generator.js'
```

- [ ] **Step 4: Build the package**

Run: `pnpm --filter @trellis/cli build`

Expected: Zero TypeScript errors. `packages/cli/dist/` contains `cli.js`, `generator.js`, `emit-grammar-js.js`, `emit-ast-ts.js`, `to-snake-case.js`, and all `.d.ts` declaration files.

- [ ] **Step 5: Run the full test suite**

Run: `pnpm --filter @trellis/cli test`

Expected: All tests PASS.

- [ ] **Step 6: Smoke-test the CLI**

```bash
cat > /tmp/test.trellis << 'EOF'
grammar TestLang
entry Model: name=ID;
terminal ID: /[a-zA-Z_]+/;
EOF

node packages/cli/dist/cli.js generate /tmp/test.trellis
cat /tmp/src/generated/grammar.js
cat /tmp/src/generated/ast.ts
```

Expected:
- `grammar.js` starts with `module.exports = grammar({` and contains `name: 'test_lang'`
- `ast.ts` contains `export class ModelNode` with a `get name(): string` getter
- `ast.ts` contains `export function createRootNode(`

- [ ] **Step 7: Verify workspace tests pass**

Run: `pnpm test`

Expected: All packages pass. Zero failures workspace-wide.

- [ ] **Step 8: Commit**

```bash
git add packages/cli/src/generator.ts packages/cli/src/cli.ts packages/cli/src/index.ts
git commit -m "feat(@trellis/cli): wire up generator orchestrator and trellis generate CLI command"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Covered by |
|---|---|
| `trellis generate` command reads `.trellis` file | Task 4 — `cli.ts` |
| Stage 1: emit `grammar.js` (tree-sitter DSL) | Task 2 — `emit-grammar-js.ts` |
| Stage 2: emit `ast.ts` (typed wrapper classes) | Task 3 — `emit-ast-ts.ts` |
| Output goes to `src/generated/` next to grammar file | Task 4 — `generator.ts` |
| Wrapper classes read tree-sitter nodes on demand | Task 3 — property getters use `childForFieldName` / `childrenForFieldName` |
| Property access memoized on first read | Task 3 — `??=` on all structural getters |
| Cross-reference lookup via link table | Task 3 — `emitCrossRefGetter` reads `ctx.linkTable.resolve` |
| Pure alternation rules inferred as supertypes | Task 2 — `isPureAlternation` + `supertypes` block |
| PascalCase → snake_case rule naming | Task 1 — `toSnakeCase` |
| Hidden terminals → `extras` | Task 2 — `extras` block |
| `word` declaration | Task 2 — `word` field |
| `conflicts` declaration | Task 2 — `conflicts` block |
| Precedence annotations `@prec(n)`, `@prec.left(n)`, `@prec.right(n)`, `@prec.dynamic(n)` | Task 2 — `emitSequence` wraps with appropriate `prec.*` call |
| `createRootNode` factory for entry rule | Task 3 — emitted by `emitAstTs` |

### Placeholder scan

No TBD, TODO, "similar to", or vague statements. Every step has complete, runnable code.

### Type consistency

- `toSnakeCase(name: string): string` — defined Task 1; imported in `emit-grammar-js.ts` (Task 2) — names match
- `emitGrammarJs(ast: GrammarAst): string` — defined Task 2; called in `generator.ts` (Task 4) — signature matches
- `emitAstTs(ast: GrammarAst): string` — defined Task 3; called in `generator.ts` (Task 4) — signature matches
- `generateGrammarFiles(ast: GrammarAst, outDir: string): void` — defined Task 4 `generator.ts`; called in `cli.ts` (Task 4) — signature matches
- `collectAssignments(alts: Alternatives): Assignment[]` — internal to `emit-ast-ts.ts`; `Alternatives` is from `grammar-ast.ts`
- `memoType(assign: Assignment, terminalNames: Set<string>): string` — internal; return value used as both the private field type suffix and the getter return type
- `elementTsType(terminal: AssignmentTerminal, terminalNames: Set<string>): string` — internal; called from `memoType` and `emitStructuralGetter`
- `emitCrossRefGetter(assign: Assignment): string[]` — guards `assign.terminal.kind !== 'cross-ref'` before accessing `assign.terminal.type`

---

## Subsequent Plans

- **Plan 4: `@trellis/testing`** — implement `parseHelper`, `linkHelper`, `lspHelper` using generated artifacts
- **Plan 5: Stage 1** — run `tree-sitter generate` subprocess from `trellis generate`; make generated language servers functional end-to-end
