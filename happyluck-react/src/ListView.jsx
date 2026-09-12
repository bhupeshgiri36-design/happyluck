import { useMemo, useState } from 'react'
import { filterChipList, segMatchesFilter, fmtTime, statusLabel, TAGS } from './helpers'

export default function ListView({ recordings, onRefresh, onOpen }) {
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState('all')

  const chips = filterChipList()
  const counts = useMemo(() => {
    const c = { all: recordings.length }
    chips.slice(1).forEach((chip) => {
      c[chip.key] = recordings.filter((r) => (r.segments || []).some((s) => segMatchesFilter(s, chip.key))).length
    })
    return c
  }, [recordings])

  const filtered = useMemo(() => {
    let list = recordings
    if (activeTag !== 'all') {
      list = list.filter((r) => (r.segments || []).some((s) => segMatchesFilter(s, activeTag)))
    }
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (r) => (r.title || '').toLowerCase().includes(q) || (r.full_text || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [recordings, activeTag, query])

  const badgesFor = (rec) => {
    const segs = rec.segments || []
    const badges = []
    if (segs.some((s) => s.starred)) badges.push('⭐')
    Object.keys(TAGS).forEach((t) => {
      if (segs.some((s) => s.tag === t)) badges.push(TAGS[t].emoji)
    })
    return badges.join(' ')
  }

  return (
    <div>
      <div className="toolbar">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search recordings or transcript text…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button className="btn ghost" onClick={onRefresh}>
          Refresh
        </button>
      </div>

      <div className="chip-row">
        {chips.map((c) => {
          if (c.key !== 'all' && counts[c.key] === 0) return null
          return (
            <button
              key={c.key}
              className={'chip' + (activeTag === c.key ? ' active' : '')}
              onClick={() => setActiveTag(c.key)}
            >
              {c.emoji ? c.emoji + ' ' : ''}
              {c.key === 'all' ? 'All recordings' : c.label} <span className="count">{counts[c.key]}</span>
            </button>
          )
        })}
      </div>

      <div className="rec-list">
        {filtered.map((rec, i) => (
          <button key={rec.id} className="rec-row" onClick={() => onOpen(rec)}>
            <span className="rec-index mono">{String(i + 1).padStart(2, '0')}</span>
            <span className="rec-info">
              <p className="rec-title devanagari">{rec.title}</p>
              <span className="rec-meta">
                <span>{rec.duration_seconds ? fmtTime(rec.duration_seconds) : '—'}</span>
                <span className={`status-pill status-${rec.status}`}>{statusLabel(rec.status)}</span>
                <span>{badgesFor(rec)}</span>
              </span>
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="empty">
          <h3>No recordings yet</h3>
          <p>Use the "+ Add recording" button in the corner to add your first recording.</p>
        </div>
      )}
    </div>
  )
}
