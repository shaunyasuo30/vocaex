import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"

import { playPronunciation } from "./lib/audio"
import { MAX_TEXT_LENGTH, MAX_WORD_LENGTH, mergeDetails, normalizeSelection, type DetailsReply, type LookupReply, type LookupResult } from "./lib/lookup"
import { floatingPosition } from "./lib/position"
import { getSettings, saveWord, type Settings } from "./lib/storage"

export const config: PlasmoCSConfig = { matches: ["http://*/*", "https://*/*"] }
export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = floatingStyles
  return style
}
const defaultSettings: Settings = { enabled: true, disabledHosts: [] }

export default function VocaMateContent() {
  const [settings, setSettings] = useState(defaultSettings)
  const [word, setWord] = useState("")
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [reply, setReply] = useState<LookupReply | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState("")
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const root = useRef<HTMLDivElement>(null)
  const range = useRef<Range | null>(null)
  const requestId = useRef(0)
  const lastWord = useRef("")

  const enabled = settings.enabled && !settings.disabledHosts.includes(location.hostname)
  const close = useCallback(() => {
    requestId.current++
    setOpen(false)
    setWord("")
    lastWord.current = ""
    setLoading(false)
    setEnriching(false)
    setReply(null)
    setSaving(false)
    setNotice("")
  }, [])

  const reposition = useCallback(() => {
    if (!range.current || !root.current) return
    if (!range.current.commonAncestorContainer.isConnected) { close(); return }
    const rect = range.current.getBoundingClientRect()
    if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) { close(); return }
    const panel = root.current.getBoundingClientRect()
    const { top, left } = floatingPosition(rect, panel, { width: window.innerWidth, height: window.innerHeight })
    setPosition((previous) => previous.top === top && previous.left === left ? previous : { top, left })
  }, [close])

  useLayoutEffect(() => { if (word && enabled) reposition() }, [word, open, reply, loading, enriching, notice, enabled, reposition])

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
      setPosition({ top: Math.max(8, rect.bottom + 8), left: Math.max(8, rect.left) })
      setWord(selected)
      setOpen(false)
      setReply(null)
      setLoading(false)
      setEnriching(false)
      setSaved(false)
      setSaving(false)
      setNotice("")
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Escape") close()
      else onSelection(event)
    }
    const onOutside = (event: PointerEvent) => {
      if (open && root.current && !event.composedPath().includes(root.current)) close()
    }
    let frame = 0
    const schedulePosition = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        reposition()
      })
    }
    document.addEventListener("mouseup", onSelection)
    document.addEventListener("keyup", onKeyUp)
    document.addEventListener("pointerdown", onOutside)
    window.addEventListener("scroll", schedulePosition, true)
    window.addEventListener("resize", schedulePosition)
    return () => {
      document.removeEventListener("mouseup", onSelection)
      document.removeEventListener("keyup", onKeyUp)
      document.removeEventListener("pointerdown", onOutside)
      window.removeEventListener("scroll", schedulePosition, true)
      window.removeEventListener("resize", schedulePosition)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [enabled, open, close, reposition])

  const lookup = async () => {
    const current = ++requestId.current
    setOpen(true)
    setLoading(true)
    setEnriching(false)
    setReply(null)
    setSaved(false)
    setSaving(false)
    setNotice("")
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
  const saveCurrent = async (value: LookupResult) => {
    const current = requestId.current
    setSaving(true)
    setNotice("")
    try {
      await saveWord(value, location.origin + location.pathname)
      if (current === requestId.current) setSaved(true)
    } catch {
      if (current === requestId.current) setNotice("Không lưu được từ. Hãy thử lại.")
    } finally {
      if (current === requestId.current) setSaving(false)
    }
  }
  if (!enabled || !word) return null
  return (
    <div ref={root} className="vm-floating-root" style={{ position: "fixed", top: position.top, left: position.left, zIndex: 2147483647 }}>
      {!open ? (
        <button type="button" className="vm-float-trigger" onClick={lookup}><span className="vm-float-trigger-icon" aria-hidden="true">✦</span>{isPassage ? "Dịch đoạn" : "Tra nghĩa"}<span className="vm-float-arrow" aria-hidden="true">→</span></button>
      ) : (
        <section role="dialog" aria-label={`${isPassage ? "Dịch đoạn" : "Tra nghĩa"} ${title}`} className="vm-float-card" style={{ width: Math.min(isPassage ? 390 : 354, window.innerWidth - 16) }}>
          <div className="vm-float-header">
            <span className="vm-float-logo" aria-hidden="true">✦</span>
            <div className="vm-float-heading">
              <div className="vm-float-kicker">VOCAMATE <span>·</span> {isPassage ? "DỊCH ĐOẠN" : "TRA TỪ"}</div>
              <strong>{title}</strong>
            </div>
            <button type="button" aria-label="Đóng" onClick={close} className="vm-float-close">✕</button>
          </div>
          <div className="vm-float-body">
            {loading && <p role="status" className="vm-float-loading"><span aria-hidden="true">✦</span> Đang tìm nghĩa cho bạn…</p>}
            {!loading && reply?.ok === false && <div role="alert" className="vm-float-error"><p>{reply.error}</p><button type="button" onClick={lookup} className="vm-float-primary">Thử lại <span aria-hidden="true">→</span></button></div>}
            {result && <>
              <div className="vm-float-meaning">
                <div className="vm-float-label">NGHĨA TIẾNG VIỆT</div>
                <p>{result.translation}</p>
              </div>
              {!isPassage && <>
                {result.phonetic && <div className="vm-float-phonetic"><span>Phiên âm</span><strong>{result.phonetic}</strong></div>}
                {result.examples.length > 0 && <div className="vm-float-examples"><div className="vm-float-label">VÍ DỤ SỬ DỤNG</div>{result.examples.map((example) => <p key={example}>{example}</p>)}</div>}
                {result.sourceUrl && <div className="vm-float-source">Dữ liệu từ <a href="https://freedictionaryapi.com/" target="_blank" rel="noopener noreferrer">FreeDictionaryAPI.com</a> · <a href={result.sourceUrl} target="_blank" rel="noopener noreferrer">Wiktionary</a></div>}
                {result.partial && <p className="vm-float-note">{enriching ? "Đang bổ sung dữ liệu từ điển…" : [!result.phonetic && "Chưa có phiên âm", !result.examples.length && "Chưa có ví dụ"].filter(Boolean).join(" · ")}</p>}
                <div className="vm-float-actions">
                  <button type="button" aria-label="Nghe phát âm" onClick={() => { playPronunciation(result.word, result.audioUrl).catch(() => setNotice("Không phát được âm thanh.")) }} className="vm-float-secondary"><span aria-hidden="true">◖))</span> Nghe</button>
                  <button type="button" disabled={saved || saving} onClick={() => saveCurrent(result)} className="vm-float-primary">{saved ? "✓ Đã lưu" : saving ? "Đang lưu…" : "＋ Lưu từ"}</button>
                </div>
                {notice && <p role="alert" className="vm-float-notice">{notice}</p>}
              </>}
            </>}
          </div>
        </section>
      )}
    </div>
  )
}

