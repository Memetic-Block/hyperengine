import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { JWK } from './wallet.js'
import type { ResolvedProcessConfig, ResolvedDeployConfig } from '../config.js'

export interface PublishResult {
  processName: string
  transactionId: string
  type: 'wasm' | 'lua'
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

export async function publishProcess(
  proc: ResolvedProcessConfig,
  deployConfig: ResolvedDeployConfig,
  wallet: JWK,
): Promise<PublishResult> {
  const { TurboFactory } = await import('@ardrive/turbo-sdk')
  const turbo = TurboFactory.authenticated({ privateKey: wallet })

  // Check for WASM build artifact first
  const wasmPath = join(proc.outDir, proc.name, 'process.wasm')
  if (await fileExists(wasmPath)) {
    const data = await readFile(wasmPath)
    const tags = [
      { name: 'Content-Type', value: 'application/wasm' },
      { name: 'Type', value: 'Module' },
      ...deployConfig.spawnTags,
    ]

    const response = await turbo.uploadFile({
      fileStreamFactory: () => data as unknown as ReadableStream,
      fileSizeFactory: () => data.byteLength,
      dataItemOpts: { tags },
    })

    return {
      processName: proc.name,
      transactionId: response.id,
      type: 'wasm',
    }
  }

  // Fall back to Lua file upload (dynamic read modules)
  const luaPath = join(proc.outDir, proc.outFile)
  if (!(await fileExists(luaPath))) {
    throw new Error(
      `No build artifact found for "${proc.name}". Run \`hyperstache build\` first.\n` +
      `  Looked for: ${wasmPath}\n` +
      `  Looked for: ${luaPath}`,
    )
  }

  const data = await readFile(luaPath)
  const tags = [
    { name: 'Content-Type', value: 'text/x-lua' },
    { name: 'Type', value: 'Module' },
    ...deployConfig.spawnTags,
  ]

  const response = await turbo.uploadFile({
    fileStreamFactory: () => data as unknown as ReadableStream,
    fileSizeFactory: () => data.byteLength,
    dataItemOpts: { tags },
  })

  return {
    processName: proc.name,
    transactionId: response.id,
    type: 'lua',
  }
}
