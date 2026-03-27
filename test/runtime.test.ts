import { describe, it, expect } from 'vitest'
import { generateRuntimeSource, generateLustacheModules } from '../src/bundler/runtime.js'

const defaults = { handlers: false, patchKey: 'ui', stateKey: 'hyperengine_state' }

// NOTE: Lua runtime behavior (function bodies, handler logic, ACL patterns, variable names)
// is tested via Lua busted. These smoke tests only verify the TypeScript generator produces
// valid output and respects the handlers flag.

describe('generateRuntimeSource', () => {
  it('returns a non-empty Lua source string', async () => {
    const source = await generateRuntimeSource(defaults)

    expect(typeof source).toBe('string')
    expect(source.length).toBeGreaterThan(0)
    // Should declare the module table and return it
    expect(source).toContain('local hyperengine = {}')
    expect(source).toContain('return hyperengine')
  })

  it('includes handler registrations when handlers is true', async () => {
    const source = await generateRuntimeSource({ ...defaults, handlers: true })

    // Should auto-call handlers() and contain at least one Handlers.add
    expect(source).toContain('Handlers.add')
    const lines = source.split('\n')
    const handlerCalls = lines.filter((l) => l.trim() === 'hyperengine.handlers()')
    expect(handlerCalls).toHaveLength(1)
  })

  it('does not auto-register handlers when handlers is false', async () => {
    const source = await generateRuntimeSource(defaults)

    const lines = source.split('\n')
    const handlerCalls = lines.filter((l) => l.trim() === 'hyperengine.handlers()')
    expect(handlerCalls).toHaveLength(0)
  })

  it('injects patchKey and stateKey into output', async () => {
    const source = await generateRuntimeSource({ handlers: false, patchKey: 'dashboard', stateKey: 'my_state' })

    expect(source).toContain('local _patch_key = "dashboard"')
    expect(source).toContain('local _state_key = "my_state"')
  })
})

describe('generateLustacheModules', () => {
  it('returns all four lustache modules in dependency order', async () => {
    const modules = await generateLustacheModules()

    expect(modules).toHaveLength(4)
    expect(modules.map(m => m.name)).toEqual([
      'lustache.scanner',
      'lustache.context',
      'lustache.renderer',
      'lustache',
    ])
  })

  it('returns non-empty source for each module', async () => {
    const modules = await generateLustacheModules()

    for (const mod of modules) {
      expect(mod.source.length).toBeGreaterThan(0)
    }
  })

  it('main lustache module requires lustache.renderer', async () => {
    const modules = await generateLustacheModules()
    const main = modules.find(m => m.name === 'lustache')!

    expect(main.source).toContain('require("lustache.renderer")')
  })
})
