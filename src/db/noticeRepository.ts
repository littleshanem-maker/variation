/**
 * Notice Repository
 *
 * CRUD for variation_notices table.
 */

import { getDatabase } from './schema';
import { VariationNotice } from '../types/domain';
import { generateId, nowISO } from '../utils/helpers';

// ============================================================
// CREATE
// ============================================================

export interface CreateNoticeInput {
  projectId: string;
  eventDescription: string;
  eventDate: string;
  costFlag: boolean;
  timeFlag: boolean;
  estimatedDays?: number;
  contractClause?: string;
  issuedByName?: string;
  issuedByEmail?: string;
  status?: 'draft' | 'issued' | 'acknowledged';
  issuedAt?: string;
}

export async function createNotice(input: CreateNoticeInput): Promise<VariationNotice> {
  const db = await getDatabase();
  const now = nowISO();
  const id = generateId();
  const seq = await getNextNoticeSequence(input.projectId);
  const noticeNumber = `VN-${String(seq).padStart(3, '0')}`;
  const status = input.status ?? 'draft';

  const notice: VariationNotice = {
    id,
    projectId: input.projectId,
    noticeNumber,
    sequenceNumber: seq,
    eventDescription: input.eventDescription,
    eventDate: input.eventDate,
    costFlag: input.costFlag,
    timeFlag: input.timeFlag,
    estimatedDays: input.estimatedDays,
    contractClause: input.contractClause,
    issuedByName: input.issuedByName,
    issuedByEmail: input.issuedByEmail,
    status,
    issuedAt: input.issuedAt,
    syncStatus: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  await db.runAsync(
    `INSERT INTO variation_notices
      (id, project_id, notice_number, sequence_number, event_description, event_date,
       cost_flag, time_flag, estimated_days, contract_clause,
       issued_by_name, issued_by_email, status, issued_at,
       acknowledged_at, variation_id, sync_status, remote_id,
       created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.projectId,
    noticeNumber,
    seq,
    input.eventDescription,
    input.eventDate,
    input.costFlag ? 1 : 0,
    input.timeFlag ? 1 : 0,
    input.estimatedDays ?? null,
    input.contractClause ?? null,
    input.issuedByName ?? null,
    input.issuedByEmail ?? null,
    status,
    input.issuedAt ?? null,
    null,
    null,
    'pending',
    null,
    now,
    now,
  );

  return notice;
}

// ============================================================
// READ
// ============================================================

export async function getNextNoticeSequence(projectId: string): Promise<number> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ max_seq: number | null }>(
    'SELECT MAX(sequence_number) as max_seq FROM variation_notices WHERE project_id = ?',
    projectId,
  );
  return (result?.max_seq ?? 0) + 1;
}

export async function getNoticesForProject(projectId: string): Promise<VariationNotice[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM variation_notices WHERE project_id = ? ORDER BY sequence_number DESC',
    projectId,
  );
  return rows.map(mapNoticeRow);
}

export async function getNoticeById(id: string): Promise<VariationNotice | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM variation_notices WHERE id = ?',
    id,
  );
  if (!row) return null;
  return mapNoticeRow(row);
}

// ============================================================
// UPDATE
// ============================================================

export async function updateNoticeStatus(
  id: string,
  status: 'draft' | 'issued' | 'acknowledged',
): Promise<void> {
  const db = await getDatabase();
  const now = nowISO();
  const issuedAt = status === 'issued' ? now : undefined;
  const acknowledgedAt = status === 'acknowledged' ? now : undefined;

  if (issuedAt !== undefined) {
    await db.runAsync(
      `UPDATE variation_notices
       SET status = ?, issued_at = ?, updated_at = ?, sync_status = 'pending'
       WHERE id = ?`,
      status, issuedAt, now, id,
    );
  } else if (acknowledgedAt !== undefined) {
    await db.runAsync(
      `UPDATE variation_notices
       SET status = ?, acknowledged_at = ?, updated_at = ?, sync_status = 'pending'
       WHERE id = ?`,
      status, acknowledgedAt, now, id,
    );
  } else {
    await db.runAsync(
      `UPDATE variation_notices
       SET status = ?, updated_at = ?, sync_status = 'pending'
       WHERE id = ?`,
      status, now, id,
    );
  }
}

export async function linkVariationToNotice(
  noticeId: string,
  variationId: string,
): Promise<void> {
  const db = await getDatabase();
  const now = nowISO();
  await db.runAsync(
    `UPDATE variation_notices
     SET variation_id = ?, updated_at = ?, sync_status = 'pending'
     WHERE id = ?`,
    variationId, now, noticeId,
  );
}

// ============================================================
// ROW MAPPER
// ============================================================

function mapNoticeRow(row: any): VariationNotice {
  return {
    id: row.id,
    projectId: row.project_id,
    noticeNumber: row.notice_number,
    sequenceNumber: row.sequence_number,
    eventDescription: row.event_description,
    eventDate: row.event_date,
    costFlag: Boolean(row.cost_flag),
    timeFlag: Boolean(row.time_flag),
    estimatedDays: row.estimated_days ?? undefined,
    contractClause: row.contract_clause ?? undefined,
    issuedByName: row.issued_by_name ?? undefined,
    issuedByEmail: row.issued_by_email ?? undefined,
    status: row.status as 'draft' | 'issued' | 'acknowledged',
    issuedAt: row.issued_at ?? undefined,
    acknowledgedAt: row.acknowledged_at ?? undefined,
    variationId: row.variation_id ?? undefined,
    syncStatus: row.sync_status,
    remoteId: row.remote_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
