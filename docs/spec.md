# Trellis — Architecture Specification

## Overview

Trellis is a TypeScript LSP generator tool similar to langium. You define a grammar in a `.trellis` file and trellis generates a tree-sitter parser, typed AST wrappers, a scope resolver, and default LSP service implementations — all in TypeScript, all debuggable, all extensible via dependency injection.

**Key differences from langium:**
- Uses tree-sitter instead of chevrotain — incremental parsing, native performance
- No cloned AST — typed wrappers read directly from tree-sitter nodes on demand
- Cross-reference resolution via incremental eager TS resolver — not a full-file recompute on every keystroke

---

## Package Structure

Monorepo using `pnpm` workspaces:

```
packages/
  core/        → @trellis/core     — runtime: base classes, link table, DI, LSP services
  cli/         → @trellis/cli      — trellis generate command, grammar parser, code generator
  testing/     → @trellis/testing  — test utilities: parseHelper, linkHelper, lspHelper
```

Users install `@trellis/core` as a runtime dependency and `@trellis/cli` + `@trellis/testing` as dev dependencies.

---

## The `trellis generate` Command

A single command runs both generation stages end-to-end:

**Stage 1 — tree-sitter artifacts:**
1. Parse the `.trellis` grammar file
2. Emit `grammar.js` (tree-sitter native DSL)
3. Run `tree-sitter generate` to compile `grammar.js` into a native C parser + Node.js bindings

**Stage 2 — TypeScript artifacts (into `src/generated/`):**
- `ast.ts` — typed wrapper classes for every grammar rule
- `scope.ts` — generated incremental scope resolver
- `lsp/` — default LSP service implementations
- `module.ts` — DI module wiring everything together
- `testing.ts` — typed test helpers

Tree-sitter CLI is a required peer dependency.

---

## Grammar Format

Grammar files use a `.trellis` extension. The syntax is langium-compatible with minimal tree-sitter additions.

### Langium syntax preserved as-is

```
grammar MyLanguage

entry Model:
    (elements+=Element)*;

Element:
    name=ID ':' type=TypeRef;

TypeRef:
    target=[Element:ID];

hidden terminal WS: /\s+/;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
terminal STRING: /"[^"]*"/;
```

**Assignment operators (same as langium):**
| Syntax | Meaning | Tree-sitter output |
|---|---|---|
| `name=ID` | Single assignment | `field('name', $.identifier)` |
| `elements+=Element` | List assignment | `field('elements', repeat($.element))` |
| `optional?='keyword'` | Boolean flag | `field('optional', optional('keyword'))` |

**Cross-references (same as langium):**
```
TypeRef:
    target=[Element:ID];      // reference to Element, resolved by ID text
    
MultiRef:
    targets=[+Element:ID];    // multiple targets
```

**Hidden terminals** map to tree-sitter `extras` automatically.

**Pure alternation rules** are inferred as tree-sitter `supertypes` automatically:
```
// trellis infers Expression as a supertype
Expression:
    BinaryExpr | UnaryExpr | Literal;
```

### Tree-sitter additions

**`word`** — required for any language with keywords, prevents `if` matching as an identifier:
```
word: ID;
```

**Precedence annotations** — required for grammars with binary operators:
```
BinaryExpr:
    left=Expression op=('+'|'-'|'*'|'/') right=Expression @prec.left(1);
```
Supported: `@prec(n)`, `@prec.left(n)`, `@prec.right(n)`, `@prec.dynamic(n)`

**`conflicts`** — explicit ambiguity resolution for GLR parsing:
```
conflicts: [[TypeRef, Identifier]];
```

### V1 scope

V1 supports a minimal grammar sufficient to define a real language: rules, terminals, hidden terminals, cross-references, alternation, `word`, precedence, and `conflicts`. Advanced tree-sitter features (`externals`, `inline`, `alias`) are deferred to v2.

---

## Runtime Model

### No cloned AST

Tree-sitter parses source text and produces a native CST in C memory. Trellis does **not** walk this CST to build a second JavaScript object graph. Instead, generated wrapper classes read from tree-sitter nodes on demand:

```ts
// generated in ast.ts
class ElementNode {
  constructor(private readonly tsNode: SyntaxNode, private readonly ctx: TrellisContext) {}

  get name(): string {
    return this.tsNode.childForFieldName('name')!.text
  }

  get type(): TypeRefNode {
    return new TypeRefNode(this.tsNode.childForFieldName('type')!, this.ctx)
  }
}
```

