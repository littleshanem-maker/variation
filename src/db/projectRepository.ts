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
    field_variation_count: number;
    total_value: number;
    at_risk_value: number;
    last_capture_at: string | null;
  }>(`
    SELECT
      p.*,
      COUNT(v.id) as variation_count,
      COUNT(CASE WHEN v.status IN ('captured', 'submitted') THEN 1 END) as field_variation_count,
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
    fieldVariationCount: row.field_variation_count,
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

export async function archiveProject(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE projects SET is_active = 0, sync_status = 'pending' WHERE id = ?", id);
}

export async function unarchiveProject(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE projects SET is_active = 1, sync_status = 'pending' WHERE id = ?", id);
}

export async function getArchivedProjects(): Promise<ProjectSummary[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string; name: string; client: string; reference: string;
    is_active: number; variation_count: number; total_value: number;
  }>(`
    SELECT p.*, 
      (SELECT COUNT(*) FROM variations v WHERE v.project_id = p.id) as variation_count,
      (SELECT COALESCE(SUM(v.estimated_value), 0) FROM variations v WHERE v.project_id = p.id) as total_value
    FROM projects p
    WHERE p.is_active = 0
    ORDER BY p.name ASC
  `);
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    client: row.client,
    reference: row.reference,
    isActive: false,
    variationCount: row.variation_count,
    totalValue: row.total_value,
  }));
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
  approvedValue: number;
  inFlightValue: number;
  disputedValue: number;
  submittedCount: number;
  approvedCount: number;
  totalWithOutcome: number;
}> {
  const db = await getDatabase();
  
  const result = await db.getFirstAsync<{
    approved_value: number;
    in_flight_value: number;
    disputed_value: number;
    submitted_count: number;
    approved_count: number;
    disputed_count: number;
    paid_count: number;
  }>(`
    SELECT
      COALESCE(SUM(CASE WHEN status = 'approved' THEN estimated_value ELSE 0 END), 0) as approved_value,
      COALESCE(SUM(CASE WHEN status = 'submitted' THEN estimated_value ELSE 0 END), 0) as in_flight_value,
      COALESCE(SUM(CASE WHEN status = 'disputed' THEN estimated_value ELSE 0 END), 0) as disputed_value,
      COUNT(CASE WHEN status = 'submitted' THEN 1 END) as submitted_count,
      COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
      COUNT(CASE WHEN status = 'disputed' THEN 1 END) as disputed_count,
      COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count
    FROM variations v
    INNER JOIN projects p ON p.id = v.project_id
    WHERE p.is_active = 1
  `);

  if (!result) {
    return {
      approvedValue: 0,
      inFlightValue: 0,
      disputedValue: 0,
      submittedCount: 0,
      approvedCount: 0,
      totalWithOutcome: 0,
    };
  }

  return {
    approvedValue: result.approved_value,
    inFlightValue: result.in_flight_value,
    disputedValue: result.disputed_value,
    submittedCount: result.submitted_count,
    approvedCount: result.approved_count,
    totalWithOutcome: result.approved_count + result.disputed_count + result.paid_count,
  };
}
