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
