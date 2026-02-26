/**
 * Variation Repository
 *
 * Full CRUD operations, status lifecycle, evidence management.
 */

import { getDatabase } from './schema';
import {
  Variation,
  VariationDetail,
  VariationStatus,
  PhotoEvidence,
  VoiceNote,
  StatusChange,
  SyncStatus,
  InstructionSource,
} from '../types/domain';
import { generateId, nowISO } from '../utils/helpers';

// ============================================================
// CREATE
// ============================================================

export interface CreateVariationInput {
  projectId: string;
  sequenceNumber: number;
  title: string;
  description: string;
  instructionSource: InstructionSource;
  instructedBy?: string;
  referenceDoc?: string;
  estimatedValue: number;
  latitude?: number;
  longitude?: number;
  locationAccuracy?: number;
  notes?: string;
  requestorName?: string;
  requestorEmail?: string;
}

export async function createVariation(input: CreateVariationInput): Promise<Variation> {
  const db = await getDatabase();
  const now = nowISO();
  const id = generateId();
  const variationNumber = `VAR-${String(input.sequenceNumber).padStart(3, '0')}`;

  const variation: Variation = {
    id,
    projectId: input.projectId,
    sequenceNumber: input.sequenceNumber,
    variationNumber,
    title: input.title,
    description: input.description,
    instructionSource: input.instructionSource,
    instructedBy: input.instructedBy,
    referenceDoc: input.referenceDoc,
    estimatedValue: input.estimatedValue,
    status: VariationStatus.DRAFT,
    capturedAt: now,
    latitude: input.latitude,
    longitude: input.longitude,
    locationAccuracy: input.locationAccuracy,
    notes: input.notes,
    requestorName: input.requestorName,
    requestorEmail: input.requestorEmail,
    syncStatus: SyncStatus.PENDING,
  };

  await db.runAsync(
    `INSERT INTO variations (id, project_id, sequence_number, variation_number, title, description, instruction_source, instructed_by, reference_doc, estimated_value, status, captured_at, latitude, longitude, location_accuracy, notes, requestor_name, requestor_email, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, input.projectId, input.sequenceNumber, variationNumber, input.title, input.description,
    input.instructionSource, input.instructedBy ?? null, input.referenceDoc ?? null,
    input.estimatedValue, VariationStatus.DRAFT, now,
    input.latitude ?? null, input.longitude ?? null, input.locationAccuracy ?? null,
    input.notes ?? null, input.requestorName ?? null, input.requestorEmail ?? null,
    SyncStatus.PENDING,
  );

  // Record initial status
  await addStatusChange(id, null, VariationStatus.DRAFT);

  return variation;
}

// ============================================================
// READ
// ============================================================

export async function getVariationsForProject(
  projectId: string,
  statusFilter?: VariationStatus,
): Promise<Variation[]> {
  const db = await getDatabase();
  let query = 'SELECT * FROM variations WHERE project_id = ?';
  const params: any[] = [projectId];

  if (statusFilter) {
    query += ' AND status = ?';
    params.push(statusFilter);
  }
  query += ' ORDER BY sequence_number DESC';

  const rows = await db.getAllAsync<any>(query, ...params);
  return rows.map(mapVariationRow);
}

export async function getVariationDetail(id: string): Promise<VariationDetail | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>(
    `SELECT v.*, p.name as project_name FROM variations v
     LEFT JOIN projects p ON p.id = v.project_id
     WHERE v.id = ?`,
    id,
  );
  if (!row) return null;

  const photos = await db.getAllAsync<any>(
    'SELECT * FROM photo_evidence WHERE variation_id = ? ORDER BY captured_at',
    id,
  );

  const voiceNotes = await db.getAllAsync<any>(
    'SELECT * FROM voice_notes WHERE variation_id = ? ORDER BY captured_at',
    id,
  );

  const statusHistory = await db.getAllAsync<any>(
    'SELECT * FROM status_changes WHERE variation_id = ? ORDER BY changed_at',
    id,
  );

  return {
    ...mapVariationRow(row),
    projectName: row.project_name,
    photos: photos.map(mapPhotoRow),
    voiceNotes: voiceNotes.map(mapVoiceRow),
    statusHistory: statusHistory.map(mapStatusRow),
  };
}

export async function getVariationsByStatus(statuses: string[]): Promise<VariationDetail[]> {
  const db = await getDatabase();
  const placeholders = statuses.map(() => '?').join(',');
  const rows = await db.getAllAsync<any>(
    `SELECT v.*, p.name as project_name FROM variations v
     INNER JOIN projects p ON p.id = v.project_id
     WHERE p.is_active = 1 AND v.status IN (${placeholders})
     ORDER BY v.estimated_value DESC`,
    ...statuses,
  );
  return rows.map(row => ({
    ...mapVariationRow(row),
    projectName: row.project_name,
    photos: [],
    voiceNotes: [],
    statusHistory: [],
  }));
}

export interface VariationStatusSummary {
  status: string;
  count: number;
  totalValue: number;
}

export async function getVariationStatusSummary(): Promise<VariationStatusSummary[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ status: string; count: number; total_value: number }>(
    `SELECT v.status, COUNT(*) as count, SUM(v.estimated_value) as total_value
     FROM variations v
     INNER JOIN projects p ON p.id = v.project_id
     WHERE p.is_active = 1
     GROUP BY v.status`,
  );
  return rows.map(row => ({
    status: row.status,
    count: row.count,
    totalValue: row.total_value ?? 0,
  }));
}

export async function getAllVariationsForRegister(): Promise<VariationDetail[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT v.*, p.name as project_name FROM variations v
     INNER JOIN projects p ON p.id = v.project_id
     WHERE p.is_active = 1
     ORDER BY p.name ASC, v.sequence_number ASC`,
  );
  return rows.map(row => ({
    ...mapVariationRow(row),
    projectName: row.project_name,
    photos: [],
    voiceNotes: [],
    statusHistory: [],
  }));
}

