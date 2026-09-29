import assert from "node:assert/strict"
import { after, test } from "node:test"

import { loadPronunciationDictionary, localPronunciationAsync } from "../src/lib/pronunciation.ts"

const originalChrome = globalThis.chrome
const originalFetch = globalThis.fetch
after(() => {
  globalThis.chrome = originalChrome
  globalThis.fetch = originalFetch
})

test("loads the packaged dictionary once on demand", async () => {
  let calls = 0
  globalThis.chrome = { runtime: { getURL: (path: string) => `chrome-extension://test/${path}` } } as typeof chrome
  globalThis.fetch = async (url) => {
    calls++
    assert.equal(url, "chrome-extension://test/cmu-pronunciations.json")
    return Response.json({ hello: "HH AH0 L OW1" })
  }
  assert.equal(await localPronunciationAsync("hello"), "/həˈloʊ/")
  await loadPronunciationDictionary()
  assert.equal(calls, 1)
})
