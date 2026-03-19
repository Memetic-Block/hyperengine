import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Mock @permaweb/aoconnect
const mockSpawn = vi.fn(async () => 'spawned-process-id')
const mockMessage = vi.fn(async () => 'eval-msg-id')
const mockResult = vi.fn(async () => ({}))

vi.mock('@permaweb/aoconnect', () => ({
  connect: vi.fn(() => ({
    spawn: mockSpawn,
    message: mockMessage,
    result: mockResult,
  })),
  createDataItemSigner: vi.fn(() => 'mock-signer'),
}))

import { deployProcess } from '../src/deploy/deploy.js'
import { writeManifest } from '../src/deploy/manifest.js'
import { AOS_MODULE_ID } from '../src/config.js'
import type { ResolvedProcessConfig, ResolvedDeployConfig } from '../src/config.js'

let tmp: string

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'hs-deploy-'))
  vi.clearAllMocks()
})

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true })
})

function makeProc(overrides: Partial<ResolvedProcessConfig> = {}): ResolvedProcessConfig {
  return {
    name: 'main',
    type: 'process',
    entry: join(tmp, 'src/process.lua'),
    outDir: join(tmp, 'dist'),
    outFile: 'process.lua',
    root: tmp,
    templates: { extensions: ['.html'], dir: join(tmp, 'src/templates'), vite: false },
    luarocks: { dependencies: {}, luaVersion: '5.3' },
    runtime: { enabled: false, handlers: false, adminInterface: { enabled: false, path: 'admin' } },
    ...overrides,
  }
}

const deployConfig: ResolvedDeployConfig = {
  scheduler: '_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA',
  spawnTags: [],
  actionTags: [],
}

const wallet = { kty: 'RSA', n: 'test-n', e: 'AQAB' }

describe('deployProcess', () => {
  it('spawns with standard AOS module and evals bundled Lua', async () => {
    const proc = makeProc()
    await mkdir(join(tmp, 'dist'), { recursive: true })
    await writeFile(join(tmp, 'dist', 'process.lua'), '-- bundled lua code')

    const result = await deployProcess(proc, deployConfig, wallet, tmp)

    expect(result.processId).toBe('spawned-process-id')
    expect(result.moduleId).toBe(AOS_MODULE_ID)
    expect(mockSpawn).toHaveBeenCalledWith(
      expect.objectContaining({
        module: AOS_MODULE_ID,
        scheduler: deployConfig.scheduler,
      }),
    )
    expect(mockMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        process: 'spawned-process-id',
        data: '-- bundled lua code',
      }),
    )
    expect(mockResult).toHaveBeenCalled()
  })

  it('spawns with published moduleId from config (no Eval)', async () => {
    const proc = makeProc({ moduleId: 'custom-module-tx-id' })
    await mkdir(join(tmp, 'dist'), { recursive: true })

    const result = await deployProcess(proc, deployConfig, wallet, tmp)

    expect(result.moduleId).toBe('custom-module-tx-id')
    expect(mockSpawn).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'custom-module-tx-id',
      }),
    )
    // No Eval step for module builds
    expect(mockMessage).not.toHaveBeenCalled()
  })

  it('reads moduleId from deploy manifest when not in config', async () => {
    const proc = makeProc()
    // Create a WASM artifact to trigger module-build path
    await mkdir(join(tmp, 'dist', 'main'), { recursive: true })
    await writeFile(join(tmp, 'dist', 'main', 'process.wasm'), Buffer.alloc(4))
    // Write manifest with moduleId
    await writeManifest(tmp, {
      processes: { main: { moduleId: 'manifest-module-id', deployedAt: '2025-01-01T00:00:00Z' } },
    })

    const result = await deployProcess(proc, deployConfig, wallet, tmp)

    expect(result.moduleId).toBe('manifest-module-id')
    expect(mockMessage).not.toHaveBeenCalled()
  })

  it('throws when WASM exists but no moduleId available', async () => {
    const proc = makeProc()
    await mkdir(join(tmp, 'dist', 'main'), { recursive: true })
    await writeFile(join(tmp, 'dist', 'main', 'process.wasm'), Buffer.alloc(4))

    await expect(deployProcess(proc, deployConfig, wallet, tmp)).rejects.toThrow(
      /No module ID found/,
    )
  })

  it('throws when no build output exists for single-file deploy', async () => {
    const proc = makeProc()

    await expect(deployProcess(proc, deployConfig, wallet, tmp)).rejects.toThrow(
      /No build output found/,
    )
  })

  it('throws when Eval returns an error', async () => {
    mockResult.mockResolvedValueOnce({ Error: 'syntax error near line 1' })
    const proc = makeProc()
    await mkdir(join(tmp, 'dist'), { recursive: true })
    await writeFile(join(tmp, 'dist', 'process.lua'), 'invalid lua')

    await expect(deployProcess(proc, deployConfig, wallet, tmp)).rejects.toThrow(
      /Eval failed/,
    )
  })

  it('includes custom spawnTags and actionTags', async () => {
    const proc = makeProc()
    await mkdir(join(tmp, 'dist'), { recursive: true })
    await writeFile(join(tmp, 'dist', 'process.lua'), '-- lua')

    const customDeploy: ResolvedDeployConfig = {
      ...deployConfig,
      spawnTags: [{ name: 'App-Name', value: 'test-app' }],
      actionTags: [{ name: 'X-Custom', value: 'val' }],
    }

    await deployProcess(proc, customDeploy, wallet, tmp)

    expect(mockSpawn).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: expect.arrayContaining([
          { name: 'App-Name', value: 'test-app' },
        ]),
      }),
    )
    expect(mockMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: expect.arrayContaining([
          { name: 'X-Custom', value: 'val' },
        ]),
      }),
    )
  })

  it('passes hyperbeamUrl to connect options', async () => {
    const { connect } = await import('@permaweb/aoconnect')
    const proc = makeProc()
    await mkdir(join(tmp, 'dist'), { recursive: true })
    await writeFile(join(tmp, 'dist', 'process.lua'), '-- lua')

    const customDeploy: ResolvedDeployConfig = {
      ...deployConfig,
      hyperbeamUrl: 'https://hyperbeam.example.com',
    }

    await deployProcess(proc, customDeploy, wallet, tmp)

    expect(connect).toHaveBeenCalledWith(
      expect.objectContaining({
        MODE: 'legacy',
        CU_URL: 'https://hyperbeam.example.com',
        MU_URL: 'https://hyperbeam.example.com',
        GATEWAY_URL: 'https://hyperbeam.example.com',
      }),
    )
  })
})
