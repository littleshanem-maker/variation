/**
 * Attachment Repository
 *
 * CRUD operations for document attachments stored locally.
 */

import { getDatabase } from './schema';
import { nowISO } from '../utils/helpers';

export interface Attachment {
  id: string;
  variationId: string;
  localUri: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  sha256Hash: string;
  capturedAt: string;
  syncStatus: string;
}

export async function addAttachment(data: Omit<Attachment, 'capturedAt' | 'syncStatus'>): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO attachments (id, variation_id, local_uri, file_name, file_size, mime_type, sha256_hash, captured_at, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    data.id,
    data.variationId,
    data.localUri,
    data.fileName,
    data.fileSize ?? null,
    data.mimeType ?? null,
    data.sha256Hash,
    nowISO(),
  );
}

export async function getAttachmentsForVariation(variationId: string): Promise<Attachment[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM attachments WHERE variation_id = ? ORDER BY captured_at ASC',
    variationId,
  );
  return rows.map(r => ({
    id: r.id,
    variationId: r.variation_id,
    localUri: r.local_uri,
    fileName: r.file_name,
    fileSize: r.file_size ?? undefined,
    mimeType: r.mime_type ?? undefined,
    sha256Hash: r.sha256_hash,
    capturedAt: r.captured_at,
    syncStatus: r.sync_status,
  }));
}

export async function deleteAttachment(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM attachments WHERE id = ?', id);
}
