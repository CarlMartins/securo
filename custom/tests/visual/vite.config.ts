import base from '../../vite.config'
import { defineConfig } from 'vite'

export default defineConfig(async (env) => ({
  ...(typeof base === 'function' ? await base(env) : base),
  cacheDir: 'tmp/securo-visual/vite-cache',
  server: { watch: { usePolling: false } },
}))
