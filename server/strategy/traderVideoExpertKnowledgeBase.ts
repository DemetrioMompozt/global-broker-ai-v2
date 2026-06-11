export type TraderVideoKnowledgeTopic =
  | 'SP500_FUTURES_MARKET_STRUCTURE'
  | 'SESSION_TIMING'
  | 'CANDLE_CONTEXT'
  | 'SUPPORT_RESISTANCE_AND_TREND'
  | 'OPENING_RANGE_AND_AUCTION'
  | 'TRAPPED_TRADER_LOGIC'
  | 'ORDERFLOW_CONFIRMATION'
  | 'RISK_AND_EXECUTION'

export type TraderVideoKnowledgeSource = {
  institution: string
  reliability: 'PRIMARY_MARKET_SOURCE' | 'PROFESSIONAL_EDUCATION' | 'CLASSIC_TEXT' | 'USER_METHOD'
  title: string
  url: string
}

export type TraderVideoKnowledgeRule = {
  agentUse: string
  appliedToVideoMethod: string
  id: string
  principle: string
  prohibitedUse: string
  sources: TraderVideoKnowledgeSource[]
  topic: TraderVideoKnowledgeTopic
}

export type TraderVideoExpertKnowledgeBaseStatus = {
  curatedStudyLibrary: Array<{
    appliedAs: string
    legalUse: string
    title: string
    source: TraderVideoKnowledgeSource
  }>
  mode: 'TRADER_VIDEO_EXPERT_KNOWLEDGE_BASE'
  primaryMethodSource: 'USER_VIDEO_AND_INSTRUCTIONS'
  principles: TraderVideoKnowledgeRule[]
  researchStandard: string[]
  safetyBoundary: string[]
  timestamp: string
  version: 'EXPERT_LIBRARY_2026_06_11'
}

const cmeEsSource: TraderVideoKnowledgeSource = {
  institution: 'CME Group',
  reliability: 'PRIMARY_MARKET_SOURCE',
  title: 'E-mini S&P 500 Futures Overview',
  url: 'https://www.cmegroup.com/markets/equities/sp/e-mini-sandp500.html',
}

const cmeMesSource: TraderVideoKnowledgeSource = {
  institution: 'CME Group',
  reliability: 'PRIMARY_MARKET_SOURCE',
  title: 'Micro E-mini S&P 500 Index Futures',
  url: 'https://www.cmegroup.com/markets/equities/sp/micro-e-mini-sandp-500.html',
}

const nyseHoursSource: TraderVideoKnowledgeSource = {
  institution: 'NYSE',
  reliability: 'PRIMARY_MARKET_SOURCE',
  title: 'NYSE Trading Hours and Calendars',
  url: 'https://www.nyse.com/trade/hours-calendars',
}

const cmtSource: TraderVideoKnowledgeSource = {
  institution: 'CMT Association',
  reliability: 'PROFESSIONAL_EDUCATION',
  title: 'A Complete Understanding of Price Action',
  url: 'https://content.cmtassociation.org/a/a-complete-understanding-of-price-action',
}

const fidelitySource: TraderVideoKnowledgeSource = {
  institution: 'Fidelity',
  reliability: 'PROFESSIONAL_EDUCATION',
  title: 'Identifying Chart Patterns with Technical Analysis',
  url: 'https://www.fidelity.com/bin-public/060_www_fidelity_com/documents/learning-center/Idenitfying-Chart-Patterns.pdf',
}

const nisonSource: TraderVideoKnowledgeSource = {
  institution: 'Steve Nison / Candlecharts',
  reliability: 'CLASSIC_TEXT',
  title: 'Japanese Candlestick Charting Techniques',
  url: 'https://candlecharts.com/',
}

