import { describe, it, expect } from 'vitest'
import { toSnakeCase } from '../src/to-snake-case.js'

describe('toSnakeCase', () => {
  it('converts PascalCase to snake_case', () => {
    expect(toSnakeCase('TypeRef')).toBe('type_ref')
    expect(toSnakeCase('BinaryExpr')).toBe('binary_expr')
    expect(toSnakeCase('Model')).toBe('model')
  })

  it('groups consecutive capitals correctly', () => {
    expect(toSnakeCase('HTMLParser')).toBe('html_parser')
  })

  it('lowercases screaming-snake terminal names', () => {
    expect(toSnakeCase('SL_COMMENT')).toBe('sl_comment')
    expect(toSnakeCase('ML_COMMENT')).toBe('ml_comment')
    expect(toSnakeCase('ID')).toBe('id')
    expect(toSnakeCase('WS')).toBe('ws')
  })

  it('handles single-word PascalCase', () => {
    expect(toSnakeCase('Literal')).toBe('literal')
    expect(toSnakeCase('Expression')).toBe('expression')
  })
})
