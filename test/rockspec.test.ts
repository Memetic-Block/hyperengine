import { describe, it, expect } from 'vitest'
import { generateRockspec } from '../src/rockspec.js'
import { resolveConfig } from '../src/config.js'

describe('generateRockspec', () => {
  it('generates valid rockspec content', async () => {
    const config = await resolveConfig(
      {
        processes: {
          main: { entry: 'src/process.lua' },
        },
        luarocks: {
          dependencies: {
            lustache: '1.3.1-0',
          },
        },
      },
      '/fake/project',
    )

    const spec = generateRockspec(config, 'my-app', '0.1.0')

    expect(spec).toContain('package = "my-app"')
    expect(spec).toContain('version = "0.1.0-1"')
    expect(spec).toContain('"lua >= 5.3"')
    expect(spec).toContain('"lustache 1.3.1-0"')
    expect(spec).toContain('type = "builtin"')
  })

  it('generates rockspec with no extra deps', async () => {
    const config = await resolveConfig(
      {
        processes: {
          main: { entry: 'src/process.lua' },
        },
      },
      '/fake/project',
    )

    const spec = generateRockspec(config, 'bare-app')
    expect(spec).toContain('"lua >= 5.3"')
    expect(spec).not.toContain('lustache')
  })
})
