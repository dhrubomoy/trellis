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
