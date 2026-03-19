import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export interface JWK {
  kty: string
  n: string
  e: string
  d?: string
  [key: string]: unknown
}

export async function loadWallet(walletPath: string, root: string): Promise<JWK> {
  const resolved = resolve(root, walletPath)
  let raw: string
  try {
    raw = await readFile(resolved, 'utf-8')
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      throw new Error(`Wallet file not found: ${resolved}`)
    }
    throw new Error(`Failed to read wallet file: ${resolved} (${code})`)
  }

  let jwk: JWK
  try {
    jwk = JSON.parse(raw)
  } catch {
    throw new Error(`Wallet file is not valid JSON: ${resolved}`)
  }

  if (!jwk.kty || !jwk.n || !jwk.e) {
    throw new Error(`Wallet file is not a valid JWK: ${resolved}`)
  }

  return jwk
}
