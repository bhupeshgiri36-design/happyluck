import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import { parseManualTranscript, fmtTime, RECORDING_CATEGORIES, DEFAULT_CATEGORY } from './helpers'
import { uploadFileWithProgress } from './uploadHelpers'

export default function AddRecordingModal({ onClose, onSaved }) {
  const [title, setTitle] = useState('')
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [transcript, setTranscript] = useState('')
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState(0)
  const [logLines, setLogLines] = useState([])
  const [playbackRate, setPlaybackRate] = useState(1)
  const [category, setCategory] = useState(DEFAULT_CATEGORY)

  const previewAudioRef = useRef(null)
  const textareaRef = useRef(null)

  const log = (msg) => setLogLines((prev) => [...prev, msg])

  // Build a local preview URL whenever a new file is chosen, and clean up the old one.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    if (previewAudioRef.current) previewAudioRef.current.playbackRate = playbackRate
  }, [playbackRate, previewUrl])

  // Inserts "M:SS " at the textarea's cursor (or at the end if nothing is focused),
  // always starting on its own new line, then puts the cursor right after it so
  // you can just start typing the words for that line.
  const insertTimestamp = () => {
    const audio = previewAudioRef.current
    if (!audio) return
    const ta = textareaRef.current
    const stamp = fmtTime(audio.currentTime)

    if (!ta) {
      setTranscript((prev) => (prev ? prev.replace(/\n?$/, '\n') : '') + `${stamp} `)
      return
    }

    const start = ta.selectionStart ?? transcript.length
    const end = ta.selectionEnd ?? transcript.length
    const before = transcript.slice(0, start)
    const after = transcript.slice(end)
    const needsNewline = before.length > 0 && !before.endsWith('\n')
    const insert = (needsNewline ? '\n' : '') + `${stamp} `
    const updated = before + insert + after
    setTranscript(updated)

    requestAnimationFrame(() => {
      const pos = before.length + insert.length
      ta.focus()
      ta.setSelectionRange(pos, pos)
    })
  }

  const togglePlay = () => {
    const audio = previewAudioRef.current
    if (!audio) return
    if (audio.paused) audio.play().catch(() => {})
    else audio.pause()
  }

  // Space bar marks a timestamp from anywhere except while actually typing in the textarea.
  useEffect(() => {
    const handler = (e) => {
      if (!previewUrl) return
      if (document.activeElement === textareaRef.current) return
      if (e.code === 'Space') {
        e.preventDefault()
        insertTimestamp()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrl, transcript])

  const handleSave = async () => {
    if (!title.trim() || !file) {
      alert('Please add a title and choose a file.')
      return
    }
    setSaving(true)
    setProgress(0)
    setLogLines([])

    try {
      const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`
      log(`Uploading audio (${(file.size / 1024 / 1024).toFixed(1)} MB)…`)
      await uploadFileWithProgress('recordings-audio', path, file, (pct) => setProgress(pct))

      const segments = parseManualTranscript(transcript)
      const fullText = segments.map((s) => s.text).join(' ')
      const duration = segments.length ? segments[segments.length - 1].end : null

      log('Saving recording and transcript…')
      const { error: insErr } = await supabase.from('recordings').insert({
        title,
        audio_path: path,
        language: 'mr',
        segments,
        full_text: fullText,
        duration_seconds: duration,
        status: segments.length ? 'done' : 'pending',
        category,
      })
      if (insErr) throw insErr

      log('Saved!')
      setTimeout(() => {
        onSaved()
      }, 600)
    } catch (err) {
      console.error(err)
      log('Error: ' + (err.message || err))
      setSaving(false)
    }
  }

  return (
    <div className="modal-bg">
      <div className="modal">
        <h2>Add a recording</h2>
        <p className="hint">Choose the audio, listen below, and tap "Mark timestamp" the instant a new line starts.</p>

        <div className="field">
          <label>Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. आजोबांची मुलाखत — भाग १"
            disabled={saving}
          />
        </div>

        <div className="field">
          <label>Category</label>
          <div className="category-picker">
            {Object.keys(RECORDING_CATEGORIES).map((key) => (
              <button
                key={key}
                type="button"
                className={'category-pill category-' + key + (category === key ? ' active' : '')}
                onClick={() => setCategory(key)}
                disabled={saving}
              >
                {RECORDING_CATEGORIES[key].emoji} {RECORDING_CATEGORIES[key].label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Audio file</label>
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => setFile(e.target.files[0])}
            disabled={saving}
          />
        </div>

        {previewUrl && (
          <div className="field timestamp-helper">
            <label>Listen &amp; mark</label>
            <audio ref={previewAudioRef} controls src={previewUrl} style={{ width: '100%' }} />
            <div className="timestamp-controls">
              <button type="button" className="btn ghost" onClick={togglePlay} disabled={saving}>
                ▶ / ⏸
              </button>
              <button type="button" className="btn" onClick={insertTimestamp} disabled={saving}>
                ⏱ Mark timestamp
              </button>
              <div className="speed-group">
                {[0.75, 1, 1.25, 1.5].map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={'speed-btn' + (playbackRate === r ? ' active' : '')}
                    onClick={() => setPlaybackRate(r)}
                    disabled={saving}
                  >
                    {r}x
                  </button>
                ))}
              </div>
            </div>
            <div className="note">
              Tip: press <b>Space</b> anywhere outside the text box below to mark a timestamp without reaching for
              the mouse — it drops a new line at the current playback time. Type the words right after.
            </div>
          </div>
        )}

        <div className="field">
          <label>Transcript with timestamps</label>
          <textarea
            ref={textareaRef}
            rows={8}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder={'0:00 नमस्कार, कसे आहात?\n1:02 [important] लक्षात ठेवा\n1:20 [question] हे बरोबर आहे का?'}
            disabled={saving}
          />
          <div className="note">
            One line per caption: timestamp, then the text. You don't need to mark favourites here — once saved, tap
            the ☆ next to any line while listening to mark it ⭐, it saves instantly.
            <br />
            Other tags you can type in brackets: <b>[important]</b> ❗, <b>[question]</b> ❓, <b>[note]</b> 📝.
          </div>
        </div>

        {saving && (
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
            <span className="progress-label">{progress}%</span>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Uploading…' : 'Save recording'}
          </button>
        </div>

        {logLines.length > 0 && (
          <div className="upload-log">
            {logLines.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
