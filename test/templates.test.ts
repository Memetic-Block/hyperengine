import { describe, it, expect } from 'vitest'
import { toLuaLongString, collectTemplates } from '../src/bundler/templates.js'
import { resolveConfig } from '../src/config.js'
import { resolve } from 'node:path'

describe('toLuaLongString', () => {
  it('wraps simple content', () => {
    expect(toLuaLongString('<h1>Hello</h1>')).toBe('[[<h1>Hello</h1>]]')
  })

  it('increases bracket level when content contains ]]', () => {
    const content = 'text with ]] inside'
    expect(toLuaLongString(content)).toBe('[=[text with ]] inside]=]')
  })

  it('increases bracket level further if needed', () => {
    const content = 'has ]] and ]=] inside'
    expect(toLuaLongString(content)).toBe('[==[has ]] and ]=] inside]==]')
  })
})

describe('collectTemplates', () => {
  it('collects templates from sample app', async () => {
    const root = resolve(__dirname, 'fixtures/sample-app')
    const config = await resolveConfig(
      {
        entry: 'src/process.lua',
      },
      root,
    )

    const result = await collectTemplates(config)
    expect(result.entries).toHaveLength(2)

    const keys = result.entries.map((e) => e.key).sort()
    expect(keys).toEqual(['index.html', 'profile.htm'])

    expect(result.luaSource).toContain('_templates["index.html"]')
    expect(result.luaSource).toContain('{{title}}')
  })
})
