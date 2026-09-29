import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import { dictionary } from "cmu-pronouncing-dictionary"

import { lookupDetails, parseFreeDictionary } from "../src/lib/dictionary.ts"
import { lookupWord, mergeDetails, normalizeSelection, normalizeText, normalizeWord, parseGoogleDetails, parseTranslation } from "../src/lib/lookup.ts"
import { arpabetToIpa, localPronunciation } from "../src/lib/pronunciation.ts"

const originalFetch = globalThis.fetch
const getLocal = async (word: string) => localPronunciation(word, dictionary)
afterEach(() => { globalThis.fetch = originalFetch })

test("normalizes input and rejects invalid requests", () => {
  assert.equal(normalizeWord("  Hello  world  "), "Hello world")
  assert.equal(normalizeWord(" "), null)
  assert.equal(normalizeWord("a".repeat(51)), null)
  assert.equal(normalizeSelection("a".repeat(100)), "a".repeat(100))
  assert.equal(normalizeText("a".repeat(2000)), "a".repeat(2000))
  assert.equal(normalizeText("a".repeat(2001)), null)
  assert.equal(normalizeWord(42), null)
})

test("long selection translates as passage without dictionary metadata", async () => {
  const requests: string[] = []
  globalThis.fetch = async (url) => {
    requests.push(url.toString())
    return Response.json([[ ["Đây là bản dịch ", "This is a long passage "], ["của đoạn văn.", "with many words."] ]])
  }
  const passage = "This is a long passage with many words and several clauses that exceeds fifty characters."
  const reply = await lookupWord(passage, new AbortController().signal)
  assert.equal(reply.ok, true)
  if (reply.ok) {
    assert.equal(reply.result.translation, "Đây là bản dịch của đoạn văn.")
    assert.equal(reply.result.partial, false)
    assert.deepEqual(reply.result.examples, [])
  }
  assert.equal(requests.length, 1)
  assert.ok(!requests[0].includes("dt=rm"))
  assert.ok(!requests[0].includes("dt=ex"))
})

test("parses multiple translated segments and distinct examples", () => {
  assert.equal(parseTranslation([[ ["xin "], ["chào"] ]]), "xin chào")
  assert.deepEqual(parseFreeDictionary({ entries: [{ language: { code: "en" }, pronunciations: [{ type: "ipa", text: "/ˈklæsɪfaɪɚ/", tags: ["General American"] }], senses: [{ examples: ["A classifier example", "A classifier example"] }] }], source: { url: "https://en.wiktionary.org/wiki/classifier" } }), { phonetic: "/ˈklæsɪfaɪɚ/", examples: ["A classifier example"], audioUrl: null, sourceUrl: "https://en.wiktionary.org/wiki/classifier" })
  const google = [] as unknown[]
  google[0] = [["sự phân loại", "classifier"], [null, null, null, "ˈklasəˌfīər"]]
  google[13] = [[["the English negative <b>classifier</b> ‘un-’"], ["another <b>classifier</b> example"]]]
  assert.deepEqual(parseGoogleDetails(google), { phonetic: "ˈklasəˌfīər", examples: ["the English negative classifier ‘un-’", "another classifier example"], audioUrl: null })
})

test("meaning and pronunciation return without waiting for dictionary", async () => {
  const requests: string[] = []
  globalThis.fetch = async (url) => {
    requests.push(url.toString())
    const data: unknown[] = []
    data[0] = [["sự phân loại", "classifier"], [null, null, null, "ˈklasəˌfīər"]]
    data[13] = [[["a <b>classifier</b> example"]]]
    return Response.json(data)
  }
  const reply = await lookupWord("Classifier", new AbortController().signal)
  assert.equal(reply.ok, true)
  if (reply.ok) {
    assert.equal(reply.result.translation, "sự phân loại")
    assert.equal(reply.result.phonetic, "ˈklasəˌfīər")
    assert.deepEqual(reply.result.examples, ["a classifier example"])
    assert.equal(reply.result.partial, false)
  }
  assert.equal(requests.length, 1)
  assert.match(requests[0], /dt=rm&dt=ex/)
})

test("capitalized selection retains its translation and gets lowercase pronunciation and examples", async () => {
  const requests: string[] = []
  globalThis.fetch = async (url) => {
    const address = url.toString()
    requests.push(address)
    const data: unknown[] = []
    data[0] = address.endsWith("q=Classifier")
      ? [["Trình phân loại", "Classifier"]]
      : [["sự phân loại", "classifier"], [null, null, null, "ˈklasəˌfīər"]]
    if (address.endsWith("q=classifier")) data[13] = [[["an English <b>classifier</b> example"]]]
    return Response.json(data)
  }
  const reply = await lookupWord("Classifier", new AbortController().signal)
  assert.equal(reply.ok, true)
  if (reply.ok) {
    assert.equal(reply.result.translation, "Trình phân loại")
    assert.equal(reply.result.phonetic, "ˈklasəˌfīər")
    assert.deepEqual(reply.result.examples, ["an English classifier example"])
  }
  assert.equal(requests.length, 2)
})

