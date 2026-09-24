import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Dev-only middleware that serves /api/snapshot by running the same server
 * builder the Vercel function uses, so `npm run dev` behaves like production
 * without needing `vercel dev`. Keys come from .env (FRED_API_KEY / FMP_API_KEY,
 * with the VITE_-prefixed vars accepted as a fallback for existing setups).
 */
function snapshotDevApi(env: Record<string, string>): Plugin {
  return {
    name: 'snapshot-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/snapshot', async (_req, res) => {
        const fredKey = env.FRED_API_KEY || env.VITE_FRED_API_KEY
        const fmpKey = env.FMP_API_KEY || env.VITE_FMP_API_KEY
        res.setHeader('Content-Type', 'application/json')
        if (!fredKey || !fmpKey) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: 'FRED/FMP key not configured in .env' }))
          return
        }
        try {
          const mod = await server.ssrLoadModule('/src/server/buildSnapshot.ts')
          const snapshot = await mod.buildSnapshot({ fredKey, fmpKey })
          res.statusCode = 200
          res.end(JSON.stringify(snapshot))
        } catch (err) {
          res.statusCode = 502
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : 'snapshot build failed',
            })
          )
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss(), snapshotDevApi(env)],
  }
})
