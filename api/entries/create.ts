import { sql } from '../db.js'
import { requireAuth, AuthError } from '../lib/auth.js'

export async function POST(request: Request) {
  // Verify JWT token
  let auth
  try {
    auth = await requireAuth(request)
  } catch (error) {
    if (error instanceof AuthError) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    throw error
  }

  const userId = auth.userId

  try {
    const body = await request.json() as {
      title?: string
      type?: string
      status?: string
      year?: number
      listType?: string
      seasonsCompleted?: number
      coverUrl?: string
      releaseDate?: string
      completedAt?: string
    }
    const { title, type, status, year, listType, seasonsCompleted, coverUrl, releaseDate, completedAt } = body

    if (!title || !type || !status || !listType) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const result = await sql`
      INSERT INTO media_entries (user_id, title, type, status, year, list_type, seasons_completed, cover_url, release_date, completed_at)
      VALUES (
        ${userId},
        ${title},
        ${type},
        ${status},
        ${year || null},
        ${listType},
        ${seasonsCompleted || null},
        ${coverUrl || null},
        ${releaseDate || null},
        ${completedAt || null}
      )
      RETURNING *
    `

    const entry = result[0]
    return new Response(
      JSON.stringify({
        entry: {
          ...entry,
          createdAt: new Date(entry.created_at),
          updatedAt: new Date(entry.updated_at),
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error creating entry:', error)
    return new Response(JSON.stringify({ error: 'Failed to create entry' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
