import { describe, it, expect, beforeEach, vi } from 'vitest'
import { promoteMaturedFuturelogEntries, loadEntries, saveEntries } from './storage'
import type { MediaEntry } from '../types'

// Provide a working localStorage mock
const store: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value },
  removeItem: (key: string) => { delete store[key] },
})

// Mock the api module so no real HTTP calls are made
vi.mock('./api', () => ({
  fetchEntries: vi.fn().mockResolvedValue({ entries: [] }),
  updateEntry: vi.fn().mockResolvedValue({ entry: {} }),
  createEntry: vi.fn(),
  deleteEntry: vi.fn(),
}))

// Mock sync-manager (imported transitively via storage)
vi.mock('./sync-manager', () => ({
  startBackgroundSync: vi.fn(),
  stopBackgroundSync: vi.fn(),
  syncOnFocus: vi.fn(),
}))

function makeEntry(overrides: Partial<MediaEntry> = {}): MediaEntry {
  return {
    id: crypto.randomUUID(),
    userId: 'local',
    title: 'Test Entry',
    type: 'game',
    status: 'planned',
    year: 2025,
    list: 'futurelog',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

beforeEach(() => {
  delete store['media-logbook-backlog']
  delete store['media-logbook-futurelog']
})

describe('promoteMaturedFuturelogEntries', () => {
  it('moves a past-dated futurelog entry to backlog', async () => {
    const entry = makeEntry({ releaseDate: '01/01/24', list: 'futurelog' }) // Jan 1, 2024 — in the past
    saveEntries([entry], 'futurelog')

    await promoteMaturedFuturelogEntries()

    expect(loadEntries('futurelog')).toHaveLength(0)
    const backlog = loadEntries('backlog')
    expect(backlog).toHaveLength(1)
    expect(backlog[0].id).toBe(entry.id)
    expect(backlog[0].list).toBe('backlog')
    expect(backlog[0].status).toBe('planned')
    expect(backlog[0].year).toBe(2024)
    expect(backlog[0].releaseDate).toBeUndefined()
  })

  it('does not move a future-dated entry', async () => {
    const entry = makeEntry({ releaseDate: '01/01/40', list: 'futurelog' }) // Jan 1, 2040
    saveEntries([entry], 'futurelog')

    await promoteMaturedFuturelogEntries()

    expect(loadEntries('futurelog')).toHaveLength(1)
    expect(loadEntries('backlog')).toHaveLength(0)
  })

  it('only promotes past entries when mixed', async () => {
    const past = makeEntry({ id: 'past', releaseDate: '15/06/23', list: 'futurelog' })
    const future = makeEntry({ id: 'future', releaseDate: '01/01/40', list: 'futurelog' }) // Jan 1, 2040
    saveEntries([past, future], 'futurelog')

    await promoteMaturedFuturelogEntries()

    const futurelog = loadEntries('futurelog')
    expect(futurelog).toHaveLength(1)
    expect(futurelog[0].id).toBe('future')

    const backlog = loadEntries('backlog')
    expect(backlog).toHaveLength(1)
    expect(backlog[0].id).toBe('past')
  })

  it('skips entries without a releaseDate', async () => {
    const entry = makeEntry({ releaseDate: undefined, list: 'futurelog' })
    saveEntries([entry], 'futurelog')

    await promoteMaturedFuturelogEntries()

    expect(loadEntries('futurelog')).toHaveLength(1)
    expect(loadEntries('backlog')).toHaveLength(0)
  })

  it('does nothing when futurelog is empty', async () => {
    await expect(promoteMaturedFuturelogEntries()).resolves.toBeUndefined()
    expect(loadEntries('backlog')).toHaveLength(0)
  })
})
