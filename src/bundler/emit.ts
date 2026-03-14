import type { LuaModule } from './resolver.js'

/**
 * Emit a single bundled Lua file from resolved modules and a templates module.
 *
 * The output wraps each module in a function inside a package loader,
 * so `require("module.name")` works within the AO runtime.
 */
export function emitBundle(
  modules: LuaModule[],
  templatesLuaSource: string | null,
): string {
  const lines: string[] = []

  // Module loader preamble
  lines.push('-- Bundled by hyperstache')
  lines.push('local _modules = {}')
  lines.push('local _loaded = {}')
  lines.push('local _original_require = require')
  lines.push('')
  lines.push('local function _require(name)')
  lines.push('  if _loaded[name] then return _loaded[name] end')
  lines.push('  if _modules[name] then')
  lines.push('    _loaded[name] = _modules[name]()')
  lines.push('    return _loaded[name]')
  lines.push('  end')
  lines.push('  return _original_require(name)')
  lines.push('end')
  lines.push('require = _require')
  lines.push('')

  // Templates module (if any)
  if (templatesLuaSource) {
    lines.push('_modules["templates"] = function()')
    for (const line of templatesLuaSource.split('\n')) {
      lines.push(`  ${line}`)
    }
    lines.push('end')
    lines.push('')
  }

  // Find the entry module (last one in the array by convention)
  const entryModule = modules[modules.length - 1]
  const depModules = modules.slice(0, -1)

  // Register dependency modules
  for (const mod of depModules) {
    lines.push(`_modules["${mod.name}"] = function()`)
    for (const line of mod.source.split('\n')) {
      lines.push(`  ${line}`)
    }
    lines.push('end')
    lines.push('')
  }

  // Entry module runs directly (not wrapped)
  lines.push('-- Entry point')
  lines.push(entryModule.source)

  return lines.join('\n')
}
