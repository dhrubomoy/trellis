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
