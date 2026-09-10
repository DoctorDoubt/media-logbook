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
    const body = await request.json() as { id?: string; updates?: Record<string, any> }
    const { id, updates } = body

    if (!id || !updates) {
      return new Response(JSON.stringify({ error: 'Missing id or updates' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Build dynamic update query
    const fields: string[] = []
    const values: any[] = []

    Object.entries(updates).forEach(([key, value]) => {
      if (key === 'seasonsCompleted') {
        fields.push('seasons_completed = $' + (fields.length + 1))
        values.push(value)
      } else if (key === 'coverUrl') {
        fields.push('cover_url = $' + (fields.length + 1))
        values.push(value)
      } else if (key === 'releaseDate') {
        fields.push('release_date = $' + (fields.length + 1))
        values.push(value)
      } else if (key === 'completedAt') {
        fields.push('completed_at = $' + (fields.length + 1))
        values.push(value)
      } else if (['title', 'type', 'status', 'year', 'list'].includes(key)) {
        const dbKey = key === 'list' ? 'list_type' : key
        fields.push(dbKey + ' = $' + (fields.length + 1))
        values.push(value)
      }
    })

    if (fields.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid fields to update' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    values.push(id)
    values.push(userId) // Add userId for ownership verification
    const query = `UPDATE media_entries SET ${fields.join(', ')} WHERE id = $${values.length - 1} AND user_id = $${values.length} RETURNING *`

    const result = await sql.query(query, values)

    if (result.length === 0) {
      return new Response(JSON.stringify({ error: 'Entry not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

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
    console.error('Error updating entry:', error)
    return new Response(JSON.stringify({ error: 'Failed to update entry' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
