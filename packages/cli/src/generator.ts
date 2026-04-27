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
