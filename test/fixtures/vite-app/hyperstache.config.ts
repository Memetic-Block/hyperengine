import { defineConfig } from '../../../src/config.js'

export default defineConfig({
  entry: 'src/process.lua',
  templates: {
    vite: true,
  },
  luarocks: {
    dependencies: {
      lustache: '1.3.1-0',
    },
  },
})
