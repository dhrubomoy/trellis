# @trellis/testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `parseHelper`, `linkHelper`, and `lspHelper` in `@trellis/testing`, and fix the `LinkTable` interface in `@trellis/core` to accept `SyntaxNode` (matching the spec and the generated code from Plan 3).

**Architecture:** Fix `LinkTable` first (prerequisite), then three focused source files — `parse-helper.ts` (wraps a parser + root factory into a reusable function), `link-helper.ts` (walks the full tree and populates the link table via a scope provider), `lsp-helper.ts` (delegates to a `DiagnosticProvider`). A shared `walk-tree.ts` utility is used by both `parse-helper.ts` (to find ERROR/MISSING nodes) and `link-helper.ts` (to visit every node for cross-reference resolution). All helpers accept interface-typed options, making them fully testable with mocked tree-sitter objects.

**Tech Stack:** TypeScript 5.x, tree-sitter ^0.21.0 (peerDep), @trellis/core (workspace dep), vitest 2.x

---

## File Structure

### Modified files
- Modify: `packages/core/src/link-table.ts` — fix interface + implementation to accept `SyntaxNode` not `number`
- Modify: `packages/core/test/link-table.test.ts` — update tests to pass `SyntaxNode` mocks

### New files
- Create: `packages/testing/src/walk-tree.ts` — recursive tree walker used by parse and link helpers
- Create: `packages/testing/src/parse-helper.ts` — `parseHelper<T>()` factory
- Create: `packages/testing/src/link-helper.ts` — `linkHelper()` factory
- Create: `packages/testing/src/lsp-helper.ts` — `lspHelper()` factory
- Create: `packages/testing/vitest.config.ts`
- Create: `packages/testing/test/parse-helper.test.ts`
- Create: `packages/testing/test/link-helper.test.ts`
- Create: `packages/testing/test/lsp-helper.test.ts`
- Modify: `packages/testing/src/index.ts` — re-export all helpers and types
- Modify: `packages/testing/package.json` — add tree-sitter peerDep + devDep, fix test script

---

## Task 1: Fix `LinkTable` in `@trellis/core`

The current `LinkTable` interface uses `number` (raw node IDs) but the spec defines `SyntaxNode`-based signatures, and the code emitted by Plan 3's `emit-ast-ts.ts` calls `ctx.linkTable.resolve(this.tsNode)` — passing a `SyntaxNode`. This is a type mismatch that would fail TypeScript compilation on any generated `ast.ts`. Fix it now as a prerequisite for everything else in this plan.

**Files:**
- Modify: `packages/core/src/link-table.ts`
- Modify: `packages/core/test/link-table.test.ts`

- [ ] **Step 1: Update the interface and implementation**

Replace the contents of `packages/core/src/link-table.ts`:

```ts
import type { SyntaxNode } from 'tree-sitter'

export interface LinkTable {
  set(refNode: SyntaxNode, resolved: SyntaxNode | undefined): void
  resolve(refNode: SyntaxNode): SyntaxNode | undefined
  has(refNode: SyntaxNode): boolean
  invalidate(nodeIds: Set<number>): void
  clear(): void
}

export class DefaultLinkTable implements LinkTable {
  // null = attempted but unresolvable; absent = never attempted
  private readonly table = new Map<number, SyntaxNode | null>()

  set(refNode: SyntaxNode, resolved: SyntaxNode | undefined): void {
    this.table.set(refNode.id, resolved ?? null)
  }

  resolve(refNode: SyntaxNode): SyntaxNode | undefined {
    const entry = this.table.get(refNode.id)
    return entry === null ? undefined : entry
  }

  has(refNode: SyntaxNode): boolean {
    return this.table.has(refNode.id)
  }

  invalidate(nodeIds: Set<number>): void {
    for (const id of nodeIds) {
      this.table.delete(id)
    }
  }

  clear(): void {
    this.table.clear()
  }
}
```

- [ ] **Step 2: Update the tests**

