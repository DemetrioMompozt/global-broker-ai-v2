import { getMicroProfitTargetNetUsd } from '../config/microProfitConfig.js'
import type { Opportunity } from '../strategy/globalOpportunityScanner.js'

export type TradingBookReference = {
  author: string
  focus: string
  sourceUrl: string
  title: string
}

export type ProfessionalTradingLibrarySkillStatus = {
  enabled: true
  mode: 'ALWAYS_ON_TRADER_LIBRARY_SKILL'
  booksLoaded: number
  lastLoadedAt: string
  copyrightPolicy: string
  corePrinciples: string[]
  candleBehaviorRules: string[]
  riskRules: string[]
  researchSources: TradingBookReference[]
  operationalImpact: string[]
}

export type ProfessionalTradingLibraryEvaluation = {
  approved: boolean
  scoreAdjustment: number
  blockers: string[]
  confirmations: string[]
  ruleHits: string[]
  reason: string
}

const loadedAt = new Date().toISOString()

export const professionalTradingLibrary: TradingBookReference[] = [
  {
    author: 'John J. Murphy',
    focus: 'Tendencia, soportes/resistencias, intermarket y estructura tecnica.',
    sourceUrl: 'https://books.google.com/books/about/Technical_Analysis_of_the_Financial_Mark.html?id=5zhXEqdr_IcC',
    title: 'Technical Analysis of the Financial Markets',
  },
  {
    author: 'Jack D. Schwager',
    focus: 'Gestion del riesgo, consistencia, seleccion de edge y lecciones de traders profesionales.',
    sourceUrl: 'https://www.wiley-vch.de/en/areas-interest/finance-economics-law/market-wizards-978-1-118-27305-0',
    title: 'Market Wizards',
  },
  {
    author: 'Mark Douglas',
    focus: 'Disciplina probabilistica, evitar revenge trading y no operar por necesidad emocional.',
    sourceUrl: 'https://books.apple.com/us/book/trading-in-the-zone/id357986493',
    title: 'Trading in the Zone',
  },
  {
    author: 'Steve Nison',
    focus: 'Lectura profesional de velas, rechazo, continuacion, agotamiento y confirmacion.',
    sourceUrl: 'https://www.penguinrandomhouse.com/books/350650/japanese-candlestick-charting-techniques-by-steve-nison/',
    title: 'Japanese Candlestick Charting Techniques',
  },
  {
    author: 'Thomas N. Bulkowski',
    focus: 'Patrones de graficos medidos con estadistica, fallas de ruptura y contexto.',
    sourceUrl: 'https://www.wiley-vch.de/en/areas-interest/finance-economics-law/encyclopedia-of-chart-patterns-978-1-119-73968-5',
    title: 'Encyclopedia of Chart Patterns',
  },
  {
    author: 'Van K. Tharp',
    focus: 'Expectancy, R multiples, position sizing y diseno de sistemas.',
    sourceUrl: 'https://vantharpinstitute.com/product/trade-your-way-to-financial-freedom',
    title: 'Trade Your Way to Financial Freedom',
  },
  {
    author: 'Alexander Elder',
    focus: 'Metodo, mente, dinero, triple screen y gestion activa de trades.',
    sourceUrl: 'https://www.wiley-vch.de/en/areas-interest/finance-economics-law/the-new-trading-for-a-living-978-1-118-44392-7',
    title: 'The New Trading for a Living',
  },
  {
    author: 'David R. Aronson',
    focus: 'Validacion estadistica, evitar data mining y no confundir intuicion con edge.',
    sourceUrl: 'https://www.wiley-vch.de/en/areas-interest/finance-economics-law/finance-investments-13fi/trading-13fi4/evidence-based-technical-analysis-978-0-470-00874-4',
    title: 'Evidence-Based Technical Analysis',
  },
  {
    author: 'Adam Grimes',
    focus: 'Regimen, presion compradora/vendedora, fallas, pullbacks y estructura real del mercado.',
    sourceUrl: 'https://www.wiley-vch.de/de/fachgebiete/finanzen-wirtschaft-recht/the-art-science-of-technical-analysis-978-1-118-11512-1',
    title: 'The Art and Science of Technical Analysis',
  },
  {
    author: 'Anna Coulling',
    focus: 'Relacion precio-volumen, esfuerzo contra resultado y confirmacion de participacion.',
    sourceUrl: 'https://www.annacoulling.com/a-complete-guide-to-volume-price-analysis-by-anna-coulling/',
    title: 'A Complete Guide to Volume Price Analysis',
  },
]

