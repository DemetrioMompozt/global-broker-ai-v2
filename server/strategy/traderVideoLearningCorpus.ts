import { buildTraderVideoExpertKnowledgeBase, type TraderVideoExpertKnowledgeBaseStatus } from './traderVideoExpertKnowledgeBase.js'

export type TraderVideoLearningCorpusStatus = {
  audioTranscript: {
    durationSeconds: number
    language: 'es'
    segments: number
    transcriptPath: string
  }
  expertKnowledgeBase: TraderVideoExpertKnowledgeBaseStatus
  externalPrinciples: Array<{
    appliedAs: string
    principle: string
    source: string
    url: string
  }>
  extractedRules: string[]
  mode: 'TRADER_VIDEO_LEARNING_CORPUS'
  overnightLearningFocus: string[]
  passAnalyses: Array<{
    focus: string
    learned: string[]
    pass: number
  }>
  sourceVideo: string
  timestamp: string
}

const transcriptPath = 'video_analysis_20260607/transcript_es.txt'

export function buildTraderVideoLearningCorpus(now = new Date()): TraderVideoLearningCorpusStatus {
  const expertKnowledgeBase = buildTraderVideoExpertKnowledgeBase(now)
  return {
    audioTranscript: {
      durationSeconds: 1406.87,
      language: 'es',
      segments: 500,
      transcriptPath,
    },
    externalPrinciples: [
      {
        appliedAs: 'No aceptar una vela aislada; exigir tendencia, ubicacion, nivel y confirmacion.',
        principle: 'Candlestick formations work best with support/resistance, trend context and confirmation.',
        source: 'Investopedia - Understanding Basic Candlestick Charts',
        url: 'https://www.investopedia.com/trading/candlestick-charting-what-is-it/',
      },
      {
        appliedAs: 'Reversal candle significa posible cambio de tendencia, no garantia de giro inmediato.',
        principle: 'Reversal patterns are better understood as trend-change warnings that require context.',
        source: 'Steve Nison / Candlecharts - Japanese Candlestick Charting Techniques',
        url: 'https://candlecharts.com/',
      },
      {
        appliedAs: 'Los patrones de velas no se usan como entrada mecanica; se tratan como evidencia que debe superar contexto, ubicacion y R/R.',
        principle: 'Candlestick patterns are probabilistic evidence and require identification discipline.',
        source: 'Wiley - Thomas Bulkowski, Encyclopedia of Candlestick Charts',
        url: 'https://www.wiley.com/en-ca/Encyclopedia%2Bof%2BCandlestick%2BCharts-p-9780470182017',
      },
      {
        appliedAs: 'Esperar activacion/ruptura antes de actuar sobre patrones visuales.',
        principle: 'Do not act on a perceived candle pattern until the pattern has formed and is activated.',
        source: 'Fidelity - Identifying Chart Patterns with Technical Analysis',
        url: 'https://www.fidelity.com/bin-public/060_www_fidelity_com/documents/learning-center/Idenitfying-Chart-Patterns.pdf',
      },
      {
        appliedAs: 'Leer tendencia por soporte/resistencia, trendlines, canales y confirmacion.',
        principle: 'Trendlines identify trend, support/resistance and channels; support/resistance are core context.',
        source: 'Investopedia - The Utility of Trendlines',
        url: 'https://www.investopedia.com/articles/trading/06/trendlines.asp',
      },
      {
        appliedAs: 'Leer velas barra por barra para detectar continuidad real, rango, pullback debil y fallo de recuperacion.',
        principle: 'Price action trend reading must identify what type of trend or range is unfolding before selecting a tactic.',
        source: 'Wiley - Al Brooks, Trading Price Action Trends',
        url: 'https://www.wiley.com/en-us/Trading%2BPrice%2BAction%2BTrends%3A%2BTechnical%2BAnalysis%2Bof%2BPrice%2BCharts%2BBar%2Bby%2BBar%2Bfor%2Bthe%2BSerious%2BTrader-p-9781118066515',
      },
      {
        appliedAs: 'ES/MES son el mercado base; la app no debe operar CFD dentro del metodo del video.',
        principle: 'E-mini and Micro E-mini S&P 500 futures are official CME equity index futures benchmarks.',
        source: 'CME Group - E-mini and Micro E-mini S&P 500 Futures',
        url: 'https://www.cmegroup.com/markets/equities/sp/e-mini-sandp500.html',
      },
      {
        appliedAs: 'El reloj tactico del metodo es New York: cash 09:30-16:00 ET, no la zona MT5 europea.',
        principle: 'The NYSE core trading session is 9:30 a.m. to 4:00 p.m. Eastern Time.',
        source: 'NYSE - Trading Hours and Calendars',
        url: 'https://www.nyse.com/trade/hours-calendars',
      },
      {
        appliedAs: 'Orderflow/bookmap solo confirma aceptacion, absorcion o agresion; no reemplaza el setup visual.',
        principle: 'Order flow analysis studies DOM, liquidity behavior, aggressor volume and executed trades.',
        source: 'Bookmap - Order Flow Trading Course',
        url: 'https://bookmap.com/learning-center/en/market-mechanics/bookmap-education-course/trading-order-flow-dom-market-depth-trading',
      },
    ],
    expertKnowledgeBase,
    extractedRules: [
      'El mercado futuro opera casi 23 horas, pero el metodo solo considera importante la sesion institucional/cash.',
      'Antes de abrir, en M30 se buscan precios donde hubo reaccion fuerte: dejaron de comprar y empezo a bajar, o dejaron de vender y empezo a subir.',
      'M30 solo sirve para pintar lineas; despues se cambia a M1 y no se vuelve a operar con M30.',
      'La meta no es capturar 30-40 puntos: se buscan una, dos o tres rotaciones limpias del dia.',
      'Los primeros 15 minutos despues de apertura cash crean el opening range; ORH y ORL se vuelven precios importantes.',
      'Un rompimiento solo es valido si el mercado logra sostenerse fuera del opening range.',
      'Si rompe y vuelve al rango, el rompimiento es falso y empieza la lectura de quien quedo mal jugado.',
      'El agente debe buscar si compradores o vendedores debiles quedaron atrapados y jugar contra ellos, no contra institucionales.',
      'La naturaleza del movimiento importa: subir/bajar con solapamiento y poco avance muestra falta de fuerza.',
      'La trendline se dibuja despues de confirmar lado debil, no antes.',
      'Para short, la linea se traza sobre lows/pivotes del pullback alcista debil; para long, sobre highs/pivotes del pullback bajista debil.',
      'La entrada exige ruptura de trendline y fallo al volver a meterse encima/debajo de ella.',
      'La vela de rejection cuenta cuando intenta recuperar y falla con venta/compra agresiva inmediata.',
      'La entrada se toma al romper el nivel de confirmacion despues del rechazo, con stop tecnico cerca.',
      'El trade debe arriesgar poco contra un objetivo mucho mayor; minimo 1:2.',
      'Bookmap/orderflow es segundo paso: volumen ejecutado grande y ordenes pasivas muestran zonas donde puede frenarse el movimiento.',
    ],
    mode: 'TRADER_VIDEO_LEARNING_CORPUS',
    overnightLearningFocus: [
      'Velas japonesas con contexto, no patrones aislados.',
      'Tendencia por estructura de maximos/minimos, solapamiento y velocidad.',
      'Opening range en S&P futures y comportamiento de false break.',
      'Trapped traders y falla de recuperacion.',
      'Trendline de tres puntos y retest fallido.',
      'Bookmap/orderflow: volumen ejecutado y liquidez pasiva como filtro posterior.',
      'Validacion paper con R/R minimo 1:2 y safety intacto.',
    ],
    passAnalyses: [
      {
        focus: 'Pasada visual del chart',
        learned: [
          'El video muestra niveles horizontales, NYVWAP, ORH/ORL, trendline azul y caja stop/target.',
          'La decision visual se construye sobre una secuencia, no sobre una sola vela.',
        ],
        pass: 1,
      },
      {
        focus: 'Pasada audio/transcript',
        learned: [
          'El trader prioriza institucionales y volumen; indicadores tradicionales no son el centro.',
          'La lectura clave es quien quedo mal jugado tras el opening range.',
        ],
        pass: 2,
      },
      {
        focus: 'Pasada tactica/horarios',
        learned: [
          'M30 antes de apertura para niveles de reaccion.',
          'M1 para operar despues del opening range.',
          'Opening range valida el resto del dia como zona de reaccion.',
        ],
        pass: 3,
      },
      {
        focus: 'Pasada ejecucion',
        learned: [
          'Se espera ruptura de trendline y fallo de recuperacion.',
          'La rejection candle confirma que el intento contrario no tiene fuerza.',
          'Stop se ubica donde la tesis queda invalidada.',
        ],
        pass: 4,
      },
      {
        focus: 'Pasada orderflow/bookmap',
        learned: [
          'Volumen ejecutado grande muestra precios donde paso actividad significativa.',
          'Ordenes pasivas grandes pueden frenar movimientos o definir zonas de interes.',
          'Bookmap es filtro avanzado posterior, no reemplaza el metodo visual base.',
        ],
        pass: 5,
      },
    ],
    sourceVideo: 'C:/Users/demet/Downloads/video/VID_20260607_203433759.mp4',
    timestamp: now.toISOString(),
  }
}
