/**
 * Seed Data
 *
 * 3 realistic Victorian construction projects with 13 variations.
 */

import { getDatabase, resetDatabase } from './schema';
import { generateId, nowISO } from '../utils/helpers';

export async function seedDatabase(): Promise<void> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM projects');
  if ((existing?.count ?? 0) > 0) return;
  await insertSeedData();
}

export async function resetAndReseed(): Promise<void> {
  await resetDatabase();
  await insertSeedData();
}

async function insertSeedData(): Promise<void> {
  const db = await getDatabase();
  const now = new Date();

  const projects = [
    { id: generateId(), name: 'Westgate Tunnel - Section 4B', client: 'CPBJH JV', reference: 'WGT-4B-2025', contractType: 'lump_sum', lat: -37.8224, lng: 144.8866 },
    { id: generateId(), name: 'Metro Crossing - Parkville', client: 'Rail Projects Victoria', reference: 'MC-PKV-2025', contractType: 'schedule_of_rates', lat: -37.7840, lng: 144.9560 },
    { id: generateId(), name: 'Northern Hospital - Mechanical', client: 'Lendlease', reference: 'NH-MECH-2025', contractType: 'design_and_construct', lat: -37.7367, lng: 145.0136 },
  ];

  for (const p of projects) {
    const created = new Date(now.getTime() - Math.random() * 30 * 86400000).toISOString();
    await db.runAsync(
      `INSERT INTO projects (id, name, client, reference, contract_type, latitude, longitude, is_active, created_at, updated_at, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 'pending')`,
      p.id, p.name, p.client, p.reference, p.contractType, p.lat, p.lng, created, created,
    );
  }

  const variations = [
    // Westgate Tunnel (7 variations)
    { projectId: projects[0].id, seq: 1, title: 'Rock class upgrade — Chainage 4200-4350', source: 'latent_condition', value: 3250000, status: 'approved', instructedBy: 'Geotech Advisor' },
    { projectId: projects[0].id, seq: 2, title: 'Additional dewatering — wet season impact', source: 'site_instruction', value: 1850000, status: 'submitted', instructedBy: 'Site Superintendent' },
    { projectId: projects[0].id, seq: 3, title: 'Traffic management plan revision 3', source: 'drawing_revision', value: 420000, status: 'captured', instructedBy: 'Traffic Engineer' },
    { projectId: projects[0].id, seq: 4, title: 'Utility relocation — Telstra conduit clash', source: 'rfi_response', value: 1180000, status: 'disputed', instructedBy: 'Design Manager' },
    { projectId: projects[0].id, seq: 5, title: 'Concrete spec change — 50MPa to 65MPa', source: 'drawing_revision', value: 890000, status: 'paid', instructedBy: 'Structural Engineer' },
    { projectId: projects[0].id, seq: 6, title: 'Night works premium — noise compliance', source: 'verbal_direction', value: 1650000, status: 'submitted', instructedBy: 'Project Manager' },
    { projectId: projects[0].id, seq: 7, title: 'Contaminated soil disposal — PFAS detected', source: 'latent_condition', value: 1640000, status: 'captured', instructedBy: 'Environmental Officer' },

    // Metro Crossing (3 variations)
    { projectId: projects[1].id, seq: 1, title: 'Platform extension — revised passenger modelling', source: 'drawing_revision', value: 2230000, status: 'approved', instructedBy: 'Design Lead' },
    { projectId: projects[1].id, seq: 2, title: 'Heritage wall protection — unexpected discovery', source: 'latent_condition', value: 1450000, status: 'submitted', instructedBy: 'Heritage Advisor' },
    { projectId: projects[1].id, seq: 3, title: 'Signalling cable reroute — live rail proximity', source: 'site_instruction', value: 850000, status: 'captured', instructedBy: 'Signalling Engineer' },

    // Northern Hospital (3 variations)
    { projectId: projects[2].id, seq: 1, title: 'Chiller plant upgrade — capacity review', source: 'rfi_response', value: 780000, status: 'approved', instructedBy: 'Mechanical Engineer' },
    { projectId: projects[2].id, seq: 2, title: 'Fire damper replacement — non-compliant units', source: 'site_instruction', value: 450000, status: 'disputed', instructedBy: 'Fire Engineer' },
    { projectId: projects[2].id, seq: 3, title: 'BMS integration scope increase', source: 'verbal_direction', value: 350000, status: 'captured', instructedBy: 'BMS Contractor' },
  ];

  for (const v of variations) {
    const id = generateId();
    const capturedAt = new Date(now.getTime() - Math.random() * 14 * 86400000).toISOString();
    const project = projects.find(p => p.id === v.projectId)!;

    await db.runAsync(
      `INSERT INTO variations (id, project_id, sequence_number, title, description, instruction_source, instructed_by, estimated_value, status, captured_at, latitude, longitude, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      id, v.projectId, v.seq, v.title,
      `Variation for ${v.title.toLowerCase()}. Documented on site with photographic evidence and GPS coordinates.`,
      v.source, v.instructedBy, v.value, v.status, capturedAt,
      project.lat + (Math.random() - 0.5) * 0.002,
      project.lng + (Math.random() - 0.5) * 0.002,
    );

    // Status history
    await db.runAsync(
      `INSERT INTO status_changes (id, variation_id, from_status, to_status, changed_at) VALUES (?, ?, NULL, 'captured', ?)`,
      generateId(), id, capturedAt,
    );

    const statusFlow: string[] = [];
    if (['submitted', 'approved', 'disputed', 'paid'].includes(v.status)) statusFlow.push('submitted');
    if (['approved', 'paid'].includes(v.status)) statusFlow.push('approved');
    if (v.status === 'disputed') statusFlow.push('disputed');
    if (v.status === 'paid') statusFlow.push('paid');

    let prev = 'captured';
    for (const s of statusFlow) {
      const changedAt = new Date(new Date(capturedAt).getTime() + Math.random() * 5 * 86400000).toISOString();
      await db.runAsync(
        `INSERT INTO status_changes (id, variation_id, from_status, to_status, changed_at) VALUES (?, ?, ?, ?, ?)`,
        generateId(), id, prev, s, changedAt,
      );
      prev = s;
    }
  }

  console.log('[Seed] Inserted 3 projects, 13 variations');
}
