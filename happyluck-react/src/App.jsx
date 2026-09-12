import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import ListView from './ListView'
import PlayerView from './PlayerView'
import AddRecordingModal from './AddRecordingModal'

export default function App() {
  const [recordings, setRecordings] = useState([])
  const [openRecording, setOpenRecording] = useState(null)
  const [showUpload, setShowUpload] = useState(false)

  const fetchRecordings = useCallback(async () => {
    if (!supabase) return
    const { data, error } = await supabase.from('recordings').select('*').order('created_at', { ascending: false })
    if (error) {
      console.error(error)
      return
    }
    setRecordings(data || [])
  }, [])

  useEffect(() => {
    fetchRecordings()
  }, [fetchRecordings])

  const handleSegmentsSaved = (id, segments) => {
    setRecordings((prev) => prev.map((r) => (r.id === id ? { ...r, segments } : r)))
    setOpenRecording((prev) => (prev && prev.id === id ? { ...prev, segments } : prev))
  }

  if (!supabase) {
    return (
      <div className="config-error">
        <h3>Supabase isn't configured</h3>
        <p>
          Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> as environment variables
          (in Render → Environment, or a local <code>.env</code> file), then redeploy.
        </p>
      </div>
    )
  }

  return (
    <>
      <header>
        <div className="eyebrow-row">
          <div className="wave">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
          <p className="tag">Marathi voice archive</p>
        </div>
        <h1 className="devanagari">आवाज़ संग्रह</h1>
        <p className="sub">
          Listen to every recording with a line-by-line Marathi transcript. Click any line to jump the audio
          straight to that moment — just like YouTube captions.
        </p>
      </header>

      <main>
        {openRecording ? (
          <PlayerView
            recording={openRecording}
            onBack={() => setOpenRecording(null)}
            onSegmentsSaved={handleSegmentsSaved}
          />
        ) : (
          <ListView recordings={recordings} onRefresh={fetchRecordings} onOpen={setOpenRecording} />
        )}
      </main>

      <button className="admin-trigger" onClick={() => setShowUpload(true)}>
        + Add recording
      </button>

      {showUpload && (
        <AddRecordingModal
          onClose={() => setShowUpload(false)}
          onSaved={() => {
            setShowUpload(false)
            fetchRecordings()
          }}
        />
      )}
    </>
  )
}
