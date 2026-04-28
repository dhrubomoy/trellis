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