Property access is memoized on first read to avoid redundant tree-sitter calls in tight loops.

### Link table

Cross-references are stored in a `LinkTable` — a flat map from tree-sitter node ID to resolved node:

```ts
interface LinkTable {
  set(refNode: SyntaxNode, resolved: SyntaxNode | undefined): void
  resolve(refNode: SyntaxNode): SyntaxNode | undefined
  invalidate(nodeIds: Set<number>): void
}
```

Typed wrapper cross-reference properties look up the link table:
```ts
// generated in ast.ts
class TypeRefNode {
  get target(): ElementNode | undefined {
    const resolved = this.ctx.linkTable.resolve(this.tsNode)
    return resolved ? new ElementNode(resolved, this.ctx) : undefined
  }
}
```

### Incremental eager resolution

On every tree-sitter edit event:

1. Tree-sitter re-parses only the changed region and reports which nodes changed
2. The resolution scheduler invalidates link table entries for affected nodes
3. A resolution pass re-resolves only cross-references in the affected region
4. Updated diagnostics are pushed to the LSP client

This means the link table is always complete (supporting diagnostics) but the per-keystroke cost is proportional to the size of the change, not the size of the file.

---

## Scope Resolution

### Generated TypeScript resolver

Trellis generates a `DefaultScopeProvider` in `generated/scope.ts` based on the grammar's cross-reference declarations. For each `[Type:TOKEN]` declaration, the generator emits a typed resolution method:

```ts
// generated — user never writes this directly
class DefaultScopeProvider implements ScopeProvider {
  resolveTypeRef(node: TypeRefNode, scope: Scope): ElementNode | undefined {
    const name = node.tsNode.childForFieldName('target')!.text
    return scope.lookup(name, 'Element') as ElementNode | undefined
  }
}
```

Users override via DI:
```ts
const services = inject(DefaultModule, {
  scope: {
    ScopeProvider: (services) => new MyScopeProvider(services)
  }
})
```

### Interface design

`ScopeProvider` is designed to allow a `TreeSitterGraphScopeProvider` implementation in a future version without breaking changes.

---

## Dependency Injection

Follows langium's exact module pattern — no framework, no decorators, zero runtime dependencies.

```ts
// core pattern
const services = inject(DefaultModule, UserOverridesModule)

// services are lazy — instantiated on first access, then cached
services.scope.ScopeProvider     // created here on first access
services.lsp.HoverProvider       // created here on first access
```

To override a service:
```ts
const MyModule = {
  scope: {
    ScopeProvider: (services) => new MyScopeProvider(services)
  }
}
const services = inject(DefaultModule, MyModule)
```

The `DefaultModule` is generated by trellis into `generated/module.ts`. Users compose it with their own modules.

---

## Default LSP Features (v1)

| Feature | Implementation strategy |
|---|---|
| **Diagnostics** | Tree-sitter parse errors + broken link table entries (missing resolution) |
| **Go to definition** | Link table lookup → source position of resolved node |
| **Find references** | Reverse index on link table — all nodes pointing to a given definition |
| **Semantic highlighting** | Tree-sitter query files (`.scm`) generated from grammar terminal types |
| **Folding ranges** | Structural — based on rule nesting depth in tree-sitter CST |

Deferred to v2: Completion, Hover, Rename, Formatting.

---

## Testing Architecture

### `@trellis/testing` (generic)

```ts
import { parseHelper, linkHelper, lspHelper } from '@trellis/testing'

// parsing stage
const parse = parseHelper<ModelNode>(services)
const doc = await parse('type Point { x: Float, y: Float }')
expect(doc.parseErrors).toHaveLength(0)

// linking stage
const point = doc.root.elements[0]
expect(point.name).toBe('Point')

// LSP stage
const location = await lspHelper.goToDefinition(doc, { line: 1, character: 15 })
expect(location.uri).toBe(doc.uri)
```

### Generated typed helpers (`generated/testing.ts`)

A thin generated file that instantiates services and wraps `@trellis/testing` with your grammar's specific types:

```ts
// generated/testing.ts
import { parseHelper, linkHelper, lspHelper } from '@trellis/testing'
import { createDefaultServices } from './module'

export const parse = parseHelper<ModelNode>(createDefaultServices())
export const link = linkHelper(createDefaultServices())
export const lsp = lspHelper(createDefaultServices())
```

Each lifecycle stage is independently testable without spinning up a full language server process.
