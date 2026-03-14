import { mkdir, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import type { ResolvedConfig } from '../config.js'
import { resolveModules } from './resolver.js'
import { collectTemplates } from './templates.js'
import { emitBundle } from './emit.js'
import { renderTemplates } from './vite-render.js'

export { resolveModules, collectTemplates, emitBundle, renderTemplates }
export type { LuaModule, ResolveResult } from './resolver.js'
export type { TemplateEntry } from './templates.js'
export type { EscapeResult } from './vite-render.js'

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
  /** Whether templates were processed through Vite */
  viteProcessed: boolean
}

/**
 * Run the full bundling pipeline: resolve → collect templates → emit.
 */
export async function bundle(config: ResolvedConfig): Promise<BundleResult> {
  // 1. Resolve Lua modules
  const { modules, unresolved } = await resolveModules(config)

  // 2. Collect templates
  const { entries, luaSource: templatesLua } = await collectTemplates(config)

  // 3. Process templates through Vite if enabled
  const viteEnabled = !!config.templates.vite
  let templatesSource: string | null = null

  if (entries.length > 0) {
    if (viteEnabled) {
      const processed = await renderTemplates(entries, config)
      // Re-generate Lua source from Vite-processed entries
      const { toLuaLongString } = await import('./templates.js')
      const lines: string[] = ['local _templates = {}']
      for (const entry of processed) {
        lines.push(`_templates["${entry.key}"] = ${toLuaLongString(entry.content)}`)
      }
      lines.push('return _templates')
      templatesSource = lines.join('\n')
    } else {
      templatesSource = templatesLua
    }
  }

  // 4. Emit bundle
  const output = emitBundle(modules, templatesSource)

  // 5. Write output
  const outPath = resolve(config.outDir, config.outFile)
  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, output, 'utf-8')

  return {
    output,
    outPath,
    unresolved,
    moduleCount: modules.length,
    templateCount: entries.length,
    viteProcessed: viteEnabled && entries.length > 0,
  }
}
