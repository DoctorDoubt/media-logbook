import { sql } from '../db.js'

/**
 * Get or create the single user for this application.
 * For single-user personal use, we always use the same user account.
 */
export async function getSingleUserId(): Promise<string> {
  // Try to get existing user
  let users = await sql`
    SELECT id FROM users
    LIMIT 1
  `

  if (users.length === 0) {
    // Create default user if none exists
    users = await sql`
      INSERT INTO users (username, password_hash)
      VALUES ('admin', 'unused')
      RETURNING id
    `
  }

  return users[0].id
}
