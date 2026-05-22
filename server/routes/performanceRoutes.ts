import { Router } from 'express'
import { getCalendarPerformance } from '../performance/calendarPerformanceEngine.js'
import { getPerformanceSummary } from '../performance/performanceEngine.js'

export const performanceRouter = Router()

performanceRouter.get('/summary', (_request, response) => {
  response.json(getPerformanceSummary())
})

performanceRouter.get('/calendar', (_request, response) => {
  response.json(getCalendarPerformance())
})
