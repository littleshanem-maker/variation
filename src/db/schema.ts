/**
 * Database Schema
 *
 * SQLite with WAL mode for offline-first performance.
 * Includes migration system for schema updates.
 */

import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  db = await SQLite.openDatabaseAsync('variation_capture_v2.db');

  // WAL mode for concurrent reads + better crash recovery
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  await createTables(db);
  await runMigrations(db);
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}

async function createTables(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      client TEXT NOT NULL,
      reference TEXT NOT NULL DEFAULT '',
      address TEXT,
      latitude REAL,
      longitude REAL,
      contract_type TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      remote_id TEXT
    );

    CREATE TABLE IF NOT EXISTS variations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      sequence_number INTEGER NOT NULL,
      variation_number TEXT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      instruction_source TEXT NOT NULL,
      instructed_by TEXT,
      reference_doc TEXT,
      estimated_value INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      captured_at TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      location_accuracy REAL,
      evidence_hash TEXT,
      notes TEXT,
      requestor_name TEXT,
      requestor_email TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      remote_id TEXT,
      ai_description TEXT,
      ai_transcription TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS photo_evidence (
      id TEXT PRIMARY KEY,
      variation_id TEXT NOT NULL,
      local_uri TEXT NOT NULL,
      remote_uri TEXT,
      sha256_hash TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      width INTEGER,
      height INTEGER,
      captured_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      FOREIGN KEY (variation_id) REFERENCES variations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS voice_notes (
      id TEXT PRIMARY KEY,
      variation_id TEXT NOT NULL,
      local_uri TEXT NOT NULL,
      remote_uri TEXT,
      duration_seconds REAL NOT NULL DEFAULT 0,
      transcription TEXT,
      transcription_status TEXT NOT NULL DEFAULT 'none',
      sha256_hash TEXT,
      captured_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      FOREIGN KEY (variation_id) REFERENCES variations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS status_changes (
      id TEXT PRIMARY KEY,
      variation_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      changed_at TEXT NOT NULL,
      changed_by TEXT,
      notes TEXT,
      FOREIGN KEY (variation_id) REFERENCES variations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY NOT NULL,
      variation_id TEXT NOT NULL,
      local_uri TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_size INTEGER,
      mime_type TEXT,
      sha256_hash TEXT NOT NULL,
      captured_at TEXT NOT NULL DEFAULT (datetime('now')),
      sync_status TEXT NOT NULL DEFAULT 'pending',
      FOREIGN KEY (variation_id) REFERENCES variations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_variations_project ON variations(project_id);
    CREATE INDEX IF NOT EXISTS idx_variations_status ON variations(status);
    CREATE INDEX IF NOT EXISTS idx_photos_variation ON photo_evidence(variation_id);
    CREATE INDEX IF NOT EXISTS idx_voice_variation ON voice_notes(variation_id);
    CREATE INDEX IF NOT EXISTS idx_status_variation ON status_changes(variation_id);
    CREATE INDEX IF NOT EXISTS idx_sync_projects ON projects(sync_status);
    CREATE INDEX IF NOT EXISTS idx_sync_variations ON variations(sync_status);
    CREATE INDEX IF NOT EXISTS idx_attachments_variation ON attachments(variation_id);
  `);
}

/**
 * Run incremental migrations for existing databases.
 * Uses try/catch since SQLite doesn't support ADD COLUMN IF NOT EXISTS
 * in all versions bundled with expo-sqlite.
 */
async function runMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
  const addColumn = async (table: string, column: string, type: string) => {
    try {
      await database.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    } catch {
      // Column already exists — safe to ignore
    }
  };

  // Migration 011: variation workflow fields
  await addColumn('variations', 'variation_number', 'TEXT');
  await addColumn('variations', 'requestor_name', 'TEXT');
  await addColumn('variations', 'requestor_email', 'TEXT');

  // Backfill variation_number for existing records that don't have one
  await database.execAsync(`
    UPDATE variations
    SET variation_number = 'VAR-' || printf('%03d', sequence_number)
    WHERE variation_number IS NULL
  `);

  // Migrate legacy 'captured' status to 'draft'
  await database.execAsync(`
    UPDATE variations SET status = 'draft' WHERE status = 'captured'
  `);
}

export async function resetDatabase(): Promise<void> {
  const database = await getDatabase();
  await database.execAsync(`
    DELETE FROM status_changes;
    DELETE FROM voice_notes;
    DELETE FROM photo_evidence;
    DELETE FROM variations;
    DELETE FROM projects;
  `);
}
