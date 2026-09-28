import { lookupDetails } from "./lib/dictionary"
import { lookupWord, normalizeText, normalizeWord, type DetailsReply, type LookupReply } from "./lib/lookup"

const cache = new Map<string, { expires: number; reply: LookupReply }>()
const inFlight = new Map<string, Promise<LookupReply>>()
const detailsCache = new Map<string, { expires: number; reply: DetailsReply }>()
const detailsInFlight = new Map<string, Promise<DetailsReply>>()
const CACHE_TTL = 10 * 60 * 1000
const MAX_CACHE = 200

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (!message || typeof message !== "object") return false
  const type = (message as any).type
  if (type !== "LOOKUP" && type !== "LOOKUP_DETAILS") return false
  const word = type === "LOOKUP_DETAILS" ? normalizeWord((message as any).word) : normalizeText((message as any).word)
  if (!word || (sender.id && sender.id !== chrome.runtime.id)) {
    sendResponse({ ok: false, error: "Yêu cầu tra từ không hợp lệ." } satisfies LookupReply)
    return false
  }
  if (type === "LOOKUP_DETAILS") {
    const cachedDetails = detailsCache.get(word)
    if (cachedDetails && cachedDetails.expires > Date.now()) {
      sendResponse(cachedDetails.reply)
      return false
    }
    let pendingDetails = detailsInFlight.get(word)
    if (!pendingDetails) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 4500)
      pendingDetails = lookupDetails(word, controller.signal)
        .then((reply) => {
          if (reply.ok) {
            detailsCache.set(word, { expires: Date.now() + CACHE_TTL, reply })
            if (detailsCache.size > MAX_CACHE) detailsCache.delete(detailsCache.keys().next().value!)
          }
          return reply
        })
        .catch((): DetailsReply => ({ ok: false, error: "Chưa lấy được dữ liệu từ điển." }))
        .finally(() => { clearTimeout(timeout); detailsInFlight.delete(word) })
      detailsInFlight.set(word, pendingDetails)
    }
    pendingDetails.then(sendResponse)
    return true
  }
  const cached = cache.get(word)
  if (cached && cached.expires > Date.now()) {
    sendResponse(cached.reply)
    return false
  }
  let pending = inFlight.get(word)
  if (!pending) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    pending = lookupWord(word, controller.signal)
      .then((reply) => {
        if (reply.ok) {
          cache.set(word, { expires: Date.now() + CACHE_TTL, reply })
          if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value!)
        }
        return reply
      })
      .catch((): LookupReply => ({ ok: false, error: "Lỗi tra cứu. Hãy thử lại." }))
      .finally(() => { clearTimeout(timeout); inFlight.delete(word) })
    inFlight.set(word, pending)
  }
  pending.then(sendResponse)
  return true
})