export async function getRecentVariations(limit: number = 10): Promise<VariationDetail[]> {
  const db = await getDatabase();
  
  const rows = await db.getAllAsync<any>(
    `SELECT v.*, p.name as project_name FROM variations v
     INNER JOIN projects p ON p.id = v.project_id
     WHERE p.is_active = 1
     ORDER BY v.captured_at DESC
     LIMIT ?`,
    limit,
  );

  return rows.map(row => ({
    ...mapVariationRow(row),
    projectName: row.project_name,
    photos: [],
    voiceNotes: [],
    statusHistory: [],
  }));
}

// ============================================================
// UPDATE
// ============================================================

export interface UpdateVariationInput {
  estimatedValue?: number;
  referenceDoc?: string;
  description?: string;
  notes?: string;
  instructedBy?: string;
  aiDescription?: string;
  aiTranscription?: string;
}

export async function updateVariation(id: string, input: UpdateVariationInput): Promise<void> {
  const db = await getDatabase();
  const sets: string[] = [];
  const vals: any[] = [];

  if (input.estimatedValue !== undefined) { sets.push('estimated_value = ?'); vals.push(input.estimatedValue); }
  if (input.referenceDoc !== undefined) { sets.push('reference_doc = ?'); vals.push(input.referenceDoc); }
  if (input.description !== undefined) { sets.push('description = ?'); vals.push(input.description); }
  if (input.notes !== undefined) { sets.push('notes = ?'); vals.push(input.notes); }
  if (input.instructedBy !== undefined) { sets.push('instructed_by = ?'); vals.push(input.instructedBy); }
  if (input.aiDescription !== undefined) { sets.push('ai_description = ?'); vals.push(input.aiDescription); }
  if (input.aiTranscription !== undefined) { sets.push('ai_transcription = ?'); vals.push(input.aiTranscription); }

  if (sets.length === 0) return;
  sets.push("sync_status = 'pending'");
  vals.push(id);

  await db.runAsync(`UPDATE variations SET ${sets.join(', ')} WHERE id = ?`, ...vals);
}

export async function updateVariationStatus(
  id: string,
  newStatus: VariationStatus,
  notes?: string,
): Promise<void> {
  const db = await getDatabase();
  const current = await db.getFirstAsync<{ status: string }>('SELECT status FROM variations WHERE id = ?', id);
  if (!current) throw new Error('Variation not found');

  await db.runAsync(
    "UPDATE variations SET status = ?, sync_status = 'pending' WHERE id = ?",
    newStatus, id,
  );

  await addStatusChange(id, current.status as VariationStatus, newStatus, notes);
}

export async function updateEvidenceHash(variationId: string, hash: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE variations SET evidence_hash = ? WHERE id = ?', hash, variationId);
}

// ============================================================
// DELETE
// ============================================================

export async function deleteVariation(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM variations WHERE id = ?', id);
}

// ============================================================
// EVIDENCE
// ============================================================

