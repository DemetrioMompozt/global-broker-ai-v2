const cache = new Map<string, { expiresAt: number; value: unknown }>()

export function setCache<T>(key: string, value: T, ttlMs: number) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs })
}

export function getCache<T>(key: string) {
  const item = cache.get(key)
  if (!item || item.expiresAt < Date.now()) return null
  return item.value as T
}
