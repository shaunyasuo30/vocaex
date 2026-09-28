import type { LookupResult } from "./lookup"

export type SavedWord = LookupResult & { savedAt: number; sourceUrl?: string }
export type Settings = { enabled: boolean; disabledHosts: string[] }
const SETTINGS_KEY = "vocamateSettings"
const WORDS_KEY = "vocamateWords"
const defaults: Settings = { enabled: true, disabledHosts: [] }

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

export async function getSavedWords(): Promise<SavedWord[]> {
  const data = await chrome.storage.local.get(WORDS_KEY)
  return Array.isArray(data[WORDS_KEY]) ? data[WORDS_KEY] : []
}

export async function saveWord(result: LookupResult, sourceUrl?: string): Promise<void> {
  const words = await getSavedWords()
  const filtered = words.filter((item) => item.word !== result.word)
  await chrome.storage.local.set({ [WORDS_KEY]: [{ ...result, savedAt: Date.now(), ...(sourceUrl ? { sourceUrl } : {}) }, ...filtered].slice(0, 500) })
}

export async function removeWord(word: string): Promise<void> {
  const words = await getSavedWords()
  await chrome.storage.local.set({ [WORDS_KEY]: words.filter((item) => item.word !== word) })
}

export async function clearSavedWords(): Promise<void> {
  await chrome.storage.local.remove(WORDS_KEY)
}
