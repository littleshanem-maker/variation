/**
 * Variation Repository
 *
 * Data access for variations and their evidence artifacts.
 * The core of the offline-first data layer.
 */

import { getDatabase } from './schema';
import {
  Variation,
  VariationWithEvidence,
  VariationStatus,
  PhotoEvidence,
  VoiceNote,
  StatusChange,
  SyncStatus,
  CaptureInProgress,
  InstructionSource,
} from '../types/domain';
import { generateId, nowISO } from '../utils/helpers';
import { getNextVariationSequence } from './projectRepository';
import { computeEvidenceHash } from '../services/evidenceChain';

// ============================================================
// CREATE — from capture flow
// ============================================================

/**
 * Save a completed capture as a new variation.
 * This is the main write operation — called when the user taps "Save Variation".
 *
 * Runs in a single transaction to ensure atomicity.
 */
export async function saveVariation(
  capture: CaptureInProgress,
  userId: string,
): Promise<Variation> {
  const db = await getDatabase();
  const now = nowISO();
  const variationId = generateId();
  const sequenceNumber = await getNextVariationSequence(capture.projectId);

  // Compute evidence hash from all photo hashes + voice hash
  const photoHashes: string[] = []; // Will be populated below
  let voiceHash: string | undefined;

  // Build title from instruction source + reference
  const sourceLabel = formatInstructionSource(capture.instructionSource);
  const title = capture.instructionReference
    ? `${sourceLabel} — ${capture.instructionReference}`
    : sourceLabel;

  await db.withTransactionAsync(async () => {
    // 1. Insert variation
    await db.runAsync(
      `INSERT INTO variations (
        id, project_id, sequence_number, title, status,
        estimated_value, instruction_source, instruction_reference,
        instructed_by, notes, captured_at, captured_by,
        latitude, longitude, evidence_hash,
        created_at, updated_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      variationId,
      capture.projectId,
      sequenceNumber,
      title,
      VariationStatus.CAPTURED,
      capture.estimatedValue ?? 0,
      capture.instructionSource,
      capture.instructionReference ?? null,
      capture.instructedBy ?? null,
      capture.notes ?? null,
      capture.startedAt,
      userId,
      capture.latitude ?? null,
      capture.longitude ?? null,
      'pending', // evidence hash computed after artifacts saved
      now,
      now,
      SyncStatus.PENDING,
    );

    // 2. Insert photos
    for (let i = 0; i < capture.photos.length; i++) {
      const photo = capture.photos[i];
      const photoId = generateId();
      // Hash will be computed by the evidence service
      const hash = await computeEvidenceHash(photo.uri);
      photoHashes.push(hash);

      await db.runAsync(
        `INSERT INTO photo_evidence (
          id, variation_id, local_uri, mime_type, file_size_bytes,
          width, height, latitude, longitude, captured_at,
          sha256_hash, sort_order, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        photoId,
        variationId,
        photo.uri,
        'image/jpeg',
        0, // Will be populated by file system check
        photo.width,
        photo.height,
        photo.latitude ?? null,
        photo.longitude ?? null,
        photo.capturedAt,
        hash,
        i,
        SyncStatus.PENDING,
      );
    }

    // 3. Insert voice note if present
    if (capture.voiceNote) {
      const voiceId = generateId();
      voiceHash = await computeEvidenceHash(capture.voiceNote.uri);

      await db.runAsync(
        `INSERT INTO voice_notes (
          id, variation_id, local_uri, mime_type, duration_seconds,
          file_size_bytes, captured_at, sha256_hash, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        voiceId,
        variationId,
        capture.voiceNote.uri,
        'audio/m4a',
        capture.voiceNote.durationSeconds,
        0,
        capture.voiceNote.capturedAt,
        voiceHash,
        SyncStatus.PENDING,
      );
    }

    // 4. Record initial status change
    await db.runAsync(
      `INSERT INTO status_changes (id, variation_id, from_status, to_status, changed_by, changed_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      generateId(),
      variationId,
      null,
      VariationStatus.CAPTURED,
      userId,
      now,
    );

    // 5. Update evidence hash on the variation
    const allHashes = [...photoHashes, voiceHash].filter(Boolean) as string[];
    const combinedHash = await computeCombinedHash(allHashes);
    await db.runAsync(
      'UPDATE variations SET evidence_hash = ? WHERE id = ?',
      combinedHash,
      variationId,
    );
  });

  // Return the saved variation
  return (await getVariationById(variationId))!;
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

  query += ' ORDER BY captured_at DESC';

  const rows = await db.getAllAsync<any>(query, ...params);
  return rows.map(mapRowToVariation);
}

export async function getVariationById(id: string): Promise<Variation | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM variations WHERE id = ?',
    id,
  );
  return row ? mapRowToVariation(row) : null;
}

export async function getVariationWithEvidence(id: string): Promise<VariationWithEvidence | null> {
  const variation = await getVariationById(id);
  if (!variation) return null;

  const db = await getDatabase();

  const photos = await db.getAllAsync<any>(
    'SELECT * FROM photo_evidence WHERE variation_id = ? ORDER BY sort_order',
    id,
  );

  const voiceRow = await db.getFirstAsync<any>(
    'SELECT * FROM voice_notes WHERE variation_id = ?',
    id,
  );

  const statusHistory = await db.getAllAsync<any>(
    'SELECT * FROM status_changes WHERE variation_id = ? ORDER BY changed_at',
    id,
  );

  return {
    ...variation,
    photos: photos.map(mapRowToPhoto),
    voiceNote: voiceRow ? mapRowToVoiceNote(voiceRow) : undefined,
    statusHistory: statusHistory.map(mapRowToStatusChange),
  };
}

