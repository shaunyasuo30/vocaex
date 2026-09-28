import assert from "node:assert/strict"
import { afterEach, test } from "node:test"

import { playPronunciation, selectEnglishVoice } from "../src/lib/audio.ts"

const originalWindow = globalThis.window
const originalUtterance = globalThis.SpeechSynthesisUtterance
afterEach(() => {
  globalThis.window = originalWindow
  globalThis.SpeechSynthesisUtterance = originalUtterance
})

test("chooses an English US natural voice over the system default", () => {
  const voices = [
    { name: "Vietnamese", lang: "vi-VN", default: true },
    { name: "English UK", lang: "en-GB", default: false },
    { name: "Microsoft Aria Online (Natural)", lang: "en-US", default: false }
  ] as SpeechSynthesisVoice[]
  assert.equal(selectEnglishVoice(voices), voices[2])
  assert.equal(selectEnglishVoice([voices[0]]), null)
})

test("speaks with a clear English voice at a slower rate", async () => {
  const voice = { name: "Google US English", lang: "en-US", default: false } as SpeechSynthesisVoice
  let spoken: SpeechSynthesisUtterance | undefined
  let cancelled = false
  globalThis.window = { speechSynthesis: {
    cancel: () => { cancelled = true },
    getVoices: () => [voice],
    speak: (utterance: SpeechSynthesisUtterance) => { spoken = utterance }
  } } as unknown as Window & typeof globalThis
  globalThis.SpeechSynthesisUtterance = class {
    text: string
    constructor(text: string) { this.text = text }
    lang = ""
    voice: SpeechSynthesisVoice | null = null
    rate = 1
    pitch = 1
  } as unknown as typeof SpeechSynthesisUtterance

  await playPronunciation("classifier", null)
  assert.equal(cancelled, true)
  assert.equal(spoken?.text, "classifier")
  assert.equal(spoken?.voice, voice)
  assert.equal(spoken?.lang, "en-US")
  assert.equal(spoken?.rate, 0.88)
})