Replace the contents of `packages/core/test/link-table.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { DefaultLinkTable } from '../src/link-table.js'
import type { SyntaxNode } from 'tree-sitter'

function mockNode(id: number): SyntaxNode {
  return { id } as unknown as SyntaxNode
}

describe('DefaultLinkTable', () => {
  it('returns undefined for a node that was never resolved', () => {
    const table = new DefaultLinkTable()
    expect(table.resolve(mockNode(1))).toBeUndefined()
  })

  it('has() returns false for a node that was never resolved', () => {
    const table = new DefaultLinkTable()
    expect(table.has(mockNode(1))).toBe(false)
  })

  it('stores and resolves a successful cross-reference', () => {
    const table = new DefaultLinkTable()
    const ref = mockNode(1)
    const target = mockNode(99)
    table.set(ref, target)
    expect(table.resolve(ref)).toBe(target)
  })

  it('stores an unresolvable reference (undefined) and has() returns true', () => {
    const table = new DefaultLinkTable()
    const ref = mockNode(1)
    table.set(ref, undefined)
    expect(table.has(ref)).toBe(true)
    expect(table.resolve(ref)).toBeUndefined()
  })

  it('invalidates specific node IDs, leaving others intact', () => {
    const table = new DefaultLinkTable()
    const ref1 = mockNode(1)
    const ref2 = mockNode(2)
    table.set(ref1, mockNode(99))
    table.set(ref2, mockNode(100))
    table.invalidate(new Set([1]))
    expect(table.has(ref1)).toBe(false)
    expect(table.has(ref2)).toBe(true)
  })

  it('clear() removes all entries', () => {
    const table = new DefaultLinkTable()
    const ref1 = mockNode(1)
    const ref2 = mockNode(2)
    table.set(ref1, mockNode(99))
    table.set(ref2, mockNode(100))
    table.clear()
    expect(table.has(ref1)).toBe(false)
    expect(table.has(ref2)).toBe(false)
  })
})
```

- [ ] **Step 3: Run tests to confirm they pass**

Run: `pnpm --filter @trellis/core test`

