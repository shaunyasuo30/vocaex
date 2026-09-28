let playbackId = 0
let currentAudio: HTMLAudioElement | null = null

export function selectEnglishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const english = voices.filter((voice) => /^en(?:-|$)/iu.test(voice.lang))
  if (!english.length) return null
  return english.reduce((best, voice) => voiceScore(voice) > voiceScore(best) ? voice : best)
}

function voiceScore(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase()
  const locale = voice.lang.toLowerCase()
  return (locale === "en-us" ? 100 : locale.startsWith("en-") ? 40 : 20)
    + (/natural|neural|enhanced|premium/u.test(name) ? 30 : 0)
    + (/google us english/u.test(name) ? 25 : 0)
    + (/microsoft/u.test(name) ? 10 : 0)
    + (voice.default ? 2 : 0)
}

function getVoices(synthesis: SpeechSynthesis): Promise<SpeechSynthesisVoice[]> {
  const available = synthesis.getVoices()
  if (selectEnglishVoice(available)) return Promise.resolve(available)
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timeout)
      synthesis.removeEventListener("voiceschanged", finish)
      resolve(synthesis.getVoices())
    }
    const timeout = setTimeout(finish, 700)
    synthesis.addEventListener("voiceschanged", finish, { once: true })
  })
}

export async function playPronunciation(word: string, audioUrl: string | null): Promise<void> {
  const current = ++playbackId
  currentAudio?.pause()
  currentAudio = null
  window.speechSynthesis?.cancel()

  if (audioUrl) {
    try {
      const audio = new Audio(audioUrl)
      currentAudio = audio
      await audio.play()
      if (current !== playbackId) audio.pause()
      return
    } catch {
      if (current === playbackId) currentAudio = null
      // File âm thanh lỗi: chuyển sang giọng đọc của trình duyệt.
    }
  }

  if (!("speechSynthesis" in window)) throw new Error("Speech synthesis unavailable")
  const synthesis = window.speechSynthesis
  const voices = await getVoices(synthesis)
  if (current !== playbackId) return

  const utterance = new SpeechSynthesisUtterance(word)
  const voice = selectEnglishVoice(voices)
  utterance.lang = voice?.lang || "en-US"
  if (voice) utterance.voice = voice
  utterance.rate = 0.88
  utterance.pitch = 1
  synthesis.speak(utterance)
}
