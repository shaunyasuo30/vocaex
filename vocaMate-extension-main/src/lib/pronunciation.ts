import { dictionary } from "cmu-pronouncing-dictionary"

const phonemes: Record<string, string> = {
  AA: "ɑ", AE: "æ", AH: "ʌ", AO: "ɔ", AW: "aʊ", AY: "aɪ", B: "b",
  CH: "tʃ", D: "d", DH: "ð", EH: "ɛ", ER: "ɝ", EY: "eɪ", F: "f",
  G: "ɡ", HH: "h", IH: "ɪ", IY: "i", JH: "dʒ", K: "k", L: "l",
  M: "m", N: "n", NG: "ŋ", OW: "oʊ", OY: "ɔɪ", P: "p", R: "ɹ",
  S: "s", SH: "ʃ", T: "t", TH: "θ", UH: "ʊ", UW: "u", V: "v",
  W: "w", Y: "j", Z: "z", ZH: "ʒ"
}
const vowels = new Set(["AA", "AE", "AH", "AO", "AW", "AY", "EH", "ER", "EY", "IH", "IY", "OW", "OY", "UH", "UW"])

// Các mục CMU dưới đây khác cách đọc Anh-Mỹ được đối chiếu tại
// dictionary.cambridge.org/pronunciation/english/<word>.
// Stochastically được đối chiếu thêm tại en.wiktionary.org/wiki/stochastically.
const verifiedPronunciations: Record<string, string> = {
  stochastic: "/stəˈkæstɪk/",
  stochastically: "/stəˈkæstɪkli/",
  stochastics: "/stəˈkæstɪks/",
  algorithm: "/ˈælɡɚɪðəm/",
  algorithms: "/ˈælɡɚɪðəmz/",
  analysis: "/əˈnæləsɪs/",
  asynchronous: "/eɪˈsɪŋkɹənəs/",
  classification: "/ˌklæsəfəˈkeɪʃən/",
  convolution: "/ˌkɑnvəˈluʃən/",
  matrices: "/ˈmeɪtɹəˌsiz/",
  network: "/ˈnɛtwɝk/",
  networks: "/ˈnɛtwɝks/",
  optimization: "/ˌɑptəməˈzeɪʃən/",
  optimize: "/ˈɑptəmaɪz/",
  optimized: "/ˈɑptəmaɪzd/",
  parameter: "/pəˈɹæmətɚ/",
  parameters: "/pəˈɹæmətɚz/",
  probabilistic: "/ˌpɹɑbəbəlˈɪstɪk/",
  process: "/ˈpɹɑsɛs/",
  query: "/ˈkwɪɹi/"
}

export function verifiedPronunciation(value: string): string | null {
  return verifiedPronunciations[value.trim().toLowerCase()] || null
}

export function arpabetToIpa(value: string): string | null {
  const parts = value.trim().split(/\s+/u).map((part) => {
    const match = /^([A-Z]+)([012]?)$/u.exec(part)
    return match ? { name: match[1], stress: match[2] } : null
  })
  if (parts.length === 0 || parts.some((part) => !part || !phonemes[part.name])) return null
  const sounds = parts as { name: string; stress: string }[]
  const markers = new Map<number, string>()
  let lastVowel = -1
  for (let i = 0; i < sounds.length; i++) {
    const part = sounds[i]
    if (!vowels.has(part.name)) continue
    if (part.stress === "1" || part.stress === "2") {
      const cluster = i - lastVowel - 1
      const onset = lastVowel < 0 ? 0 : cluster === 0 ? i : cluster > 1 && ["Y", "W", "R", "L"].includes(sounds[i - 1].name) ? i - 2 : i - 1
      markers.set(onset, part.stress === "1" ? "ˈ" : "ˌ")
    }
    lastVowel = i
  }
  const output = sounds.map((part, i) => {
    const sound = part.name === "AH" && part.stress === "0" ? "ə" :
      part.name === "ER" && part.stress === "0" ? "ɚ" : phonemes[part.name]
    return (markers.get(i) || "") + sound
  }).join("")
  return `/${output}/`
}

function partPronunciation(part: string): string | null {
  if (verifiedPronunciations[part]) return verifiedPronunciations[part]
  const direct = dictionary[part]
  if (typeof direct === "string") return arpabetToIpa(direct)
  for (const prefix of ["hyper", "back", "micro", "macro", "meta", "inter", "intra", "multi", "anti", "auto", "bio", "pre", "post"]) {
    if (!part.startsWith(prefix)) continue
    const rest = part.slice(prefix.length)
    if (typeof dictionary[prefix] !== "string" || typeof dictionary[rest] !== "string") continue
    const first = arpabetToIpa(dictionary[prefix])
    const second = arpabetToIpa(dictionary[rest])
    if (first && second) return `/${first.slice(1, -1).replace("ˈ", "ˌ")}${second.slice(1, -1)}/`
  }
  return null
}

export function localPronunciation(value: string): string | null {
  const normalized = value.trim().toLowerCase()
  if (!/^[a-z]+(?:[ -][a-z]+)*$/u.test(normalized)) return null
  const parts = normalized.split(/[ -]/u)
  const ipaParts = parts.map(partPronunciation)
  if (ipaParts.some((part) => !part)) return null
  return `/${ipaParts.map((part) => part!.slice(1, -1)).join(" ")}/`
}
