export type LookupResult = {
  word: string
  translation: string
  phonetic: string
  examples: string[]
  audioUrl: string | null
  partial: boolean
  sourceUrl?: string
}

export type LookupReply =
  | { ok: true; result: LookupResult }
  | { ok: false; error: string }

export type DictionaryDetails = Pick<LookupResult, "phonetic" | "examples" | "audioUrl" | "sourceUrl">
export type DetailsReply =
  | { ok: true; details: DictionaryDetails }
  | { ok: false; error: string }

export const MAX_WORD_LENGTH = 50
export const MAX_TEXT_LENGTH = 2000

export function normalizeSelection(value: unknown): string | null {
  if (typeof value !== "string") return null
  const word = value.normalize("NFC").replace(/\s+/gu, " ").trim()
  if (!word || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/u.test(word)) return null
  return word
}

export function normalizeWord(value: unknown): string | null {
  const word = normalizeSelection(value)
  return word && word.length <= MAX_WORD_LENGTH ? word : null
}

export function normalizeText(value: unknown): string | null {
  const text = normalizeSelection(value)
  return text && text.length <= MAX_TEXT_LENGTH ? text : null
}

export function parseTranslation(data: unknown): string | null {
  if (!Array.isArray(data) || !Array.isArray(data[0])) return null
  const segments = data[0]
    .filter((entry: unknown) => Array.isArray(entry) && typeof entry[0] === "string")
    .map((entry: string[]) => entry[0])
  const value = segments.join("").trim()
  return value || null
}

function cleanExample(value: string): string {
  return value
    .replace(/<[^>]*>/gu, "")
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/gu, (entity) => ({
      "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " "
    })[entity] || entity)
    .replace(/\s+/gu, " ")
    .trim()
}

export function parseGoogleDetails(data: unknown): DictionaryDetails {
  const empty: DictionaryDetails = { phonetic: "", examples: [], audioUrl: null }
  if (!Array.isArray(data)) return empty
  const segments = Array.isArray(data[0]) ? data[0] : []
  const phonetic = segments
    .map((item: unknown) => Array.isArray(item) && typeof item[3] === "string" ? item[3] : "")
    .find((value: string) => value.trim()) || ""
  const examples: string[] = []
  const groups = Array.isArray(data[13]) ? data[13] : []
  for (const group of groups) {
    if (!Array.isArray(group)) continue
    for (const entry of group) {
      if (!Array.isArray(entry) || typeof entry[0] !== "string") continue
      const example = cleanExample(entry[0])
      if (example && example.length <= 240 && !examples.includes(example)) examples.push(example)
      if (examples.length === 3) break
    }
    if (examples.length === 3) break
  }
  return { phonetic: phonetic.trim().slice(0, 80), examples, audioUrl: null }
}

async function getJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

export async function lookupWord(word: string, signal: AbortSignal): Promise<LookupReply> {
  const normalized = normalizeText(word)
  if (!normalized) return { ok: false, error: "Chọn đoạn văn tối đa 2.000 ký tự để dịch." }
  const isShort = normalized.length <= MAX_WORD_LENGTH
  const encoded = encodeURIComponent(normalized)
  let data: unknown
  try {
    data = await getJson(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t${isShort ? "&dt=rm&dt=ex" : ""}&q=${encoded}`, signal)
  } catch {
    return { ok: false, error: signal.aborted ? "Tra cứu quá thời gian. Hãy thử lại." : "Không lấy được nghĩa. Hãy kiểm tra mạng và thử lại." }
  }
  const translated = parseTranslation(data)
  if (!translated) {
    return { ok: false, error: "Không tìm thấy nghĩa phù hợp. Hãy thử từ khác." }
  }
  if (!isShort) {
    return { ok: true, result: { word: normalized, translation: translated, phonetic: "", examples: [], audioUrl: null, partial: false } }
  }
  let details = parseGoogleDetails(data)
  if ((!details.phonetic || details.examples.length === 0) && /^[A-Z][a-z]+$/u.test(normalized)) {
    try {
      const lowerData = await getJson(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&dt=rm&dt=ex&q=${encodeURIComponent(normalized.toLowerCase())}`, signal)
      const lowerDetails = parseGoogleDetails(lowerData)
      details = {
        phonetic: details.phonetic || lowerDetails.phonetic,
        examples: details.examples.length ? details.examples : lowerDetails.examples,
        audioUrl: null
      }
    } catch { /* Vẫn trả nghĩa đã tìm được. */ }
  }
  return { ok: true, result: { word: normalized, translation: translated, ...details, partial: !details.phonetic || details.examples.length === 0 } }
}

export function mergeDetails(result: LookupResult, details: DictionaryDetails): LookupResult {
  const phonetic = details.phonetic || result.phonetic
  const examples = [...new Set([...details.examples, ...result.examples])].slice(0, 3)
  return { ...result, phonetic, examples, audioUrl: details.audioUrl || result.audioUrl, sourceUrl: details.sourceUrl || result.sourceUrl, partial: !phonetic || examples.length === 0 }
}
