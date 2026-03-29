import type { LuaModule } from './resolver.js'
import type { LustacheModule } from './runtime.js'

export interface EmitOptions {
  /** Resolved Lua modules (entry module last) */
  modules: LuaModule[]
  /** Generated Lua source for the templates module, or null */
  templatesLuaSource: string | null
  /** Generated Lua source for the hyperengine runtime module, or null */
  runtimeLuaSource?: string | null
  /** Whether to auto-require the runtime module in the entry point */
  autoRequireRuntime?: boolean
}

/**
 * Convert a module name to a valid Lua identifier for use as a function name.
 * Replaces dots, hyphens, and other non-alphanumeric characters with underscores.
 */
export function getModFnName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_')
}

/**
 * Emit a single bundled Lua file from resolved modules and a templates module.
 *
 * Each dependency module is wrapped in a loader function and registered via
 * `_G.package.loaded["module.name"]` so that `require("module.name")` works
 * within the AO runtime without overloading `require`.
 */
export function emitBundle(
  modules: LuaModule[],
  templatesLuaSource: string | null,
  runtimeLuaSource?: string | null,
  autoRequireRuntime?: boolean,
  autoRequireModules?: string[],
  lustacheModules?: LustacheModule[],
): string {
  const lines: string[] = []
  // Track module names for the package.loaded assignments at the end
  const registeredModules: string[] = []

  lines.push('-- Bundled by hyperengine')
  lines.push('')

  // Lustache modules (defined before templates and runtime so require("lustache") resolves)
  if (lustacheModules) {
    for (const mod of lustacheModules) {
      const fnName = getModFnName(mod.name)
      lines.push(`-- module: "${mod.name}"`)
      lines.push(`local function _loaded_mod_${fnName}()`)
      for (const line of mod.source.split('\n')) {
        lines.push(`  ${line}`)
      }
      lines.push('end')
      lines.push('')
      registeredModules.push(mod.name)
    }
  }

  // Templates module (if any)
  if (templatesLuaSource) {
    const fnName = getModFnName('templates')
    lines.push(`-- module: "templates"`)
    lines.push(`local function _loaded_mod_${fnName}()`)
    for (const line of templatesLuaSource.split('\n')) {
      lines.push(`  ${line}`)
    }
    lines.push('end')
    lines.push('')
    registeredModules.push('templates')
  }

  // Runtime module (if any) — defined after templates so require('templates') resolves
  if (runtimeLuaSource) {
    const fnName = getModFnName('hyperengine')
    lines.push(`-- module: "hyperengine"`)
    lines.push(`local function _loaded_mod_${fnName}()`)
    for (const line of runtimeLuaSource.split('\n')) {
      lines.push(`  ${line}`)
    }
    lines.push('end')
    lines.push('')
    registeredModules.push('hyperengine')
  }

  // Find the entry module (last one in the array by convention)
  const entryModule = modules[modules.length - 1]
  const depModules = modules.slice(0, -1)

  // Define dependency module loader functions
  for (const mod of depModules) {
    const fnName = getModFnName(mod.name)
    lines.push(`-- module: "${mod.name}"`)
    lines.push(`local function _loaded_mod_${fnName}()`)
    for (const line of mod.source.split('\n')) {
      lines.push(`  ${line}`)
    }
    lines.push('end')
    lines.push('')
    registeredModules.push(mod.name)
  }

  // Register all modules in package.loaded so require() resolves them
  for (const name of registeredModules) {
    const fnName = getModFnName(name)
    lines.push(`_G.package.loaded["${name}"] = _loaded_mod_${fnName}()`)
  }
  if (registeredModules.length > 0) {
    lines.push('')
  }

  // Entry module runs directly (not wrapped)
  lines.push('-- Entry point')
  if (autoRequireRuntime && runtimeLuaSource) {
    lines.push('require("hyperengine")')
  }
  if (autoRequireModules) {
    for (const mod of autoRequireModules) {
      lines.push(`require("${mod}")`)
    }
  }
  lines.push(entryModule.source)

  return lines.join('\n')
}

/**
 * Emit a bundled Lua file wrapped as a module.
 *
 * The output is identical to `emitBundle` but wrapped so that all side effects
 * (handler registration, etc.) execute when the module is `require()`'d,
 * and an empty table is returned to satisfy the Lua module contract.
 */
export function emitModule(
  modules: LuaModule[],
  templatesLuaSource: string | null,
  runtimeLuaSource?: string | null,
  autoRequireRuntime?: boolean,
  autoRequireModules?: string[],
  lustacheModules?: LustacheModule[],
): string {
  const inner = emitBundle(modules, templatesLuaSource, runtimeLuaSource, autoRequireRuntime, autoRequireModules, lustacheModules)
  const lines: string[] = []
  lines.push('local function _init()')
  for (const line of inner.split('\n')) {
    lines.push(`  ${line}`)
  }
  lines.push('end')
  lines.push('')
  lines.push('_init()')
  lines.push('return {}')
  return lines.join('\n')
}
