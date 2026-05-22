import type { CfdQuote } from '../cfd/cfdPricingEngine.js'

export function validateDataGuard(quote: CfdQuote) {
  const blocked = quote.sourcePrice.feedType === 'MOCK_DATA'
    || quote.sourcePrice.feedType === 'STALE_DATA'
    || quote.sourcePrice.feedType === 'ERROR'
    || !Number.isFinite(quote.mid)
    || quote.mid <= 0
  return {
    approved: !blocked,
    status: blocked ? 'BLOCKED' as const : 'APPROVED' as const,
    reason: blocked ? 'Feed invalido para operar paper CFD.' : 'Feed valido para paper tracking.',
  }
}
