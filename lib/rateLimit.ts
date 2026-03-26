type Entry = {
  count: number
  resetAt: number
}

const store = new Map<string, Entry>()

// Ryd entries der er udløbet — køres ved hvert kald for at undgå memory leak
function evict(now: number) {
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key)
  }
}

export function rateLimit(
  ip: string,
  key: string,
  maxRequests: number,
  windowMs: number
): { success: boolean } {
  const now = Date.now()
  evict(now)

  const storeKey = `${key}:${ip}`
  const entry = store.get(storeKey)

  if (!entry || entry.resetAt <= now) {
    store.set(storeKey, { count: 1, resetAt: now + windowMs })
    return { success: true }
  }

  if (entry.count >= maxRequests) {
    return { success: false }
  }

  entry.count++
  return { success: true }
}

export function getIp(req: { headers: { get(name: string): string | null } }): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '127.0.0.1'
}
