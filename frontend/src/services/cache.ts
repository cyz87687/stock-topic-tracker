const CACHE_PREFIX = 'stk_'
const DEFAULT_TTL = 14400

interface CacheEntry<T> {
  d: T
  t: number
  ttl: number
}

export function get<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const entry: CacheEntry<T> = JSON.parse(raw)
    if (Date.now() - entry.t > entry.ttl * 1000) {
      localStorage.removeItem(CACHE_PREFIX + key)
      return null
    }
    return entry.d
  } catch {
    return null
  }
}

export function getStale<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const entry: CacheEntry<T> = JSON.parse(raw)
    return entry.d
  } catch {
    return null
  }
}

export function set<T>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
  try {
    const entry: CacheEntry<T> = { d: data, t: Date.now(), ttl }
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry))
  } catch {
    // storage full, clear old entries
    clearOld()
  }
}

export function clear(key?: string): void {
  if (key) {
    localStorage.removeItem(CACHE_PREFIX + key)
  } else {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(CACHE_PREFIX)) keys.push(k)
    }
    keys.forEach((k) => localStorage.removeItem(k))
  }
}

function clearOld(): void {
  const now = Date.now()
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k?.startsWith(CACHE_PREFIX)) continue
    try {
      const entry = JSON.parse(localStorage.getItem(k) || '{}')
      if (now - entry.t > entry.ttl * 1000) keys.push(k)
    } catch {
      keys.push(k)
    }
  }
  keys.forEach((k) => localStorage.removeItem(k))
}

export function status(): Record<string, { age: number; ttl: number }> {
  const result: Record<string, { age: number; ttl: number }> = {}
  const now = Date.now()
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k?.startsWith(CACHE_PREFIX)) continue
    try {
      const entry = JSON.parse(localStorage.getItem(k) || '{}')
      const shortKey = k.slice(CACHE_PREFIX.length)
      result[shortKey] = { age: Math.round((now - entry.t) / 1000), ttl: entry.ttl }
    } catch {
      // skip
    }
  }
  return result
}
