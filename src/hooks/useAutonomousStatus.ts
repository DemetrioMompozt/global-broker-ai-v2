import { useCallback, useEffect, useState } from 'react'
import { fetchCfdPaperStatus } from '../api/client'
import type { CfdPaperStatus } from '../types/trading'

export function useAutonomousStatus() {
  const [status, setStatus] = useState<CfdPaperStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const next = await fetchCfdPaperStatus()
      setStatus(next)
      setLastRefresh(new Date().toISOString())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const interval = window.setInterval(() => void refresh(), 2000)
    return () => window.clearInterval(interval)
  }, [refresh])

  return { status, error, lastRefresh, refreshing, refresh }
}