test("dictionary can enrich an already visible result", async () => {
  globalThis.fetch = async () => Response.json({ entries: [{ language: { code: "en" }, pronunciations: [{ type: "ipa", text: "/ˈklæsɪfaɪər/", tags: ["General American"] }], senses: [{ examples: ["An example"] }] }] })
  const details = await lookupDetails("classifier", new AbortController().signal, getLocal)
  assert.equal(details.ok, true)
  if (details.ok) {
    const result = mergeDetails({ word: "classifier", translation: "sự phân loại", phonetic: "ˈklasəˌfīər", examples: [], audioUrl: null, partial: true }, details.details)
    assert.equal(result.phonetic, "/ˈklæsɪfaɪər/")
    assert.deepEqual(result.examples, ["An example"])
    assert.equal(result.partial, false)
  }
})

test("local CMU pronunciation fills words and technical compounds without network", async () => {
  globalThis.fetch = async () => { throw new Error("Should not fetch") }
  assert.equal(arpabetToIpa("D EY1 T AH0 S EH2 T S"), "/ˈdeɪtəˌsɛts/")
  assert.equal(localPronunciation("datasets", dictionary), "/ˈdeɪtəˌsɛts/")
  assert.match(localPronunciation("machine learning", dictionary) || "", /^\/.* .*\/$/u)
  assert.ok(localPronunciation("hyperparameter", dictionary))
  assert.ok(localPronunciation("backpropagation", dictionary))
  const reply = await lookupDetails("datasets", new AbortController().signal, getLocal)
  assert.equal(reply.ok, true)
  if (reply.ok) assert.equal(reply.details.phonetic, "/ˈdeɪtəˌsɛts/")
})

test("verified pronunciation corrects the stochastic word family and phrases", async () => {
  globalThis.fetch = async () => { throw new Error("Should not fetch") }
  assert.equal(localPronunciation("stochastic", dictionary), "/stəˈkæstɪk/")
  assert.equal(localPronunciation("stochastically", dictionary), "/stəˈkæstɪkli/")
  assert.equal(localPronunciation("stochastic gradient descent", dictionary), "/stəˈkæstɪk ˈɡɹeɪdiənt dɪˈsɛnt/")
  const reply = await lookupDetails("Stochastic", new AbortController().signal)
  assert.equal(reply.ok, true)
  if (reply.ok) assert.equal(reply.details.phonetic, "/stəˈkæstɪk/")
})

test("Cambridge-checked corrections replace misleading CMU entries", () => {
  const expected: Record<string, string> = {
    algorithm: "/ˈælɡɚɪðəm/",
    analysis: "/əˈnæləsɪs/",
    asynchronous: "/eɪˈsɪŋkɹənəs/",
    classification: "/ˌklæsəfəˈkeɪʃən/",
    convolution: "/ˌkɑnvəˈluʃən/",
    matrices: "/ˈmeɪtɹəˌsiz/",
    optimization: "/ˌɑptəməˈzeɪʃən/",
    parameter: "/pəˈɹæmətɚ/",
    probabilistic: "/ˌpɹɑbəbəlˈɪstɪk/",
    query: "/ˈkwɪɹi/"
  }
  for (const [word, phonetic] of Object.entries(expected)) assert.equal(localPronunciation(word, dictionary), phonetic, word)
})

test("dictionary lookup prefers US IPA over a UK entry and overrides CMU fallback", async () => {
  globalThis.fetch = async () => Response.json({
    entries: [{ language: { code: "en" }, pronunciations: [
      { type: "ipa", text: "/ˈtəʊkən/", tags: ["UK"] },
      { type: "ipa", text: "/ˈtoʊkən/", tags: ["US"] }
    ] }],
    source: { url: "https://en.wiktionary.org/wiki/token" }
  })
  const reply = await lookupDetails("token", new AbortController().signal, getLocal)
  assert.equal(reply.ok, true)
  if (reply.ok) {
    assert.equal(reply.details.phonetic, "/ˈtoʊkən/")
    assert.equal(reply.details.sourceUrl, "https://en.wiktionary.org/wiki/token")
  }
})

test("British-only dictionary IPA does not replace an available American fallback", () => {
  const details = parseFreeDictionary({ entries: [{ language: { code: "en" }, pronunciations: [
    { type: "ipa", text: "/ˈtəʊkən/", tags: ["UK"] }
  ] }] }, "/ˈtoʊkən/")
  assert.equal(details.phonetic, "/ˈtoʊkən/")
})

test("translation HTTP failure is not treated as a result", async () => {
  globalThis.fetch = async (url) => url.toString().includes("translate")
    ? new Response("server error", { status: 500 })
    : Response.json([])
  const reply = await lookupWord("hello", new AbortController().signal)
  assert.equal(reply.ok, false)
})
