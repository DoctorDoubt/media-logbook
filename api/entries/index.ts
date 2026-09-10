import { sql } from '../db.js'
import { getSingleUserId } from '../lib/single-user.js'
import { requireAuth, AuthError } from '../lib/auth.js'

export async function GET(request: Request) {
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

  const url = new URL(request.url)
  const listType = url.searchParams.get('list')

  if (!listType || (listType !== 'backlog' && listType !== 'futurelog')) {
    return new Response(JSON.stringify({ error: 'Invalid or missing listType' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const entries = await sql`
      SELECT * FROM media_entries
      WHERE user_id = ${userId} AND list_type = ${listType}
      ORDER BY created_at DESC
    `
    return new Response(
      JSON.stringify({
        entries: entries.map((e: any) => ({
          ...e,
          createdAt: new Date(e.created_at),
          updatedAt: new Date(e.updated_at),
        })),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error fetching entries:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch entries' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
