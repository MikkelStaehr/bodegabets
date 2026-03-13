/**
 * Simpel in-memory rate limiter til Next.js API routes.
 * Bruger et sliding window per bruger-ID.
 *
 * Begrænsninger:
 * - Nulstilles ved Vercel cold start (acceptabelt for dette use case)
 * - Ikke delt på tværs af Vercel instances (acceptabelt for lille trafik)
 *
 * Brug:
 *   const limit = rateLimit({ maxRequests: 5, windowMs: 60_000 })
 *   const result = limit(userId)
 *   if (!result.ok) return NextResponse.json({ error: 'For mange forsøg' }, { status: 429 })
 */

type RateLimitOptions = {
    maxRequests: number  // Max antal requests i vinduet
    windowMs: number     // Vinduets størrelse i millisekunder
  }
  
  type RateLimitResult = {
    ok: boolean
    remaining: number
    resetAt: number
  }
  
  export function rateLimit({ maxRequests, windowMs }: RateLimitOptions) {
    const requests = new Map<string, number[]>()
  
    // Ryd gamle entries hvert 5. minut for at undgå memory leak
    setInterval(() => {
      const now = Date.now()
      for (const [key, timestamps] of requests.entries()) {
        const valid = timestamps.filter((t) => now - t < windowMs)
        if (valid.length === 0) {
          requests.delete(key)
        } else {
          requests.set(key, valid)
        }
      }
    }, 5 * 60 * 1000)
  
    return function check(identifier: string): RateLimitResult {
      const now = Date.now()
      const timestamps = (requests.get(identifier) ?? []).filter(
        (t) => now - t < windowMs
      )
  
      if (timestamps.length >= maxRequests) {
        const oldest = Math.min(...timestamps)
        return {
          ok: false,
          remaining: 0,
          resetAt: oldest + windowMs,
        }
      }
  
      timestamps.push(now)
      requests.set(identifier, timestamps)
  
      return {
        ok: true,
        remaining: maxRequests - timestamps.length,
        resetAt: now + windowMs,
      }
    }
  }
  
  // Prækonfigurerede limiters til de tre endpoints
  export const betsLimiter = rateLimit({ maxRequests: 10, windowMs: 60_000 })       // 10 per minut
  export const createGameLimiter = rateLimit({ maxRequests: 5, windowMs: 60_000 })  // 5 per minut
  export const joinGameLimiter = rateLimit({ maxRequests: 10, windowMs: 60_000 })   // 10 per minut