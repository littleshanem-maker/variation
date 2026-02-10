/**
 * Seed Data Service
 *
 * Populates the database with realistic demo data.
 * Used on first launch and for demo mode.
 *
 * All data reflects real Victorian construction scenarios
 * to make demos credible with contractor prospects.
 */

import { getDatabase } from './schema';
import { generateId, nowISO } from '../utils/helpers';
import { VariationStatus, InstructionSource, SyncStatus } from '../types/domain';

const DEMO_USER_ID = 'demo-user-001';

interface SeedVariation {
  title: string;
  status: VariationStatus;
  estimatedValue: number; // dollars, converted to cents
  instructionSource: InstructionSource;
  instructionReference?: string;
  instructedBy?: string;
  description: string;
  daysAgo: number;
  photoCount: number;
  hasVoice: boolean;
}

const PROJECTS = [
  {
    name: 'Westgate Tunnel – Section 4B',
    client: 'CPBJH JV',
    reference: 'WT-2026-4B',
    address: 'Williamstown Road, Port Melbourne VIC',
    latitude: -37.8316,
    longitude: 144.9001,
    contractType: 'lump_sum' as const,
    variations: [
      {
        title: 'Additional pipe support brackets – Level 3',
        status: VariationStatus.APPROVED,
        estimatedValue: 12400,
        instructionSource: InstructionSource.SITE_INSTRUCTION,
        instructionReference: 'SI-2026-031',
        instructedBy: 'Mark Sullivan (Superintendent)',
        description: 'Client superintendent directed installation of 14 additional pipe support brackets on Level 3 mechanical riser, not shown on original drawing M-301. Brackets required due to revised pipe routing to avoid new fire damper locations. Material: galvanised steel channel, 150mm x 75mm, fixed to concrete soffit with M12 anchors. Labour: 2 fitters, 6 hours. Refer to Site Instruction SI-2026-031 dated 28 January 2026.',
        daysAgo: 4,
        photoCount: 3,
        hasVoice: true,
      },
      {
        title: 'Rock excavation – Trench B alignment',
        status: VariationStatus.SUBMITTED,
        estimatedValue: 28500,
        instructionSource: InstructionSource.LATENT_CONDITION,
        instructionReference: 'SI-2026-047',
        instructedBy: 'Site conditions (latent)',
        description: 'Latent rock condition encountered at 1.8m depth along Trench B alignment (Chainage 450–520). Rock not identified in geotechnical report ref GEO-2025-089 provided at tender. Hydraulic hammer required for 70 linear metres of trench excavation. Additional cost includes machine hire (CAT 330 with hammer attachment, 4 days), operator, spotter, and disposal of excavated rock to licensed tip. Refer SI-2026-047.',
        daysAgo: 6,
        photoCount: 6,
        hasVoice: true,
      },
      {
        title: 'Relocated gas main crossing point',
        status: VariationStatus.CAPTURED,
        estimatedValue: 8200,
        instructionSource: InstructionSource.VERBAL_DIRECTION,
        instructedBy: 'Dave Chen (Site Superintendent)',
        description: 'Verbal instruction from site superintendent Dave Chen to relocate gas main crossing point 12m east of designed position due to Telstra conduit conflict discovered during potholing. Additional trenching (14m), bedding sand, PE100 SDR11 pipe installation, backfill, and bitumen surface reinstatement required. Conduit not shown on DBYD plans provided at tender.',
        daysAgo: 2,
        photoCount: 4,
        hasVoice: true,
      },
      {
        title: 'Standing time – crane access blocked',
        status: VariationStatus.DISPUTED,
        estimatedValue: 6800,
        instructionSource: InstructionSource.OTHER,
        instructedBy: 'N/A – delay claim',
        description: '4-person crew on standing time for 6 hours due to crane access path blocked by concrete contractor formwork. Access path shown on construction programme rev 14 was not available. No prior notice given by principal contractor. Crew: 1 leading hand, 2 fitters, 1 rigger. Plant on standby: 25T franna crane.',
        daysAgo: 9,
        photoCount: 2,
        hasVoice: false,
      },
      {
        title: 'Additional bollards – gate entry',
        status: VariationStatus.PAID,
        estimatedValue: 3400,
        instructionSource: InstructionSource.SITE_INSTRUCTION,
        instructionReference: 'SI-2026-022',
        instructedBy: 'Mark Sullivan (Superintendent)',
        description: 'Supply and install 6 additional steel safety bollards at main site entry gate per superintendent written direction SI-2026-022. Bollards: 114mm OD x 1200mm galvanised steel pipe, filled with concrete, painted safety yellow, set into 400mm x 400mm x 600mm deep concrete footings.',
        daysAgo: 13,
        photoCount: 2,
        hasVoice: false,
      },
      {
        title: 'Revised alignment – stormwater connection',
        status: VariationStatus.CAPTURED,
        estimatedValue: 15300,
        instructionSource: InstructionSource.DRAWING_REVISION,
        instructionReference: 'DWG-SW-401 Rev C',
        instructedBy: 'Design team (RFI response)',
        description: 'Drawing revision DWG-SW-401 Rev C issued 3 February 2026 relocates stormwater connection point 8m south of original design position. Additional 300mm RCP pipe supply and install (12m), two additional 90-degree bends, modified pit connection, and reinstatement of disturbed road pavement.',
        daysAgo: 1,
        photoCount: 3,
        hasVoice: true,
      },
      {
        title: 'Asbestos-contaminated soil removal',
        status: VariationStatus.SUBMITTED,
        estimatedValue: 34200,
        instructionSource: InstructionSource.LATENT_CONDITION,
        instructionReference: 'SI-2026-051',
        description: 'Friable asbestos-contaminated soil discovered during excavation at Chainage 380. Area approximately 6m x 4m x 1.2m deep. Not identified in Phase 2 Environmental Site Assessment ref ESA-2025-044. Requires licensed asbestos removal contractor, air monitoring, Class A tip disposal, and replacement clean fill. Work stopped for 2 days pending WorkSafe notification.',
        daysAgo: 3,
        photoCount: 8,
        hasVoice: true,
      },
    ] as SeedVariation[],
  },
  {
    name: 'Metro Crossing – Parkville',
    client: 'Rail Projects Victoria',
    reference: 'MC-2026-PV',
    address: 'Royal Parade, Parkville VIC',
    latitude: -37.7840,
    longitude: 144.9560,
    contractType: 'schedule_of_rates' as const,
    variations: [
      {
        title: 'Service relocation – unknown Yarra Water main',
        status: VariationStatus.APPROVED,
        estimatedValue: 18700,
        instructionSource: InstructionSource.LATENT_CONDITION,
        instructionReference: 'SI-MC-088',
        instructedBy: 'RPV Project Engineer',
        description: 'Unknown 150mm Yarra Water main encountered during bulk excavation at Level B2. Main not shown on any utility plans provided at tender. Emergency shutdown coordinated with Yarra Water. Temporary bypass installed, permanent relocation completed over 3 days. Includes Yarra Water attendance fees, traffic management, and reinstatement.',
        daysAgo: 8,
        photoCount: 5,
        hasVoice: true,
      },
      {
        title: 'Additional structural support – tunnel interface',
        status: VariationStatus.SUBMITTED,
        estimatedValue: 22100,
        instructionSource: InstructionSource.RFI_RESPONSE,
        instructionReference: 'RFI-MC-156',
        instructedBy: 'Structural engineer (John Wardle)',
        description: 'RFI response RFI-MC-156 requires additional steel framing at tunnel interface zone not shown on original structural drawings. 6 additional 250UC89.5 columns, 4 additional 360UB56.7 beams, connection plates, and high-strength bolting. Structural steel supply (2.4 tonnes), fabrication, delivery, and installation. Crane time: 2 days.',
        daysAgo: 5,
        photoCount: 4,
        hasVoice: true,
      },
      {
        title: 'Traffic management – extended duration',
        status: VariationStatus.CAPTURED,
        estimatedValue: 4500,
        instructionSource: InstructionSource.VERBAL_DIRECTION,
        instructedBy: 'RPV Site Manager',
        description: 'Verbal direction from RPV site manager to maintain traffic management setup for additional 3 days beyond programme due to delayed concrete pour by others. Includes traffic controller labour (2 persons x 3 days), signage hire extension, and VicRoads permit amendment fee.',
        daysAgo: 1,
        photoCount: 2,
        hasVoice: false,
      },
    ] as SeedVariation[],
  },
  {
    name: 'Northern Hospital – Mechanical',
    client: 'Lendlease',
    reference: 'NH-2026-M1',
    address: 'Cooper Street, Epping VIC',
    latitude: -37.6420,
    longitude: 145.0170,
    contractType: 'lump_sum' as const,
    variations: [
      {
        title: 'Rerouted chilled water – fire door conflict',
        status: VariationStatus.CAPTURED,
        estimatedValue: 9800,
        instructionSource: InstructionSource.SITE_INSTRUCTION,
        instructionReference: 'SI-NH-019',
        instructedBy: 'Lendlease PM (Sarah Brooks)',
        description: 'Site Instruction SI-NH-019 directs rerouting of 100mm chilled water supply and return pipework around new fire door location on Level 2 east wing. Original drawing showed straight run through corridor — fire door added in BCA compliance review. Additional 8m of copper pipe, 4 elbows, 2 isolation valves, insulation, and ceiling tile reinstatement.',
        daysAgo: 3,
        photoCount: 3,
        hasVoice: true,
      },
      {
        title: 'After-hours concrete pump access',
        status: VariationStatus.CAPTURED,
        estimatedValue: 3200,
        instructionSource: InstructionSource.VERBAL_DIRECTION,
        instructedBy: 'Lendlease Site Foreman',
        description: 'Verbal direction to provide after-hours plant access for concrete pump truck on Saturday 1 February. Required due to programme delay on structural works. Includes: 2 personnel for 6 hours (overtime rates), site lighting, and traffic management for truck access through live hospital car park.',
        daysAgo: 7,
        photoCount: 2,
        hasVoice: false,
      },
      {
        title: 'Additional penetration fire sealing',
        status: VariationStatus.SUBMITTED,
        estimatedValue: 2800,
        instructionSource: InstructionSource.DRAWING_REVISION,
        instructionReference: 'DWG-FP-201 Rev B',
        description: 'Drawing revision DWG-FP-201 Rev B adds 12 additional fire-rated penetration seals not shown on original mechanical drawings. Penetrations through 2-hour rated walls for HVAC ductwork and pipe services. Promat or equivalent fire collar system, licensed installer required. BCA compliance certification per penetration.',
        daysAgo: 5,
        photoCount: 4,
        hasVoice: true,
      },
    ] as SeedVariation[],
  },
];

