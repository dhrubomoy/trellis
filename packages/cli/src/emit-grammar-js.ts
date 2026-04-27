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
