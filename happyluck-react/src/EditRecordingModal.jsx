import { useState } from 'react'
import { supabase } from './supabaseClient'
import { parseManualTranscript, serializeTranscript } from './helpers'

export default function EditRecordingModal({ recording, onClose, onSaved }) {
  const [title, setTitle] = useState(recording.title)
  const [transcript, setTranscript] = useState(serializeTranscript(recording.segments))
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Title cannot be empty.')
      return
    }
    setSaving(true)
    setErrorMsg('')

    const segments = parseManualTranscript(transcript)
    const fullText = segments.map((s) => s.text).join(' ')
    const duration = segments.length ? segments[segments.length - 1].end : recording.duration_seconds

    const { error } = await supabase
      .from('recordings')
      .update({
        title,
        segments,
        full_text: fullText,
        duration_seconds: duration,
        status: segments.length ? 'done' : 'pending',
      })
      .eq('id', recording.id)

    setSaving(false)
    if (error) {
      console.error(error)
      setErrorMsg(error.message)
      return
    }
    onSaved()
  }

  return (
    <div className="modal-bg">
      <div className="modal">
        <h2>Edit recording</h2>
        <p className="hint">The audio file itself can't be changed here — only the title and transcript.</p>

        <div className="field">
          <label>Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} disabled={saving} />
        </div>

        <div className="field">
          <label>Transcript with timestamps</label>
          <textarea
            rows={10}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            disabled={saving}
          />
          <div className="note">
            Star and tag brackets are preserved: <b>[star]</b> ⭐, <b>[important]</b> ❗, <b>[question]</b> ❓,{' '}
            <b>[note]</b> 📝.
          </div>
        </div>

        {errorMsg && <div className="upload-log">{errorMsg}</div>}

        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
