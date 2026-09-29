import { lookupDetails } from "./lib/dictionary"
import { lookupWord, normalizeText, normalizeWord, type DetailsReply, type LookupReply } from "./lib/lookup"
import { createRequestCache } from "./lib/request-cache"
import { createWordCommandHandler, type WordCommand } from "./lib/storage"

const handleWordCommand = createWordCommandHandler(chrome.storage.local)
const lookup = createRequestCache<LookupReply>(
  lookupWord,
  () => ({ ok: false, error: "Lỗi tra cứu. Hãy thử lại." }),
  { ttlMs: 10 * 60 * 1000, timeoutMs: 8000, maxEntries: 200 }
)
const details = createRequestCache<DetailsReply>(
  lookupDetails,
  () => ({ ok: false, error: "Chưa lấy được dữ liệu từ điển." }),
  { ttlMs: 10 * 60 * 1000, timeoutMs: 4500, maxEntries: 200 }
)

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (!message || typeof message !== "object") return false
  const type = (message as { type?: unknown }).type
  if (type === "SAVE_WORD" || type === "REMOVE_WORD" || type === "CLEAR_WORDS") {
    if (sender.id && sender.id !== chrome.runtime.id) {
      sendResponse({ ok: false })
      return false
    }
    handleWordCommand(message as WordCommand)
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }))
    return true
  }
  if (type !== "LOOKUP" && type !== "LOOKUP_DETAILS") return false
  const word = type === "LOOKUP_DETAILS" ? normalizeWord((message as { word?: unknown }).word) : normalizeText((message as { word?: unknown }).word)
  if (!word || (sender.id && sender.id !== chrome.runtime.id)) {
    sendResponse({ ok: false, error: "Yêu cầu tra từ không hợp lệ." } satisfies LookupReply)
    return false
  }
  const request = type === "LOOKUP_DETAILS" ? details(word) : lookup(word)
  request.then(sendResponse)
  return true
})