const floatingStyles = `
.vm-floating-root, .vm-floating-root * { box-sizing: border-box; }
.vm-floating-root { font: 13px Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #192f4c; }
.vm-floating-root button { font: inherit; cursor: pointer; }
.vm-floating-root button:focus-visible, .vm-floating-root a:focus-visible { outline: 3px solid #f3b544; outline-offset: 2px; }
.vm-float-trigger { display: inline-flex; align-items: center; gap: 8px; padding: 5px 12px 5px 5px; border: 1px solid #d8e3fa; border-radius: 999px; background: #fff; color: #2845a8; font-size: 12px !important; font-weight: 800 !important; white-space: nowrap; box-shadow: 0 8px 23px rgba(40, 75, 150, .2); transition: transform .18s, box-shadow .18s; }
.vm-float-trigger:hover { transform: translateY(-2px); box-shadow: 0 11px 27px rgba(40, 75, 150, .24); }
.vm-float-trigger-icon { display: grid; place-items: center; width: 27px; height: 27px; border-radius: 50%; background: #405ee8; color: #fff; font-size: 15px; }
.vm-float-arrow { color: #7793cb; font-size: 15px; }
.vm-float-card { max-height: min(70vh, 440px); overflow-y: auto; border: 1px solid #dce6f4; border-radius: 19px; background: #fff; box-shadow: 0 22px 56px rgba(24, 53, 103, .23), 0 4px 14px rgba(24, 53, 103, .1); }
.vm-float-header { display: flex; align-items: flex-start; gap: 10px; padding: 14px 15px; border-bottom: 1px solid #e5edf7; background: linear-gradient(120deg, #eaf2ff, #f9fbff 58%, #f0fbf7); }
.vm-float-logo { display: grid; place-items: center; flex: none; width: 30px; height: 30px; border-radius: 10px; background: #405ee8; color: #fff; font-size: 18px; box-shadow: 0 4px 9px rgba(64, 94, 232, .2); }
.vm-float-heading { flex: 1; min-width: 0; }
.vm-float-kicker, .vm-float-label { color: #6881a2; font-size: 9px; font-weight: 850; letter-spacing: 1px; }
.vm-float-kicker span { color: #1cae97; }
.vm-float-heading strong { display: block; margin-top: 4px; color: #172e4e; font-size: 16px; line-height: 1.28; overflow-wrap: anywhere; }
.vm-float-close { display: grid; place-items: center; flex: none; width: 27px; height: 27px; padding: 0; border: 1px solid #dbe6f2; border-radius: 9px; background: #fff; color: #748aa3; font-size: 12px !important; }
.vm-float-close:hover { background: #edf3fc; color: #2e4e75; }
.vm-float-body { padding: 15px; }
.vm-float-loading { margin: 2px 0; color: #4865bd; font-size: 12px; font-weight: 750; }
.vm-float-loading span { display: inline-block; margin-right: 5px; color: #20aa96; animation: vm-breathe 1.3s ease-in-out infinite; }
.vm-float-error { padding: 11px; border: 1px solid #f5d9de; border-radius: 11px; background: #fff3f4; color: #a5445b; }
.vm-float-error p { margin: 0 0 10px; line-height: 1.5; }
.vm-float-meaning { padding: 12px 13px; border: 1px solid #d6eee7; border-radius: 13px; background: linear-gradient(125deg, #edf9f5, #f8fdfb); }
.vm-float-meaning .vm-float-label { color: #579185; }
.vm-float-meaning p { margin: 6px 0 0; color: #167668; font-size: 17px; line-height: 1.4; font-weight: 800; overflow-wrap: anywhere; }
.vm-float-phonetic { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 11px; color: #7d91a8; font-size: 11px; }
.vm-float-phonetic strong { padding: 4px 8px; border-radius: 7px; background: #edf3ff; color: #4965a5; font-size: 12px; font-weight: 750; }
.vm-float-examples { margin-top: 14px; }
.vm-float-examples p { margin: 7px 0 0; padding: 8px 10px; border-left: 2px solid #bbd9f5; border-radius: 0 9px 9px 0; background: #f7faff; color: #526a84; font-size: 12px; line-height: 1.5; }
.vm-float-source { margin-top: 11px; color: #8699ae; font-size: 10px; line-height: 1.4; }
.vm-float-source a { color: #4366bf; text-decoration: underline; text-underline-offset: 2px; }
.vm-float-note { margin: 11px 0 0; padding: 8px 9px; border-radius: 8px; background: #fff7e7; color: #946b2b; font-size: 11px; line-height: 1.4; }
.vm-float-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
.vm-float-primary, .vm-float-secondary { min-height: 34px; padding: 8px 11px; border-radius: 9px; font-size: 12px !important; font-weight: 800 !important; white-space: nowrap; transition: transform .18s, background .18s; }
.vm-float-primary { border: 1px solid #3856dd; background: #405ee8; color: #fff; box-shadow: 0 4px 10px rgba(64, 94, 232, .18); }
.vm-float-primary:hover:not(:disabled) { transform: translateY(-1px); background: #304cce; }
.vm-float-primary:disabled { cursor: wait; opacity: .65; }
.vm-float-secondary { border: 1px solid #d3e2f5; background: #f5f9ff; color: #41669d; }
.vm-float-secondary:hover { transform: translateY(-1px); background: #eaf3ff; }
.vm-float-notice { margin: 10px 0 0; color: #a5445b; font-size: 11px; }
@keyframes vm-breathe { 50% { opacity: .45; transform: scale(.85); } }
@media (prefers-reduced-motion: reduce) { .vm-floating-root * { animation-duration: .01ms !important; transition-duration: .01ms !important; } }
`