const corePrinciples = [
  'Operar solo cuando el precio confirme una tesis, no porque el agente necesite actividad.',
  'Separar idea buena de trade bueno: el spread, el margen y el stop pueden destruir una idea correcta.',
  'Toda entrada debe tener invalidacion clara antes de definir tamano.',
  'El objetivo neto exige movimiento realista despues de spread, comision, slippage y swap.',
  'La estadistica manda: patrones sin muestra suficiente se prueban en shadow, no en main paper.',
  'Despues de perdidas, reducir repeticion de patrones fallidos; no perseguir recuperacion.',
]

const candleBehaviorRules = [
  'No abrir con vela insuficiente, vela incompleta o ruptura sin cierre confirmado.',
  'Preferir entradas donde la vela cerrada muestra direccion, rango util y rechazo contra el lado perdedor.',
  'Bloquear entradas planas: si el precio no muestra desplazamiento direccional, no hay edge para target $2.',
  'Penalizar breakouts extendidos si el movimiento ya consumio la mayor parte del recorrido esperado.',
  'Usar velas para confirmar contexto, no para adivinar ticks aislados.',
]

const riskRules = [
  'No aceptar costo total mayor a 30% del target neto.',
  'No aceptar spread mayor a 20% del target neto.',
  'No aceptar una posicion cuyo margen comprima la cuenta por debajo de niveles profesionales.',
  'No duplicar simbolo ni repetir una direccion que viene perdiendo sin reversal excepcional.',
  'El sistema debe registrar por que entro, que lo invalida y que aprendizaje deja al cerrar.',
]

function candleSignal(opportunity: Opportunity) {
  const candle = opportunity.candleBehavior
  if (typeof candle !== 'object' || !candle) return null
  const record = candle as { signal?: string; score?: number; pattern?: string; reason?: string }
  return record
}

function isCrypto(opportunity: Opportunity) {
  return opportunity.assetClass === 'CRYPTO_CFD' || opportunity.source === 'BINANCE_REALTIME'
}

