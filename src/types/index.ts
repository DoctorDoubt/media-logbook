export type MediaType = 'movie' | 'tv' | 'game' | 'comic'

export type Status = 'planned' | 'in_progress' | 'completed' | 'paused' | 'dropped' | 'replaying'

export type ListType = 'backlog' | 'futurelog'

export interface MediaEntry {
  id: string
  userId: string
  title: string
  type: MediaType
  status: Status
  year: number
  list: ListType
  seasonsCompleted?: number
  coverUrl?: string
  releaseDate?: string  // Format: "DD/MM/YY" - only for futurelog entries
  completedAt?: string  // Format: "DD/MM/YY" - when entry was finished (backlog)
  createdAt: Date
  updatedAt: Date
}

export type SortField = 'title' | 'year'

export interface Filters {
  type: MediaType | 'all'
  status: Status | 'all'
}
