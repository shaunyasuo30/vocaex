import { normalizeWord, type DetailsReply, type DictionaryDetails } from "./lookup.ts"
import { localPronunciation, verifiedPronunciation } from "./pronunciation.ts"

export function parseFreeDictionary(data: unknown, americanFallback: string | null = null): DictionaryDetails {
  const empty: DictionaryDetails = { phonetic: "", examples: [], audioUrl: null }
  if (!data || typeof data !== "object") return empty
  const response = data as any
  const entries = Array.isArray(response.entries) ? response.entries.filter((entry: any) => entry?.language?.code === "en") : []
  const pronunciations = entries.flatMap((entry: any) => Array.isArray(entry.pronunciations) ? entry.pronunciations : [])
    .filter((item: any) => item?.type === "ipa" && typeof item.text === "string" && item.text.length <= 100)
  const preferred = pronunciations
    .filter((item: any) => !Array.isArray(item.tags) || !item.tags.some((tag: unknown) => typeof tag === "string" && /^(rare|nonstandard)$/iu.test(tag)))
    .sort((a: any, b: any) => pronunciationRank(b) - pronunciationRank(a))[0]
  const examples: string[] = []
  for (const entry of entries) {
    if (!Array.isArray(entry.senses)) continue
    for (const sense of entry.senses) {
      if (!Array.isArray(sense?.examples)) continue
      for (const example of sense.examples) {
        if (typeof example === "string" && example.trim() && example.length <= 240 && !examples.includes(example.trim())) examples.push(example.trim())
        if (examples.length === 3) break
      }
      if (examples.length === 3) break
    }
    if (examples.length === 3) break
  }
  const sourceUrl = typeof response.source?.url === "string" && /^https:\/\/en\.wiktionary\.org\/wiki\//u.test(response.source.url)
    ? response.source.url : undefined
  const phonetic = preferred && pronunciationRank(preferred) === 0 && americanFallback
    ? americanFallback : preferred?.text?.trim() || ""
  return { phonetic, examples, audioUrl: null, sourceUrl }
}

function pronunciationRank(item: any): number {
  const tags: string[] = Array.isArray(item.tags) ? item.tags : []
  if (tags.some((tag) => /General American|United States|^US$|American/u.test(tag))) return 3
  if (tags.some((tag) => /Received Pronunciation|British|^UK$/u.test(tag))) return 0
  return 1
}

export async function lookupDetails(word: string, signal: AbortSignal): Promise<DetailsReply> {
  const normalized = normalizeWord(word)
  if (!normalized) return { ok: false, error: "Yêu cầu tra từ không hợp lệ." }
  const verified = verifiedPronunciation(normalized)
  if (verified) return { ok: true, details: { phonetic: verified, examples: [], audioUrl: null } }
  const local = localPronunciation(normalized)
  const controller = local ? new AbortController() : null
  const onAbort = () => controller?.abort()
  if (controller) {
    signal.addEventListener("abort", onAbort, { once: true })
    if (signal.aborted) controller.abort()
  }
  const timeout = controller ? setTimeout(() => controller.abort(), 1200) : null
  const requestSignal = controller?.signal || signal
  const candidates = normalized === normalized.toLowerCase() ? [normalized] : [normalized, normalized.toLowerCase()]
  try {
    for (const candidate of candidates) {
      try {
        const response = await fetch(`https://freedictionaryapi.com/api/v1/entries/en/${encodeURIComponent(candidate)}`, { signal: requestSignal })
        if (!response.ok) continue
        const details = parseFreeDictionary(await response.json(), local)
        if (details.phonetic || details.examples.length) return { ok: true, details: { ...details, phonetic: details.phonetic || local || "" } }
      } catch { /* Thử cách viết khác, rồi trả trạng thái thiếu dữ liệu. */ }
    }
  } finally {
    if (timeout) clearTimeout(timeout)
    if (controller) signal.removeEventListener("abort", onAbort)
  }
  if (local) return { ok: true, details: { phonetic: local, examples: [], audioUrl: null } }
  return { ok: false, error: "Chưa lấy được dữ liệu từ điển." }
}
