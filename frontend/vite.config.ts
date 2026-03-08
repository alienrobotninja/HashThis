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
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // PDF generation — only loaded when user clicks "Download Certificate"
          'pdf-vendor': ['jspdf', 'qrcode'],
          // CKB wallet connector — large but needed at startup for wallet UI
          'ckb-vendor': ['@ckb-ccc/core', '@ckb-ccc/connector-react'],
          // React + router — stable, cache-friendly
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})