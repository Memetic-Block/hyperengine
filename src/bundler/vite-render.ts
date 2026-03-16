import { writeFile, mkdir, rm, cp } from 'node:fs/promises'
import { resolve, relative, dirname, basename, join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'
import type { Plugin, InlineConfig } from 'vite'
import type { OutputBundle, OutputAsset, OutputChunk } from 'rollup'
import type { ResolvedProcessConfig } from '../config.js'
import type { TemplateEntry } from './templates.js'

// ---------------------------------------------------------------------------
// Template syntax escaping
// ---------------------------------------------------------------------------

export interface EscapeResult {
  escaped: string
  markers: Map<number, string>
}

const TEMPLATE_SYNTAX_RE = /\{\{\{[^}]*\}\}\}|\{\{[^}]*\}\}/g

/**
 * Replace Mustache expressions with HTML comment markers so Vite's HTML
 * pipeline doesn't choke on them. Triple-brace `{{{…}}}` is matched first.
 */
export function escapeTemplateSyntax(html: string): EscapeResult {
  const markers = new Map<number, string>()
  let index = 0

  const escaped = html.replace(TEMPLATE_SYNTAX_RE, (match) => {
    const i = index++
    markers.set(i, match)
    return `<!--HS_MARKER_${i}-->`
  })

  return { escaped, markers }
}

/**
 * Restore previously escaped Mustache expressions.
 */
export function restoreTemplateSyntax(
  html: string,
  markers: Map<number, string>,
): string {
  let result = html
  for (const [i, original] of markers) {
    result = result.replace(`<!--HS_MARKER_${i}-->`, original)
  }
  return result
}

// ---------------------------------------------------------------------------
// Inlining Vite plugin
// ---------------------------------------------------------------------------

/**
 * A Vite plugin that inlines locally-built CSS and JS assets into the HTML
 * output. Remote URLs (http://, https://, //) are preserved.
 */
