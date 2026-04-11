import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadDotenv } from '../src/config.js'

let tmp: string
const ENV_KEYS: string[] = []

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'hs-dotenv-'))
})

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true })
  for (const key of ENV_KEYS) {
    delete process.env[key]
  }
  ENV_KEYS.length = 0
})

function track(...keys: string[]) {
  ENV_KEYS.push(...keys)
}

describe('loadDotenv', () => {
  it('loads key=value pairs into process.env', async () => {
    track('TEST_DOTENV_A', 'TEST_DOTENV_B')
    await writeFile(join(tmp, '.env'), 'TEST_DOTENV_A=hello\nTEST_DOTENV_B=world\n')
    loadDotenv(tmp)
    expect(process.env.TEST_DOTENV_A).toBe('hello')
    expect(process.env.TEST_DOTENV_B).toBe('world')
  })

  it('strips surrounding double quotes', async () => {
    track('TEST_DOTENV_DQ')
    await writeFile(join(tmp, '.env'), 'TEST_DOTENV_DQ="quoted value"\n')
    loadDotenv(tmp)
    expect(process.env.TEST_DOTENV_DQ).toBe('quoted value')
  })

  it('strips surrounding single quotes', async () => {
    track('TEST_DOTENV_SQ')
    await writeFile(join(tmp, '.env'), "TEST_DOTENV_SQ='single quoted'\n")
    loadDotenv(tmp)
    expect(process.env.TEST_DOTENV_SQ).toBe('single quoted')
  })

  it('skips comments and blank lines', async () => {
    track('TEST_DOTENV_C')
    await writeFile(join(tmp, '.env'), '# comment\n\n  \nTEST_DOTENV_C=yes\n# another comment\n')
    loadDotenv(tmp)
    expect(process.env.TEST_DOTENV_C).toBe('yes')
  })

  it('does not overwrite existing env vars', async () => {
    track('TEST_DOTENV_EXIST')
    process.env.TEST_DOTENV_EXIST = 'original'
    await writeFile(join(tmp, '.env'), 'TEST_DOTENV_EXIST=overwritten\n')
    loadDotenv(tmp)
    expect(process.env.TEST_DOTENV_EXIST).toBe('original')
  })

  it('silently ignores missing .env file', () => {
    expect(() => loadDotenv(tmp)).not.toThrow()
  })

  it('handles values containing equals signs', async () => {
    track('TEST_DOTENV_EQ')
    await writeFile(join(tmp, '.env'), 'TEST_DOTENV_EQ=a=b=c\n')
    loadDotenv(tmp)
    expect(process.env.TEST_DOTENV_EQ).toBe('a=b=c')
  })

  it('falls back to cwd .env when root has no .env', async () => {
    track('TEST_DOTENV_CWD')
    const subdir = join(tmp, 'child')
    await mkdir(subdir)
    // .env only in tmp (acting as cwd), not in subdir (acting as root)
    await writeFile(join(tmp, '.env'), 'TEST_DOTENV_CWD=from_cwd\n')
    const origCwd = process.cwd()
    process.chdir(tmp)
    try {
      loadDotenv(subdir)
      expect(process.env.TEST_DOTENV_CWD).toBe('from_cwd')
    } finally {
      process.chdir(origCwd)
    }
  })

  it('root .env takes priority over cwd .env', async () => {
    track('TEST_DOTENV_PRIO')
    const subdir = join(tmp, 'child')
    await mkdir(subdir)
    await writeFile(join(tmp, '.env'), 'TEST_DOTENV_PRIO=cwd_val\n')
    await writeFile(join(subdir, '.env'), 'TEST_DOTENV_PRIO=root_val\n')
    const origCwd = process.cwd()
    process.chdir(tmp)
    try {
      loadDotenv(subdir)
      expect(process.env.TEST_DOTENV_PRIO).toBe('root_val')
    } finally {
      process.chdir(origCwd)
    }
  })
})
