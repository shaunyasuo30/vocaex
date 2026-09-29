import assert from "node:assert/strict"
import { test } from "node:test"

import { createRequestCache } from "../src/lib/request-cache.ts"

test("coalesces simultaneous lookups and serves successful results from cache", async () => {
  let calls = 0
  const get = createRequestCache<{ ok: boolean; key: string }>(
    async (key: string) => {
      calls++
      await new Promise((resolve) => setTimeout(resolve, 5))
      return { ok: true, key }
    },
    () => ({ ok: false, key: "" }),
    { ttlMs: 1000, timeoutMs: 100, maxEntries: 10 }
  )
  assert.deepEqual(await Promise.all([get("word"), get("word")]), [
    { ok: true, key: "word" }, { ok: true, key: "word" }
  ])
  assert.deepEqual(await get("word"), { ok: true, key: "word" })
  assert.equal(calls, 1)
})

test("does not cache errors or rejected requests", async () => {
  let calls = 0
  const get = createRequestCache(
    async () => {
      calls++
      if (calls === 1) throw new Error("network")
      return { ok: calls > 2, value: calls }
    },
    () => ({ ok: false, value: 0 }),
    { ttlMs: 1000, timeoutMs: 100, maxEntries: 10 }
  )
  assert.deepEqual(await get("word"), { ok: false, value: 0 })
  assert.deepEqual(await get("word"), { ok: false, value: 2 })
  assert.deepEqual(await get("word"), { ok: true, value: 3 })
  assert.deepEqual(await get("word"), { ok: true, value: 3 })
  assert.equal(calls, 3)
})

test("aborts a stalled request and allows a retry", async () => {
  let calls = 0
  const get = createRequestCache<{ ok: boolean; value: number }>(
    async (_key, signal) => {
      calls++
      if (calls > 1) return { ok: true, value: calls }
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true })
      })
    },
    () => ({ ok: false, value: 0 }),
    { ttlMs: 1000, timeoutMs: 10, maxEntries: 10 }
  )
  assert.deepEqual(await get("word"), { ok: false, value: 0 })
  assert.deepEqual(await get("word"), { ok: true, value: 2 })
})
