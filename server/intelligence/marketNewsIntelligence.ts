import type { Opportunity } from '../strategy/globalOpportunityScanner.js'

type MarketNewsEvent = {
  affectedMarkets: string[]
  impact: 'LOW' | 'MEDIUM' | 'HIGH'
  publishedAt: string
  reason: string
  source: string
  title: string
  url: string
}

type MarketNewsSnapshot = {
  enabled: true
  status: 'READY' | 'STALE' | 'ERROR'
  lastUpdatedAt: string | null
  nextUpdateAt: string | null
  globalRisk: 'LOW' | 'MEDIUM' | 'HIGH'
  summary: string
  topEvents: MarketNewsEvent[]
  sources: Array<{ name: string; status: 'OK' | 'ERROR'; url: string }>
  error?: string
}

const updateIntervalMs = 5 * 60 * 1000
let cache: MarketNewsSnapshot = {
  enabled: true,
  globalRisk: 'LOW',
  lastUpdatedAt: null,
  nextUpdateAt: null,
  sources: [],
  status: 'STALE',
  summary: 'Market news intelligence inicializando.',
  topEvents: [],
}
let inflight: Promise<MarketNewsSnapshot> | null = null

const sources = [
  { name: 'Federal Reserve RSS', type: 'rss' as const, url: 'https://www.federalreserve.gov/feeds/press_all.xml' },
  { name: 'ECB RSS', type: 'rss' as const, url: 'https://www.ecb.europa.eu/rss/press.html' },
  {
    name: 'GDELT Global News',
    type: 'gdelt' as const,
    url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=(%22Federal%20Reserve%22%20OR%20FOMC%20OR%20ECB%20OR%20inflation%20OR%20CPI%20OR%20payrolls%20OR%20%22jobs%20report%22%20OR%20%22US%20dollar%22%20OR%20gold%20OR%20forex%20OR%20bitcoin%20OR%20ethereum)&mode=artlist&format=json&maxrecords=20&timespan=6h&sort=datedesc',
  },
]

function stripTags(value: string) {
  return value
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

function itemField(item: string, name: string) {
  const match = item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'))
  return match ? stripTags(match[1]) : ''
}

function parseRss(xml: string, source: string): MarketNewsEvent[] {
  const items = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].slice(0, 10)
  return items.map((match) => {
    const item = match[0]
    return classifyEvent({
      publishedAt: dateOrNow(itemField(item, 'pubDate')),
      source,
      title: itemField(item, 'title'),
      url: itemField(item, 'link'),
    })
  }).filter((event) => event.title)
}

function dateOrNow(value: string) {
  const time = Date.parse(value)
  return Number.isFinite(time) ? new Date(time).toISOString() : new Date().toISOString()
}

function classifyEvent(input: { publishedAt: string; source: string; title: string; url: string }): MarketNewsEvent {
  const text = input.title.toLowerCase()
  const affected = new Set<string>()
  let impact: MarketNewsEvent['impact'] = 'LOW'
  const reasons: string[] = []

  if (/\b(fomc|federal reserve|fed|powell|interest rate|rate decision|inflation|cpi|pce|payrolls|jobs report|treasury|yield|dollar)\b/i.test(text)) {
    affected.add('USD')
    affected.add('FOREX_CFD')
    affected.add('INDEX_CFD')
    affected.add('METAL_CFD')
    impact = 'HIGH'
    reasons.push('macro USD/Fed')
  }
  if (/\b(ecb|lagarde|euro area|eurozone|euro)\b/i.test(text)) {
    affected.add('EUR')
    affected.add('EURUSD.cfd')
    affected.add('FOREX_CFD')
    impact = impact === 'HIGH' ? 'HIGH' : 'MEDIUM'
    reasons.push('macro EUR/ECB')
  }
  if (/\b(gold|xau|precious metal|safe haven)\b/i.test(text)) {
    affected.add('XAUUSD.cfd')
    affected.add('METAL_CFD')
    impact = impact === 'LOW' ? 'MEDIUM' : impact
    reasons.push('oro/metales')
  }
  if (/\b(bitcoin|btc|ethereum|eth|crypto|stablecoin|binance|etf)\b/i.test(text)) {
    affected.add('CRYPTO_CFD')
    impact = impact === 'LOW' ? 'MEDIUM' : impact
    reasons.push('cripto')
  }
  if (/\b(war|attack|sanction|tariff|oil|opec|geopolitical|default|bank crisis)\b/i.test(text)) {
    affected.add('FOREX_CFD')
    affected.add('INDEX_CFD')
    affected.add('METAL_CFD')
    impact = 'HIGH'
    reasons.push('riesgo geopolitico/sistemico')
  }

  return {
    affectedMarkets: [...affected],
    impact,
    publishedAt: input.publishedAt,
    reason: reasons.length ? reasons.join(', ') : 'noticia de baja relevancia para el universo actual',
    source: input.source,
    title: input.title,
    url: input.url,
  }
}

async function fetchText(url: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6_000)
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'GlobalBrokerAI-v2 paper research bot' }, signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.text()
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchGdelt(url: string) {
  const raw = await fetchText(url)
  const parsed = JSON.parse(raw) as { articles?: Array<{ title?: string; url?: string; domain?: string; seendate?: string }> }
  return (parsed.articles ?? []).slice(0, 15).map((article) => classifyEvent({
    publishedAt: dateOrNow(article.seendate ?? ''),
    source: article.domain ? `GDELT:${article.domain}` : 'GDELT',
    title: article.title ?? '',
    url: article.url ?? '',
  })).filter((event) => event.title)
}

