import assert from "node:assert/strict"
import { test } from "node:test"

import { createWordCommandHandler, getSavedWords } from "../src/lib/storage.ts"
import type { LookupResult } from "../src/lib/lookup.ts"

function memoryStorage(initial: unknown[] = []) {
  let words = initial
  const area = {
    async get() {
      await new Promise((resolve) => setTimeout(resolve, 1))
      return { vocamateWords: words }
    },
    async set(value: { vocamateWords: unknown[] }) {
      await new Promise((resolve) => setTimeout(resolve, 1))
      words = value.vocamateWords
    },
    async remove() { words = [] }
  } as unknown as Pick<chrome.storage.StorageArea, "get" | "set" | "remove">
  return area
}

function result(word: string): LookupResult {
  return {
    word, translation: `nghĩa ${word}`, phonetic: "", examples: [],
    audioUrl: null, partial: false, sourceUrl: `https://en.wiktionary.org/wiki/${word}`
  }
}

test("serializes saves from multiple contexts and keeps both source URLs", async () => {
  const area = memoryStorage()
  const handle = createWordCommandHandler(area)
  await Promise.all([
    handle({ type: "SAVE_WORD", result: result("alpha"), sourcePageUrl: "https://example.com/article" }),
    handle({ type: "SAVE_WORD", result: result("beta"), sourcePageUrl: "https://example.org/page" })
  ])
  const words = await getSavedWords(area)
  assert.deepEqual(words.map((item) => item.word), ["beta", "alpha"])
  assert.equal(words[1].sourceUrl, "https://en.wiktionary.org/wiki/alpha")
  assert.equal(words[1].sourcePageUrl, "https://example.com/article")
})

test("migrates legacy page URLs and continues after a rejected command", async () => {
  const area = memoryStorage([{ ...result("old"), sourceUrl: "https://example.com/old", savedAt: 1 }])
  const handle = createWordCommandHandler(area)
  const legacy = (await getSavedWords(area))[0]
  assert.equal(legacy.sourceUrl, undefined)
  assert.equal(legacy.sourcePageUrl, "https://example.com/old")
  await assert.rejects(handle({ type: "SAVE_WORD", result: { ...result("bad"), word: "" } }))
  await handle({ type: "SAVE_WORD", result: result("new") })
  assert.deepEqual((await getSavedWords(area)).map((item) => item.word), ["new", "old"])
})
