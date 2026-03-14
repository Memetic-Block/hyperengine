import { defineConfig } from '../../../src/config.js'

export default defineConfig({
  entry: 'src/process.lua',
  luarocks: {
    dependencies: {
      lustache: '1.3.1-0',
    },
  },
})