function dedupe(events: MarketNewsEvent[]) {
  const seen = new Set<string>()
  const next: MarketNewsEvent[] = []
  for (const event of events) {
    const key = `${event.title.toLowerCase()}|${event.url}`
    if (seen.has(key)) continue
    seen.add(key)
    next.push(event)
  }
  return next.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
}

async function refreshMarketNewsIntelligence() {
  const sourceStatuses: MarketNewsSnapshot['sources'] = []
  const events: MarketNewsEvent[] = []
  for (const source of sources) {
    try {
      if (source.type === 'rss') events.push(...parseRss(await fetchText(source.url), source.name))
      if (source.type === 'gdelt') events.push(...await fetchGdelt(source.url))
      sourceStatuses.push({ name: source.name, status: 'OK', url: source.url })
    } catch {
      sourceStatuses.push({ name: source.name, status: 'ERROR', url: source.url })
    }
  }
  const topEvents = dedupe(events).slice(0, 18)
  const high = topEvents.filter((event) => event.impact === 'HIGH')
  const medium = topEvents.filter((event) => event.impact === 'MEDIUM')
  const now = Date.now()
  cache = {
    enabled: true,
    globalRisk: high.length ? 'HIGH' : medium.length ? 'MEDIUM' : 'LOW',
    lastUpdatedAt: new Date(now).toISOString(),
    nextUpdateAt: new Date(now + updateIntervalMs).toISOString(),
    sources: sourceStatuses,
    status: sourceStatuses.some((source) => source.status === 'OK') ? 'READY' : 'ERROR',
    summary: high.length
      ? `${high.length} noticia(s) de alto impacto detectadas; el agente debe exigir confirmacion extra o esperar.`
      : medium.length
        ? `${medium.length} noticia(s) relevantes detectadas; operar solo con setup confirmado.`
        : 'Sin titulares recientes de alto impacto para el universo operado.',
    topEvents,
  }
  return cache
}

export async function getMarketNewsIntelligence() {
  const fresh = cache.lastUpdatedAt && Date.now() - new Date(cache.lastUpdatedAt).getTime() < updateIntervalMs
  if (fresh) return cache
  if (!inflight) inflight = refreshMarketNewsIntelligence().finally(() => { inflight = null })
  return inflight
}

function opportunityAffectedByEvent(opportunity: Opportunity, event: MarketNewsEvent) {
  const affected = new Set(event.affectedMarkets)
  if (affected.has(opportunity.cfdSymbol)) return true
  if (opportunity.assetClass && affected.has(opportunity.assetClass)) return true
  if (opportunity.cfdSymbol.includes('EUR') && affected.has('EUR')) return true
  if (opportunity.cfdSymbol.includes('USD') && affected.has('USD')) return true
  if (opportunity.assetClass === 'CRYPTO_CFD' && affected.has('CRYPTO_CFD')) return true
  return false
}

export function validateMarketNewsForOpportunity(input: {
  intelligence: MarketNewsSnapshot
  opportunity: Opportunity
}) {
  const relevant = input.intelligence.topEvents.filter((event) => opportunityAffectedByEvent(input.opportunity, event))
  const highImpact = relevant.filter((event) => event.impact === 'HIGH')
  const mediumImpact = relevant.filter((event) => event.impact === 'MEDIUM')
  const cfdScore = input.opportunity.cfdExpertScore ?? 0
  const score = input.opportunity.opportunityScore ?? 0
  const candleScore = typeof input.opportunity.candleBehavior === 'object'
    && input.opportunity.candleBehavior
    && 'score' in input.opportunity.candleBehavior
    && typeof input.opportunity.candleBehavior.score === 'number'
    ? input.opportunity.candleBehavior.score
    : input.opportunity.candleBehaviorScore ?? 0

  if (input.intelligence.status === 'ERROR') {
    return { approved: true, reason: 'News intelligence no disponible; no bloquea, pero el audit lo marca como stale.', relevantEvents: [] as MarketNewsEvent[] }
  }
  if (highImpact.length && (score < 97 || cfdScore < 95 || candleScore < 82)) {
    return {
      approved: false,
      reason: `News intelligence bloquea entrada: noticia de alto impacto (${highImpact[0].title}) afecta ${input.opportunity.cfdSymbol}; exige score 97, CFD 95 y vela 82.`,
      relevantEvents: highImpact.slice(0, 3),
    }
  }
  if (mediumImpact.length && (score < 92 || cfdScore < 90 || candleScore < 76)) {
    return {
      approved: false,
      reason: `News intelligence exige confirmacion extra por noticia relevante (${mediumImpact[0].title}).`,
      relevantEvents: mediumImpact.slice(0, 3),
    }
  }
  return {
    approved: true,
    reason: relevant.length
      ? `News intelligence aprueba con cautela: ${relevant.length} noticia(s) relevantes, pero el setup supera umbrales extra.`
      : 'News intelligence sin riesgo relevante para este simbolo.',
    relevantEvents: relevant.slice(0, 3),
  }
}
