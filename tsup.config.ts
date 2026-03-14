import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
    vite: 'src/vite-plugin.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node18',
  splitting: true,
  sourcemap: true,
  shims: false,
  external: [
    'commander',
    'fast-glob',
    'vite',
    'esbuild',
  ],
})
