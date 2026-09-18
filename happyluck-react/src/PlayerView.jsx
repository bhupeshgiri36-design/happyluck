import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import { filterChipList, segMatchesFilter, fmtTime, TAGS, buildShareLink, copyText } from './helpers'

const SEEK_TIMEOUT_MS = 4000

export default function PlayerView({ recording, onBack, onSegmentsSaved }) {
  const [segments, setSegments] = useState(recording.segments || [])
  const [activeTag, setActiveTag] = useState('all')
  const [currentTime, setCurrentTime] = useState(0)
  const [seekingIdx, setSeekingIdx] = useState(null)
  const [buffering, setBuffering] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const audioRef = useRef(null)
  const pendingSeekRef = useRef(null) // { handler, timeoutId } for whichever seek is currently in flight

  useEffect(() => {
    setSegments(recording.segments || [])
    setActiveTag('all')
  }, [recording])

  // Clean up any in-flight seek listener/timeout if we navigate away or the
  // recording changes mid-seek, so nothing fires against a stale element.
  useEffect(() => {
    return () => clearPendingSeek()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const clearPendingSeek = () => {
    const audio = audioRef.current
    const pending = pendingSeekRef.current
    if (pending) {
      if (audio) audio.removeEventListener('loadedmetadata', pending.handler)
      clearTimeout(pending.timeoutId)
      pendingSeekRef.current = null
    }
  }

  const seekTo = (start, idx) => {
    const audio = audioRef.current
    if (!audio) return

    // Cancel whatever earlier tap was still waiting — otherwise two quick
    // taps on different lines can race and the wrong one wins.
    clearPendingSeek()
    setSeekingIdx(idx)

    const doSeek = () => {
      clearPendingSeek()
      setSeekingIdx(null)
      try {
        audio.currentTime = start
      } catch {
        // Ignore — if this throws, metadata genuinely isn't ready, and the
        // play() call below will surface as a normal playback failure instead.
      }
      const playPromise = audio.play()
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          // Autoplay blocked or interrupted by a newer tap — the native
          // controls are still right there for the user to hit play manually.
        })
      }
    }

    // readyState >= 1 (HAVE_METADATA) means duration/currentTime are safe to set right now.
    if (audio.readyState >= 1) {
      doSeek()
      return
    }

    // Metadata isn't loaded yet — common on mobile browsers that delay
    // loading audio until you interact with it. Force it to start loading,
    // then seek the instant metadata arrives. A hard timeout means a slow or
    // broken connection can never leave the button looking stuck forever —
    // it'll just try anyway once the timeout hits.
    const handler = () => doSeek()
    const timeoutId = setTimeout(doSeek, SEEK_TIMEOUT_MS)
    pendingSeekRef.current = { handler, timeoutId }
    audio.addEventListener('loadedmetadata', handler, { once: true })
    audio.load()
  }

  const handleShare = async () => {
    const link = buildShareLink(recording.id)
    const ok = await copyText(link)
    if (ok) {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } else {
      // Clipboard genuinely unavailable — fall back to showing the link so it can be copied by hand.
      window.prompt('Copy this link:', link)
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
      <div className="player-top-row">
        <button className="back-link" onClick={onBack}>
          ← Back to all recordings
        </button>
        <button className="btn ghost share-btn" onClick={handleShare}>
          {linkCopied ? '✅ Link copied' : '🔗 Share'}
        </button>
      </div>

      <div className="player-card">
        <h2 className="devanagari">{recording.title}</h2>
        <audio
          ref={audioRef}
          controls
          preload="metadata"
          src={audioUrl}
          onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
          onWaiting={() => setBuffering(true)}
          onPlaying={() => setBuffering(false)}
          onCanPlay={() => setBuffering(false)}
        />
        {buffering && <p className="buffering-note">Buffering… (depends on your connection speed)</p>}
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
          const isSeeking = seekingIdx === idx
          return (
            <div key={idx} className={'seg' + (isActive ? ' active' : '')}>
              <button
                className={'jump-bar' + (isSeeking ? ' seeking' : '')}
                title="Play from here"
                onClick={() => seekTo(seg.start, idx)}
              >
                <span className="jump-bar-icon">{isSeeking ? '⋯' : '🎵'}</span>
                <span className="jump-bar-time mono">{fmtTime(seg.start)}</span>
                <span className="jump-bar-play">▶</span>
              </button>
              <button className="star-btn" title="Mark as favourite" onClick={() => toggleStar(idx)}>
                {seg.starred ? '⭐' : '☆'}
              </button>
              <span className="seg-tag">{seg.tag ? TAGS[seg.tag].emoji : ''}</span>
              <span className="seg-text devanagari" onClick={() => seekTo(seg.start, idx)}>
                {seg.text}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
