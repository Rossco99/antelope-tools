import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const src = (dir) => path.resolve(import.meta.dirname, 'src', dir)

export default defineConfig({
  plugins: [react()],
  // some wallet/chain libraries still reference Node's `global`
  define: { global: 'globalThis' },
  // the network .env lives in the repository root; Docker builds pass the
  // same variables through the environment instead
  envDir: '..',
  envPrefix: 'REACT_APP_',
  resolve: {
    // absolute imports from src/ (CRA's baseUrl), e.g. `import x from 'utils'`
    alias: [
      { find: /^components(?=\/|$)/, replacement: src('components') },
      { find: /^config(?=\/|$)/, replacement: src('config') },
      { find: /^context(?=\/|$)/, replacement: src('context') },
      { find: /^hooks(?=\/|$)/, replacement: src('hooks') },
      { find: /^routes(?=\/|$)/, replacement: src('routes') },
      { find: /^utils(?=\/|$)/, replacement: src('utils') },
      // MUI 5 icon files at the package root are CommonJS; use the ES modules
      {
        find: /^@mui\/icons-material\/(?!esm\/)(.+)$/,
        replacement: '@mui/icons-material/esm/$1',
      },
    ],
  },
  server: {
    host: true,
    port: Number(process.env.PORT) || 3000,
  },
  build: {
    outDir: 'build',
  },
})