export function evaluateProfessionalTradingLibrarySkill(opportunity: Opportunity): ProfessionalTradingLibraryEvaluation {
  const blockers: string[] = []
  const confirmations: string[] = []
  const ruleHits: string[] = []
  const target = getMicroProfitTargetNetUsd()
  const candle = candleSignal(opportunity)
  const cfdScore = opportunity.cfdExpertScore ?? opportunity.opportunityScore
  const expected = opportunity.expectedNetProfit ?? 0
  const costRatio = expected > 0 ? target / expected : Infinity
  const moveMultiple = opportunity.edgeRequiredMoveBps && opportunity.edgeRequiredMoveBps > 0
    ? Math.abs(opportunity.edgeMoveBps ?? 0) / opportunity.edgeRequiredMoveBps
    : isCrypto(opportunity) ? 1 : 0

  if (!opportunity.setupConfirmed) {
    blockers.push(`sin setup confirmado: ${opportunity.setupStatus}`)
    ruleHits.push('Murphy/Grimes: contexto y estructura antes que actividad.')
  } else {
    confirmations.push('setup confirmado por motor operativo')
  }

  if (!candle || candle.signal === 'BLOCKS_ENTRY') {
    blockers.push(`vela no aprueba entrada: ${candle?.reason ?? 'sin lectura de vela cerrada'}`)
    ruleHits.push('Nison: la vela debe confirmar la historia del precio.')
  } else if (candle.signal === 'CONFIRMS_ENTRY' && (candle.score ?? 0) >= 70) {
    confirmations.push(`vela cerrada confirma: ${candle.pattern ?? 'patron direccional'} score ${candle.score ?? 0}`)
  } else if (isCrypto(opportunity)) {
    blockers.push(`cripto exige vela cerrada fuerte; lectura actual ${candle.signal ?? 'sin senal'} score ${candle.score ?? 0}`)
  }

  if (expected < target) {
    blockers.push(`expected net $${expected.toFixed(2)} menor al target $${target}`)
    ruleHits.push('Tharp: expectativa neta positiva antes de tamano.')
  } else {
    confirmations.push(`expectativa neta cubre target $${target}`)
  }

  if ((opportunity.quote.spreadBps ?? 0) > 25 && !isCrypto(opportunity)) {
    blockers.push(`spread ${opportunity.quote.spreadBps.toFixed(2)} bps demasiado alto para micro target`)
    ruleHits.push('CFD cost discipline: el costo de entrada no puede comerse el edge.')
  }

  if (moveMultiple < (isCrypto(opportunity) ? 1.4 : 1.2)) {
    blockers.push(`movimiento disponible ${moveMultiple.toFixed(2)}x no supera con holgura el movimiento requerido`)
    ruleHits.push('Bulkowski/Grimes: no perseguir patrones sin recorrido restante.')
  } else {
    confirmations.push(`recorrido ${moveMultiple.toFixed(2)}x sobre movimiento requerido`)
  }

  if (cfdScore < (isCrypto(opportunity) ? 86 : 84)) {
    blockers.push(`CFD expert score ${cfdScore.toFixed(0)} insuficiente para biblioteca profesional`)
  }

  if (costRatio > 0.85) {
    blockers.push('expected net demasiado justo contra el target; margen de error insuficiente')
    ruleHits.push('Aronson: exigir margen estadistico, no apenas pasar el umbral.')
  }

  const scoreAdjustment = confirmations.length * 2 - blockers.length * 8
  return {
    approved: blockers.length === 0,
    blockers,
    confirmations,
    reason: blockers.length
      ? `Professional Trading Library bloquea ${opportunity.cfdSymbol}: ${blockers.join('; ')}.`
      : `Professional Trading Library aprueba ${opportunity.cfdSymbol}: estructura, vela, expectativa y recorrido pasan los principios cargados.`,
    ruleHits,
    scoreAdjustment,
  }
}

export function getProfessionalTradingLibrarySystemPrompt() {
  return [
    'Biblioteca profesional cargada permanentemente. No copiar textos de libros; aplicar principios operativos originales.',
    `Libros base: ${professionalTradingLibrary.map((book) => `${book.title} (${book.author})`).join('; ')}.`,
    `Principios: ${corePrinciples.join(' ')}`,
    `Reglas de velas: ${candleBehaviorRules.join(' ')}`,
    `Reglas de riesgo CFD: ${riskRules.join(' ')}`,
    'Research only: toda recomendacion GPT debe quedar como hipotesis hasta validarse en paper/shadow.',
  ].join('\n')
}

export function getProfessionalTradingLibrarySkillStatus(): ProfessionalTradingLibrarySkillStatus {
  return {
    enabled: true,
    booksLoaded: professionalTradingLibrary.length,
    candleBehaviorRules,
    corePrinciples,
    copyrightPolicy: 'Solo principios operativos originales y referencias; no se cargan PDFs ni texto completo con copyright.',
    lastLoadedAt: loadedAt,
    mode: 'ALWAYS_ON_TRADER_LIBRARY_SKILL',
    operationalImpact: [
      'El trader entry gate usa esta biblioteca antes de abrir main paper.',
      'GPT research recibe esta biblioteca como contexto base permanente.',
      'La UI muestra la biblioteca para auditar que esta cargada.',
    ],
    researchSources: professionalTradingLibrary,
    riskRules,
  }
}
