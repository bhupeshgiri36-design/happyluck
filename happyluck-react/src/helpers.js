export const TAGS = {
  important: { emoji: '❗', label: 'Important' },
  question: { emoji: '❓', label: 'Question' },
  note: { emoji: '📝', label: 'Note' },
}

export function filterChipList() {
  return [
    { key: 'all', label: 'All', emoji: '' },
    { key: 'star', label: 'Favourite', emoji: '⭐' },
    ...Object.keys(TAGS).map((t) => ({ key: t, label: TAGS[t].label, emoji: TAGS[t].emoji })),
  ]
}

export function segMatchesFilter(seg, key) {
  if (key === 'all') return true
  if (key === 'star') return !!seg.starred
  return seg.tag === key
}

export function fmtTime(sec) {
  if (sec == null) return ''
  sec = Math.floor(sec)
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function statusLabel(s) {
  return { done: 'Ready', pending: 'Queued', transcribing: 'Transcribing…', error: 'Failed' }[s] || s
}

// Parses lines like "0:15 Hello there" or "0:39 [star] [important] Hello" into
// [{start, end, text, tag, starred}] — each line's end is the next line's start.
export function parseManualTranscript(raw) {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)
  const parsed = []
  const timeRe = /^(\d{1,2}:)?(\d{1,2}):(\d{2})\s+(.+)$/
  const bracketRe = /^\[(star|important|question|note)\]\s*/

  lines.forEach((line) => {
    const m = line.match(timeRe)
    if (!m) return
    const h = m[1] ? parseInt(m[1]) : 0
    const min = parseInt(m[2])
    const sec = parseInt(m[3])
    const start = h * 3600 + min * 60 + sec

    let rest = m[4]
    let starred = false
    let tag = null
    let bm
    while ((bm = rest.match(bracketRe))) {
      if (bm[1] === 'star') starred = true
      else tag = bm[1]
      rest = rest.slice(bm[0].length)
    }
    parsed.push({ start, tag, starred, text: rest.trim() })
  })

  parsed.sort((a, b) => a.start - b.start)
  return parsed.map((seg, i) => ({
    start: seg.start,
    end: i < parsed.length - 1 ? parsed[i + 1].start : seg.start + 6,
    text: seg.text,
    tag: seg.tag,
    starred: seg.starred,
  }))
}