// ============================================================
// UPDATE
// ============================================================

export async function updateVariationStatus(
  variationId: string,
  newStatus: VariationStatus,
  userId: string,
  notes?: string,
): Promise<void> {
  const db = await getDatabase();
  const now = nowISO();

  await db.withTransactionAsync(async () => {
    const current = await db.getFirstAsync<{ status: string }>(
      'SELECT status FROM variations WHERE id = ?',
      variationId,
    );

    await db.runAsync(
      'UPDATE variations SET status = ?, updated_at = ?, sync_status = ? WHERE id = ?',
      newStatus,
      now,
      SyncStatus.PENDING,
      variationId,
    );

    await db.runAsync(
      `INSERT INTO status_changes (id, variation_id, from_status, to_status, changed_by, changed_at, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      generateId(),
      variationId,
      current?.status ?? null,
      newStatus,
      userId,
      now,
      notes ?? null,
    );
  });
}

export async function updateVariationDescription(
  variationId: string,
  description: string,
  isAiGenerated: boolean,
): Promise<void> {
  const db = await getDatabase();
  const now = nowISO();

  if (isAiGenerated) {
    await db.runAsync(
      'UPDATE variations SET ai_description = ?, description = ?, updated_at = ?, sync_status = ? WHERE id = ?',
      description,
      description,
      now,
      SyncStatus.PENDING,
      variationId,
    );
  } else {
    await db.runAsync(
      'UPDATE variations SET description = ?, updated_at = ?, sync_status = ? WHERE id = ?',
      description,
      now,
      SyncStatus.PENDING,
      variationId,
    );
  }
}

// ============================================================
// HELPERS
// ============================================================

function mapRowToVariation(row: any): Variation {
  return {
    id: row.id,
    projectId: row.project_id,
    sequenceNumber: row.sequence_number,
    title: row.title,
    status: row.status as VariationStatus,
    estimatedValue: row.estimated_value,
    approvedValue: row.approved_value ?? undefined,
    instructionSource: row.instruction_source as InstructionSource,
    instructionReference: row.instruction_reference ?? undefined,
    instructedBy: row.instructed_by ?? undefined,
    description: row.description ?? undefined,
    aiDescription: row.ai_description ?? undefined,
    notes: row.notes ?? undefined,
    capturedAt: row.captured_at,
    capturedBy: row.captured_by,
    submittedAt: row.submitted_at ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    locationAccuracy: row.location_accuracy ?? undefined,
    evidenceHash: row.evidence_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status as SyncStatus,
  };
}

function mapRowToPhoto(row: any): PhotoEvidence {
  return {
    id: row.id,
    variationId: row.variation_id,
    localUri: row.local_uri,
    remoteUri: row.remote_uri ?? undefined,
    thumbnailUri: row.thumbnail_uri ?? undefined,
    mimeType: row.mime_type,
    fileSizeBytes: row.file_size_bytes,
    width: row.width,
    height: row.height,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    capturedAt: row.captured_at,
    sha256Hash: row.sha256_hash,
    sortOrder: row.sort_order,
    syncStatus: row.sync_status as SyncStatus,
  };
}

function mapRowToVoiceNote(row: any): VoiceNote {
  return {
    id: row.id,
    variationId: row.variation_id,
    localUri: row.local_uri,
    remoteUri: row.remote_uri ?? undefined,
    mimeType: row.mime_type,
    durationSeconds: row.duration_seconds,
    fileSizeBytes: row.file_size_bytes,
    transcription: row.transcription ?? undefined,
    transcriptionConfidence: row.transcription_confidence ?? undefined,
    capturedAt: row.captured_at,
    sha256Hash: row.sha256_hash,
    syncStatus: row.sync_status as SyncStatus,
  };
}

function mapRowToStatusChange(row: any): StatusChange {
  return {
    id: row.id,
    variationId: row.variation_id,
    fromStatus: row.from_status as VariationStatus | null,
    toStatus: row.to_status as VariationStatus,
    changedBy: row.changed_by,
    changedAt: row.changed_at,
    notes: row.notes ?? undefined,
  };
}

function formatInstructionSource(source: InstructionSource): string {
  const labels: Record<InstructionSource, string> = {
    [InstructionSource.SITE_INSTRUCTION]: 'Site Instruction',
    [InstructionSource.RFI_RESPONSE]: 'RFI Response',
    [InstructionSource.VERBAL_DIRECTION]: 'Verbal Direction',
    [InstructionSource.DRAWING_REVISION]: 'Drawing Revision',
    [InstructionSource.LATENT_CONDITION]: 'Latent Condition',
    [InstructionSource.EMAIL]: 'Email Instruction',
    [InstructionSource.OTHER]: 'Other',
  };
  return labels[source] ?? source;
}

async function computeCombinedHash(hashes: string[]): Promise<string> {
  // Combine all individual hashes into one evidence chain hash
  const combined = hashes.sort().join(':');
  // In production, this would be a proper SHA-256 of the combined string
  // For now, use the first hash as a placeholder
  return `sha256:${combined.slice(0, 8)}...${combined.slice(-4)}`;
}
