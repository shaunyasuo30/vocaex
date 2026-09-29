import { useEffect, useRef, useState, type FormEvent } from "react"

import "./popup.css"

import { playPronunciation } from "./lib/audio"
import { mergeDetails, normalizeWord, type DetailsReply, type LookupReply } from "./lib/lookup"
import { clearSavedWords, getSavedWords, getSettings, removeWord, saveWord, setSettings, type SavedWord, type Settings } from "./lib/storage"

export default function Popup() {
  const [query, setQuery] = useState("")
  const [reply, setReply] = useState<LookupReply | null>(null)
  const [loading, setLoading] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [words, setWords] = useState<SavedWord[]>([])
  const [filter, setFilter] = useState("")
  const [settings, setLocalSettings] = useState<Settings>({ enabled: true, disabledHosts: [] })
  const [host, setHost] = useState<string | null>(null)
  const [notice, setNotice] = useState("")
  const requestId = useRef(0)

  const refresh = () => getSavedWords().then(setWords).catch(() => setNotice("Không đọc được danh sách từ."))
  useEffect(() => {
    refresh()
    getSettings().then(setLocalSettings).catch(() => setNotice("Không đọc được cài đặt."))
    chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      try {
        const url = new URL(tabs[0]?.url || "")
        if (url.protocol === "http:" || url.protocol === "https:") setHost(url.hostname)
      } catch { /* Trang hệ thống không có hostname. */ }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const onChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.vocamateWords) refresh()
      if (changes.vocamateSettings) getSettings().then(setLocalSettings).catch(() => {})
    }
    chrome.storage.onChanged.addListener(onChange)
    return () => chrome.storage.onChanged.removeListener(onChange)
  }, [])

  const updateSettings = async (next: Settings) => {
    try {
      await setSettings(next)
      setLocalSettings(next)
      setNotice("")
    } catch { setNotice("Không lưu được cài đặt.") }
  }

  const lookup = async (event: FormEvent) => {
    event.preventDefault()
    const word = normalizeWord(query)
    if (!word) { setNotice("Nhập một từ hoặc cụm từ tối đa 50 ký tự."); return }
    const current = ++requestId.current
    setNotice("")
    setLoading(true)
    setEnriching(false)
    setReply(null)
    try {
      const answer: LookupReply = await chrome.runtime.sendMessage({ type: "LOOKUP", word })
      if (current === requestId.current) {
        setReply(answer)
        if (answer.ok) {
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
    }
    catch { if (current === requestId.current) setReply({ ok: false, error: "Không thể kết nối tới extension." }) }
    finally { if (current === requestId.current) setLoading(false) }
  }

  const result = reply?.ok ? reply.result : null
  const visibleWords = words.filter((item) => item.word.toLocaleLowerCase().includes(filter.toLocaleLowerCase()))
  return <main className="vm-popup">
    <header className="vm-hero">
      <div className="vm-brand-row">
        <div className="vm-brand-lockup"><span className="vm-logo" aria-hidden="true">✦</span><span className="vm-brand">VocaMate<span className="vm-brand-period">.</span></span></div>
        <span className="vm-badge"><span className="vm-badge-dot" aria-hidden="true" /> BẠN ĐỒNG HÀNH</span>
      </div>
      <div className="vm-hero-copy">
        <span className="vm-eyebrow">HỌC TỪ MỖI TRANG BẠN ĐỌC</span>
        <h1>Đọc đâu,<br /><span>hiểu ngay đó.</span></h1>
        <p>Chạm vào từ mới. Hiểu nghĩa, nghe cách đọc và lưu lại điều hay.</p>
      </div>
      <div className="vm-hero-decoration" aria-hidden="true"><span>hello</span><span>xin chào</span><span>✦</span></div>
    </header>

    <div className="vm-body">
      <form onSubmit={lookup} className="vm-search-form">
        <div className="vm-search-heading"><label htmlFor="vm-word-input" className="vm-section-label">TRA TỪ NHANH</label><span>EN → VI</span></div>
        <div className="vm-search-row">
          <span className="vm-search-icon" aria-hidden="true">⌕</span>
          <input id="vm-word-input" aria-label="Từ cần tra" placeholder="Nhập từ tiếng Anh…" value={query} onChange={(event) => { requestId.current++; setQuery(event.target.value); setReply(null); setLoading(false); setEnriching(false) }} maxLength={50} />
          <button type="submit" disabled={loading} className="vm-primary-button vm-search-button">Tra <span aria-hidden="true">→</span></button>
        </div>
      </form>

      {loading && <div role="status" className="vm-status"><span aria-hidden="true">✦</span> Đang tìm nghĩa cho bạn…</div>}
      {reply?.ok === false && <div role="alert" className="vm-error">{reply.error}</div>}
      {result && <section className="vm-result" aria-label={`Kết quả tra ${result.word}`}>
        <div className="vm-result-top"><span className="vm-result-kicker">KHÁM PHÁ TỪ VỰNG</span><span className="vm-result-star" aria-hidden="true">✦</span></div>
        <h2>{result.word}</h2>
        {result.phonetic && <div className="vm-phonetic">/{result.phonetic.replace(/^\/+|\/+$/gu, "")}/</div>}
        <div className="vm-meaning-card"><span className="vm-mini-label">NGHĨA TIẾNG VIỆT</span><p className="vm-meaning">{result.translation}</p></div>
        {result.examples.length > 0 && <div className="vm-examples"><span className="vm-mini-label">VÍ DỤ</span>{result.examples.map((example) => <p key={example}>{example}</p>)}</div>}
        {result.sourceUrl && <p className="vm-source">Nguồn: <a href="https://freedictionaryapi.com/" target="_blank" rel="noopener noreferrer">FreeDictionaryAPI.com</a> · <a href={result.sourceUrl} target="_blank" rel="noopener noreferrer">Wiktionary</a></p>}
        {result.partial && <p className="vm-note">{enriching ? "Đang bổ sung dữ liệu từ điển…" : [!result.phonetic && "Chưa có phiên âm", !result.examples.length && "Chưa có ví dụ"].filter(Boolean).join(" · ")}</p>}
        <div className="vm-result-actions">
          <button type="button" className="vm-secondary-button" onClick={() => playPronunciation(result.word, result.audioUrl).catch(() => setNotice("Không phát được âm thanh."))}><span aria-hidden="true">◖))</span> Nghe</button>
          <button type="button" className="vm-primary-button" onClick={() => saveWord(result).then(refresh).catch(() => setNotice("Không lưu được từ."))}><span aria-hidden="true">＋</span> Lưu từ</button>
        </div>
      </section>}

      <section className="vm-panel vm-settings" aria-label="Cài đặt">
        <div className="vm-panel-heading"><span className="vm-panel-icon" aria-hidden="true">⚙</span><div><span className="vm-panel-overline">TRẢI NGHIỆM CỦA BẠN</span><h2>Tùy chỉnh</h2></div></div>
        <label className="vm-setting-row"><span><strong>Bật VocaMate</strong><small>Hiện nút tra khi bôi đen</small></span><input className="vm-switch" type="checkbox" checked={settings.enabled} onChange={(event) => updateSettings({ ...settings, enabled: event.target.checked })} /></label>
        {host && <label className="vm-setting-row"><span><strong>Trang hiện tại</strong><small title={host}>{host}</small></span><input className="vm-switch" type="checkbox" checked={!settings.disabledHosts.includes(host)} onChange={(event) => updateSettings({ ...settings, disabledHosts: event.target.checked ? settings.disabledHosts.filter((item) => item !== host) : [...settings.disabledHosts, host] })} /></label>}
      </section>

      <section className="vm-panel vm-saved" aria-label="Từ đã lưu">
        <div className="vm-panel-heading"><span className="vm-panel-icon vm-book-icon" aria-hidden="true">▤</span><div><span className="vm-panel-overline">BỘ SƯU TẬP</span><h2>Từ đã lưu <span className="vm-count">{words.length}</span></h2></div></div>
        <input className="vm-filter" aria-label="Tìm từ đã lưu" placeholder="⌕  Tìm trong danh sách…" value={filter} onChange={(event) => setFilter(event.target.value)} />
        <div className="vm-word-list">
          {visibleWords.length === 0 && <p className="vm-empty">{words.length === 0 ? "Lưu từ mới để bắt đầu bộ sưu tập của bạn." : "Không tìm thấy từ phù hợp."}</p>}
          {visibleWords.map((item) => <div key={item.word} className="vm-word-row"><span className="vm-word-initial" aria-hidden="true">{item.word.slice(0, 1).toLocaleUpperCase()}</span><div><strong>{item.word}</strong><span>{item.translation}</span></div><button type="button" aria-label={`Xóa ${item.word}`} onClick={() => removeWord(item.word).then(refresh).catch(() => setNotice("Không xóa được từ."))}>✕</button></div>)}
        </div>
        {words.length > 0 && <button type="button" className="vm-clear-button" onClick={() => clearSavedWords().then(refresh).catch(() => setNotice("Không xóa được danh sách từ."))}>Xóa tất cả từ đã lưu</button>}
      </section>

      {notice && <p role="alert" className="vm-error">{notice}</p>}
      <p className="vm-privacy">Chỉ từ bạn tra được gửi tới dịch vụ dịch và từ điển. Từ đã lưu ở trên máy này.<br />Phát âm cục bộ: <a href="https://github.com/cmusphinx/cmudict" target="_blank" rel="noopener noreferrer">CMU Pronouncing Dictionary</a> · <a href={chrome.runtime.getURL("NOTICE.txt")} target="_blank" rel="noopener noreferrer">Giấy phép</a></p>
    </div>
  </main>
}
