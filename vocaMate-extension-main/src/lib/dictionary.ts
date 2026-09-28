import { normalizeWord, type DetailsReply, type DictionaryDetails } from "./lookup.ts"
import { localPronunciation } from "./pronunciation.ts"

export function parseFreeDictionary(data: unknown): DictionaryDetails {
  const empty: DictionaryDetails = { phonetic: "", examples: [], audioUrl: null }
  if (!data || typeof data !== "object") return empty
  const response = data as any
  const entries = Array.isArray(response.entries) ? response.entries.filter((entry: any) => entry?.language?.code === "en") : []
  const pronunciations = entries.flatMap((entry: any) => Array.isArray(entry.pronunciations) ? entry.pronunciations : [])
    .filter((item: any) => item?.type === "ipa" && typeof item.text === "string" && item.text.length <= 100)
  const preferred = pronunciations.find((item: any) => Array.isArray(item.tags) && item.tags.includes("General American")) || pronunciations[0]
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
  return { phonetic: preferred?.text?.trim() || "", examples, audioUrl: null, sourceUrl }
}

export async function lookupDetails(word: string, signal: AbortSignal): Promise<DetailsReply> {
  const normalized = normalizeWord(word)
  if (!normalized) return { ok: false, error: "Yêu cầu tra từ không hợp lệ." }
  const local = localPronunciation(normalized)
  if (local) return { ok: true, details: { phonetic: local, examples: [], audioUrl: null } }
  const candidates = normalized === normalized.toLowerCase() ? [normalized] : [normalized, normalized.toLowerCase()]
  for (const candidate of candidates) {
    try {
      const response = await fetch(`https://freedictionaryapi.com/api/v1/entries/en/${encodeURIComponent(candidate)}`, { signal })
      if (!response.ok) continue
      const details = parseFreeDictionary(await response.json())
      if (details.phonetic || details.examples.length) return { ok: true, details }
    } catch { /* Thử cách viết khác, rồi trả trạng thái thiếu dữ liệu. */ }
  }
  return { ok: false, error: "Chưa lấy được dữ liệu từ điển." }
}
