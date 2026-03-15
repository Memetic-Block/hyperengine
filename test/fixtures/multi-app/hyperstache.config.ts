import { defineConfig } from '../../../src/config.js'

export default defineConfig({
  processes: {
    main: { entry: 'src/process.lua' },
    worker: { entry: 'src/worker.lua', outFile: 'worker.lua' },
  },
  luarocks: {
    dependencies: {
      lustache: '1.3.1-0',
    },
  },
})
