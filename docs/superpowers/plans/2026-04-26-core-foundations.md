# @trellis/core Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the trellis pnpm monorepo and implement all `@trellis/core` runtime foundations: LinkTable, TrellisNode base class, TrellisContext, the `inject()` DI system, Scope/ScopeProvider, and LSP service interfaces.

**Architecture:** Three-package pnpm monorepo (`@trellis/core`, `@trellis/cli`, `@trellis/testing`). `@trellis/core` contains all runtime primitives that generated language server code depends on — a link table for cross-reference resolution, a thin typed wrapper base class over tree-sitter `SyntaxNode`s (no cloned AST), a langium-style lazy proxy DI system, and LSP service interfaces. The CLI and testing packages are scaffolded as stubs for future plans.

**Tech Stack:** TypeScript 5.x, pnpm workspaces, vitest, tree-sitter (peer dependency for `SyntaxNode` types)

---

## File Structure

### Monorepo root
- Create: `package.json` — workspace root, shared devDependencies, root scripts
- Create: `pnpm-workspace.yaml` — declares `packages/*` as workspace members
- Create: `tsconfig.base.json` — shared TypeScript config (strict, ES2022, Node16)
- Create: `.gitignore`

### packages/core
- Create: `packages/core/package.json` — `@trellis/core`, `tree-sitter` as peer + dev dep
- Create: `packages/core/tsconfig.json` — extends `../../tsconfig.base.json`
- Create: `packages/core/vitest.config.ts`
- Create: `packages/core/src/index.ts` — public re-exports
- Create: `packages/core/src/link-table.ts` — `LinkTable` interface + `DefaultLinkTable`
- Create: `packages/core/src/inject.ts` — `Module<I,T>` type + `inject()` function
- Create: `packages/core/src/context.ts` — `TrellisContext` interface
- Create: `packages/core/src/node.ts` — `TrellisNode` abstract base class
- Create: `packages/core/src/scope.ts` — `Scope`, `DefaultScope`, `ScopeProvider` interface
- Create: `packages/core/src/lsp/diagnostic.ts` — `DiagnosticProvider` interface + types
- Create: `packages/core/src/lsp/index.ts` — re-exports
- Create: `packages/core/test/link-table.test.ts`
- Create: `packages/core/test/inject.test.ts`
- Create: `packages/core/test/node.test.ts`
- Create: `packages/core/test/scope.test.ts`

