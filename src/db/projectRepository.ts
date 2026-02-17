/**
 * Project Repository
 */

import { getDatabase } from './schema';
import { Project, ProjectSummary, SyncStatus } from '../types/domain';
import { generateId, nowISO } from '../utils/helpers';

export async function createProject(
  data: Pick<Project, 'name' | 'client' | 'reference' | 'contractType'> &
    Partial<Pick<Project, 'address' | 'latitude' | 'longitude'>>
): Promise<Project> {
  const db = await getDatabase();
  const now = nowISO();
  const project: Project = {
    id: generateId(),
    ...data,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    syncStatus: SyncStatus.PENDING,
  };

  await db.runAsync(
    `INSERT INTO projects (id, name, client, reference, address, latitude, longitude, contract_type, is_active, created_at, updated_at, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    project.id,
    project.name,
    project.client,
    project.reference,
    project.address ?? null,
    project.latitude ?? null,
    project.longitude ?? null,
    project.contractType ?? null,
    project.isActive ? 1 : 0,
    project.createdAt,
    project.updatedAt,
    project.syncStatus,
  );

  return project;
}

export async function getActiveProjects(): Promise<ProjectSummary[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<{
    id: string;
    name: string;
    client: string;
    reference: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    contract_type: string | null;
    is_active: number;
    created_at: string;
    updated_at: string;
    sync_status: string;
    variation_count: number;
    total_value: number;
    at_risk_value: number;
    last_capture_at: string | null;
  }>(`
    SELECT
      p.*,
      COUNT(v.id) as variation_count,
      COALESCE(SUM(v.estimated_value), 0) as total_value,
      COALESCE(SUM(CASE WHEN v.status IN ('captured', 'submitted', 'disputed') THEN v.estimated_value ELSE 0 END), 0) as at_risk_value,
      MAX(v.captured_at) as last_capture_at
    FROM projects p
    LEFT JOIN variations v ON v.project_id = p.id
    WHERE p.is_active = 1
    GROUP BY p.id
    ORDER BY COALESCE(MAX(v.captured_at), p.created_at) DESC
  `);

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    client: row.client,
    reference: row.reference,
    address: row.address ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    contractType: row.contract_type as Project['contractType'],
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status as SyncStatus,
    variationCount: row.variation_count,
    totalValue: row.total_value,
    atRiskValue: row.at_risk_value,
    lastCaptureAt: row.last_capture_at ?? undefined,
  }));
}

export async function getProjectById(id: string): Promise<Project | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM projects WHERE id = ?',
    id,
  );
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    client: row.client,
    reference: row.reference,
    address: row.address ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    contractType: row.contract_type ?? undefined,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status as SyncStatus,
  };
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM projects WHERE id = ?', id);
}

export async function getNextVariationSequence(projectId: string): Promise<number> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ max_seq: number | null }>(
    'SELECT MAX(sequence_number) as max_seq FROM variations WHERE project_id = ?',
    projectId,
  );
  return (result?.max_seq ?? 0) + 1;
}

export async function getDashboardStats(): Promise<{
  totalVariations: number;
  totalValue: number;
  atRiskValue: number;
  approvedCount: number;
  totalWithOutcome: number;
}> {
  const db = await getDatabase();
  
  const result = await db.getFirstAsync<{
    total_variations: number;
    total_value: number;
    at_risk_value: number;
    approved_count: number;
    disputed_count: number;
    paid_count: number;
  }>(`
    SELECT
      COUNT(*) as total_variations,
      COALESCE(SUM(estimated_value), 0) as total_value,
      COALESCE(SUM(CASE WHEN status IN ('captured', 'submitted', 'disputed') THEN estimated_value ELSE 0 END), 0) as at_risk_value,
      COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
      COUNT(CASE WHEN status = 'disputed' THEN 1 END) as disputed_count,
      COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count
    FROM variations v
    INNER JOIN projects p ON p.id = v.project_id
    WHERE p.is_active = 1
  `);

  if (!result) {
    return {
      totalVariations: 0,
      totalValue: 0,
      atRiskValue: 0,
      approvedCount: 0,
      totalWithOutcome: 0,
    };
  }

  return {
    totalVariations: result.total_variations,
    totalValue: result.total_value,
    atRiskValue: result.at_risk_value,
    approvedCount: result.approved_count,
    totalWithOutcome: result.approved_count + result.disputed_count + result.paid_count,
  };
}
