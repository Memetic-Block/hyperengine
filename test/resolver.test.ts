import { describe, it, expect } from 'vitest'
import { extractRequires, pathToModuleName } from '../src/bundler/resolver.js'

describe('extractRequires', () => {
  it('extracts double-quoted requires', () => {
    const src = `local m = require("handlers.home")`
    expect(extractRequires(src)).toEqual(['handlers.home'])
  })

  it('extracts single-quoted requires', () => {
    const src = `local m = require('lib.utils')`
    expect(extractRequires(src)).toEqual(['lib.utils'])
  })

  it('extracts requires without parentheses', () => {
    const src = `local m = require "lustache"`
    expect(extractRequires(src)).toEqual(['lustache'])
  })

  it('extracts multiple requires', () => {
    const src = [
      'local a = require("mod.a")',
      'local b = require("mod.b")',
      'local c = require("mod.c")',
    ].join('\n')
    expect(extractRequires(src)).toEqual(['mod.a', 'mod.b', 'mod.c'])
  })

  it('returns empty array for no requires', () => {
    const src = 'print("hello")'
    expect(extractRequires(src)).toEqual([])
  })
})

describe('pathToModuleName', () => {
  it('converts file path to module name', () => {
    expect(pathToModuleName('/project/src/handlers/home.lua', '/project/src'))
      .toBe('handlers.home')
  })

  it('handles init.lua files', () => {
    expect(pathToModuleName('/project/src/mymod/init.lua', '/project/src'))
      .toBe('mymod')
  })

  it('handles top-level file', () => {
    expect(pathToModuleName('/project/src/utils.lua', '/project/src'))
      .toBe('utils')
  })
})
