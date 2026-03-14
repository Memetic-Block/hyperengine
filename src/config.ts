import { readFile, mkdir, writeFile, stat } from 'node:fs/promises'
import { resolve, dirname, join, extname } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { UserConfig as ViteUserConfig } from 'vite'

export interface ViteTemplateOptions {
  /** Vite plugins to use when processing templates */
  plugins?: ViteUserConfig['plugins']
  /** CSS options (PostCSS, preprocessors, etc.) */
  css?: ViteUserConfig['css']
  /** Resolve options (aliases, extensions, etc.) */
  resolve?: ViteUserConfig['resolve']
  /** Define global constant replacements */
  define?: ViteUserConfig['define']
}

export interface HyperstacheConfig {
  /** Lua entry point, e.g. "src/process.lua" */
  entry: string
  /** Output directory (default: "dist") */
  outDir?: string
  /** Output filename (default: "process.lua") */
  outFile?: string
  templates?: {
    /** File extensions treated as mustache templates (default: [ '.html', '.htm', '.tmpl', '.mustache', '.mst', '.mu', '.stache' ]) */
    extensions?: string[]
    /** Directory to scan for templates (default: auto-discover from entry dir) */
    dir?: string
    /** Enable Vite processing of templates. `true` for defaults, or pass options. */
    vite?: boolean | ViteTemplateOptions
  }
  luarocks?: {
    /** Luarocks dependencies, e.g. { lustache: "1.3.1-0" } */
    dependencies?: Record<string, string>
    /** Lua version for rockspec (default: "5.3") */
    luaVersion?: string
  }
}

export interface ResolvedConfig {
  root: string
  entry: string
  outDir: string
  outFile: string
  templates: {
    extensions: string[]
    dir: string
    vite: ViteTemplateOptions | false
  }
  luarocks: {
    dependencies: Record<string, string>
    luaVersion: string
  }
}

const CONFIG_FILES = [
  'hyperstache.config.ts',
  'hyperstache.config.js',
  'hyperstache.config.mjs',
]

async function resolveTemplatesDir(root: string, entryDir: string, configDir?: string): Promise<string> {
  if (configDir) return resolve(root, configDir)
  const templatesSubdir = join(entryDir, 'templates')
  try {
    const s = await stat(templatesSubdir)
    if (s.isDirectory()) return templatesSubdir
  } catch {}
  return entryDir
}

export async function resolveConfig(
  raw: HyperstacheConfig,
  root: string,
): Promise<ResolvedConfig> {
  const entry = resolve(root, raw.entry)
  const entryDir = dirname(entry)

  const rawVite = raw.templates?.vite
  const viteOpts: ViteTemplateOptions | false =
    rawVite === true ? {} : rawVite === false || rawVite == null ? false : rawVite

  return {
    root,
    entry,
    outDir: resolve(root, raw.outDir ?? 'dist'),
    outFile: raw.outFile ?? 'process.lua',
    templates: {
      extensions: raw.templates?.extensions ?? [ '.html', '.htm', '.tmpl', '.mustache', '.mst', '.mu', '.stache' ],
      dir: await resolveTemplatesDir(root, entryDir, raw.templates?.dir),
      vite: viteOpts,
    },
    luarocks: {
      dependencies: raw.luarocks?.dependencies ?? {},
      luaVersion: raw.luarocks?.luaVersion ?? '5.3',
    },
  }
}

export async function loadConfig(root: string): Promise<ResolvedConfig> {
  for (const name of CONFIG_FILES) {
    const filePath = resolve(root, name)
    try {
      await readFile(filePath)
    } catch {
      continue
    }

    const ext = extname(name)
    let config: HyperstacheConfig

    if (ext === '.ts') {
      // Bundle the TS config to a temp ESM file with esbuild, then import it
      const { build } = await import('esbuild')
      const outdir = resolve(root, 'node_modules', '.hyperstache')
      const outfile = resolve(outdir, `config-${Date.now()}.mjs`)
      await mkdir(outdir, { recursive: true })
      await build({
        entryPoints: [filePath],
        outfile,
        format: 'esm',
        platform: 'node',
        bundle: true,
        write: true,
        packages: 'external',
      })
      const mod = await import(pathToFileURL(outfile).href)
      config = mod.default ?? mod
    } else {
      const mod = await import(pathToFileURL(filePath).href)
      config = mod.default ?? mod
    }

    return await resolveConfig(config, root)
  }

  throw new Error(
    `No config file found. Create one of: ${CONFIG_FILES.join(', ')}`,
  )
}

export function defineConfig(config: HyperstacheConfig): HyperstacheConfig {
  return config
}
