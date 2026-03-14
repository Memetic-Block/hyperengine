#!/usr/bin/env node

import { Command } from 'commander'
import { resolve } from 'node:path'
import { readFile } from 'node:fs/promises'
import { loadConfig } from './config.js'
import { bundle } from './bundler/index.js'
import { writeRockspec } from './rockspec.js'

const pkg = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf-8'),
)

const program = new Command()

program
  .name('hyperstache')
  .description('AO Lua process bundler with Mustache templates and Luarocks')
  .version(pkg.version)

program
  .command('build')
  .description('Bundle the AO Lua process')
  .option('-r, --root <dir>', 'Project root directory', '.')
  .action(async (opts) => {
    const root = resolve(opts.root)
    const config = await loadConfig(root)
    const result = await bundle(config)

    const viteNote = result.viteProcessed ? ' (Vite processed)' : ''
    console.log(`Bundled ${result.moduleCount} modules, ${result.templateCount} templates${viteNote}`)
    console.log(`Output: ${result.outPath}`)

    if (result.unresolved.length > 0) {
      console.warn(`Unresolved modules: ${result.unresolved.join(', ')}`)
    }
  })

program
  .command('dev')
  .description('Start Vite dev server with hyperstache plugin')
  .option('-r, --root <dir>', 'Project root directory', '.')
  .action(async (opts) => {
    const root = resolve(opts.root)
    const { createServer } = await import('vite')
    const { hyperstache } = await import('./vite-plugin.js')
    const config = await loadConfig(root)

    const server = await createServer({
      root,
      plugins: [hyperstache(config)],
    })

    await server.listen()
    server.printUrls()
  })

program
  .command('rockspec')
  .description('Generate a .rockspec file from config')
  .option('-r, --root <dir>', 'Project root directory', '.')
  .option('-n, --name <name>', 'Package name')
  .option('-v, --ver <version>', 'Package version', '0.1.0')
  .action(async (opts) => {
    const root = resolve(opts.root)
    const config = await loadConfig(root)
    const filePath = await writeRockspec(config, opts.name, opts.ver)
    console.log(`Rockspec written to: ${filePath}`)
  })

program.parse()
