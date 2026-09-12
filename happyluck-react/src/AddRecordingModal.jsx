import { useState } from 'react'
import { supabase } from './supabaseClient'
import { parseManualTranscript } from './helpers'

export default function AddRecordingModal({ onClose, onSaved }) {
  const [title, setTitle] = useState('')
  const [file, setFile] = useState(null)
  const [transcript, setTranscript] = useState('')
  const [saving, setSaving] = useState(false)
  const [logLines, setLogLines] = useState([])

  const log = (msg) => setLogLines((prev) => [...prev, msg])

  const handleSave = async () => {
    if (!title.trim() || !file) {
      alert('Please add a title and choose a file.')
      return
    }
    setSaving(true)
    setLogLines([])

    try {
      log('Uploading audio to Supabase…')
      const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`
      const { error: upErr } = await supabase.storage.from('recordings-audio').upload(path, file)
      if (upErr) throw upErr

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
        <p className="hint">Upload the audio, then type or paste each line with its timestamp below.</p>

        <div className="field">
          <label>Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. आजोबांची मुलाखत — भाग १"
          />
        </div>

        <div className="field">
          <label>Audio file</label>
          <input type="file" accept="audio/*" onChange={(e) => setFile(e.target.files[0])} />
        </div>

        <div className="field">
          <label>Transcript with timestamps</label>
          <textarea
            rows={8}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder={'0:00 नमस्कार, कसे आहात?\n1:02 [important] लक्षात ठेवा\n1:20 [question] हे बरोबर आहे का?'}
          />
          <div className="note">
            One line per caption: timestamp, then the text. You don't need to mark favourites here — once saved, tap
            the ☆ next to any line while listening to mark it ⭐, it saves instantly.
            <br />
            Other tags you can type in brackets: <b>[important]</b> ❗, <b>[question]</b> ❓, <b>[note]</b> 📝.
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn" onClick={handleSave} disabled={saving}>
            Save recording
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