export async function addPhotoEvidence(photo: Omit<PhotoEvidence, 'syncStatus'>): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO photo_evidence (id, variation_id, local_uri, sha256_hash, latitude, longitude, width, height, captured_at, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    photo.id, photo.variationId, photo.localUri, photo.sha256Hash,
    photo.latitude ?? null, photo.longitude ?? null,
    photo.width ?? null, photo.height ?? null,
    photo.capturedAt, SyncStatus.PENDING,
  );
}

export async function addVoiceNote(note: Omit<VoiceNote, 'syncStatus'>): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO voice_notes (id, variation_id, local_uri, duration_seconds, transcription, transcription_status, sha256_hash, captured_at, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    note.id, note.variationId, note.localUri, note.durationSeconds,
    note.transcription ?? null, note.transcriptionStatus,
    note.sha256Hash ?? null, note.capturedAt, SyncStatus.PENDING,
  );
}

export async function updateVoiceTranscription(
  voiceNoteId: string,
  transcription: string,
  status: 'complete' | 'failed',
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE voice_notes SET transcription = ?, transcription_status = ? WHERE id = ?',
    transcription, status, voiceNoteId,
  );
}

export async function getPhotosForVariation(variationId: string): Promise<PhotoEvidence[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM photo_evidence WHERE variation_id = ? ORDER BY captured_at',
    variationId,
  );
  return rows.map(mapPhotoRow);
}

// ============================================================
// STATUS CHANGES
// ============================================================

async function addStatusChange(
  variationId: string,
  fromStatus: VariationStatus | null,
  toStatus: VariationStatus,
  notes?: string,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO status_changes (id, variation_id, from_status, to_status, changed_at, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    generateId(), variationId, fromStatus, toStatus, nowISO(), notes ?? null,
  );
}

// ============================================================
// SYNC HELPERS
// ============================================================

export async function getPendingSyncCount(): Promise<number> {
  const db = await getDatabase();
  const tables = ['projects', 'variations', 'photo_evidence', 'voice_notes'];
  let total = 0;
  for (const table of tables) {
    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${table} WHERE sync_status = 'pending'`
    );
    total += result?.count ?? 0;
  }
  return total;
}

// ============================================================
// ROW MAPPERS
// ============================================================

function mapVariationRow(row: any): Variation {
  const seqNum = row.sequence_number as number;
  return {
    id: row.id,
    projectId: row.project_id,
    sequenceNumber: seqNum,
    variationNumber: row.variation_number ?? `VAR-${String(seqNum).padStart(3, '0')}`,
    title: row.title,
    description: row.description,
    instructionSource: row.instruction_source as InstructionSource,
    instructedBy: row.instructed_by ?? undefined,
    referenceDoc: row.reference_doc ?? undefined,
    estimatedValue: row.estimated_value,
    status: row.status as VariationStatus,
    capturedAt: row.captured_at,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    locationAccuracy: row.location_accuracy ?? undefined,
    evidenceHash: row.evidence_hash ?? undefined,
    notes: row.notes ?? undefined,
    requestorName: row.requestor_name ?? undefined,
    requestorEmail: row.requestor_email ?? undefined,
    syncStatus: row.sync_status as SyncStatus,
    remoteId: row.remote_id ?? undefined,
    aiDescription: row.ai_description ?? undefined,
    aiTranscription: row.ai_transcription ?? undefined,
  };
}

function mapPhotoRow(row: any): PhotoEvidence {
  return {
    id: row.id,
    variationId: row.variation_id,
    localUri: row.local_uri,
    remoteUri: row.remote_uri ?? undefined,
    sha256Hash: row.sha256_hash,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    capturedAt: row.captured_at,
    syncStatus: row.sync_status as SyncStatus,
  };
}

function mapVoiceRow(row: any): VoiceNote {
  return {
    id: row.id,
    variationId: row.variation_id,
    localUri: row.local_uri,
    remoteUri: row.remote_uri ?? undefined,
    durationSeconds: row.duration_seconds,
    transcription: row.transcription ?? undefined,
    transcriptionStatus: row.transcription_status,
    sha256Hash: row.sha256_hash ?? undefined,
    capturedAt: row.captured_at,
    syncStatus: row.sync_status as SyncStatus,
  };
}

function mapStatusRow(row: any): StatusChange {
  return {
    id: row.id,
    variationId: row.variation_id,
    fromStatus: row.from_status as VariationStatus | null,
    toStatus: row.to_status as VariationStatus,
    changedAt: row.changed_at,
    changedBy: row.changed_by ?? undefined,
    notes: row.notes ?? undefined,
  };
}
