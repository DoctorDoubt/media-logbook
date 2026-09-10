use rusqlite::{Connection, Result as SqlResult, params};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{Manager, State};
use uuid::Uuid;

// ─── Types ───────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MediaEntry {
    pub id: String,
    pub user_id: String,
    pub title: String,
    #[serde(rename = "type")]
    pub media_type: String,
    pub status: String,
    pub year: i64,
    pub list: String,
    pub seasons_completed: Option<i64>,
    pub cover_url: Option<String>,
    pub release_date: Option<String>,
    pub completed_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateEntryInput {
    pub title: String,
    #[serde(rename = "type")]
    pub media_type: String,
    pub status: String,
    pub year: i64,
    pub list: String,
    pub seasons_completed: Option<i64>,
    pub cover_url: Option<String>,
    pub release_date: Option<String>,
    pub completed_at: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateEntryInput {
    pub title: Option<String>,
    #[serde(rename = "type")]
    pub media_type: Option<String>,
    pub status: Option<String>,
    pub year: Option<i64>,
    pub list: Option<String>,
    pub seasons_completed: Option<i64>,
    pub cover_url: Option<String>,
    pub release_date: Option<String>,
    pub completed_at: Option<String>,
}

// ─── Database state ──────────────────────────────────────────────────────────

pub struct DbState(pub Mutex<Connection>);

fn init_db(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS media_entries (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL DEFAULT 'local',
            title TEXT NOT NULL,
            media_type TEXT NOT NULL,
            status TEXT NOT NULL,
            year INTEGER NOT NULL DEFAULT 0,
            list_type TEXT NOT NULL,
            seasons_completed INTEGER,
            cover_url TEXT,
            release_date TEXT,
            completed_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_list_type ON media_entries(list_type);
    ")?;
    Ok(())
}

// ─── Tauri commands ──────────────────────────────────────────────────────────

#[tauri::command]
fn get_entries(list_type: String, db: State<DbState>) -> Result<Vec<MediaEntry>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, user_id, title, media_type, status, year, list_type,
                    seasons_completed, cover_url, release_date, completed_at,
                    created_at, updated_at
             FROM media_entries WHERE list_type = ? ORDER BY created_at ASC",
        )
        .map_err(|e| e.to_string())?;

    let entries = stmt
        .query_map([&list_type], |row| {
            Ok(MediaEntry {
                id: row.get(0)?,
                user_id: row.get(1)?,
                title: row.get(2)?,
                media_type: row.get(3)?,
                status: row.get(4)?,
                year: row.get(5)?,
                list: row.get(6)?,
                seasons_completed: row.get(7)?,
                cover_url: row.get(8)?,
                release_date: row.get(9)?,
                completed_at: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<SqlResult<Vec<_>>>()
        .map_err(|e| e.to_string())?;

    Ok(entries)
}

#[tauri::command]
fn create_entry(entry: CreateEntryInput, db: State<DbState>) -> Result<MediaEntry, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO media_entries
            (id, user_id, title, media_type, status, year, list_type,
             seasons_completed, cover_url, release_date, completed_at,
             created_at, updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)",
        params![
            &id,
            "local",
            &entry.title,
            &entry.media_type,
            &entry.status,
            entry.year,
            &entry.list,
            entry.seasons_completed,
            entry.cover_url,
            entry.release_date,
            entry.completed_at,
            &now,
            &now,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(MediaEntry {
        id,
        user_id: "local".into(),
        title: entry.title,
        media_type: entry.media_type,
        status: entry.status,
        year: entry.year,
        list: entry.list,
        seasons_completed: entry.seasons_completed,
        cover_url: entry.cover_url,
        release_date: entry.release_date,
        completed_at: entry.completed_at,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
fn update_entry(
    id: String,
    updates: UpdateEntryInput,
    db: State<DbState>,
) -> Result<MediaEntry, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    // Fetch current entry first
    let mut stmt = conn
        .prepare(
            "SELECT id, user_id, title, media_type, status, year, list_type,
                    seasons_completed, cover_url, release_date, completed_at,
                    created_at, updated_at
             FROM media_entries WHERE id = ?",
        )
        .map_err(|e| e.to_string())?;

    let current = stmt
        .query_row([&id], |row| {
            Ok(MediaEntry {
                id: row.get(0)?,
                user_id: row.get(1)?,
                title: row.get(2)?,
                media_type: row.get(3)?,
                status: row.get(4)?,
                year: row.get(5)?,
                list: row.get(6)?,
                seasons_completed: row.get(7)?,
                cover_url: row.get(8)?,
                release_date: row.get(9)?,
                completed_at: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        })
        .map_err(|e| format!("Entry not found: {e}"))?;

    let updated = MediaEntry {
        id: current.id.clone(),
        user_id: current.user_id,
        title: updates.title.unwrap_or(current.title),
        media_type: updates.media_type.unwrap_or(current.media_type),
        status: updates.status.unwrap_or(current.status),
        year: updates.year.unwrap_or(current.year),
        list: updates.list.unwrap_or(current.list),
        seasons_completed: updates.seasons_completed.or(current.seasons_completed),
        cover_url: updates.cover_url.or(current.cover_url),
        release_date: updates.release_date.or(current.release_date),
        completed_at: updates.completed_at.or(current.completed_at),
        created_at: current.created_at,
        updated_at: now.clone(),
    };

    conn.execute(
        "UPDATE media_entries SET
            title=?2, media_type=?3, status=?4, year=?5, list_type=?6,
            seasons_completed=?7, cover_url=?8, release_date=?9,
            completed_at=?10, updated_at=?11
         WHERE id=?1",
        params![
            &updated.id,
            &updated.title,
            &updated.media_type,
            &updated.status,
            updated.year,
            &updated.list,
            updated.seasons_completed,
            updated.cover_url,
            updated.release_date,
            updated.completed_at,
            &updated.updated_at,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(updated)
}

#[tauri::command]
fn delete_entry(id: String, db: State<DbState>) -> Result<bool, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM media_entries WHERE id = ?", [&id])
        .map_err(|e| e.to_string())?;
    Ok(true)
}

// ─── App entry point ─────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Open SQLite database in app data dir
            let app_dir = app
                .path()
                .app_data_dir()
                .expect("failed to get app data dir");
            std::fs::create_dir_all(&app_dir).expect("failed to create app data dir");
            let db_path = app_dir.join("data.db");

            let conn = Connection::open(&db_path).expect("failed to open database");
            init_db(&conn).expect("failed to initialize database");

            app.manage(DbState(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_entries,
            create_entry,
            update_entry,
            delete_entry,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
