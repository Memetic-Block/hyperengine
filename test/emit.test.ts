import { describe, it, expect } from 'vitest'
import { emitBundle } from '../src/bundler/emit.js'
import type { LuaModule } from '../src/bundler/resolver.js'

describe('emitBundle', () => {
  it('emits a valid bundle with modules and templates', () => {
    const modules: LuaModule[] = [
      {
        name: 'lib.utils',
        path: '/fake/lib/utils.lua',
        source: 'local M = {}\nfunction M.hello() return "hi" end\nreturn M',
        dependencies: [],
      },
      {
        name: 'process',
        path: '/fake/process.lua',
        source: 'local utils = require("lib.utils")\nprint(utils.hello())',
        dependencies: ['lib.utils'],
      },
    ]

    const templatesLua = `local _templates = {}\n_templates["index.html"] = [[<h1>Hello</h1>]]\nreturn _templates`

    const output = emitBundle(modules, templatesLua)

    // Should have the module loader
    expect(output).toContain('local _modules = {}')
    expect(output).toContain('local function _require(name)')

    // Should register the dep module
    expect(output).toContain('_modules["lib.utils"]')

    // Should register the templates module
    expect(output).toContain('_modules["templates"]')

    // Entry module source should appear at the end, unwrapped
    expect(output).toContain('local utils = require("lib.utils")')

    // Should contain comment marker
    expect(output).toContain('-- Entry point')
  })

  it('emits bundle without templates when none provided', () => {
    const modules: LuaModule[] = [
      {
        name: 'main',
        path: '/fake/main.lua',
        source: 'print("hello")',
        dependencies: [],
      },
    ]

    const output = emitBundle(modules, null)
    expect(output).not.toContain('_modules["templates"]')
    expect(output).toContain('print("hello")')
  })

  it('emits bundle with runtime module after templates', () => {
    const modules: LuaModule[] = [
      {
        name: 'main',
        path: '/fake/main.lua',
        source: 'print("hello")',
        dependencies: [],
      },
    ]

    const templatesLua = `local _templates = {}\nreturn _templates`
    const runtimeLua = `local hyperstache = {}\nreturn hyperstache`

    const output = emitBundle(modules, templatesLua, runtimeLua)

    // Both modules should be registered
    expect(output).toContain('_modules["templates"]')
    expect(output).toContain('_modules["hyperstache"]')

    // Runtime should appear after templates
    const templatesIdx = output.indexOf('_modules["templates"]')
    const runtimeIdx = output.indexOf('_modules["hyperstache"]')
    expect(runtimeIdx).toBeGreaterThan(templatesIdx)
  })

  it('auto-requires runtime when autoRequireRuntime is true', () => {
    const modules: LuaModule[] = [
      {
        name: 'main',
        path: '/fake/main.lua',
        source: 'print("hello")',
        dependencies: [],
      },
    ]

    const runtimeLua = `local hyperstache = {}\nreturn hyperstache`

    const output = emitBundle(modules, null, runtimeLua, true)

    // Should have auto-require before entry point
    const entryIdx = output.indexOf('-- Entry point')
    const requireIdx = output.indexOf('require("hyperstache")', entryIdx)
    expect(requireIdx).toBeGreaterThan(entryIdx)
  })

  it('does not auto-require runtime when autoRequireRuntime is false', () => {
    const modules: LuaModule[] = [
      {
        name: 'main',
        path: '/fake/main.lua',
        source: 'print("hello")',
        dependencies: [],
      },
    ]

    const runtimeLua = `local hyperstache = {}\nreturn hyperstache`

    const output = emitBundle(modules, null, runtimeLua, false)

    // Should NOT have auto-require in the entry section
    const entryIdx = output.indexOf('-- Entry point')
    const afterEntry = output.slice(entryIdx)
    expect(afterEntry).not.toContain('require("hyperstache")')
  })
})