function hyperstacheInline(): Plugin {
  return {
    name: 'hyperstache-inline',
    enforce: 'post',

    generateBundle(_options, bundle: OutputBundle) {
      const consumed = new Set<string>()

      for (const [fileName, asset] of Object.entries(bundle)) {
        if (!fileName.endsWith('.html')) continue
        if (asset.type !== 'asset') continue

        let html = typeof asset.source === 'string'
          ? asset.source
          : new TextDecoder().decode(asset.source)

        // Inline CSS: <link rel="stylesheet" href="local.css"> → <style>…</style>
        html = html.replace(
          /<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*\/?>/gi,
          (_tag, href: string) => {
            if (isRemoteUrl(href)) return _tag
            const cssFile = resolveAssetRef(href, bundle)
            if (!cssFile) return _tag
            consumed.add(cssFile.fileName)
            const css = extractSource(cssFile)
            if (css == null) return _tag
            return `<style>${css}</style>`
          },
        )

        // Also handle <link href="…" rel="stylesheet"> (href before rel)
        html = html.replace(
          /<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*\/?>/gi,
          (_tag, href: string) => {
            if (isRemoteUrl(href)) return _tag
            const cssFile = resolveAssetRef(href, bundle)
            if (!cssFile) return _tag
            consumed.add(cssFile.fileName)
            const css = extractSource(cssFile)
            if (css == null) return _tag
            return `<style>${css}</style>`
          },
        )

        // Inline JS: <script … src="local.js"> → <script>…</script>
        html = html.replace(
          /<script\s+([^>]*)src=["']([^"']+)["']([^>]*)>\s*<\/script>/gi,
          (_tag, before: string, src: string, after: string) => {
            if (isRemoteUrl(src)) return _tag
            const jsFile = resolveAssetRef(src, bundle)
            if (!jsFile || jsFile.type !== 'chunk') return _tag
            consumed.add(jsFile.fileName)
            // Strip type="module" — inlined code runs as classic script
            const attrs = (before + after)
              .replace(/type=["']module["']/gi, '')
              .trim()
            const open = attrs ? `<script ${attrs}>` : '<script>'
            return `${open}${jsFile.code}</script>`
          },
        )

        ;(asset as OutputAsset).source = html
      }

      // Remove consumed CSS/JS assets from the bundle output
      for (const name of consumed) {
        delete bundle[name]
      }
    },
  }
}

function isRemoteUrl(url: string): boolean {
  return /^(https?:)?\/\//.test(url)
}

function extractSource(asset: OutputAsset | OutputChunk): string | null {
  if (asset.type === 'chunk') return asset.code
  if (typeof asset.source === 'string') return asset.source
  return new TextDecoder().decode(asset.source)
}

function resolveAssetRef(
  href: string,
  bundle: OutputBundle,
): (OutputAsset | OutputChunk) | undefined {
  // Strip leading /
  const key = href.replace(/^\//, '')
  return bundle[key] as (OutputAsset | OutputChunk) | undefined
}

// ---------------------------------------------------------------------------
// Vite build orchestration
// ---------------------------------------------------------------------------

/**
 * Process templates through Vite's build pipeline, inlining local CSS/JS
 * assets and preserving Mustache expressions.
 *
 * Only `.html` files are fed through Vite (it only supports `.html` entry
 * points). Other template extensions are passed through with Mustache
 * expressions intact.
 *
 * If `config.templates.vite` is `false`, returns entries unchanged.
 */
export async function renderTemplates(
  entries: TemplateEntry[],
  config: ResolvedProcessConfig,
): Promise<TemplateEntry[]> {
  if (!config.templates.vite || entries.length === 0) {
    return entries
  }

  // Split entries: only .html files go through Vite
  const htmlEntries = entries.filter((e) => e.key.endsWith('.html'))
  const otherEntries = entries.filter((e) => !e.key.endsWith('.html'))

  if (htmlEntries.length === 0) {
    return entries
  }

  // 1. Copy the entire templates directory to a temp location so Vite
  //    can resolve relative asset imports (CSS, JS, TS, etc.)
  const tmpBase = resolve(
    tmpdir(),
    `hyperstache-${randomBytes(6).toString('hex')}`,
  )
  await cp(config.templates.dir, tmpBase, { recursive: true })

  // 2. Escape Mustache syntax and overwrite HTML files in temp
  const escapeMap = new Map<
    string,
    { entry: TemplateEntry; markers: Map<number, string> }
  >()

  const inputEntries: Record<string, string> = {}
  for (const entry of htmlEntries) {
    const { escaped, markers } = escapeTemplateSyntax(entry.content)
    const tempPath = resolve(tmpBase, entry.key)
    await mkdir(dirname(tempPath), { recursive: true })
    await writeFile(tempPath, escaped, 'utf-8')
    const name = entry.key.replace(/\.[^.]+$/, '')
    inputEntries[name] = tempPath
    escapeMap.set(entry.key, { entry, markers })
  }

  try {
    // 3. Build with Vite
    const viteOpts = config.templates.vite as Exclude<
      typeof config.templates.vite,
      false
    >
    const { build, loadConfigFromFile, mergeConfig } = await import('vite')

    // Try to load project-level vite.config
    let projectConfig: InlineConfig = {}
    const loaded = await loadConfigFromFile(
      { command: 'build', mode: 'production' },
      undefined,
      config.root,
    ).catch(() => null)
    if (loaded) {
      projectConfig = loaded.config
    }

    // Merge: project vite.config → hyperstache template overrides → forced settings
    const hyperstacheOverrides: InlineConfig = {
      plugins: viteOpts.plugins ?? [],
      css: viteOpts.css,
      resolve: viteOpts.resolve,
      define: viteOpts.define,
      build: {
        rollupOptions: {
          external: viteOpts.external,
        },
      },
    }

    const forcedConfig: InlineConfig = {
      root: tmpBase,
      logLevel: 'warn',
      plugins: [hyperstacheInline()],
      build: {
        write: false,
        emptyOutDir: false,
        cssCodeSplit: false,
        assetsInlineLimit: Infinity,
        rollupOptions: {
          input: inputEntries,
        },
        modulePreload: false,
      },
    }

    const merged = mergeConfig(
      mergeConfig(projectConfig, hyperstacheOverrides),
      forcedConfig,
    )

    const buildResult = await build(merged)

    // 4. Extract processed HTML from Rollup output
    const outputs = Array.isArray(buildResult) ? buildResult : [buildResult]
    const processedEntries: TemplateEntry[] = []

    for (const output of outputs) {
      if (!('output' in output)) continue

      for (const chunk of output.output) {
        if (!chunk.fileName.endsWith('.html')) continue

        const source =
          chunk.type === 'asset'
            ? typeof chunk.source === 'string'
              ? chunk.source
              : new TextDecoder().decode(chunk.source)
            : ''

        const matchKey = findMatchingKey(chunk.fileName, escapeMap)
        if (!matchKey) continue

        const { entry, markers } = escapeMap.get(matchKey)!
        const restored = restoreTemplateSyntax(source, markers)

        processedEntries.push({
          key: entry.key,
          path: entry.path,
          content: restored,
        })
      }
    }

    // For any HTML entries not found in Vite output, pass through unchanged
    const processedKeys = new Set(processedEntries.map((e) => e.key))
    for (const entry of htmlEntries) {
      if (!processedKeys.has(entry.key)) {
        processedEntries.push(entry)
      }
    }

    // Append non-HTML template entries unchanged
    processedEntries.push(...otherEntries)

    return processedEntries
  } finally {
    await rm(tmpBase, { recursive: true, force: true }).catch(() => {})
  }
}

function findMatchingKey(
  fileName: string,
  escapeMap: Map<string, unknown>,
): string | undefined {
  if (escapeMap.has(fileName)) return fileName
  for (const key of escapeMap.keys()) {
    if (
      fileName === key ||
      fileName.endsWith('/' + key) ||
      key.endsWith('/' + fileName)
    ) {
      return key
    }
  }
  return undefined
}
