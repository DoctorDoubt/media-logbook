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
    const body = await request.json() as { id?: string }
    const { id } = body

    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const result = await sql`
      DELETE FROM media_entries
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING id
    `

    if (result.length === 0) {
      return new Response(JSON.stringify({ error: 'Entry not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error deleting entry:', error)
    return new Response(JSON.stringify({ error: 'Failed to delete entry' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
