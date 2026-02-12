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
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      instruction_source TEXT NOT NULL,
      instructed_by TEXT,
      reference_doc TEXT,
      estimated_value INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'captured',
      captured_at TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      location_accuracy REAL,
      evidence_hash TEXT,
      notes TEXT,
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

    CREATE INDEX IF NOT EXISTS idx_variations_project ON variations(project_id);
    CREATE INDEX IF NOT EXISTS idx_variations_status ON variations(status);
    CREATE INDEX IF NOT EXISTS idx_photos_variation ON photo_evidence(variation_id);
    CREATE INDEX IF NOT EXISTS idx_voice_variation ON voice_notes(variation_id);
    CREATE INDEX IF NOT EXISTS idx_status_variation ON status_changes(variation_id);
    CREATE INDEX IF NOT EXISTS idx_sync_projects ON projects(sync_status);
    CREATE INDEX IF NOT EXISTS idx_sync_variations ON variations(sync_status);
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
