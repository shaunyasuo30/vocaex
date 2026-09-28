import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useRef, useState } from "react"

import { playPronunciation } from "./lib/audio"
import { MAX_TEXT_LENGTH, MAX_WORD_LENGTH, mergeDetails, normalizeSelection, type DetailsReply, type LookupReply, type LookupResult } from "./lib/lookup"
import { getSettings, saveWord, type Settings } from "./lib/storage"

export const config: PlasmoCSConfig = { matches: ["http://*/*", "https://*/*"] }
const defaultSettings: Settings = { enabled: true, disabledHosts: [] }

export default function VocaMateContent() {
  const [settings, setSettings] = useState(defaultSettings)
  const [word, setWord] = useState("")
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [reply, setReply] = useState<LookupReply | null>(null)
  const [saved, setSaved] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const root = useRef<HTMLDivElement>(null)
  const range = useRef<Range | null>(null)
  const requestId = useRef(0)
  const lastWord = useRef("")

  const enabled = settings.enabled && !settings.disabledHosts.includes(location.hostname)
  const close = () => {
    requestId.current++
    setOpen(false)
    setWord("")
    lastWord.current = ""
    setLoading(false)
    setEnriching(false)
    setReply(null)
  }

  useEffect(() => {
    getSettings().then(setSettings).catch(() => {})
    const onChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.vocamateSettings) getSettings().then(setSettings).catch(() => {})
    }
    chrome.storage.onChanged.addListener(onChange)
    return () => chrome.storage.onChanged.removeListener(onChange)
  }, [])

  useEffect(() => {
    if (!enabled) {
      close()
      return
    }
    const onSelection = (event: MouseEvent | KeyboardEvent) => {
      if (root.current && event.composedPath().includes(root.current)) return
      const target = event.target
      if (target instanceof Element && target.closest("input, textarea, [contenteditable], [role=textbox]")) return
      const selection = window.getSelection()
      const selected = normalizeSelection(selection?.toString())
      if (!selected || !selection?.rangeCount) {
        if (!open) close()
        return
      }
      if (open && selected === lastWord.current) return
      requestId.current++
      lastWord.current = selected
      range.current = selection.getRangeAt(0).cloneRange()
      const rect = range.current.getBoundingClientRect()
      setPosition({ top: Math.max(8, Math.min(window.innerHeight - 50, rect.bottom + 8)), left: Math.max(8, Math.min(window.innerWidth - 170, rect.left)) })
      setWord(selected)
      setOpen(false)
      setReply(null)
      setLoading(false)
      setEnriching(false)
      setSaved(false)
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Escape") close()
      else onSelection(event)
    }
    const onOutside = (event: PointerEvent) => {
      if (open && root.current && !event.composedPath().includes(root.current)) close()
    }
    const updatePosition = () => {
      if (!range.current) return
      const rect = range.current.getBoundingClientRect()
      setPosition({ top: Math.max(8, Math.min(window.innerHeight - (open ? 290 : 50), rect.bottom + 8)), left: Math.max(8, Math.min(window.innerWidth - (open ? (word.length > MAX_WORD_LENGTH ? 400 : 360) : 170), rect.left)) })
    }
    document.addEventListener("mouseup", onSelection)
    document.addEventListener("keyup", onKeyUp)
    document.addEventListener("pointerdown", onOutside)
    window.addEventListener("scroll", updatePosition, true)
    window.addEventListener("resize", updatePosition)
    return () => {
      document.removeEventListener("mouseup", onSelection)
      document.removeEventListener("keyup", onKeyUp)
      document.removeEventListener("pointerdown", onOutside)
      window.removeEventListener("scroll", updatePosition, true)
      window.removeEventListener("resize", updatePosition)
    }
  }, [enabled, open, word])

  const lookup = async () => {
    const current = ++requestId.current
    if (range.current) {
      const rect = range.current.getBoundingClientRect()
      setPosition({ top: Math.max(8, Math.min(window.innerHeight - 290, rect.bottom + 8)), left: Math.max(8, Math.min(window.innerWidth - (word.length > MAX_WORD_LENGTH ? 400 : 360), rect.left)) })
    }
    setOpen(true)
    setLoading(true)
    setEnriching(false)
    setReply(null)
    setSaved(false)
    if (word.length > MAX_TEXT_LENGTH) {
      setReply({ ok: false, error: "Đoạn quá dài. Hãy chọn tối đa 2.000 ký tự để dịch." })
      setLoading(false)
      return
    }
    try {
      const answer: LookupReply = await chrome.runtime.sendMessage({ type: "LOOKUP", word })
      if (current === requestId.current) {
        setReply(answer)
        if (answer.ok && word.length <= MAX_WORD_LENGTH) {
          setEnriching(answer.result.partial)
          chrome.runtime.sendMessage({ type: "LOOKUP_DETAILS", word })
            .then((details: DetailsReply) => {
              if (current === requestId.current && details.ok) {
                setReply((previous) => previous?.ok ? { ok: true, result: mergeDetails(previous.result, details.details) } : previous)
              }
            })
            .catch(() => {})
            .finally(() => { if (current === requestId.current) setEnriching(false) })
        }
      }
    } catch {
      if (current === requestId.current) setReply({ ok: false, error: "Không thể kết nối tới extension. Hãy thử lại." })
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }

  const result: LookupResult | null = reply?.ok ? reply.result : null
  const isPassage = word.length > MAX_WORD_LENGTH
  const title = word.length > 100 ? `${word.slice(0, 100)}…` : word
  if (!enabled || !word) return null
  return (
    <div ref={root} style={{ position: "fixed", top: position.top, left: position.left, zIndex: 2147483647, fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif", fontSize: 13, color: "#183152", boxSizing: "border-box" }}>
      {!open ? (
        <button type="button" onClick={lookup} style={buttonStyle}><span aria-hidden="true" style={{ marginRight: 7 }}>✦</span>{isPassage ? "Dịch đoạn" : "Tra nghĩa"}<span aria-hidden="true" style={{ marginLeft: 8 }}>→</span></button>
      ) : (
        <section role="dialog" aria-label={`${isPassage ? "Dịch đoạn" : "Tra nghĩa"} ${title}`} style={{ width: Math.min(isPassage ? 380 : 340, window.innerWidth - 16), maxHeight: "min(70vh, 420px)", overflowY: "auto", background: "linear-gradient(165deg, #ffffff 60%, #f5faff)", border: "1px solid #d9e7fa", borderRadius: 18, boxShadow: "0 20px 50px rgba(24, 65, 125, .22), 0 3px 10px rgba(24, 65, 125, .08)", boxSizing: "border-box" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", background: "linear-gradient(100deg, #eaf3ff, #effdfd)", borderBottom: "1px solid #e0ebf8" }}>
            <span aria-hidden="true" style={{ display: "grid", placeItems: "center", width: 29, height: 29, flexShrink: 0, borderRadius: 10, background: "linear-gradient(135deg, #315ef6, #24c4d1)", color: "white", fontSize: 18 }}>✦</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: "#5d81b0", fontSize: 9, letterSpacing: 1.2, fontWeight: 800 }}>VOCAMATE · {isPassage ? "DỊCH ĐOẠN" : "TRA TỪ"}</div>
              <strong style={{ display: "block", color: "#183152", fontSize: 15, lineHeight: 1.3, marginTop: 2, overflowWrap: "anywhere" }}>{title}</strong>
            </div>
            <button type="button" aria-label="Đóng" onClick={close} style={closeButtonStyle}>✕</button>
          </div>
          <div style={{ padding: 16 }}>
            {loading && <p role="status" style={{ color: "#3d75ca", fontWeight: 700, margin: "2px 0" }}>✦ Đang tìm nghĩa cho bạn…</p>}
            {!loading && reply?.ok === false && <div role="alert" style={{ padding: 11, background: "#fff0f1", color: "#ab3f59", borderRadius: 11 }}><p style={{ margin: "0 0 10px" }}>{reply.error}</p><button type="button" onClick={lookup} style={buttonStyle}>Thử lại</button></div>}
            {result && <>
              <div style={{ background: "#f0f7ff", borderLeft: "3px solid #3d87f3", borderRadius: 11, padding: "11px 13px" }}>
                <div style={{ color: "#6787b4", fontSize: 10, letterSpacing: 1, fontWeight: 800 }}>NGHĨA TIẾNG VIỆT</div>
                <p style={{ color: "#126b87", fontSize: 17, lineHeight: 1.45, fontWeight: 800, margin: "6px 0 0", overflowWrap: "anywhere" }}>{result.translation}</p>
              </div>
              {!isPassage && <>
                {result.phonetic && <div style={{ color: "#587497", fontSize: 12, marginTop: 11 }}>Phiên âm <strong style={{ color: "#335b8d", marginLeft: 4 }}>{result.phonetic}</strong></div>}
                {result.examples.length > 0 && <div style={{ marginTop: 14 }}><div style={{ color: "#6080a7", fontSize: 10, letterSpacing: 1, fontWeight: 800 }}>VÍ DỤ SỬ DỤNG</div>{result.examples.map((example) => <p key={example} style={{ background: "#f7faff", border: "1px solid #e6effb", color: "#455e7c", padding: "9px 10px", borderRadius: 9, margin: "7px 0 0", fontSize: 12, lineHeight: 1.5 }}>{example}</p>)}</div>}
                {result.sourceUrl && <div style={{ color: "#7890ad", fontSize: 10, marginTop: 10 }}>Dữ liệu từ <a href="https://freedictionaryapi.com/" target="_blank" rel="noopener noreferrer" style={{ color: "#3a74c6" }}>FreeDictionaryAPI.com</a> · <a href={result.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#3a74c6" }}>Wiktionary</a></div>}
                {result.partial && <p style={{ color: "#9b6b23", background: "#fff8e9", borderRadius: 8, padding: "7px 9px", fontSize: 11, margin: "12px 0 0" }}>{enriching ? "Đang bổ sung dữ liệu từ điển…" : [!result.phonetic && "Chưa có phiên âm", !result.examples.length && "Chưa có ví dụ"].filter(Boolean).join(" · ")}</p>}
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
                  <button type="button" aria-label="Nghe phát âm" onClick={() => { playPronunciation(result.word, result.audioUrl).catch(() => {}) }} style={secondaryButtonStyle}>◖)) Nghe</button>
                  <button type="button" disabled={saved} onClick={() => saveWord(result, location.origin + location.pathname).then(() => setSaved(true)).catch(() => setReply({ ok: false, error: "Không lưu được từ. Hãy thử lại." }))} style={buttonStyle}>{saved ? "✓ Đã lưu" : "＋ Lưu từ"}</button>
                </div>
              </>}
            </>}
          </div>
        </section>
      )}
    </div>
  )
}

const buttonStyle: React.CSSProperties = { background: "linear-gradient(110deg, #315ef6, #258fed)", color: "white", border: "1px solid rgba(255,255,255,.8)", borderRadius: 999, padding: "9px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer", boxShadow: "0 6px 17px rgba(42, 104, 221, .26)", whiteSpace: "nowrap" }
const secondaryButtonStyle: React.CSSProperties = { color: "#2c67b3", background: "#f0f7ff", border: "1px solid #d5e7fc", borderRadius: 999, padding: "9px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }
const closeButtonStyle: React.CSSProperties = { color: "#6f89a8", background: "#ffffffbd", border: "1px solid #d7e5f7", borderRadius: 9, width: 27, height: 27, flexShrink: 0, cursor: "pointer" }
