import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export interface RuntimeOptions {
  handlers: boolean
  /** Top-level key for patch@1.0 publishing (default: "ui") */
  patchKey: string
  /** Key under which hyperstache_templates and hyperstache_acl are synced to patch@1.0 (default: "hyperstache_state") */
  stateKey: string
}

/**
 * Resolve the path to a bundled Lua runtime file.
 *
 * In source: src/bundler/runtime.ts → ../../src/lua/<name>
 * In dist (with splitting): dist/chunk-xxx.js → ./lua/<name>
 *
 * We detect which layout we're in by checking whether __dirname
 * ends with `src/bundler` (running from source / ts-node) or not
 * (running from the flat dist output produced by tsup with splitting).
 */
function luaPath(name: string): string {
  if (__dirname.endsWith('src/bundler') || __dirname.endsWith('src\\bundler')) {
    // Running from source
    return resolve(__dirname, '..', 'lua', name)
  }
  // Running from dist/ (flat chunk alongside dist/lua/)
  return resolve(__dirname, 'lua', name)
}

/**
 * Generate the Lua source for the `hyperstache` runtime module.
 *
 * Reads the Lua source from `src/lua/runtime.lua` and optionally
 * appends the auto-handler registration snippet.
 *
 * The module provides CRUD operations and lustache rendering for templates
 * at runtime inside a deployed AO process.
 *
 * - Persists state in the lowercase global `hyperstache_templates` (AO
 *   auto-persists lowercase globals across process reloads).
 * - Seeds from the bundled `templates` module on first load, merging
 *   without overwriting existing (runtime-modified) keys.
 * - Mutation handlers are guarded by `msg.From == Owner`.
 */
export async function generateRuntimeSource(options: RuntimeOptions): Promise<string> {
  let source = await readFile(luaPath('runtime.lua'), 'utf-8')

  // Inject the configured patch key
  source = source.replace(
    'local _patch_key = "ui"',
    `local _patch_key = "${options.patchKey}"`,
  )

  // Inject the configured state key
  source = source.replace(
    'local _state_key = "hyperstache_state"',
    `local _state_key = "${options.stateKey}"`,
  )

  if (options.handlers) {
    // Insert the auto-call just before the final `return hyperstache`
    source = source.replace(
      /\nreturn hyperstache\s*$/,
      '\nhyperstache.handlers()\n\nreturn hyperstache\n',
    )
  }

  return source
}
