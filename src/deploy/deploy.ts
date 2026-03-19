import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { JWK } from './wallet.js'
import type { ResolvedProcessConfig, ResolvedDeployConfig } from '../config.js'
import { AOS_MODULE_ID } from '../config.js'
import type { ProcessManifestEntry } from './manifest.js'
import { readManifest } from './manifest.js'

export interface DeployResult {
  processName: string
  processId: string
  moduleId: string
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

export async function deployProcess(
  proc: ResolvedProcessConfig,
  deployConfig: ResolvedDeployConfig,
  wallet: JWK,
  root: string,
): Promise<DeployResult> {
  const { connect, createDataItemSigner } = await import('@permaweb/aoconnect')

  const ao = connect({
    MODE: 'legacy' as const,
    ...(deployConfig.hyperbeamUrl && {
      CU_URL: deployConfig.hyperbeamUrl,
      MU_URL: deployConfig.hyperbeamUrl,
      GATEWAY_URL: deployConfig.hyperbeamUrl,
    }),
  })
  const signer = createDataItemSigner(wallet)

  // Determine if this is a WASM module build or a standard single-file deploy
  const wasmPath = join(proc.outDir, proc.name, 'process.wasm')
  const hasWasm = await fileExists(wasmPath)

  // Resolve the module ID for the spawn
  let moduleId: string
  if (hasWasm || proc.moduleId) {
    // WASM module build: use the published module ID
    moduleId = proc.moduleId
      ?? (await readManifest(root)).processes[proc.name]?.moduleId
      ?? ''
    if (!moduleId) {
      throw new Error(
        `No module ID found for "${proc.name}". ` +
        `Run \`hyperstache publish --process ${proc.name}\` first to upload the WASM module.`,
      )
    }
  } else {
    // Standard single-file process: use the default AOS module
    moduleId = AOS_MODULE_ID
  }

  // Spawn the process
  const spawnTags = [
    { name: 'Name', value: proc.name },
    ...deployConfig.spawnTags,
  ]

  const processId = await ao.spawn({
    module: moduleId,
    scheduler: deployConfig.scheduler,
    signer,
    tags: spawnTags,
  })

  // For single-file processes, Eval the bundled Lua
  if (!hasWasm && !proc.moduleId) {
    const luaPath = join(proc.outDir, proc.outFile)
    if (!(await fileExists(luaPath))) {
      throw new Error(
        `No build output found for "${proc.name}". Run \`hyperstache build\` first.\n` +
        `  Expected: ${luaPath}`,
      )
    }

    const luaSource = await readFile(luaPath, 'utf-8')
    const evalTags = [
      { name: 'Action', value: 'Eval' },
      ...deployConfig.actionTags,
    ]

    const msgId = await ao.message({
      process: processId,
      signer,
      tags: evalTags,
      data: luaSource,
    })

    // Wait for the result to confirm the Eval succeeded
    const res = await ao.result({ process: processId, message: msgId })
    if (res.Error) {
      throw new Error(
        `Eval failed for "${proc.name}" (process: ${processId}):\n${res.Error}`,
      )
    }
  }

  return { processName: proc.name, processId, moduleId }
}
