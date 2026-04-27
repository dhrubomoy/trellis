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
