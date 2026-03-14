import { mkdir, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import type { ResolvedConfig } from '../config.js'
import { resolveModules } from './resolver.js'
import { collectTemplates } from './templates.js'
import { emitBundle } from './emit.js'

export { resolveModules, collectTemplates, emitBundle }
export type { LuaModule, ResolveResult } from './resolver.js'
export type { TemplateEntry } from './templates.js'

export interface BundleResult {
  /** The bundled Lua source */
  output: string
  /** Path the bundle was written to */
  outPath: string
  /** Module names that could not be resolved */
  unresolved: string[]
  /** Number of Lua modules included */
  moduleCount: number
  /** Number of templates inlined */
  templateCount: number
}

/**
 * Run the full bundling pipeline: resolve → collect templates → emit.
 */
export async function bundle(config: ResolvedConfig): Promise<BundleResult> {
  // 1. Resolve Lua modules
  const { modules, unresolved } = await resolveModules(config)

  // 2. Collect templates
  const { entries, luaSource: templatesLua } = await collectTemplates(config)
  const templatesSource = entries.length > 0 ? templatesLua : null

  // 3. Emit bundle
  const output = emitBundle(modules, templatesSource)

  // 4. Write output
  const outPath = resolve(config.outDir, config.outFile)
  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, output, 'utf-8')

  return {
    output,
    outPath,
    unresolved,
    moduleCount: modules.length,
    templateCount: entries.length,
  }
}