const bulkowskiSource: TraderVideoKnowledgeSource = {
  institution: 'Wiley / Thomas Bulkowski',
  reliability: 'CLASSIC_TEXT',
  title: 'Encyclopedia of Candlestick Charts',
  url: 'https://www.wiley.com/en-ca/Encyclopedia%2Bof%2BCandlestick%2BCharts-p-9780470182017',
}

const brooksSource: TraderVideoKnowledgeSource = {
  institution: 'Wiley / Al Brooks',
  reliability: 'CLASSIC_TEXT',
  title: 'Trading Price Action Trends',
  url: 'https://www.wiley.com/en-us/Trading%2BPrice%2BAction%2BTrends%3A%2BTechnical%2BAnalysis%2Bof%2BPrice%2BCharts%2BBar%2Bby%2BBar%2Bfor%2Bthe%2BSerious%2BTrader-p-9781118066515',
}

const investopediaCandlesSource: TraderVideoKnowledgeSource = {
  institution: 'Investopedia',
  reliability: 'PROFESSIONAL_EDUCATION',
  title: 'Understanding Basic Candlestick Charts',
  url: 'https://www.investopedia.com/trading/candlestick-charting-what-is-it/',
}

const investopediaTrendlineSource: TraderVideoKnowledgeSource = {
  institution: 'Investopedia',
  reliability: 'PROFESSIONAL_EDUCATION',
  title: 'The Utility of Trendlines',
  url: 'https://www.investopedia.com/articles/trading/06/trendlines.asp',
}

const bookmapOrderFlowSource: TraderVideoKnowledgeSource = {
  institution: 'Bookmap',
  reliability: 'PROFESSIONAL_EDUCATION',
  title: 'Order Flow Trading: DOM, liquidity behavior, aggressor volume and executed trades',
  url: 'https://bookmap.com/learning-center/en/market-mechanics/bookmap-education-course/trading-order-flow-dom-market-depth-trading',
}

const bookmapSupplyDemandSource: TraderVideoKnowledgeSource = {
  institution: 'Bookmap',
  reliability: 'PROFESSIONAL_EDUCATION',
  title: 'Real supply and demand through passive and aggressive order flow',
  url: 'https://bookmap.com/learning-center/en/supply-demand-setups/supply-demand-setups/real-supply-demand',
}

const userMethodSource: TraderVideoKnowledgeSource = {
  institution: 'User video method',
  reliability: 'USER_METHOD',
  title: 'Video and direct instructions: M30 marks, M1 execution, opening range, trapped traders, trendline failure',
  url: 'local://video_analysis_20260607/transcript_es.txt',
}

