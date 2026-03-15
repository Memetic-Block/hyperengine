import { readFile } from 'node:fs/promises'
import { resolve, relative } from 'node:path'
import fg from 'fast-glob'
import type { ResolvedProcessConfig } from '../config.js'

export interface TemplateEntry {
  /** Relative key used in the templates table, e.g. "index.html" */
  key: string
  /** Absolute file path */
  path: string
  /** Raw template content */
  content: string
}

/**
 * Determine the appropriate Lua long-string bracket level.
 * If the content contains ]==], we increase the level.
 */
function bracketLevel(content: string): number {
  let level = 0
  while (content.includes(']' + '='.repeat(level) + ']')) {
    level++
  }
  return level
}

/**
 * Wrap content in Lua long-string brackets at the appropriate level.
 */
export function toLuaLongString(content: string): string {
  const level = bracketLevel(content)
  const eq = '='.repeat(level)
  return `[${eq}[${content}]${eq}]`
}

/**
 * Collect all template files and generate a Lua module source string.
 */
export async function collectTemplates(
  config: ResolvedProcessConfig,
): Promise<{ entries: TemplateEntry[]; luaSource: string }> {
  const patterns = config.templates.extensions.map(
    (ext) => `**/*${ext}`,
  )
  const files = await fg(patterns, {
    cwd: config.templates.dir,
    absolute: true,
  })

  const entries: TemplateEntry[] = []

  for (const filePath of files.sort()) {
    const content = await readFile(filePath, 'utf-8')
    const key = relative(config.templates.dir, filePath)
    entries.push({ key, path: filePath, content })
  }

  // Generate Lua module source
  const lines: string[] = ['local _templates = {}']
  for (const entry of entries) {
    lines.push(`_templates["${entry.key}"] = ${toLuaLongString(entry.content)}`)
  }
  lines.push('return _templates')

  return { entries, luaSource: lines.join('\n') }
}
