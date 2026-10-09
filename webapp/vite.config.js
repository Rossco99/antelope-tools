import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { parseEnv } from 'node:util'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const src = (dir) => path.resolve(import.meta.dirname, 'src', dir)

// The selected network's settings are in the repository root .env (written by
// `make <network>`). Vite's own .env loading is disabled because it would also
// merge ../.env.local, which here is the "local" network config, not an
// override. Variables already in the environment (Docker builds) win.
const rootEnv = path.resolve(import.meta.dirname, '..', '.env')

if (existsSync(rootEnv)) {
  for (const [key, value] of Object.entries(
    parseEnv(readFileSync(rootEnv, 'utf8')),
  )) {
    if (!(key in process.env)) process.env[key] = value
  }
}

export default defineConfig({
  plugins: [react()],
  // some wallet/chain libraries still reference Node's `global`
  define: { global: 'globalThis' },
  envDir: false,
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
