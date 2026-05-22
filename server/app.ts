import './config/env.js'
import cors from 'cors'
import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { env } from './config/env.js'
import { startBinanceLivePriceProvider } from './feeds/binanceLivePriceProvider.js'
import { healthRouter } from './routes/healthRoutes.js'
import { livePriceRouter } from './routes/livePriceRoutes.js'
import { cfdPaperRouter, startCfdPaperAgent } from './routes/cfdPaperRoutes.js'
import { performanceRouter } from './routes/performanceRoutes.js'
import { vtMarketsRouter } from './routes/vtMarketsRoutes.js'

const app = express()
app.use(cors())
app.use(express.json())
app.use((request, response, next) => {
  if (!env.basicAuthUser || !env.basicAuthPassword) return next()
  const header = request.headers.authorization ?? ''
  const [scheme, encoded] = header.split(' ')
  const decoded = scheme === 'Basic' && encoded ? Buffer.from(encoded, 'base64').toString('utf8') : ''
  const separator = decoded.indexOf(':')
  const user = separator >= 0 ? decoded.slice(0, separator) : ''
  const password = separator >= 0 ? decoded.slice(separator + 1) : ''
  if (user === env.basicAuthUser && password === env.basicAuthPassword) return next()
  response.setHeader('WWW-Authenticate', 'Basic realm="Global Broker AI"')
  response.status(401).send('Authentication required')
})
app.use((_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
  response.setHeader('Pragma', 'no-cache')
  response.setHeader('Expires', '0')
  next()
})

app.use('/api/health', healthRouter)
app.use('/api/live-prices', livePriceRouter)
app.use('/api/cfd-paper', cfdPaperRouter)
app.use('/api/performance', performanceRouter)
app.use('/api/vt-markets', vtMarketsRouter)

const distPath = path.resolve(process.cwd(), 'dist')
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  app.use((request, response, next) => {
    if (request.path.startsWith('/api')) return next()
    response.sendFile(path.join(distPath, 'index.html'))
  })
}

startBinanceLivePriceProvider()
if (process.env.CFD_PAPER_AGENT_AUTOSTART !== 'false') startCfdPaperAgent()

app.listen(env.port, env.host, () => {
  console.log(`[v2] listening on http://${env.host}:${env.port}`)
  console.log('[v2] Paper only. Real trading disabled.')
})
