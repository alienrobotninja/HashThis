import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['process', 'buffer', 'util', 'stream'],
      globals: { process: true, Buffer: true, global: true },
    }),
  ],
})
