import type { Plugin, ResolvedConfig as ViteResolvedConfig } from 'vite'
import { loadConfig, resolveConfig } from './config.js'
import type { HyperstacheConfig, ResolvedConfig } from './config.js'
import { bundle } from './bundler/index.js'

export interface HyperstachePluginOptions extends HyperstacheConfig {}

/**
 * Vite plugin for hyperstache — bundles AO Lua processes with mustache templates.
 *
 * Usage in vite.config.ts:
 *   import { hyperstache } from 'hyperstache/vite'
 *   export default defineConfig({ plugins: [hyperstache({ entry: 'src/process.lua' })] })
 */
export function hyperstache(options?: HyperstachePluginOptions): Plugin {
  let hsConfig: ResolvedConfig
  let viteConfig: ViteResolvedConfig

  return {
    name: 'vite-plugin-hyperstache',

    async configResolved(config) {
      viteConfig = config
      const root = config.root

      if (options) {
        hsConfig = await resolveConfig(options, root)
      } else {
        hsConfig = await loadConfig(root)
      }
    },

    async buildStart() {
      const result = await bundle(hsConfig)
      console.log(
        `[hyperstache] Bundled ${result.moduleCount} modules, ${result.templateCount} templates → ${result.outPath}`,
      )
      if (result.unresolved.length > 0) {
        console.warn(
          `[hyperstache] Unresolved modules: ${result.unresolved.join(', ')}`,
        )
      }
    },

    configureServer(server) {
      // Watch Lua, template, and template-referenced asset files
      const extensions = hsConfig.templates.extensions
      const watchPatterns = [
        '**/*.lua',
        ...extensions.map((e) => `**/*${e}`),
      ]

      // If Vite template processing is enabled, also watch CSS/JS/TS
      // files under the templates directory
      if (hsConfig.templates.vite) {
        watchPatterns.push(
          '**/*.css',
          '**/*.scss',
          '**/*.sass',
          '**/*.less',
          '**/*.styl',
          '**/*.js',
          '**/*.ts',
          '**/*.jsx',
          '**/*.tsx',
        )
      }

      server.watcher.add(watchPatterns)
    },

    async handleHotUpdate({ file, server }) {
      const isLua = file.endsWith('.lua')
      const isTemplate = hsConfig.templates.extensions.some((ext) =>
        file.endsWith(ext),
      )
      const isTemplateAsset =
        hsConfig.templates.vite &&
        /\.(css|scss|sass|less|styl|js|ts|jsx|tsx)$/.test(file)

      if (isLua || isTemplate || isTemplateAsset) {
        console.log(`[hyperstache] File changed: ${file}, re-bundling...`)
        const result = await bundle(hsConfig)
        console.log(
          `[hyperstache] Re-bundled ${result.moduleCount} modules, ${result.templateCount} templates${result.viteProcessed ? ' (Vite processed)' : ''}`,
        )
        // Trigger full page reload since Lua changes affect the process
        server.ws.send({ type: 'full-reload' })
        return []
      }
    },
  }
}

export { defineConfig } from './config.js'
export type { HyperstacheConfig, ResolvedConfig, ViteTemplateOptions } from './config.js'
