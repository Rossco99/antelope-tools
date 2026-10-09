// Headless browser smoke test for the webapp: visits each page, saves a
// screenshot and reports console errors, failed requests and GraphQL errors.
// Run with `make smoke` (uses the Playwright docker image).
import { chromium } from 'playwright'

const base = process.env.SMOKE_BASE_URL || 'http://localhost:3000'
const outDir = process.env.SMOKE_OUT_DIR || 'smoke-results'
const waitMs = parseInt(process.env.SMOKE_WAIT_MS || '8000')
const routes = [
  '/', '/block-producers', '/nodes', '/endpoints', '/endpoints-stats',
  '/nodes-distribution', '/rewards-distribution', '/cpu-benchmark',
  '/undiscoverable-bps', '/accounts', '/ricardian-contract', '/bpjson',
  '/about', '/help'
]

if (process.env.SMOKE_EVM === 'true') routes.push('/evm', '/evm-rpc-endpoints')

const browser = await chromium.launch()
let failures = 0

for (const route of routes) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
  const pageErrors = new Set()
  const gqlErrors = new Set()
  const consoleErrors = new Set()
  const failedRequests = new Set()

  page.on('pageerror', error => pageErrors.add(error.message.slice(0, 200)))
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.add(message.text().slice(0, 200))
  })
  page.on('requestfailed', request => {
    failedRequests.add(`${request.failure()?.errorText} ${request.url().slice(0, 120)}`)
  })
  page.on('response', async response => {
    if (response.url().includes('/v1/graphql')) {
      try {
        const body = await response.json()

        if (body.errors) gqlErrors.add(body.errors[0].message.slice(0, 200))
      } catch {}
    } else if (response.status() >= 400) {
      failedRequests.add(`${response.status()} ${response.url().slice(0, 120)}`)
    }
  })
  page.on('websocket', ws =>
    ws.on('framereceived', frame => {
      const payload = String(frame.payload)

      if (/"type":"(error|connection_error)"/.test(payload)) {
        gqlErrors.add(`ws ${payload.slice(0, 200)}`)
      }
    })
  )

  await page.goto(base + route, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(waitMs)

  const name = route === '/' ? 'home' : route.slice(1).replace(/\//g, '_')

  await page.screenshot({ path: `${outDir}/${name}.png` })
  await page.close()

  const failed = pageErrors.size + gqlErrors.size > 0

  if (failed) failures++
  console.log(`${failed ? 'FAIL' : 'ok  '} ${route}`)
  for (const error of pageErrors) console.log(`     page error: ${error}`)
  for (const error of gqlErrors) console.log(`     graphql error: ${error}`)
  if (process.env.SMOKE_VERBOSE === 'true') {
    for (const error of consoleErrors) console.log(`     console: ${error}`)
    for (const request of failedRequests) console.log(`     request: ${request}`)
  }
}

await browser.close()
console.log(`\n${routes.length - failures}/${routes.length} pages ok, screenshots in ${outDir}/`)
process.exit(failures ? 1 : 0)
