type Reply = { ok: boolean }

export function createRequestCache<T extends Reply>(
  load: (key: string, signal: AbortSignal) => Promise<T>,
  fallback: () => T,
  options: { ttlMs: number; timeoutMs: number; maxEntries: number }
) {
  const cache = new Map<string, { expires: number; reply: T }>()
  const inFlight = new Map<string, Promise<T>>()

  return (key: string): Promise<T> => {
    const cached = cache.get(key)
    if (cached && cached.expires > Date.now()) return Promise.resolve(cached.reply)
    if (cached) cache.delete(key)
    const pending = inFlight.get(key)
    if (pending) return pending

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs)
    const request = Promise.resolve()
      .then(() => load(key, controller.signal))
      .then((reply) => {
        if (reply.ok) {
          cache.set(key, { expires: Date.now() + options.ttlMs, reply })
          if (cache.size > options.maxEntries) cache.delete(cache.keys().next().value!)
        }
        return reply
      })
      .catch(fallback)
      .finally(() => {
        clearTimeout(timeout)
        inFlight.delete(key)
      })
    inFlight.set(key, request)
    return request
  }
}