export function buildTraderVideoExpertKnowledgeBase(now = new Date()): TraderVideoExpertKnowledgeBaseStatus {
  const curatedStudyLibrary: TraderVideoExpertKnowledgeBaseStatus['curatedStudyLibrary'] = [
    {
      appliedAs: 'Velas japonesas se leen como psicologia de compradores/vendedores, pero solo tienen autoridad en niveles del metodo.',
      legalUse: 'Resumen operativo propio; no se almacena texto del libro.',
      source: nisonSource,
      title: 'Candlestick psychology with context',
    },
    {
      appliedAs: 'Patrones de velas se tratan como evidencia probabilistica y no como gatillos automaticos.',
      legalUse: 'Referencia bibliografica oficial y principio resumido.',
      source: bulkowskiSource,
      title: 'Statistical humility for candle patterns',
    },
    {
      appliedAs: 'La lectura bar-by-bar busca comportamiento institucional: continuidad, pullbacks y fallos de recuperacion.',
      legalUse: 'Referencia editorial oficial y principio resumido.',
      source: brooksSource,
      title: 'Bar-by-bar price action and institutional behavior',
    },
    {
      appliedAs: 'La vela contiene open/high/low/close; cuerpo y mechas describen rechazo, aceptacion o indecision.',
      legalUse: 'Fuente educativa publica resumida en reglas propias.',
      source: investopediaCandlesSource,
      title: 'Candle anatomy and sentiment',
    },
    {
      appliedAs: 'Una trendline gana fuerza por multiples toques y por actuar como soporte/resistencia; el metodo exige tres puntos.',
      legalUse: 'Fuente educativa publica resumida en regla propia.',
      source: investopediaTrendlineSource,
      title: 'Trendlines as support/resistance',
    },
    {
      appliedAs: 'Opening range y horario cash se anclan a la sesion institucional de New York.',
      legalUse: 'Fuente primaria de mercado.',
      source: nyseHoursSource,
      title: 'New York cash session as tactical clock',
    },
    {
      appliedAs: 'ES/MES son el benchmark; CFD/cripto/forex no sustituyen el metodo del video.',
      legalUse: 'Fuente primaria de mercado.',
      source: cmeEsSource,
      title: 'S&P futures market structure',
    },
    {
      appliedAs: 'Orderflow confirma absorcion, agresion y liquidez; no reemplaza la lectura visual del metodo.',
      legalUse: 'Fuente educativa publica resumida en regla propia.',
      source: bookmapOrderFlowSource,
      title: 'Orderflow as confirmation layer',
    },
  ]
  const principles: TraderVideoKnowledgeRule[] = [
    {
      agentUse: 'Confirmar que el instrumento es ES/MES/SP500 futuro o equivalente no-CFD antes de ejecutar el metodo.',
      appliedToVideoMethod: 'La mesa unica opera S&P futures/no-CFD; cualquier CFD queda fuera del metodo principal.',
      id: 'sp500-futures-first',
      principle: 'El metodo se debe anclar en el mercado real de futuros S&P; ES/MES son los benchmarks operativos.',
      prohibitedUse: 'No usar forex, cripto o CFD para compensar falta de senal en S&P.',
      sources: [cmeEsSource, cmeMesSource, userMethodSource],
      topic: 'SP500_FUTURES_MARKET_STRUCTURE',
    },
    {
      agentUse: 'Convertir toda lectura a hora New York y dividir la jornada en preparacion, opening range y ventana activa.',
      appliedToVideoMethod: 'Preparar M30 antes de 09:30 NY, no operar 09:30-09:45, y no abrir despues de 16:00 NY.',
      id: 'ny-core-session-clock',
      principle: 'La sesion cash de acciones de New York corre 09:30-16:00 ET; el metodo usa esa subasta como reloj institucional.',
      prohibitedUse: 'No tomar la hora MT5/Europa como verdad operativa para futuros S&P.',
      sources: [nyseHoursSource, userMethodSource],
      topic: 'SESSION_TIMING',
    },
    {
      agentUse: 'Usar velas japonesas como evidencia contextual dentro de una historia completa.',
      appliedToVideoMethod: 'Una mecha, envolvente o rejection solo cuenta si ocurre en ORH/ORL, marca M30, VWAP/zona relevante y confirma atrapados.',
      id: 'candles-need-context',
      principle: 'Las velas funcionan mejor con tendencia, soporte/resistencia, multiples marcos y confirmacion.',
      prohibitedUse: 'No abrir por una vela aislada, patron estetico o color rojo/verde sin ubicacion.',
      sources: [nisonSource, bulkowskiSource, investopediaCandlesSource, cmtSource],
      topic: 'CANDLE_CONTEXT',
    },
    {
      agentUse: 'Evaluar tendencia por maximos/minimos, avance real, solapamiento, velocidad y rechazo.',
      appliedToVideoMethod: 'El contramovimiento debil debe verse como avance pobre y solapado antes de dibujar trendline.',
      id: 'trend-structure-over-indicator',
      principle: 'Tendencia, soporte/resistencia y trendlines son lectura estructural; requieren confirmacion y ubicacion.',
      prohibitedUse: 'No tratar una linea de dos puntos o una pendiente cualquiera como senal valida.',
      sources: [brooksSource, cmtSource, fidelitySource, investopediaTrendlineSource, userMethodSource],
      topic: 'SUPPORT_RESISTANCE_AND_TREND',
    },
    {
      agentUse: 'Tratar ORH/ORL como zona de prueba de aceptacion o rechazo, no como breakout automatico.',
      appliedToVideoMethod: 'Si rompe ORH/ORL y sostiene, se respeta posible institucional; si falla y vuelve, se empieza a buscar mal jugados.',
      id: 'opening-range-acceptance-failure',
      principle: 'La apertura cash genera informacion de subasta; el valor esta en aceptar o rechazar niveles, no en cruzarlos una vez.',
      prohibitedUse: 'No operar durante los primeros 15 minutos ni perseguir la primera ruptura sin retest.',
      sources: [nyseHoursSource, userMethodSource],
      topic: 'OPENING_RANGE_AND_AUCTION',
    },
    {
      agentUse: 'Inferir compradores/vendedores atrapados solo despues de una falla verificable en una marca importante.',
      appliedToVideoMethod: 'Compradores atrapados habilitan busqueda de short; vendedores atrapados habilitan busqueda de long.',
      id: 'trapped-side-before-trendline',
      principle: 'La ventaja tactica nace de identificar quien quedo mal posicionado y operar con el flujo que lo presiona.',
      prohibitedUse: 'No dibujar trendline antes de detectar el lado atrapado.',
      sources: [userMethodSource],
      topic: 'TRAPPED_TRADER_LOGIC',
    },
    {
      agentUse: 'Usar orderflow/bookmap como confirmacion secundaria cuando haya datos confiables.',
      appliedToVideoMethod: 'Volumen agresor, liquidez pasiva y absorcion pueden reforzar la tesis de fallo/atrapados.',
      id: 'orderflow-is-confirmation-not-trigger',
      principle: 'Orderflow ayuda a entender por que se mueve el precio mediante DOM, liquidez, agresores y trades ejecutados.',
      prohibitedUse: 'No reemplazar el metodo visual con una burbuja de volumen o una pared de liquidez aislada.',
      sources: [bookmapOrderFlowSource, bookmapSupplyDemandSource],
      topic: 'ORDERFLOW_CONFIRMATION',
    },
    {
      agentUse: 'Construir siempre caja roja/verde antes de aprobar la entrada tactica.',
      appliedToVideoMethod: 'Stop tecnico en invalidacion, target estructural, R/R minimo 1:2 y costos <= 30% del target.',
      id: 'red-green-box-hard-risk',
      principle: 'La lectura puede ser buena, pero la entrada no existe si la recompensa no paga al menos dos veces el riesgo.',
      prohibitedUse: 'No convertir una buena tesis en trade si R/R < 2 o si el costo destruye el target.',
      sources: [userMethodSource, fidelitySource],
      topic: 'RISK_AND_EXECUTION',
    },
  ]

  return {
    curatedStudyLibrary,
    mode: 'TRADER_VIDEO_EXPERT_KNOWLEDGE_BASE',
    primaryMethodSource: 'USER_VIDEO_AND_INSTRUCTIONS',
    principles,
    researchStandard: [
      'Priorizar fuentes primarias de mercado para horarios, simbolos y estructura de contrato.',
      'Usar fuentes profesionales/clasicas para velas, tendencia, soporte/resistencia y confirmacion.',
      'Usar el video y las instrucciones del usuario como doctrina tactica principal.',
      'Descartar contenido superficial que prometa entradas mecanicas sin contexto.',
    ],
    safetyBoundary: [
      'La biblioteca no abre trades.',
      'La biblioteca no relaja filtros.',
      'La biblioteca no sustituye datos reales M1/M30.',
      'La biblioteca no puede saltarse paperOnly, KillSwitch, RiskGuard, DataGuard ni V4 safety veto.',
    ],
    timestamp: now.toISOString(),
    version: 'EXPERT_LIBRARY_2026_06_11',
  }
}
