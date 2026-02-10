/**
 * Variation Capture — Database Schema & Migrations
 *
 * Offline-first SQLite database. All data is stored locally first,
 * then synced to the cloud when connectivity is available.
 *
 * Key design decisions:
 * - UUIDs for all IDs (generated client-side, no server dependency)
 * - sync_status column on all mutable tables
 * - status_changes is append-only (immutable audit trail)
 * - All monetary values stored in cents (integer) to avoid float errors
 * - Timestamps are ISO 8601 strings (SQLite has no native datetime)
 */

import * as SQLite from 'expo-sqlite';

const DB_NAME = 'variation_capture.db';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync(DB_NAME);
    await runMigrations(db);
  }
  return db;
}

// ============================================================
// MIGRATIONS
// ============================================================

const MIGRATIONS: { version: number; sql: string[] }[] = [
  {
    version: 1,
    sql: [
      // Projects
      `CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        client TEXT NOT NULL,
        reference TEXT NOT NULL,
        address TEXT,
        latitude REAL,
        longitude REAL,
        contract_type TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending'
      )`,

      // Variations
      `CREATE TABLE IF NOT EXISTS variations (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        sequence_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'captured',
        estimated_value INTEGER NOT NULL DEFAULT 0,
        approved_value INTEGER,
        instruction_source TEXT NOT NULL,
        instruction_reference TEXT,
        instructed_by TEXT,
        description TEXT,
        ai_description TEXT,
        notes TEXT,
        captured_at TEXT NOT NULL,
        captured_by TEXT NOT NULL,
        submitted_at TEXT,
        approved_at TEXT,
        latitude REAL,
        longitude REAL,
        location_accuracy REAL,
        evidence_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        FOREIGN KEY (project_id) REFERENCES projects(id)
      )`,

      // Photos
      `CREATE TABLE IF NOT EXISTS photo_evidence (
        id TEXT PRIMARY KEY,
        variation_id TEXT NOT NULL,
        local_uri TEXT NOT NULL,
        remote_uri TEXT,
        thumbnail_uri TEXT,
        mime_type TEXT NOT NULL,
        file_size_bytes INTEGER NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        latitude REAL,
        longitude REAL,
        captured_at TEXT NOT NULL,
        sha256_hash TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        FOREIGN KEY (variation_id) REFERENCES variations(id)
      )`,

      // Voice notes
      `CREATE TABLE IF NOT EXISTS voice_notes (
        id TEXT PRIMARY KEY,
        variation_id TEXT NOT NULL,
        local_uri TEXT NOT NULL,
        remote_uri TEXT,
        mime_type TEXT NOT NULL,
        duration_seconds REAL NOT NULL,
        file_size_bytes INTEGER NOT NULL,
        transcription TEXT,
        transcription_confidence REAL,
        captured_at TEXT NOT NULL,
        sha256_hash TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        FOREIGN KEY (variation_id) REFERENCES variations(id)
      )`,

      // Status changes — append-only audit trail
      `CREATE TABLE IF NOT EXISTS status_changes (
        id TEXT PRIMARY KEY,
        variation_id TEXT NOT NULL,
        from_status TEXT,
        to_status TEXT NOT NULL,
        changed_by TEXT NOT NULL,
        changed_at TEXT NOT NULL,
        notes TEXT,
        FOREIGN KEY (variation_id) REFERENCES variations(id)
      )`,

      // Indexes for common queries
      `CREATE INDEX IF NOT EXISTS idx_variations_project ON variations(project_id)`,
      `CREATE INDEX IF NOT EXISTS idx_variations_status ON variations(status)`,
      `CREATE INDEX IF NOT EXISTS idx_variations_sync ON variations(sync_status)`,
      `CREATE INDEX IF NOT EXISTS idx_photos_variation ON photo_evidence(variation_id)`,
      `CREATE INDEX IF NOT EXISTS idx_voice_variation ON voice_notes(variation_id)`,
      `CREATE INDEX IF NOT EXISTS idx_status_changes_variation ON status_changes(variation_id)`,

      // Schema version tracking
      `CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY
      )`,
      `INSERT OR REPLACE INTO schema_version (version) VALUES (1)`,
    ],
  },
];

async function runMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
  // Enable WAL mode for better concurrent read/write performance
  await database.execAsync('PRAGMA journal_mode = WAL');
  await database.execAsync('PRAGMA foreign_keys = ON');

  // Check current version
  let currentVersion = 0;
  try {
    const result = await database.getFirstAsync<{ version: number }>(
      'SELECT MAX(version) as version FROM schema_version'
    );
    currentVersion = result?.version ?? 0;
  } catch {
    // Table doesn't exist yet — version 0
  }

  // Run pending migrations
  for (const migration of MIGRATIONS) {
    if (migration.version > currentVersion) {
      console.log(`[DB] Running migration v${migration.version}`);
      await database.withTransactionAsync(async () => {
        for (const sql of migration.sql) {
          await database.execAsync(sql);
        }
      });
    }
  }
}

/**
 * Close the database connection.
 * Call this on app background/unmount for clean shutdown.
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}
