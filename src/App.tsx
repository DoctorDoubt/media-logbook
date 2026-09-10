import { useState, useEffect, useMemo, useRef } from 'react'
import { InputBar } from './components/InputBar'
import { Timeline } from './components/Timeline'
import { MediaColumns } from './components/MediaColumns'
import { CalendarView } from './components/CalendarView'
import { PasswordModal } from './components/PasswordModal'
import { SyncIndicator } from './components/SyncIndicator'
import { AnsiArt } from './components/AnsiArt'
import { useMediaEntries } from './hooks/useMediaEntries'
import { promoteMaturedFuturelogEntries } from './lib/storage'
import type { MediaEntry, ListType } from './types'

const UNLOCKED_KEY = 'jefflog-unlocked'
const AUTH_TOKEN_KEY = 'jefflog-auth-token'


function AnimatedBackground({ isDayTheme }: { isDayTheme: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const SPACING = 28
    const DOT_RADIUS = 0.8

    let width = canvas.width = canvas.offsetWidth
    let height = canvas.height = canvas.offsetHeight

    type Dot = { x: number; y: number; phase: number; speed: number }
    let dots: Dot[] = []

    const buildGrid = () => {
      dots = []
      const cols = Math.ceil(width / SPACING)
      const rows = Math.ceil(height / SPACING)
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          dots.push({
            x: c * SPACING + SPACING / 2,
            y: r * SPACING + SPACING / 2,
            phase: Math.random() * Math.PI * 2,
            speed: 0.0001 + Math.random() * 0.0001,
          })
        }
      }
    }
    buildGrid()

    let animId: number
    const draw = (t: number) => {
      ctx.clearRect(0, 0, width, height)
      const color = isDayTheme ? '0,0,0' : '255,255,255'
      for (const dot of dots) {
        const raw = (Math.sin(dot.phase + t * dot.speed) + 1) / 2
        const alpha = raw < 0.85 ? raw * 0.25 : 0.7
        ctx.beginPath()
        ctx.arc(dot.x, dot.y, DOT_RADIUS, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${color},${alpha})`
        ctx.fill()
      }
      animId = requestAnimationFrame(draw)
    }
    animId = requestAnimationFrame(draw)

    const onResize = () => {
      width = canvas.width = canvas.offsetWidth
      height = canvas.height = canvas.offsetHeight
      buildGrid()
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', onResize)
    }
  }, [isDayTheme])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  )
}

function Logo() {
  const pixelLetters: Record<string, number[][]> = {
    j: [
      [0,0,1,1],
      [0,0,2,2],
      [0,0,1,1],
      [1,1,2,2],
      [1,1,1,1],
    ],
    e: [
      [1,1,1,1],
      [2,2,0,0],
      [1,1,1,0],
      [2,2,0,0],
      [1,1,1,1],
    ],
    f: [
      [1,1,1,1],
      [2,2,0,0],
      [1,1,1,0],
      [2,2,0,0],
      [1,1,0,0],
    ],
    l: [
      [1,1,0,0],
      [2,2,0,0],
      [1,1,0,0],
      [2,2,0,0],
      [1,1,1,1],
    ],
    o: [
      [1,1,1,1],
      [2,0,0,2],
      [1,0,0,1],
      [2,0,0,2],
      [1,1,1,1],
    ],
    g: [
      [1,1,1,1],
      [2,0,0,2],
      [1,0,1,1],
      [2,0,0,2],
      [1,1,1,1],
    ],
  }

  const color = { top: 'var(--logo-top)', bottom: 'var(--logo-bottom)' }
  const word = 'jefflog'

  return (
    <div className="flex flex-col items-center select-none">
      <div className="flex gap-2">
        {word.split('').map((char, letterIndex) => {
          const pixels = pixelLetters[char]
          return (
            <div key={letterIndex} className="flex flex-col">
              {pixels.map((row, rowIndex) => (
                <div key={rowIndex} className="flex">
                  {row.map((cell, colIndex) => (
                    <div
                      key={colIndex}
                      style={{
                        width: 10,
                        height: 10,
                        backgroundColor: cell === 1 ? color.top : cell === 2 ? color.bottom : 'transparent',
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ListToggle({ currentList, onToggle }: { currentList: ListType; onToggle: (list: ListType) => void }) {
  return (
    <div className="flex gap-1 border border-border">
      <button
        onClick={() => onToggle('backlog')}
        className={`px-4 py-2 text-xs transition-colors ${
          currentList === 'backlog'
            ? 'bg-border text-text'
            : 'text-muted hover:text-text'
        }`}
      >
        BACKLOG
      </button>
      <button
        onClick={() => onToggle('futurelog')}
        className={`px-4 py-2 text-xs transition-colors ${
          currentList === 'futurelog'
            ? 'bg-border text-text'
            : 'text-muted hover:text-text'
        }`}
      >
        FUTURELOG
      </button>
    </div>
  )
}

function ThemeToggle({ isDayTheme, onToggle, syncStatus, onSync }: { isDayTheme: boolean; onToggle: () => void; syncStatus: 'syncing' | 'synced' | 'error'; onSync: () => void }) {
  return (
    <div className="fixed top-4 left-4 z-50 flex gap-2">
      <button
        onClick={onToggle}
        className="p-2 border border-border text-muted hover:text-text hover:border-muted"
        title={isDayTheme ? 'Switch to night' : 'Switch to day'}
      >
        {isDayTheme ? (
          // Moon icon
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
          // Sun icon
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        )}
      </button>
      <button
        onClick={onSync}
        disabled={syncStatus === 'syncing'}
        className="p-2 border border-border text-muted hover:text-text hover:border-muted disabled:opacity-40"
        title="Sync now"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={syncStatus === 'syncing' ? 'animate-spin' : ''}>
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
      </button>
      <SyncIndicator status={syncStatus} />
    </div>
  )
}

function App() {
  const [selectedTime, setSelectedTime] = useState<number | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<MediaEntry | null>(null)
  const [newEntryType, setNewEntryType] = useState<MediaEntry['type'] | null>(null)
  const [newEntryTitle, setNewEntryTitle] = useState('')
  const [newEntryStatus, setNewEntryStatus] = useState<MediaEntry['status']>('planned')
  const [newEntryYear, setNewEntryYear] = useState(new Date().getFullYear())
  const [newEntryReleaseDate, setNewEntryReleaseDate] = useState('')
  const [newEntrySeasonsCompleted, setNewEntrySeasonsCompleted] = useState(0)
  const [showSaved, setShowSaved] = useState(false)
  const [entryCount, setEntryCount] = useState(0)
  const [currentList, setCurrentList] = useState<ListType>('backlog')
  const { entries, loading, add, update, remove, syncStatus, manualSync } = useMediaEntries(currentList)
  const [showCalendar, setShowCalendar] = useState(false)
  const [coverOptions, setCoverOptions] = useState<string[]>([])
  const [fetchingCovers, setFetchingCovers] = useState(false)
  const [coverFetchEmpty, setCoverFetchEmpty] = useState(false)
  type CoverMode = 'ascii' | 'ansi' | 'original'
  const COVER_MODES_KEY = 'jefflog-cover-modes'
  const getCoverMode = (id: string): CoverMode => {
    try {
      const map = JSON.parse(localStorage.getItem(COVER_MODES_KEY) ?? '{}')
      return map[id] ?? 'ascii'
    } catch { return 'ascii' }
  }
  const saveCoverMode = (id: string, mode: CoverMode) => {
    try {
      const map = JSON.parse(localStorage.getItem(COVER_MODES_KEY) ?? '{}')
      map[id] = mode
      localStorage.setItem(COVER_MODES_KEY, JSON.stringify(map))
    } catch {}
  }
  const [coverDisplayMode, setCoverDisplayMode] = useState<CoverMode>('ascii')
  const [isUnlocked, setIsUnlocked] = useState(() => {
    // Check if user has a valid auth token (new method) or legacy unlocked flag
    const hasAuthToken = !!sessionStorage.getItem(AUTH_TOKEN_KEY)
    const wasUnlocked = sessionStorage.getItem(UNLOCKED_KEY) === 'true'

    // If we have an unlocked flag but no token, clear the old flag
    if (wasUnlocked && !hasAuthToken) {
      sessionStorage.removeItem(UNLOCKED_KEY)
    }

    return hasAuthToken || wasUnlocked
  })
  const [isDayTheme, setIsDayTheme] = useState(() => {
    return localStorage.getItem('jefflog-theme') === 'day'
  })

  useEffect(() => {
    promoteMaturedFuturelogEntries().catch(console.error)
  }, [])

  useEffect(() => {
    if (isDayTheme) {
      document.documentElement.classList.add('day')
    } else {
      document.documentElement.classList.remove('day')
    }
    localStorage.setItem('jefflog-theme', isDayTheme ? 'day' : 'night')
  }, [isDayTheme])

  const toggleTheme = () => setIsDayTheme((prev) => !prev)

  useEffect(() => {
    if (!loading && entries.length !== entryCount) {
      if (entryCount !== 0) {
        setShowSaved(true)
        const timer = setTimeout(() => setShowSaved(false), 1500)
        return () => clearTimeout(timer)
      }
      setEntryCount(entries.length)
    }
  }, [entries.length, loading, entryCount])

  const handleAddEntry = (entry: { title: string; type: MediaEntry['type']; status: MediaEntry['status']; year: number; list: ListType; releaseDate?: string; seasonsCompleted?: number }) => {
    // Don't await - let optimistic update show immediately
    add({
      ...entry,
      seasonsCompleted: entry.type === 'tv' ? (entry.seasonsCompleted ?? 0) : undefined,
      releaseDate: entry.releaseDate,
    })
    setShowSaved(true)
    setTimeout(() => setShowSaved(false), 1500)
  }


  const handleQuickAdd = (type: MediaEntry['type']) => {
    setNewEntryType(type)
    setNewEntryTitle('')
    setNewEntryStatus('planned')
    setNewEntryYear(new Date().getFullYear())
    setNewEntryReleaseDate('')
    setNewEntrySeasonsCompleted(0)
  }

  const handleConfirmNewEntry = () => {
    if (!newEntryType || !newEntryTitle.trim()) return
    add({
      title: newEntryTitle.trim(),
      type: newEntryType,
      status: newEntryStatus,
      year: newEntryYear,
      list: currentList,
      releaseDate: currentList === 'futurelog' && newEntryReleaseDate ? newEntryReleaseDate : undefined,
      seasonsCompleted: newEntryType === 'tv' ? newEntrySeasonsCompleted : undefined,
    })
    setShowSaved(true)
    setTimeout(() => setShowSaved(false), 1500)
    setNewEntryType(null)
  }

  // Reset time filter when switching lists
  const handleListToggle = (list: ListType) => {
    setCurrentList(list)
    setSelectedTime(null)
  }

  // Filter entries by selected time (memoized)
  const filteredEntries = useMemo(() => {
    if (!selectedTime) return entries

    return entries.filter((e) => {
      if (currentList === 'futurelog') {
        // Filter by release year
        if (!e.releaseDate) return false
        const parts = e.releaseDate.split('/')
        if (parts.length !== 3) return false
        let year = parseInt(parts[2], 10)
        if (year < 100) year += year < 50 ? 2000 : 1900
        return year === selectedTime
      } else {
        return e.year === selectedTime
      }
    })
  }, [entries, selectedTime, currentList])

  const handleEntryClick = (entry: MediaEntry) => {
    setSelectedEntry(entry)
    setCoverDisplayMode(getCoverMode(entry.id))
  }

  const fetchCoverOptions = async (entry: MediaEntry) => {
    setFetchingCovers(true)
    setCoverFetchEmpty(false)
    try {
      const res = await fetch(`/api/cover?title=${encodeURIComponent(entry.title)}&type=${entry.type}`)
      const data = await res.json()
      const urls: string[] = data.urls ?? []
      setCoverOptions(urls)
      if (urls.length === 0) setCoverFetchEmpty(true)
      if (urls.length > 0 && !entry.coverUrl) {
        setSelectedEntry(prev => prev?.id === entry.id ? { ...prev, coverUrl: urls[0] } : prev)
        update(entry.id, { coverUrl: urls[0] })
      }
    } catch (e) {
      console.error('Cover fetch failed:', e)
      setCoverFetchEmpty(true)
    } finally {
      setFetchingCovers(false)
    }
  }

  // Auto-fetch cover options when opening an entry without a cover
  useEffect(() => {
    setCoverOptions([])
    setCoverFetchEmpty(false)
    if (!selectedEntry || selectedEntry.coverUrl) return
    fetchCoverOptions(selectedEntry)
  }, [selectedEntry?.id])

  const handleCloseDetail = () => {
    setSelectedEntry(null)
    setCoverOptions([])
    setCoverFetchEmpty(false)
  }

  const handleConfirmEntry = () => {
    if (selectedEntry) {
      update(selectedEntry.id, {
        title: selectedEntry.title,
        year: selectedEntry.year,
        status: selectedEntry.status,
        releaseDate: selectedEntry.releaseDate,
        seasonsCompleted: selectedEntry.seasonsCompleted,
      })
      setShowSaved(true)
      setTimeout(() => setShowSaved(false), 1500)
      setSelectedEntry(null)
    }
  }

  const handleDeleteEntry = () => {
    if (selectedEntry) {
      const id = selectedEntry.id
      setSelectedEntry(null)
      // Don't await - let optimistic update show immediately
      remove(id)
      setShowSaved(true)
      setTimeout(() => setShowSaved(false), 1500)
    }
  }

  const handleQuickDelete = (entry: MediaEntry) => {
    // Don't await - let optimistic update show immediately
    remove(entry.id)
    setShowSaved(true)
    setTimeout(() => setShowSaved(false), 1500)
  }

  const handleTypeChange = (entry: MediaEntry, newType: MediaEntry['type']) => {
    // Optimistic UI update
    setSelectedEntry({ ...entry, type: newType })
    // Don't await - let optimistic update show immediately
    update(entry.id, { type: newType })
    setShowSaved(true)
    setTimeout(() => setShowSaved(false), 1500)
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'movie': return 'text-movie'
      case 'tv': return 'text-tv'
      case 'game': return 'text-game'
      case 'comic': return 'text-comic'
      default: return 'text-muted'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-muted">
        loading...
      </div>
    )
  }

  if (!isUnlocked) {
    return (
      <PasswordModal
        onUnlock={() => {
          // The auth token is now stored in PasswordModal component
          sessionStorage.setItem(UNLOCKED_KEY, 'true')
          setIsUnlocked(true)
        }}
      />
    )
  }

  return (
    <div className={`flex flex-col h-screen transition-all ${showCalendar ? 'mr-72' : ''}`}>
      <ThemeToggle isDayTheme={isDayTheme} onToggle={toggleTheme} syncStatus={syncStatus} onSync={manualSync} />

      {/* Calendar Toggle + Version */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <div className="relative group">
          <span className="text-dim text-xs select-none cursor-default">v{__APP_VERSION__}</span>
          <div className="absolute right-0 top-5 hidden group-hover:block z-50 w-64 border border-border bg-bg p-2 shadow-lg">
            {__APP_CHANGELOG__.map((line, i) => (
              <div key={i} className="text-xs text-muted py-0.5 border-b border-border last:border-0 last:pb-0 first:pt-0">
                {line}
              </div>
            ))}
          </div>
        </div>
        <button
        onClick={() => setShowCalendar(prev => !prev)}
        className={`p-2 border text-muted hover:text-text hover:border-muted ${
          showCalendar ? 'border-muted bg-border' : 'border-border'
        }`}
        title={showCalendar ? 'Hide calendar' : 'Show calendar'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>
      </div>

      {/* Save Indicator */}
      {showSaved && (
        <div className="fixed top-4 right-16 z-50 px-3 py-1 text-xs text-completed border border-completed/50 bg-bg">
          SAVED
        </div>
      )}

      {/* Top Half - Logo + Toggle + Input */}
      <div className="relative h-1/2 flex flex-col items-center justify-center border-b border-border overflow-hidden">
        <AnimatedBackground isDayTheme={isDayTheme} />
        <div className="relative flex flex-col items-center w-full" style={{ zIndex: 1 }}>
        <Logo />

        <div className="mt-6">
          <ListToggle currentList={currentList} onToggle={handleListToggle} />
        </div>

        <div className="w-full max-w-lg mt-4">
          <InputBar onAdd={handleAddEntry} currentList={currentList} />
        </div>

        <div className="mt-2 text-dim text-xs">
          {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'} in {currentList}
        </div>
        </div>
      </div>

      {/* Bottom Half - Timeline + Columns + Calendar */}
      <div className="h-1/2 flex overflow-hidden">
        <Timeline
          entries={entries}
          selectedYear={selectedTime}
          onYearSelect={setSelectedTime}
          currentList={currentList}
        />
        <MediaColumns
          entries={filteredEntries}
          onEntryClick={handleEntryClick}
          currentList={currentList}
          onAddEntry={handleQuickAdd}
          onDeleteEntry={handleQuickDelete}
          onUpdateEntry={update}
        />
      </div>

      {/* Calendar View - Full height sidebar */}
      {showCalendar && (
        <div className="fixed top-0 right-0 h-full w-72 z-40 bg-bg">
          <CalendarView
            entries={entries}
            onEntryClick={handleEntryClick}
            currentList={currentList}
          />
        </div>
      )}

      {/* New Entry Modal (triggered by clicking a column) */}
      {newEntryType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80" onClick={() => setNewEntryType(null)} />
          <div className="relative w-full max-w-sm border border-border bg-bg">
            <div className="px-4 py-2 border-b border-border">
              <span className={`text-xs ${getTypeColor(newEntryType)}`}>{newEntryType.toUpperCase()}</span>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-label text-xs block mb-1">TITLE</label>
                <input
                  autoFocus
                  type="text"
                  value={newEntryTitle}
                  onChange={(e) => setNewEntryTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirmNewEntry()}
                  className="w-full px-2 py-1 text-xs border border-border bg-bg text-text focus:outline-none focus:border-muted"
                />
              </div>
              <div className="flex gap-4">
                {currentList === 'backlog' && (
                  <>
                    <div className="flex-1">
                      <label className="text-label text-xs block mb-1">YEAR</label>
                      <input
                        type="number"
                        value={newEntryYear}
                        onChange={(e) => setNewEntryYear(parseInt(e.target.value) || new Date().getFullYear())}
                        className="w-full px-2 py-1 text-xs border border-border bg-bg text-text focus:outline-none"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-label text-xs block mb-1">STATUS</label>
                      <select
                        value={newEntryStatus}
                        onChange={(e) => setNewEntryStatus(e.target.value as MediaEntry['status'])}
                        className="w-full px-2 py-1 text-xs border border-border bg-bg text-text"
                      >
                        <option value="planned">PLANNED</option>
                        <option value="in_progress">IN PROGRESS</option>
                        <option value="paused">PAUSED</option>
                        <option value="completed">COMPLETED</option>
                        <option value="dropped">DROPPED</option>
                      </select>
                    </div>
                  </>
                )}
                {currentList === 'futurelog' && (
                  <div className="flex-1">
                    <label className="text-label text-xs block mb-1">RELEASE DATE</label>
                    <input
                      type="text"
                      value={newEntryReleaseDate}
                      onChange={(e) => setNewEntryReleaseDate(e.target.value)}
                      placeholder="DD/MM/YY"
                      className="w-full px-2 py-1 text-xs border border-border bg-bg text-text placeholder-dim focus:outline-none"
                    />
                  </div>
                )}
              </div>
              {newEntryType === 'tv' && (
                <div>
                  <label className="text-label text-xs block mb-1">SEASON</label>
                  <input
                    type="number"
                    value={newEntrySeasonsCompleted}
                    min={0}
                    onChange={(e) => setNewEntrySeasonsCompleted(parseInt(e.target.value) || 0)}
                    className="w-24 px-2 py-1 text-xs border border-border bg-bg text-text focus:outline-none"
                  />
                </div>
              )}
            </div>
            <div className="flex gap-2 p-4 border-t border-border">
              <button
                onClick={handleConfirmNewEntry}
                disabled={!newEntryTitle.trim()}
                className="px-3 py-1 text-xs border border-completed text-completed hover:bg-completed hover:text-bg disabled:opacity-50"
              >
                CONFIRM
              </button>
              <button
                onClick={() => setNewEntryType(null)}
                className="px-3 py-1 text-xs border border-border text-muted hover:text-text hover:border-muted"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Entry Detail Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80" onClick={handleCloseDetail} />
          <div className="relative w-full max-w-md border border-border bg-bg">
            {/* Header */}
            <div className="px-4 py-2 border-b border-border flex items-center justify-between">
              <span className={`text-xs ${getTypeColor(selectedEntry.type)}`}>
                {selectedEntry.type.toUpperCase()}
              </span>
              <select
                value={selectedEntry.type}
                onChange={(e) => handleTypeChange(selectedEntry, e.target.value as MediaEntry['type'])}
                className="text-xs bg-bg border border-border text-text px-2 py-1"
              >
                <option value="movie">MOVIE</option>
                <option value="tv">TV SHOW</option>
                <option value="game">GAME</option>
                <option value="comic">COMIC</option>
              </select>
            </div>

            {/* Body: info left, cover right */}
            <div className="flex">
              <div className="flex-1 p-4 space-y-3 border-r border-border">
                <div>
                  <label className="text-label text-xs block mb-1">TITLE</label>
                  <input
                    type="text"
                    value={selectedEntry.title}
                    onChange={(e) => setSelectedEntry({ ...selectedEntry, title: e.target.value })}
                    className="w-full px-2 py-1 text-xs border border-border bg-bg text-text"
                  />
                </div>
                {selectedEntry.list === 'backlog' && (
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-label text-xs block mb-1">YEAR</label>
                      <input
                        type="number"
                        value={selectedEntry.year || ''}
                        onChange={(e) => {
                          const year = parseInt(e.target.value) || new Date().getFullYear()
                          setSelectedEntry({ ...selectedEntry, year })
                        }}
                        className="w-full px-2 py-1 text-xs border border-border bg-bg text-text"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-label text-xs block mb-1">STATUS</label>
                      <select
                        value={selectedEntry.status}
                        onChange={(e) => {
                          const newStatus = e.target.value as MediaEntry['status']
                          setSelectedEntry({ ...selectedEntry, status: newStatus })
                        }}
                        className="w-full px-2 py-1 text-xs border border-border bg-bg text-text"
                      >
                        <option value="planned">PLANNED</option>
                        <option value="in_progress">IN PROGRESS</option>
                        <option value="paused">PAUSED</option>
                        <option value="completed">COMPLETED</option>
                        <option value="dropped">DROPPED</option>
                      </select>
                    </div>
                  </div>
                )}
                {selectedEntry.list === 'futurelog' && (
                  <div>
                    <label className="text-label text-xs block mb-1">RELEASE DATE</label>
                    <input
                      type="text"
                      value={selectedEntry.releaseDate || ''}
                      onChange={(e) => setSelectedEntry({ ...selectedEntry, releaseDate: e.target.value })}
                      placeholder="DD/MM/YYYY"
                      className="w-full px-2 py-1 text-xs border border-border bg-bg text-text"
                    />
                  </div>
                )}
              </div>

              {/* Cover art */}
              <div className="flex flex-col items-center justify-center p-3 gap-2" style={{ minWidth: 80, maxWidth: 200 }}>
                {selectedEntry.coverUrl ? (
                  coverDisplayMode === 'original' ? (
                    <img
                      src={selectedEntry.coverUrl}
                      alt=""
                      style={{ width: 112, aspectRatio: '2/3', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <AnsiArt
                      src={selectedEntry.coverUrl}
                      mode={coverDisplayMode}
                      maxWidth={32}
                      maxHeight={28}
                      forceAspect={2/3}
                      brightness={coverDisplayMode === 'ascii' ? 1.6 : 1}
                    />
                  )
                ) : (
                  <div className="text-dim text-xs text-center">fetching<br/>cover...</div>
                )}
                {/* Mode toggle */}
                <div className="flex gap-1">
                  {(['ascii', 'ansi', 'original'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => { setCoverDisplayMode(m); saveCoverMode(selectedEntry.id, m) }}
                      className={`text-xs px-1 ${coverDisplayMode === m ? 'text-text' : 'text-dim hover:text-muted'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => { setCoverFetchEmpty(false); fetchCoverOptions(selectedEntry) }}
                  disabled={fetchingCovers}
                  className="text-dim text-xs hover:text-muted disabled:opacity-50"
                >
                  {fetchingCovers ? 'searching...' : 'change'}
                </button>
              </div>
            </div>

            {/* Cover picker strip */}
            {coverFetchEmpty && coverOptions.length === 0 && (
              <div className="border-t border-border px-3 py-2 text-xs text-dim">no results found</div>
            )}
            {coverOptions.length > 0 && (
              <div className="border-t border-border">
                <div className="flex gap-2 px-3 py-2 overflow-x-auto">
                  {coverOptions.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setSelectedEntry(prev => prev ? { ...prev, coverUrl: url } : prev)
                        update(selectedEntry.id, { coverUrl: url })
                      }}
                      className={`flex-shrink-0 border ${selectedEntry.coverUrl === url ? 'border-muted' : 'border-border hover:border-muted'}`}
                    >
                      <img
                        src={url}
                        alt=""
                        style={{ width: 40, height: 56, objectFit: 'cover', display: 'block' }}
                      />
                    </button>
                  ))}
                </div>
                <form
                  className="flex gap-2 px-3 pb-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const q = (e.currentTarget.elements.namedItem('q') as HTMLInputElement).value.trim()
                    if (q) fetchCoverOptions({ ...selectedEntry, title: q })
                  }}
                >
                  <input
                    name="q"
                    defaultValue={selectedEntry.title}
                    className="flex-1 px-2 py-1 text-xs border border-border bg-bg text-text focus:outline-none focus:border-muted"
                    placeholder="search for different poster..."
                  />
                  <button type="submit" disabled={fetchingCovers} className="px-3 py-1 text-xs border border-border text-muted hover:text-text hover:border-muted disabled:opacity-50">
                    {fetchingCovers ? '...' : 'search'}
                  </button>
                </form>
              </div>
            )}

            <div className="flex gap-2 p-4 border-t border-border">
              <button
                onClick={handleConfirmEntry}
                className="px-3 py-1 text-xs border border-completed text-completed hover:bg-completed hover:text-bg"
              >
                CONFIRM
              </button>
              <button
                onClick={handleCloseDetail}
                className="px-3 py-1 text-xs border border-border text-muted hover:text-text hover:border-muted"
              >
                CLOSE
              </button>
              <button
                onClick={handleDeleteEntry}
                className="px-3 py-1 text-xs border border-dropped text-dropped hover:bg-dropped hover:text-bg"
              >
                DELETE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
