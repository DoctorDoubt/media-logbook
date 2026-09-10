/**
 * Database migration script
 * Run this to ensure your database schema is up to date
 */

import { sql } from './api/db.js'

export async function migrateDatabase() {
  try {
    console.log('Starting database migration...')

    // Create users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)
    `

    console.log('- users table created')

    // Create media_entries table
    await sql`
      CREATE TABLE IF NOT EXISTS media_entries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('movie', 'tv', 'game', 'comic')),
        status TEXT NOT NULL CHECK (status IN ('planned', 'in_progress', 'paused', 'completed', 'dropped')),
        year INTEGER,
        list_type TEXT NOT NULL CHECK (list_type IN ('backlog', 'futurelog')),
        seasons_completed INTEGER DEFAULT 0,
        cover_url TEXT,
        release_date TEXT,
        completed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_media_entries_user_id ON media_entries(user_id)
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_media_entries_list_type ON media_entries(list_type)
    `

    console.log('- media_entries table created')

    // Create refresh_tokens table
    await sql`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        token TEXT UNIQUE NOT NULL,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        revoked_at TIMESTAMP WITH TIME ZONE
      )
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token)
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)
    `

    console.log('- refresh_tokens table created')

    // Add revoked_at column to refresh_tokens if it doesn't exist (for backward compatibility)
    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'refresh_tokens' AND column_name = 'revoked_at'
        ) THEN
          ALTER TABLE refresh_tokens ADD COLUMN revoked_at TIMESTAMP WITH TIME ZONE;
        END IF;
      END $$;
    `

    console.log('- refresh_tokens.revoked_at column verified')

    // Add updated_at column to media_entries for sync functionality
    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'media_entries' AND column_name = 'updated_at'
        ) THEN
          ALTER TABLE media_entries ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        END IF;
      END $$;
    `

    // Backfill existing entries with created_at as updated_at
    await sql`
      UPDATE media_entries
      SET updated_at = created_at
      WHERE updated_at IS NULL
    `

    // Create index for sync performance
    await sql`
      CREATE INDEX IF NOT EXISTS idx_media_entries_updated_at
      ON media_entries(user_id, updated_at)
    `

    console.log('- media_entries.updated_at column added')

    console.log('Migration completed successfully!')
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  }
}

// Run migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}
