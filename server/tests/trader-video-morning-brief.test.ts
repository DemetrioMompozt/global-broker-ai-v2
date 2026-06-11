import { buildTraderVideoMorningBrief } from '../strategy/traderVideoMorningBrief.js'
import { assert, done } from './assert.js'

const beforeReview = buildTraderVideoMorningBrief(new Date('2026-06-11T12:30:00.000Z')) // 08:30 NY
assert(beforeReview.phase === 'BEFORE_PRE_MARKET_REVIEW', '08:30 NY debe ser preparacion previa, no trading.')
assert(beforeReview.canOpenPaperByTime === false, 'Antes de 09:45 NY no se puede abrir.')
assert(beforeReview.timezone === 'America/New_York', 'El brief debe usar hora New York.')

const m30 = buildTraderVideoMorningBrief(new Date('2026-06-11T13:15:00.000Z')) // 09:15 NY
assert(m30.phase === 'PRE_MARKET_M30_MARKING', '09:15 NY debe ser marcas M30.')
assert(m30.currentTimeframe === 'M30', 'En preparacion se mira M30.')
assert(m30.requiredEvidenceNow.some((item) => item.includes('High/low cash')), 'Debe pedir high/low cash previo.')
assert(m30.requiredEvidenceNow.some((item) => item.includes('overnight')), 'Debe pedir high/low overnight.')

const openingRange = buildTraderVideoMorningBrief(new Date('2026-06-11T13:35:00.000Z')) // 09:35 NY
assert(openingRange.phase === 'OPENING_RANGE_BUILDING', '09:35 NY debe construir opening range.')
assert(openingRange.currentTimeframe === 'M1', 'Opening range se observa en M1.')
assert(openingRange.canOpenPaperByTime === false, 'No se opera dentro de los primeros 15 minutos.')

const main = buildTraderVideoMorningBrief(new Date('2026-06-11T14:00:00.000Z')) // 10:00 NY
assert(main.phase === 'MAIN_METHOD_WINDOW', '10:00 NY debe ser ventana principal.')
assert(main.currentTimeframe === 'M1', 'La ejecucion debe ser M1.')
assert(main.canOpenPaperByTime === true, 'Solo despues de 09:45 NY se permite pasar a evaluacion paper por tiempo.')
assert(main.requiredEvidenceNow.some((item) => item.includes('Trendline de tres puntos')), 'Debe exigir trendline de tres puntos.')
assert(main.requiredEvidenceNow.some((item) => item.includes('R/R minimo 1:2')), 'Debe exigir R/R minimo 1:2.')

const closed = buildTraderVideoMorningBrief(new Date('2026-06-11T20:30:00.000Z')) // 16:30 NY
assert(closed.phase === 'AFTER_CASH_CLOSE', '16:30 NY debe estar cerrado para nuevas entradas.')
assert(closed.canOpenPaperByTime === false, 'Despues de 16:00 NY no se abre.')
assert(closed.prohibitedActions.some((item) => item.includes('No abrir despues de 16:00 NY')), 'Debe prohibir abrir despues de 16:00 NY.')

done('trader-video-morning-brief')
