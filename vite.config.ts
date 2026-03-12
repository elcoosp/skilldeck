import path from 'node:path'
import { lingui } from '@lingui/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'

const host = process.env.TAURI_DEV_HOST

export default defineConfig(() => ({
  plugins: [
    tailwindcss(),
    react({
      // Use SWC plugin for Lingui macros
      plugins: [['@lingui/swc-plugin', {}]]
    }),
    lingui()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**']
    }
  }
}))
