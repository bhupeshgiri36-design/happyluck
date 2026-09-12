import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import { filterChipList, segMatchesFilter, fmtTime, TAGS } from './helpers'

export default function PlayerView({ recording, onBack, onSegmentsSaved }) {
  const [segments, setSegments] = useState(recording.segments || [])
  const [activeTag, setActiveTag] = useState('all')
  const [currentTime, setCurrentTime] = useState(0)
  const audioRef = useRef(null)

  useEffect(() => {
    setSegments(recording.segments || [])
    setActiveTag('all')
  }, [recording])

  const audioUrl = useMemo(() => {
    const { data } = supabase.storage.from('recordings-audio').getPublicUrl(recording.audio_path)
    return data.publicUrl
  }, [recording.audio_path])

  const chips = filterChipList()
  const counts = useMemo(() => {
    const c = { all: segments.length }
    chips.slice(1).forEach((chip) => {
      c[chip.key] = segments.filter((s) => segMatchesFilter(s, chip.key)).length
    })
    return c
  }, [segments])

  const visibleSegments = segments
    .map((seg, idx) => ({ seg, idx }))
    .filter(({ seg }) => segMatchesFilter(seg, activeTag))

  const seekTo = (start) => {
    const audio = audioRef.current
    if (!audio) return
    // Set currentTime directly and force play; guards against the audio
    // element not being ready yet right after the src changes.
    const doSeek = () => {
      audio.currentTime = start
      audio.play().catch(() => {})
    }
    if (audio.readyState >= 1) {
      doSeek()
    } else {
      audio.addEventListener('loadedmetadata', doSeek, { once: true })
    }
  }

  const toggleStar = async (idx) => {
    const updated = segments.map((s, i) => (i === idx ? { ...s, starred: !s.starred } : s))
    setSegments(updated)

    const { error } = await supabase.from('recordings').update({ segments: updated }).eq('id', recording.id)
    if (error) {
      console.error(error)
      setSegments(segments) // roll back
      alert('Could not save favourite — check your connection and try again.')
      return
    }
    onSegmentsSaved(recording.id, updated)
  }

  return (
    <div>
      <button className="back-link" onClick={onBack}>
        ← Back to all recordings
      </button>

      <div className="player-card">
        <h2 className="devanagari">{recording.title}</h2>
        <audio
          ref={audioRef}
          controls
          src={audioUrl}
          onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
        />
      </div>

      <div className="transcript">
        <div className="transcript-header">
          <h3>Transcript</h3>
        </div>

        <div className="chip-row">
          <span className="chip-row-label">Filter:</span>
          {chips.map((c) => {
            if (c.key !== 'all' && counts[c.key] === 0) return null
            return (
              <button
                key={c.key}
                className={'chip' + (activeTag === c.key ? ' active' : '')}
                onClick={() => setActiveTag(c.key)}
              >
                {c.emoji ? c.emoji + ' ' : ''}
                {c.key === 'all' ? 'All lines' : c.label} <span className="count">{counts[c.key]}</span>
              </button>
            )
          })}
        </div>

        {segments.length === 0 && (
          <p style={{ color: 'var(--muted)', padding: '12px 8px' }}>No transcript available yet for this recording.</p>
        )}

        {segments.length > 0 && visibleSegments.length === 0 && (
          <p style={{ color: 'var(--muted)', padding: '12px 8px' }}>No lines with this tag.</p>
        )}

        {visibleSegments.map(({ seg, idx }) => {
          const isActive = currentTime >= seg.start && currentTime < seg.end
          return (
            <div key={idx} className={'seg' + (isActive ? ' active' : '')}>
              <button className="jump-btn" title="Play from here" onClick={() => seekTo(seg.start)}>
                ▶
              </button>
              <span className="seg-time mono">{fmtTime(seg.start)}</span>
              <button className="star-btn" title="Mark as favourite" onClick={() => toggleStar(idx)}>
                {seg.starred ? '⭐' : '☆'}
              </button>
              <span className="seg-tag">{seg.tag ? TAGS[seg.tag].emoji : ''}</span>
              <span className="seg-text devanagari" onClick={() => seekTo(seg.start)}>
                {seg.text}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
