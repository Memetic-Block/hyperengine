import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadWallet } from '../src/deploy/wallet.js'

let tmp: string

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'hs-wallet-'))
})

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true })
})

describe('loadWallet', () => {
  it('loads a valid JWK file', async () => {
    const jwk = { kty: 'RSA', n: 'test-n', e: 'AQAB', d: 'test-d' }
    await writeFile(join(tmp, 'wallet.json'), JSON.stringify(jwk))

    const result = await loadWallet('wallet.json', tmp)
    expect(result.kty).toBe('RSA')
    expect(result.n).toBe('test-n')
    expect(result.e).toBe('AQAB')
    expect(result.d).toBe('test-d')
  })

  it('throws when file does not exist', async () => {
    await expect(loadWallet('missing.json', tmp)).rejects.toThrow(
      /Wallet file not found/,
    )
  })

  it('throws when file is not valid JSON', async () => {
    await writeFile(join(tmp, 'bad.json'), 'not json')
    await expect(loadWallet('bad.json', tmp)).rejects.toThrow(
      /not valid JSON/,
    )
  })

  it('throws when file is not a valid JWK', async () => {
    await writeFile(join(tmp, 'invalid.json'), JSON.stringify({ foo: 'bar' }))
    await expect(loadWallet('invalid.json', tmp)).rejects.toThrow(
      /not a valid JWK/,
    )
  })

  it('resolves relative paths from root', async () => {
    const jwk = { kty: 'RSA', n: 'n', e: 'e' }
    await writeFile(join(tmp, 'keys/wallet.json').replace('/keys/', '/'), JSON.stringify(jwk))
    // Use absolute path
    const result = await loadWallet(join(tmp, 'wallet.json'), '/')
    expect(result.kty).toBe('RSA')
  })
})