Expected: All 6 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/link-table.ts packages/core/test/link-table.test.ts
git commit -m "fix(@trellis/core): LinkTable accepts SyntaxNode instead of nodeId (matches spec)"
```

---

## Task 2: `walk-tree.ts` + `parseHelper`

**Files:**
- Modify: `packages/testing/package.json`
- Create: `packages/testing/vitest.config.ts`
- Create: `packages/testing/src/walk-tree.ts`
- Create: `packages/testing/src/parse-helper.ts`
- Create: `packages/testing/test/parse-helper.test.ts`

- [ ] **Step 1: Update `package.json`**

Replace the contents of `packages/testing/package.json`:

```json
{
  "name": "@trellis/testing",
  "version": "0.0.1",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@trellis/core": "workspace:*"
  },
  "peerDependencies": {
    "tree-sitter": "^0.21.0"
  },
  "devDependencies": {
    "tree-sitter": "^0.21.0",
    "typescript": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

Run: `pnpm install`

Expected: `tree-sitter` installed as devDep in `packages/testing/node_modules`.

- [ ] **Step 2: Create `vitest.config.ts`**

Create `packages/testing/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts']
  }
})
```

- [ ] **Step 3: Write failing tests for `parseHelper`**

Create `packages/testing/test/parse-helper.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { parseHelper } from '../src/parse-helper.js'
import type { SyntaxNode, Tree } from 'tree-sitter'
import type { TrellisContext } from '@trellis/core'

function mockNode(opts: Partial<{
  id: number
  type: string
  isMissing: boolean
  hasError: boolean
  childCount: number
  child: (i: number) => SyntaxNode | null
  startPosition: { row: number; column: number }
  endPosition: { row: number; column: number }
}> = {}): SyntaxNode {
  return {
    id: 1,
    type: 'model',
    text: '',
    isMissing: false,
    hasError: false,
    childCount: 0,
    child: () => null,
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 0, column: 0 },
    ...opts,
  } as unknown as SyntaxNode
}

function mockTree(rootNode: SyntaxNode): Tree {
  return { rootNode } as unknown as Tree
}

describe('parseHelper', () => {
  it('calls parser.parse with the source text', () => {
    const root = mockNode()
    const parser = { parse: vi.fn().mockReturnValue(mockTree(root)) }
    const createRoot = vi.fn().mockReturnValue({ tsNode: root })
    const parse = parseHelper({ parser, createRoot })
    parse('hello world')
    expect(parser.parse).toHaveBeenCalledWith('hello world')
  })

  it('returns the root node returned by createRoot', () => {
    const root = mockNode()
    const parser = { parse: vi.fn().mockReturnValue(mockTree(root)) }
    const expectedRoot = { tsNode: root, text: 'hello' }
    const createRoot = vi.fn().mockReturnValue(expectedRoot)
    const parse = parseHelper({ parser, createRoot })
    const result = parse('hello world')
    expect(result.root).toBe(expectedRoot)
  })

  it('passes the tree and a TrellisContext to createRoot', () => {
    const root = mockNode()
    const tree = mockTree(root)
    const parser = { parse: vi.fn().mockReturnValue(tree) }
    const createRoot = vi.fn().mockReturnValue({ tsNode: root })
    const parse = parseHelper({ parser, createRoot })
    parse('hello')
    const [calledTree, calledCtx] = createRoot.mock.calls[0]!
    expect(calledTree).toBe(tree)
    expect(calledCtx).toHaveProperty('linkTable')
  })

  it('returns empty parseErrors when root has no errors', () => {
    const root = mockNode({ hasError: false, isMissing: false, childCount: 0 })
    const parser = { parse: vi.fn().mockReturnValue(mockTree(root)) }
    const parse = parseHelper({ parser, createRoot: vi.fn().mockReturnValue({}) })
    const result = parse('hello')
    expect(result.parseErrors).toHaveLength(0)
  })

  it('collects ERROR nodes as parse errors', () => {
    const errorNode = mockNode({ id: 2, type: 'ERROR', isMissing: false, childCount: 0 })
    const root = mockNode({
      id: 1,
      type: 'model',
      hasError: true,
      childCount: 1,
      child: (i: number) => (i === 0 ? errorNode : null),
    })
    const parser = { parse: vi.fn().mockReturnValue(mockTree(root)) }
    const parse = parseHelper({ parser, createRoot: vi.fn().mockReturnValue({}) })
    const result = parse('hello')
    expect(result.parseErrors).toHaveLength(1)
    expect(result.parseErrors[0]!.message).toBe('Syntax error')
  })

  it('collects MISSING nodes as parse errors', () => {
    const missingNode = mockNode({ id: 2, type: 'identifier', isMissing: true, childCount: 0 })
    const root = mockNode({
      id: 1,
      type: 'model',
      hasError: true,
      childCount: 1,
      child: (i: number) => (i === 0 ? missingNode : null),
    })
    const parser = { parse: vi.fn().mockReturnValue(mockTree(root)) }
    const parse = parseHelper({ parser, createRoot: vi.fn().mockReturnValue({}) })
    const result = parse('hello')
    expect(result.parseErrors).toHaveLength(1)
    expect(result.parseErrors[0]!.message).toBe('Missing identifier')
  })

  it('provides a TrellisContext with a DefaultLinkTable when no createContext is supplied', () => {
    const root = mockNode()
    const parser = { parse: vi.fn().mockReturnValue(mockTree(root)) }
    let capturedCtx: TrellisContext | undefined
    const createRoot = vi.fn().mockImplementation((_tree: Tree, ctx: TrellisContext) => {
      capturedCtx = ctx
      return {}
    })
    const parse = parseHelper({ parser, createRoot })
    parse('hello')
    expect(capturedCtx!.linkTable).toBeDefined()
    expect(typeof capturedCtx!.linkTable.resolve).toBe('function')
  })

  it('uses a custom createContext when provided', () => {
    const root = mockNode()
    const parser = { parse: vi.fn().mockReturnValue(mockTree(root)) }
    const customCtx: TrellisContext = {
      linkTable: { set: vi.fn(), resolve: vi.fn(), has: vi.fn(), invalidate: vi.fn(), clear: vi.fn() },
    }
    const createContext = vi.fn().mockReturnValue(customCtx)
    let capturedCtx: TrellisContext | undefined
    const createRoot = vi.fn().mockImplementation((_tree: Tree, ctx: TrellisContext) => {
      capturedCtx = ctx
      return {}
    })
    const parse = parseHelper({ parser, createRoot, createContext })
    parse('hello')
    expect(capturedCtx).toBe(customCtx)
  })

  it('exposes the tree and ctx on the result', () => {
    const root = mockNode()
    const tree = mockTree(root)
    const parser = { parse: vi.fn().mockReturnValue(tree) }
    const parse = parseHelper({ parser, createRoot: vi.fn().mockReturnValue({}) })
    const result = parse('hello')
    expect(result.tree).toBe(tree)
    expect(result.ctx).toHaveProperty('linkTable')
  })
})
```

- [ ] **Step 4: Run tests to confirm they fail**

Run: `pnpm --filter @trellis/testing test`

Expected: FAIL — `Cannot find module '../src/parse-helper.js'`

- [ ] **Step 5: Implement `walk-tree.ts`**

Create `packages/testing/src/walk-tree.ts`:

```ts
import type { SyntaxNode } from 'tree-sitter'

export function walkTree(node: SyntaxNode, visitor: (n: SyntaxNode) => void): void {
  visitor(node)
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (child !== null) walkTree(child, visitor)
  }
}
```

- [ ] **Step 6: Implement `parse-helper.ts`**

Create `packages/testing/src/parse-helper.ts`:

```ts
import type { SyntaxNode, Tree } from 'tree-sitter'
import { DefaultLinkTable, type TrellisContext } from '@trellis/core'
import { walkTree } from './walk-tree.js'

export interface ParseError {
  message: string
  startPosition: { row: number; column: number }
  endPosition: { row: number; column: number }
}

export interface ParseResult<T> {
  root: T
  parseErrors: ParseError[]
  tree: Tree
  ctx: TrellisContext
}

export interface ParseHelperOptions<T> {
  readonly parser: { parse(source: string): Tree }
  readonly createRoot: (tree: Tree, ctx: TrellisContext) => T
  readonly createContext?: () => TrellisContext
}

export function parseHelper<T>(options: ParseHelperOptions<T>): (source: string) => ParseResult<T> {
  const { parser, createRoot, createContext } = options
  return (source: string): ParseResult<T> => {
    const tree = parser.parse(source)
    const ctx = createContext ? createContext() : { linkTable: new DefaultLinkTable() }
    const root = createRoot(tree, ctx)
    const parseErrors = collectParseErrors(tree.rootNode)
    return { root, parseErrors, tree, ctx }
  }
}

function collectParseErrors(rootNode: SyntaxNode): ParseError[] {
  const errors: ParseError[] = []
  walkTree(rootNode, (node) => {
    if (node.type === 'ERROR') {
      errors.push({
        message: 'Syntax error',
        startPosition: node.startPosition,
        endPosition: node.endPosition,
      })
    } else if (node.isMissing) {
      errors.push({
        message: `Missing ${node.type}`,
        startPosition: node.startPosition,
        endPosition: node.endPosition,
      })
    }
  })
  return errors
}
```

- [ ] **Step 7: Run tests to confirm they pass**

Run: `pnpm --filter @trellis/testing test`

Expected: All 8 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/testing/src/walk-tree.ts packages/testing/src/parse-helper.ts \
  packages/testing/test/parse-helper.test.ts \
  packages/testing/package.json packages/testing/vitest.config.ts pnpm-lock.yaml
git commit -m "feat(@trellis/testing): add walkTree utility and parseHelper"
```

---

## Task 3: `linkHelper`

**Files:**
- Create: `packages/testing/src/link-helper.ts`
- Create: `packages/testing/test/link-helper.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/testing/test/link-helper.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { linkHelper } from '../src/link-helper.js'
import type { SyntaxNode } from 'tree-sitter'
import { DefaultLinkTable, type TrellisContext, type Scope } from '@trellis/core'

function mockNode(id: number, children: SyntaxNode[] = []): SyntaxNode {
  return {
    id,
    type: 'node',
    childCount: children.length,
    child: (i: number) => children[i] ?? null,
  } as unknown as SyntaxNode
}

function mockCtx(): TrellisContext {
  return { linkTable: new DefaultLinkTable() }
}

function mockScope(): Scope {
  return {
    lookup: vi.fn().mockReturnValue(undefined),
    define: vi.fn(),
    createChildScope: vi.fn(),
  }
}

describe('linkHelper', () => {
  it('calls scopeProvider.buildScope with the root node', () => {
    const scope = mockScope()
    const buildScope = vi.fn().mockReturnValue(scope)
    const resolve = vi.fn().mockReturnValue(undefined)
    const link = linkHelper({ buildScope, resolve })
    const root = mockNode(1)
    link(root, mockCtx())
    expect(buildScope).toHaveBeenCalledWith(root)
  })

  it('calls scopeProvider.resolve for the root node', () => {
    const scope = mockScope()
    const buildScope = vi.fn().mockReturnValue(scope)
    const resolve = vi.fn().mockReturnValue(undefined)
    const link = linkHelper({ buildScope, resolve })
    const root = mockNode(1)
    link(root, mockCtx())
    expect(resolve).toHaveBeenCalledWith(root, scope)
  })

  it('calls scopeProvider.resolve for each child node', () => {
    const scope = mockScope()
    const child1 = mockNode(2)
    const child2 = mockNode(3)
    const root = mockNode(1, [child1, child2])
    const buildScope = vi.fn().mockReturnValue(scope)
    const resolve = vi.fn().mockReturnValue(undefined)
    const link = linkHelper({ buildScope, resolve })
    link(root, mockCtx())
    expect(resolve).toHaveBeenCalledWith(child1, scope)
    expect(resolve).toHaveBeenCalledWith(child2, scope)
  })

  it('walks grandchildren recursively', () => {
    const scope = mockScope()
    const grandchild = mockNode(3)
    const child = mockNode(2, [grandchild])
    const root = mockNode(1, [child])
    const buildScope = vi.fn().mockReturnValue(scope)
    const resolve = vi.fn().mockReturnValue(undefined)
    const link = linkHelper({ buildScope, resolve })
    link(root, mockCtx())
    expect(resolve).toHaveBeenCalledWith(grandchild, scope)
  })

  it('stores resolved nodes in the link table', () => {
    const scope = mockScope()
    const target = mockNode(99)
    const refNode = mockNode(2)
    const root = mockNode(1, [refNode])
    const buildScope = vi.fn().mockReturnValue(scope)
    const resolve = vi.fn().mockImplementation((n: SyntaxNode) =>
      n === refNode ? target : undefined
    )
    const link = linkHelper({ buildScope, resolve })
    const ctx = mockCtx()
    link(root, ctx)
    expect(ctx.linkTable.resolve(refNode)).toBe(target)
  })

  it('does not store undefined resolutions in the link table', () => {
    const scope = mockScope()
    const root = mockNode(1)
    const buildScope = vi.fn().mockReturnValue(scope)
    const resolve = vi.fn().mockReturnValue(undefined)
    const link = linkHelper({ buildScope, resolve })
    const ctx = mockCtx()
    link(root, ctx)
    expect(ctx.linkTable.has(root)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `pnpm --filter @trellis/testing test`

Expected: FAIL — `Cannot find module '../src/link-helper.js'`

- [ ] **Step 3: Implement `link-helper.ts`**

Create `packages/testing/src/link-helper.ts`:

```ts
import type { SyntaxNode } from 'tree-sitter'
import type { TrellisContext, ScopeProvider } from '@trellis/core'
import { walkTree } from './walk-tree.js'

export function linkHelper(
  scopeProvider: ScopeProvider
): (rootNode: SyntaxNode, ctx: TrellisContext) => void {
  return (rootNode: SyntaxNode, ctx: TrellisContext): void => {
    const scope = scopeProvider.buildScope(rootNode)
    walkTree(rootNode, (node) => {
      const resolved = scopeProvider.resolve(node, scope)
      if (resolved !== undefined) {
        ctx.linkTable.set(node, resolved)
      }
    })
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `pnpm --filter @trellis/testing test`

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/testing/src/link-helper.ts packages/testing/test/link-helper.test.ts
git commit -m "feat(@trellis/testing): add linkHelper"
```

---

## Task 4: `lspHelper`

**Files:**
- Create: `packages/testing/src/lsp-helper.ts`
- Create: `packages/testing/test/lsp-helper.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/testing/test/lsp-helper.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `pnpm --filter @trellis/testing test`

Expected: FAIL — `Cannot find module '../src/lsp-helper.js'`

- [ ] **Step 3: Implement `lsp-helper.ts`**

Create `packages/testing/src/lsp-helper.ts`:

```ts
import type { SyntaxNode } from 'tree-sitter'
import type { DiagnosticProvider, TrellisDiagnostic } from '@trellis/core'

export interface LspHelper {
  getDiagnostics(rootNode: SyntaxNode): readonly TrellisDiagnostic[]
}

export function lspHelper(diagnosticProvider: DiagnosticProvider): LspHelper {
  return {
    getDiagnostics(rootNode: SyntaxNode): readonly TrellisDiagnostic[] {
      return diagnosticProvider.getDiagnostics(rootNode)
    },
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `pnpm --filter @trellis/testing test`

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/testing/src/lsp-helper.ts packages/testing/test/lsp-helper.test.ts
git commit -m "feat(@trellis/testing): add lspHelper"
```

---

## Task 5: Wire up exports and build

**Files:**
- Modify: `packages/testing/src/index.ts`

- [ ] **Step 1: Update `index.ts`**

Replace the contents of `packages/testing/src/index.ts`:

```ts
export * from './parse-helper.js'
export * from './link-helper.js'
export * from './lsp-helper.js'
export * from './walk-tree.js'
```

- [ ] **Step 2: Build the package**

Run: `pnpm --filter @trellis/testing build`

Expected: Zero TypeScript errors. `packages/testing/dist/` contains `index.js`, `parse-helper.js`, `link-helper.js`, `lsp-helper.js`, `walk-tree.js`, and all `.d.ts` declaration files.

- [ ] **Step 3: Run the full workspace test suite**

Run: `pnpm test`

Expected: All packages pass — `@trellis/core`, `@trellis/cli`, and `@trellis/testing` all green, zero failures workspace-wide.

- [ ] **Step 4: Commit**

```bash
git add packages/testing/src/index.ts
git commit -m "feat(@trellis/testing): wire up exports and build"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Covered by |
|---|---|
| `parseHelper<T>(options)` parses source, returns typed root + parse errors + tree + ctx | Task 2 — `parse-helper.ts` |
| `linkHelper(scopeProvider)` walks full tree, populates link table | Task 3 — `link-helper.ts` |
| `lspHelper(provider)` delegates to diagnostic provider | Task 4 — `lsp-helper.ts` |
| Each lifecycle stage independently testable without a language server | All tasks — each helper is a standalone function |
| `LinkTable.resolve(SyntaxNode)` matches the generated code from `emit-ast-ts.ts` | Task 1 — `link-table.ts` fix |
| `ParseResult` exposes `parseErrors`, `root`, `tree`, `ctx` | Task 2 — `ParseResult<T>` interface |
| ERROR and MISSING nodes collected as parse errors | Task 2 — `collectParseErrors` walks tree |

### Placeholder scan

No TBD, TODO, "similar to", or vague steps. Every step has complete, runnable code.

### Type consistency

- `walkTree(node: SyntaxNode, visitor: (n: SyntaxNode) => void): void` — defined Task 2 step 5; imported in `parse-helper.ts` (step 6) and `link-helper.ts` (Task 3 step 3) ✓
- `parseHelper<T>(options: ParseHelperOptions<T>)` — defined in `parse-helper.ts`; exported via `index.ts` ✓
- `ParseHelperOptions<T>.parser` typed as `{ parse(source: string): Tree }` — test mocks satisfy this interface ✓
- `linkHelper(scopeProvider: ScopeProvider)` — `ScopeProvider` from `@trellis/core`; interface has `buildScope(rootNode: SyntaxNode): Scope` and `resolve(refNode: SyntaxNode, scope: Scope): SyntaxNode | undefined` ✓
- `ctx.linkTable.set(node, resolved)` in `link-helper.ts` — `node` is `SyntaxNode`, matches updated `LinkTable.set(refNode: SyntaxNode, ...)` from Task 1 ✓
- `lspHelper(diagnosticProvider: DiagnosticProvider)` — `DiagnosticProvider` from `@trellis/core`; has `getDiagnostics(rootNode: SyntaxNode): readonly TrellisDiagnostic[]` ✓
- `LspHelper.getDiagnostics` return type `readonly TrellisDiagnostic[]` — matches `DiagnosticProvider.getDiagnostics` return type ✓

---

## Subsequent Plans

- **Plan 5: Stage 1** — run `tree-sitter generate` subprocess from `trellis generate`; make generated language servers functional end-to-end; generate `scope.ts`, `module.ts`, `testing.ts`