/**
 * Check if the database already has seed data.
 */
export async function hasSeedData(): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM projects',
  );
  return (result?.count ?? 0) > 0;
}

/**
 * Seed the database with demo data.
 * Idempotent — skips if data already exists.
 */
export async function seedDatabase(): Promise<void> {
  if (await hasSeedData()) {
    console.log('[Seed] Database already has data, skipping');
    return;
  }

  console.log('[Seed] Populating demo data...');
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    for (const project of PROJECTS) {
      const projectId = generateId();
      const now = nowISO();

      await db.runAsync(
        `INSERT INTO projects (id, name, client, reference, address, latitude, longitude, contract_type, is_active, created_at, updated_at, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 'synced')`,
        projectId,
        project.name,
        project.client,
        project.reference,
        project.address,
        project.latitude,
        project.longitude,
        project.contractType,
        now,
        now,
      );

      for (let i = 0; i < project.variations.length; i++) {
        const v = project.variations[i];
        const variationId = generateId();
        const capturedDate = new Date();
        capturedDate.setDate(capturedDate.getDate() - v.daysAgo);
        const capturedAt = capturedDate.toISOString();

        // Generate a plausible evidence hash
        const evidenceHash = `sha256:${generateId().replace(/-/g, '').slice(0, 8)}...${generateId().replace(/-/g, '').slice(0, 4)}`;

        await db.runAsync(
          `INSERT INTO variations (
            id, project_id, sequence_number, title, status,
            estimated_value, instruction_source, instruction_reference,
            instructed_by, description, ai_description,
            captured_at, captured_by, latitude, longitude,
            evidence_hash, created_at, updated_at, sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
          variationId,
          projectId,
          i + 1,
          v.title,
          v.status,
          v.estimatedValue * 100, // dollars to cents
          v.instructionSource,
          v.instructionReference ?? null,
          v.instructedBy ?? null,
          v.description,
          v.description, // AI description same as description for seed data
          capturedAt,
          DEMO_USER_ID,
          project.latitude + (Math.random() - 0.5) * 0.002,
          project.longitude + (Math.random() - 0.5) * 0.002,
          evidenceHash,
          capturedAt,
          capturedAt,
        );

        // Insert mock photo records
        for (let p = 0; p < v.photoCount; p++) {
          await db.runAsync(
            `INSERT INTO photo_evidence (
              id, variation_id, local_uri, mime_type, file_size_bytes,
              width, height, latitude, longitude, captured_at,
              sha256_hash, sort_order, sync_status
            ) VALUES (?, ?, ?, 'image/jpeg', ?, 4032, 3024, ?, ?, ?, ?, ?, 'synced')`,
            generateId(),
            variationId,
            `file://demo/photo_${variationId}_${p}.jpg`,
            Math.round(2000000 + Math.random() * 3000000), // 2-5MB
            project.latitude + (Math.random() - 0.5) * 0.001,
            project.longitude + (Math.random() - 0.5) * 0.001,
            capturedAt,
            generateId().replace(/-/g, '').slice(0, 16),
            p,
          );
        }

        // Insert mock voice note if applicable
        if (v.hasVoice) {
          await db.runAsync(
            `INSERT INTO voice_notes (
              id, variation_id, local_uri, mime_type, duration_seconds,
              file_size_bytes, transcription, transcription_confidence,
              captured_at, sha256_hash, sync_status
            ) VALUES (?, ?, ?, 'audio/m4a', ?, ?, ?, 0.94, ?, ?, 'synced')`,
            generateId(),
            variationId,
            `file://demo/voice_${variationId}.m4a`,
            30 + Math.round(Math.random() * 60), // 30-90 seconds
            Math.round(500000 + Math.random() * 1500000),
            v.description, // Use description as mock transcription
            capturedAt,
            generateId().replace(/-/g, '').slice(0, 16),
          );
        }

        // Insert status change history
        await db.runAsync(
          `INSERT INTO status_changes (id, variation_id, from_status, to_status, changed_by, changed_at)
           VALUES (?, ?, NULL, 'captured', ?, ?)`,
          generateId(),
          variationId,
          DEMO_USER_ID,
          capturedAt,
        );

        // Add additional status transitions based on current status
        if ([VariationStatus.SUBMITTED, VariationStatus.APPROVED, VariationStatus.DISPUTED, VariationStatus.PAID].includes(v.status)) {
          const submittedDate = new Date(capturedDate);
          submittedDate.setDate(submittedDate.getDate() + 1);
          await db.runAsync(
            `INSERT INTO status_changes (id, variation_id, from_status, to_status, changed_by, changed_at)
             VALUES (?, ?, 'captured', 'submitted', ?, ?)`,
            generateId(),
            variationId,
            DEMO_USER_ID,
            submittedDate.toISOString(),
          );
        }
        if ([VariationStatus.APPROVED, VariationStatus.PAID].includes(v.status)) {
          const approvedDate = new Date(capturedDate);
          approvedDate.setDate(approvedDate.getDate() + 3);
          await db.runAsync(
            `INSERT INTO status_changes (id, variation_id, from_status, to_status, changed_by, changed_at, notes)
             VALUES (?, ?, 'submitted', 'approved', ?, ?, 'Approved by client representative')`,
            generateId(),
            variationId,
            'client-rep',
            approvedDate.toISOString(),
          );
        }
        if (v.status === VariationStatus.DISPUTED) {
          const disputedDate = new Date(capturedDate);
          disputedDate.setDate(disputedDate.getDate() + 2);
          await db.runAsync(
            `INSERT INTO status_changes (id, variation_id, from_status, to_status, changed_by, changed_at, notes)
             VALUES (?, ?, 'submitted', 'disputed', ?, ?, 'Client disputes standing time claim — requests additional evidence')`,
            generateId(),
            variationId,
            'client-rep',
            disputedDate.toISOString(),
          );
        }
        if (v.status === VariationStatus.PAID) {
          const paidDate = new Date(capturedDate);
          paidDate.setDate(paidDate.getDate() + 10);
          await db.runAsync(
            `INSERT INTO status_changes (id, variation_id, from_status, to_status, changed_by, changed_at, notes)
             VALUES (?, ?, 'approved', 'paid', ?, ?, 'Included in Progress Claim #7')`,
            generateId(),
            variationId,
            DEMO_USER_ID,
            paidDate.toISOString(),
          );
        }
      }
    }
  });

  console.log('[Seed] Demo data populated successfully');
}

/**
 * Clear all data and reseed. Used for "Reset Demo" in settings.
 */
export async function resetAndReseed(): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM status_changes');
    await db.execAsync('DELETE FROM voice_notes');
    await db.execAsync('DELETE FROM photo_evidence');
    await db.execAsync('DELETE FROM variations');
    await db.execAsync('DELETE FROM projects');
  });
  await seedDatabase();
}