### packages/cli (stub only)
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/src/index.ts`

### packages/testing (stub only)
- Create: `packages/testing/package.json`
- Create: `packages/testing/tsconfig.json`
- Create: `packages/testing/src/index.ts`

---

## Task 1: Monorepo Scaffolding

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/vitest.config.ts`
- Create: `packages/core/src/index.ts`
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/src/index.ts`
- Create: `packages/testing/package.json`
- Create: `packages/testing/tsconfig.json`
- Create: `packages/testing/src/index.ts`

- [ ] **Step 1: Initialize git and create root package.json**

Run: `git init`

Create `package.json`:
```json
{
  "name": "trellis",
  "private": true,
  "version": "0.0.1",
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create workspace config and shared TypeScript base**

Create `pnpm-workspace.yaml`:
```yaml
packages:
  - 'packages/*'
```

Create `tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "lib": ["ES2022"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

Create `.gitignore`:
```
node_modules/
dist/
```

- [ ] **Step 3: Scaffold packages/core**

Create `packages/core/package.json`:
```json
{
  "name": "@trellis/core",
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
    "test": "vitest run",
    "test:watch": "vitest"
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

Create `packages/core/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

Create `packages/core/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts']
  }
})
```

Create `packages/core/src/index.ts`:
```ts
export * from './link-table.js'
export * from './inject.js'
export * from './context.js'
export * from './node.js'
export * from './scope.js'
export * from './lsp/index.js'
```

- [ ] **Step 4: Scaffold packages/cli**

Create `packages/cli/package.json`:
```json
{
  "name": "@trellis/cli",
  "version": "0.0.1",
  "type": "module",
  "bin": {
    "trellis": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@trellis/core": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

Create `packages/cli/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

Create `packages/cli/src/index.ts`:
```ts
// @trellis/cli — grammar parser and code generator (implemented in future plans)
```

- [ ] **Step 5: Scaffold packages/testing**

Create `packages/testing/package.json`:
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
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

Create `packages/testing/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

Create `packages/testing/src/index.ts`:
```ts
// @trellis/testing — test utilities (implemented in future plans)
```

- [ ] **Step 6: Install dependencies**

Run: `pnpm install`

Expected: lockfile created, `node_modules/` symlinked across packages, no errors.

- [ ] **Step 7: Verify build**

Run: `pnpm --filter @trellis/core build`

Expected: `packages/core/dist/` created. No TypeScript errors. (index.ts re-exports will error until source files exist — if so, temporarily empty `src/index.ts`, build, then restore once files are created in later tasks.)

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "chore: initialize trellis pnpm monorepo with @trellis/core, @trellis/cli, @trellis/testing scaffolding"
```

---

## Task 2: LinkTable

The `LinkTable` stores resolved cross-references as a flat map from tree-sitter node ID (a number) to the resolved target `SyntaxNode`. It distinguishes "never attempted" (key absent) from "attempted but unresolvable" (key present, value `undefined`). Supports bulk invalidation when a file edit makes cached resolutions stale.

**Files:**
- Create: `packages/core/src/link-table.ts`
- Create: `packages/core/test/link-table.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/core/test/link-table.test.ts`:
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
    expect(table.resolve(1)).toBeUndefined()
  })

  it('has() returns false for a node that was never resolved', () => {
    const table = new DefaultLinkTable()
    expect(table.has(1)).toBe(false)
  })

  it('stores and resolves a successful cross-reference', () => {
    const table = new DefaultLinkTable()
    const target = mockNode(99)
    table.set(1, target)
    expect(table.resolve(1)).toBe(target)
  })

  it('stores an unresolvable reference (undefined) and has() returns true', () => {
    const table = new DefaultLinkTable()
    table.set(1, undefined)
    expect(table.has(1)).toBe(true)
    expect(table.resolve(1)).toBeUndefined()
  })

  it('invalidates specific node IDs, leaving others intact', () => {
    const table = new DefaultLinkTable()
    table.set(1, mockNode(99))
    table.set(2, mockNode(100))
    table.invalidate(new Set([1]))
    expect(table.has(1)).toBe(false)
    expect(table.has(2)).toBe(true)
  })

  it('clear() removes all entries', () => {
    const table = new DefaultLinkTable()
    table.set(1, mockNode(99))
    table.set(2, mockNode(100))
    table.clear()
    expect(table.has(1)).toBe(false)
    expect(table.has(2)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `pnpm --filter @trellis/core test`

Expected: FAIL — `Cannot find module '../src/link-table.js'`

- [ ] **Step 3: Implement LinkTable**

Create `packages/core/src/link-table.ts`:
```ts
import type { SyntaxNode } from 'tree-sitter'

export interface LinkTable {
  set(nodeId: number, resolved: SyntaxNode | undefined): void
  resolve(nodeId: number): SyntaxNode | undefined
  has(nodeId: number): boolean
  invalidate(nodeIds: Set<number>): void
  clear(): void
}

export class DefaultLinkTable implements LinkTable {
  // null = attempted but unresolvable; absent = never attempted
  private readonly table = new Map<number, SyntaxNode | null>()

  set(nodeId: number, resolved: SyntaxNode | undefined): void {
    this.table.set(nodeId, resolved ?? null)
  }

  resolve(nodeId: number): SyntaxNode | undefined {
    return this.table.get(nodeId) ?? undefined
  }

  has(nodeId: number): boolean {
    return this.table.has(nodeId)
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

- [ ] **Step 4: Run tests to confirm they pass**

Run: `pnpm --filter @trellis/core test`

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/link-table.ts packages/core/test/link-table.test.ts
git commit -m "feat(@trellis/core): add LinkTable interface and DefaultLinkTable"
```

---

## Task 3: inject() DI System

Langium-style module-based DI. A `Module` is a nested object where every leaf is a factory function `(services: I) => T`. `inject()` merges one or more modules (later overrides earlier) and returns a lazy proxy — services are instantiated on first access and cached. Factory functions always receive the root services object, regardless of nesting depth. Circular dependencies throw at access time.

**Files:**
- Create: `packages/core/src/inject.ts`
- Create: `packages/core/test/inject.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/core/test/inject.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { inject } from '../src/inject.js'

describe('inject', () => {
  it('creates a flat service from a factory', () => {
    interface S { value: string }
    const services = inject<S>({ value: () => 'hello' })
    expect(services.value).toBe('hello')
  })

  it('passes the root services object to factory functions', () => {
    interface S { a: string; b: string }
    const services = inject<S>({
      a: () => 'foo',
      b: (s) => s.a + 'bar'
    })
    expect(services.b).toBe('foobar')
  })

  it('handles nested service groups', () => {
    interface S { group: { value: string } }
    const services = inject<S>({
      group: { value: () => 'nested' }
    })
    expect(services.group.value).toBe('nested')
  })

  it('passes root services to factories inside nested groups', () => {
    interface S { name: string; greet: { message: string } }
    const services = inject<S>({
      name: () => 'world',
      greet: { message: (s) => `hello ${s.name}` }
    })
    expect(services.greet.message).toBe('hello world')
  })

  it('services are lazy — factory not called until first access', () => {
    const factory = vi.fn(() => 'value')
    interface S { x: string }
    const services = inject<S>({ x: factory })
    expect(factory).not.toHaveBeenCalled()
    void services.x
    expect(factory).toHaveBeenCalledOnce()
  })

  it('services are cached — factory called only once across multiple accesses', () => {
    const factory = vi.fn(() => ({ id: Math.random() }))
    interface S { thing: { id: number } }
    const services = inject<S>({ thing: factory })
    const first = services.thing
    const second = services.thing
    expect(first).toBe(second)
    expect(factory).toHaveBeenCalledOnce()
  })

  it('later modules override earlier modules at the same key', () => {
    interface S { value: string }
    const base = { value: () => 'base' }
    const override = { value: () => 'override' }
    const services = inject<S>(base, override)
    expect(services.value).toBe('override')
  })

  it('deep merges nested modules — override only replaces specified keys', () => {
    interface S { group: { a: string; b: string } }
    const base = { group: { a: () => 'base-a', b: () => 'base-b' } }
    const override = { group: { b: () => 'override-b' } }
    const services = inject<S>(base, override)
    expect(services.group.a).toBe('base-a')
    expect(services.group.b).toBe('override-b')
  })

  it('throws on circular dependencies', () => {
    interface S { a: string; b: string }
    const services = inject<S>({
      a: (s) => s.b,
      b: (s) => s.a
    })
    expect(() => services.a).toThrow(/[Cc]ircular/)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `pnpm --filter @trellis/core test`

Expected: FAIL — `Cannot find module '../src/inject.js'`

- [ ] **Step 3: Implement inject()**

Create `packages/core/src/inject.ts`:
```ts
export type Module<I, T> = {
  [K in keyof T]: T[K] extends object
    ? Module<I, T[K]>
    : (injector: I) => T[K]
}

export function inject<T extends object>(...modules: Array<Partial<Module<T, T>>>): T {
  const merged = modules.reduce(mergeModules, {} as Module<T, T>)
  // proxy is assigned before any factory can be called (factories are invoked lazily on first access)
  let proxy!: T
  proxy = createProxy(merged, () => proxy) as T
  return proxy
}

function createProxy<I extends object, T extends object>(
  module: Module<I, T>,
  getRoot: () => I
): T {
  const cache = new Map<string, unknown>()
  const inProgress = new Set<string>()

  return new Proxy({} as T, {
    get(_target, prop: string | symbol) {
      if (typeof prop === 'symbol') return undefined
      if (cache.has(prop)) return cache.get(prop)

      const entry = (module as Record<string, unknown>)[prop]
      if (entry === undefined) return undefined

      if (typeof entry === 'function') {
        if (inProgress.has(prop)) {
          throw new Error(`Circular dependency detected for service: "${prop}"`)
        }
        inProgress.add(prop)
        const value = (entry as (i: I) => unknown)(getRoot())
        inProgress.delete(prop)
        cache.set(prop, value)
        return value
      }

      if (isPlainObject(entry)) {
        const nested = createProxy(entry as Module<I, Record<string, unknown>>, getRoot)
        cache.set(prop, nested)
        return nested
      }

      cache.set(prop, entry)
      return entry
    }
  })
}

function mergeModules<T extends object>(target: T, source: Partial<T>): T {
  const result = Object.assign({}, target)
  for (const key of Object.keys(source) as Array<keyof T>) {
    const s = source[key]
    const t = result[key]
    if (isPlainObject(s) && isPlainObject(t)) {
      result[key] = mergeModules(
        t as Record<string, unknown>,
        s as Partial<Record<string, unknown>>
      ) as T[keyof T]
    } else if (s !== undefined) {
      result[key] = s as T[keyof T]
    }
  }
  return result
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `pnpm --filter @trellis/core test`

Expected: All 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/inject.ts packages/core/test/inject.test.ts
git commit -m "feat(@trellis/core): add langium-style inject() DI module system"
```

---

## Task 4: TrellisContext and TrellisNode

`TrellisContext` holds shared runtime state (the link table) that all nodes need to resolve cross-references. `TrellisNode` is the abstract base class for all generated grammar-specific node wrappers (e.g. `ElementNode`, `ModelNode`). It wraps a tree-sitter `SyntaxNode` and delegates to it — no data is copied.

**Files:**
- Create: `packages/core/src/context.ts`
- Create: `packages/core/src/node.ts`
- Create: `packages/core/test/node.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/core/test/node.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { TrellisNode } from '../src/node.js'
import type { TrellisContext } from '../src/context.js'
import { DefaultLinkTable } from '../src/link-table.js'
import type { SyntaxNode, Point } from 'tree-sitter'

function mockNode(overrides: Partial<{
  id: number
  type: string
  text: string
  startPosition: Point
  endPosition: Point
  startIndex: number
  endIndex: number
}> = {}): SyntaxNode {
  return {
    id: 1,
    type: 'test_node',
    text: 'foo',
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 0, column: 3 },
    startIndex: 0,
    endIndex: 3,
    ...overrides
  } as unknown as SyntaxNode
}

function makeContext(): TrellisContext {
  return { linkTable: new DefaultLinkTable() }
}

class ConcreteNode extends TrellisNode {}

describe('TrellisNode', () => {
  it('exposes the underlying tsNode', () => {
    const tsNode = mockNode()
    const node = new ConcreteNode(tsNode, makeContext())
    expect(node.tsNode).toBe(tsNode)
  })

  it('exposes nodeType from tsNode.type', () => {
    const node = new ConcreteNode(mockNode({ type: 'element' }), makeContext())
    expect(node.nodeType).toBe('element')
  })

  it('exposes text from tsNode.text', () => {
    const node = new ConcreteNode(mockNode({ text: 'myName' }), makeContext())
    expect(node.text).toBe('myName')
  })

  it('exposes startPosition from tsNode', () => {
    const node = new ConcreteNode(
      mockNode({ startPosition: { row: 2, column: 5 } }),
      makeContext()
    )
    expect(node.startPosition).toEqual({ row: 2, column: 5 })
  })

  it('exposes endPosition from tsNode', () => {
    const node = new ConcreteNode(
      mockNode({ endPosition: { row: 2, column: 10 } }),
      makeContext()
    )
    expect(node.endPosition).toEqual({ row: 2, column: 10 })
  })

  it('exposes startIndex and endIndex from tsNode', () => {
    const node = new ConcreteNode(mockNode({ startIndex: 10, endIndex: 20 }), makeContext())
    expect(node.startIndex).toBe(10)
    expect(node.endIndex).toBe(20)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `pnpm --filter @trellis/core test`

Expected: FAIL — `Cannot find module '../src/node.js'`

- [ ] **Step 3: Implement TrellisContext and TrellisNode**

Create `packages/core/src/context.ts`:
```ts
import type { LinkTable } from './link-table.js'

export interface TrellisContext {
  readonly linkTable: LinkTable
}
```

Create `packages/core/src/node.ts`:
```ts
import type { SyntaxNode, Point } from 'tree-sitter'
import type { TrellisContext } from './context.js'

export abstract class TrellisNode {
  constructor(
    readonly tsNode: SyntaxNode,
    protected readonly ctx: TrellisContext
  ) {}

  get nodeType(): string {
    return this.tsNode.type
  }

  get text(): string {
    return this.tsNode.text
  }

  get startPosition(): Point {
    return this.tsNode.startPosition
  }

  get endPosition(): Point {
    return this.tsNode.endPosition
  }

  get startIndex(): number {
    return this.tsNode.startIndex
  }

  get endIndex(): number {
    return this.tsNode.endIndex
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `pnpm --filter @trellis/core test`

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/context.ts packages/core/src/node.ts packages/core/test/node.test.ts
git commit -m "feat(@trellis/core): add TrellisContext interface and TrellisNode abstract base class"
```

---

## Task 5: Scope and ScopeProvider

`Scope` is a name→node map for a single lexical scope. `DefaultScope` supports parent scope chaining — lookups fall through to the parent if not found locally, enabling nested scopes (function bodies, blocks). `ScopeProvider` is the interface the generated resolver and user overrides must implement.

**Files:**
- Create: `packages/core/src/scope.ts`
- Create: `packages/core/test/scope.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/core/test/scope.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { DefaultScope } from '../src/scope.js'
import type { SyntaxNode } from 'tree-sitter'

function mockNode(id: number): SyntaxNode {
  return { id } as unknown as SyntaxNode
}

describe('DefaultScope', () => {
  it('returns undefined for an unknown name', () => {
    const scope = new DefaultScope()
    expect(scope.lookup('Foo', 'Element')).toBeUndefined()
  })

  it('resolves a defined name and type', () => {
    const scope = new DefaultScope()
    const node = mockNode(1)
    scope.define('Foo', 'Element', node)
    expect(scope.lookup('Foo', 'Element')).toBe(node)
  })

  it('does not confuse the same name with different types', () => {
    const scope = new DefaultScope()
    const a = mockNode(1)
    const b = mockNode(2)
    scope.define('Foo', 'Element', a)
    scope.define('Foo', 'TypeAlias', b)
    expect(scope.lookup('Foo', 'Element')).toBe(a)
    expect(scope.lookup('Foo', 'TypeAlias')).toBe(b)
  })

  it('child scope resolves definitions from parent', () => {
    const parent = new DefaultScope()
    const parentNode = mockNode(1)
    parent.define('ParentDef', 'Element', parentNode)

    const child = parent.createChildScope()
    expect(child.lookup('ParentDef', 'Element')).toBe(parentNode)
  })

  it('parent scope cannot see child definitions', () => {
    const parent = new DefaultScope()
    const child = parent.createChildScope()
    child.define('ChildDef', 'Element', mockNode(1))
    expect(parent.lookup('ChildDef', 'Element')).toBeUndefined()
  })

  it('child scope shadows parent definition with same name and type', () => {
    const parent = new DefaultScope()
    parent.define('Foo', 'Element', mockNode(1))

    const child = parent.createChildScope()
    const childNode = mockNode(2)
    child.define('Foo', 'Element', childNode)

    expect(child.lookup('Foo', 'Element')).toBe(childNode)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `pnpm --filter @trellis/core test`

Expected: FAIL — `Cannot find module '../src/scope.js'`

- [ ] **Step 3: Implement Scope, DefaultScope, and ScopeProvider**

Create `packages/core/src/scope.ts`:
```ts
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
  return `${type}::${name}`
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `pnpm --filter @trellis/core test`

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/scope.ts packages/core/test/scope.test.ts
git commit -m "feat(@trellis/core): add Scope, DefaultScope, and ScopeProvider interface"
```

---

## Task 6: LSP Service Interfaces and Final Wiring

Define TypeScript interfaces for all default LSP services in v1. These are pure interfaces — no logic, no tests needed. Also wire up `src/index.ts` with all exports and verify the full package builds and all tests pass.

**Files:**
- Create: `packages/core/src/lsp/diagnostic.ts`
- Create: `packages/core/src/lsp/index.ts`
- Modify: `packages/core/src/index.ts` (ensure all exports present)

- [ ] **Step 1: Create LSP interfaces**

Create `packages/core/src/lsp/diagnostic.ts`:
```ts
import type { SyntaxNode } from 'tree-sitter'

export type DiagnosticSeverity = 'error' | 'warning' | 'information' | 'hint'

export interface TrellisDiagnostic {
  readonly node: SyntaxNode
  readonly message: string
  readonly severity: DiagnosticSeverity
}

export interface DiagnosticProvider {
  getDiagnostics(rootNode: SyntaxNode): TrellisDiagnostic[]
}
```

Create `packages/core/src/lsp/index.ts`:
```ts
export * from './diagnostic.js'
```

- [ ] **Step 2: Verify src/index.ts exports everything**

Confirm `packages/core/src/index.ts` contains:
```ts
export * from './link-table.js'
export * from './inject.js'
export * from './context.js'
export * from './node.js'
export * from './scope.js'
export * from './lsp/index.js'
```

- [ ] **Step 3: Build and verify no TypeScript errors**

Run: `pnpm --filter @trellis/core build`

Expected: `packages/core/dist/` fully built. Zero TypeScript errors.

- [ ] **Step 4: Run all tests**

Run: `pnpm --filter @trellis/core test`

Expected: All 23 tests PASS (6 link-table + 9 inject + 6 node + 6 scope - wait: node has 6, scope has 6, inject has 9, link-table has 6 = 27 total). Zero failures.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/lsp/ packages/core/src/index.ts
git commit -m "feat(@trellis/core): add LSP service interfaces and finalize public exports"
```

---

## Self-Review

### Spec coverage

| `docs/spec.md` requirement | Covered by |
|---|---|
| pnpm monorepo — `@trellis/core`, `@trellis/cli`, `@trellis/testing` | Task 1 |
| No cloned AST — thin wrapper reads from tree-sitter nodes on demand | `TrellisNode` (Task 4) |
| `LinkTable` — flat map, `has()`, `invalidate()`, `clear()` | Task 2 |
| `TrellisContext` holds link table | Task 4 |
| `inject()` — langium module pattern, lazy, cached, cycle detection, deep merge | Task 3 |
| `ScopeProvider` interface — designed for future `TreeSitterGraphScopeProvider` | Task 5 |
| `DefaultScope` — name+type keyed, parent chaining | Task 5 |
| LSP service interfaces (v1 set) | Task 6 |
| `@trellis/cli` scaffolded for future plan | Task 1 |
| `@trellis/testing` scaffolded for future plan | Task 1 |

### Placeholder scan

No TBD, TODO, "similar to", or "add error handling" patterns. All code steps contain full implementations.

### Type consistency

- `LinkTable.set/resolve/has/invalidate/clear` — defined in `link-table.ts`, used consistently in tests and in `TrellisContext`
- `TrellisContext.linkTable: LinkTable` — defined in `context.ts`, used in `node.test.ts` via `makeContext()`
- `TrellisNode` constructor `(tsNode: SyntaxNode, ctx: TrellisContext)` — consistent across `node.ts` and all test `new ConcreteNode(...)` calls
- `TrellisNode` getters: `nodeType`, `text`, `startPosition`, `endPosition`, `startIndex`, `endIndex` — defined in `node.ts`, tested in `node.test.ts`
- `Scope.lookup/define/createChildScope`, `ScopeProvider.buildScope/resolve` — defined in `scope.ts`, tested in `scope.test.ts`
- `inject<T>(...modules)` — `Module<I,T>` type, `createProxy`, `mergeModules` — all internal, consistent
- `DiagnosticProvider.getDiagnostics(rootNode: SyntaxNode): TrellisDiagnostic[]` — no callers yet, interfaces only

---

## Subsequent Plans

This plan produces a fully tested `@trellis/core` package. The next plans in sequence:

- **Plan 2: `@trellis/cli` — Grammar Parser** — parse `.trellis` files into an in-memory `GrammarAst`
- **Plan 3: `@trellis/cli` — Code Generator** — emit `grammar.js` + TypeScript wrappers from `GrammarAst`
- **Plan 4: `@trellis/testing`** — implement `parseHelper`, `linkHelper`, `lspHelper` using the generated artifacts
