import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { collectAdminTemplates } from '../src/bundler/admin.js'
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

let adminDir: string

beforeEach(async () => {
  adminDir = await mkdtemp(join(tmpdir(), 'hs-admin-test-'))
})

afterEach(async () => {
  await rm(adminDir, { recursive: true, force: true })
})

describe('collectAdminTemplates', () => {
  it('collects HTML files from admin directory', async () => {
    await writeFile(join(adminDir, 'index.html'), '<h1>Admin</h1>')
    const entries = await collectAdminTemplates({ dir: adminDir })

    expect(entries).toHaveLength(1)
    expect(entries[0].key).toBe('admin/index.html')
    expect(entries[0].content).toBe('<h1>Admin</h1>')
  })

  it('prefixes entries with admin/', async () => {
    await writeFile(join(adminDir, 'index.html'), '<h1>Admin</h1>')
    await writeFile(join(adminDir, 'settings.htm'), '<h1>Settings</h1>')
    const entries = await collectAdminTemplates({ dir: adminDir })

    const keys = entries.map((e) => e.key).sort()
    expect(keys).toEqual(['admin/index.html', 'admin/settings.htm'])
  })

  it('returns empty array when no HTML files exist', async () => {
    await writeFile(join(adminDir, 'styles.css'), 'body {}')
    const entries = await collectAdminTemplates({ dir: adminDir })

    expect(entries).toHaveLength(0)
  })

  it('collects only files matching given extensions', async () => {
    await writeFile(join(adminDir, 'index.html'), '<h1>Admin</h1>')
    await writeFile(join(adminDir, 'styles.css'), 'body {}')
    await writeFile(join(adminDir, 'admin.js'), 'console.log("hi")')

    const entries = await collectAdminTemplates({
      dir: adminDir,
      extensions: ['.html', '.css'],
    })

    const keys = entries.map((e) => e.key).sort()
    expect(keys).toEqual(['admin/index.html', 'admin/styles.css'])
  })

  it('collects from nested subdirectories', async () => {
    await mkdir(join(adminDir, 'sub'), { recursive: true })
    await writeFile(join(adminDir, 'index.html'), '<h1>Root</h1>')
    await writeFile(join(adminDir, 'sub', 'page.html'), '<h1>Sub</h1>')

    const entries = await collectAdminTemplates({ dir: adminDir })
    const keys = entries.map((e) => e.key).sort()
    expect(keys).toEqual(['admin/index.html', 'admin/sub/page.html'])
  })
})
