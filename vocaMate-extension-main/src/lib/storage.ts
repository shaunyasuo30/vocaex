import type { LookupResult } from "./lookup"

export type SavedWord = LookupResult & { savedAt: number; sourcePageUrl?: string }
export type Settings = { enabled: boolean; disabledHosts: string[] }
export type WordCommand =
  | { type: "SAVE_WORD"; result: LookupResult; sourcePageUrl?: string }
  | { type: "REMOVE_WORD"; word: string }
  | { type: "CLEAR_WORDS" }

const SETTINGS_KEY = "vocamateSettings"
const WORDS_KEY = "vocamateWords"
const defaults: Settings = { enabled: true, disabledHosts: [] }

type StorageArea = Pick<chrome.storage.StorageArea, "get" | "set" | "remove">

function isDictionaryUrl(value: unknown): value is string {
  return typeof value === "string" && /^https:\/\/en\.wiktionary\.org\/wiki\//u.test(value)
}

function isPageUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false
  try { return ["http:", "https:"].includes(new URL(value).protocol) } catch { return false }
}

function parseSavedWord(value: unknown): SavedWord | null {
  if (!value || typeof value !== "object") return null
  const item = value as Partial<SavedWord>
  if (typeof item.word !== "string" || !item.word.trim() || item.word.length > 50 ||
      typeof item.translation !== "string" || !item.translation.trim() ||
      typeof item.savedAt !== "number" || !Number.isFinite(item.savedAt)) return null
  const sourcePageUrl = isPageUrl(item.sourcePageUrl) ? item.sourcePageUrl :
    isPageUrl(item.sourceUrl) && !isDictionaryUrl(item.sourceUrl) ? item.sourceUrl : undefined
  return {
    word: item.word,
    translation: item.translation,
    phonetic: typeof item.phonetic === "string" ? item.phonetic : "",
    examples: Array.isArray(item.examples) ? item.examples.filter((example): example is string => typeof example === "string").slice(0, 3) : [],
    audioUrl: typeof item.audioUrl === "string" ? item.audioUrl : null,
    partial: item.partial === true,
    savedAt: item.savedAt,
    ...(isDictionaryUrl(item.sourceUrl) ? { sourceUrl: item.sourceUrl } : {}),
    ...(sourcePageUrl ? { sourcePageUrl } : {})
  }
}

export async function getSettings(): Promise<Settings> {
  const data = await chrome.storage.local.get(SETTINGS_KEY)
  const value = data[SETTINGS_KEY]
  return {
    enabled: typeof value?.enabled === "boolean" ? value.enabled : defaults.enabled,
    disabledHosts: Array.isArray(value?.disabledHosts) ? value.disabledHosts.filter((host: unknown): host is string => typeof host === "string") : []
  }
}

export async function setSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings })
}

export async function getSavedWords(area: StorageArea = chrome.storage.local): Promise<SavedWord[]> {
  const data = await area.get(WORDS_KEY)
  return Array.isArray(data[WORDS_KEY]) ? data[WORDS_KEY].map(parseSavedWord).filter((item): item is SavedWord => item !== null) : []
}

// All mutations run in the background worker, so popup and content scripts share one queue.
export function createWordCommandHandler(area: StorageArea) {
  let queue: Promise<unknown> = Promise.resolve()
  return (command: WordCommand): Promise<void> => {
    const operation = queue.then(async () => {
      if (command.type === "CLEAR_WORDS") {
        await area.remove(WORDS_KEY)
        return
      }
      const words = await getSavedWords(area)
      if (command.type === "REMOVE_WORD") {
        if (typeof command.word !== "string") throw new Error("Invalid word")
        await area.set({ [WORDS_KEY]: words.filter((item) => item.word !== command.word) })
        return
      }
      const result = command.result
      if (!result || typeof result.word !== "string" || !result.word.trim() || result.word.length > 50 ||
          typeof result.translation !== "string" || !result.translation.trim()) throw new Error("Invalid saved word")
      const entry = parseSavedWord({ ...result, savedAt: Date.now(), sourcePageUrl: command.sourcePageUrl })
      if (!entry) throw new Error("Invalid saved word")
      await area.set({ [WORDS_KEY]: [entry, ...words.filter((item) => item.word !== entry.word)].slice(0, 500) })
    })
    queue = operation.catch(() => {})
    return operation
  }
}

async function sendWordCommand(command: WordCommand): Promise<void> {
  const reply: { ok: boolean } = await chrome.runtime.sendMessage(command)
  if (!reply?.ok) throw new Error("Word storage failed")
}

export function saveWord(result: LookupResult, sourcePageUrl?: string): Promise<void> {
  return sendWordCommand({ type: "SAVE_WORD", result, sourcePageUrl })
}

export function removeWord(word: string): Promise<void> {
  return sendWordCommand({ type: "REMOVE_WORD", word })
}

export function clearSavedWords(): Promise<void> {
  return sendWordCommand({ type: "CLEAR_WORDS" })
}
