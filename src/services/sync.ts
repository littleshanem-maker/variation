/**
 * Sync Service — Phase 2 (FIXED)
 *
 * Bidirectional sync between local SQLite and Supabase.
 * Strategy: Local-first, push pending on connectivity, pull server changes.
 *
 * CRITICAL CHANGES from original:
 * 1. Push uses insert-or-update instead of upsert — only touches mobile-owned fields
 * 2. Pull updates existing local records when server is newer (was: skip if exists)
 * 3. New columns from web schema are pulled but never pushed
 *
 * Works fully offline without Supabase configured.
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { getDatabase } from '../db/schema';
import { config } from '../config';
import { getSupabase } from './supabase';
import { SyncStatus } from '../types/domain';

// ============================================================
// CONNECTIVITY MONITORING
// ============================================================

type ConnectivityListener = (isConnected: boolean) => void;
const listeners: ConnectivityListener[] = [];
let currentlyConnected = true;

export function onConnectivityChange(listener: ConnectivityListener): () => void {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index >= 0) listeners.splice(index, 1);
  };
}

export function isConnected(): boolean {
  return currentlyConnected;
}

export function startConnectivityMonitoring(): () => void {
  const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
    const connected = Boolean(state.isConnected);
    if (connected !== currentlyConnected) {
      currentlyConnected = connected;
      listeners.forEach((l) => l(connected));

      if (connected && config.supabase.enabled) {
        syncPendingChanges().catch(console.error);
      }
    }
  });
  return unsubscribe;
}

// ============================================================
// SYNC OPERATIONS
// ============================================================

export interface SyncResult {
  success: boolean;
  message?: string;
  pushed: number;
  pulled: number;
}

export async function syncPendingChanges(): Promise<SyncResult> {
  if (!currentlyConnected) {
    return { success: false, message: 'No connectivity', pushed: 0, pulled: 0 };
  }

  if (!config.supabase.enabled) {
    return { success: true, message: 'Cloud sync not configured — local only', pushed: 0, pulled: 0 };
  }

  const db = await getDatabase();
  let pushed = 0;
  let pulled = 0;

  try {
    const supabase = getSupabase();
    if (!supabase) {
      return { success: false, message: 'Supabase client failed', pushed: 0, pulled: 0 };
    }

    // Get current authenticated user for RLS
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id ?? null;
    console.log('[Sync] User ID:', userId ?? 'NOT AUTHENTICATED');

    // Skip sync if not authenticated — RLS will block all queries anyway
    if (!userId) {
      return { success: false, message: 'Not authenticated — sync skipped', pushed: 0, pulled: 0 };
    }

    // ---- PUSH: Local → Server ----
    // IMPORTANT: Use insert-or-update, NOT upsert.
    // Only push mobile-owned fields. Never touch web-only fields.

    // 1. Push pending projects
    const pendingProjects = await db.getAllAsync<any>(
      "SELECT * FROM projects WHERE sync_status = 'pending'"
    );
    for (const project of pendingProjects) {
      try {
        // Check if project exists on server
        const { data: existing } = await supabase
          .from('projects')
          .select('id')
          .eq('id', project.id)
          .maybeSingle();

        // Mobile-owned project fields (never include company_id — server trigger handles it)
        const mobileProjectFields = {
          name: project.name,
          client: project.client,
          reference: project.reference,
          address: project.address,
          latitude: project.latitude,
          longitude: project.longitude,
          contract_type: project.contract_type,
          is_active: project.is_active,
          updated_at: project.updated_at,
        };

        let error;
        if (existing) {
          // UPDATE — only mobile-owned fields, preserves company_id, client_email, etc.
          ({ error } = await supabase
            .from('projects')
            .update(mobileProjectFields)
            .eq('id', project.id));
        } else {
          // INSERT — new project. Server trigger auto-sets company_id.
          ({ error } = await supabase
            .from('projects')
            .insert({
              id: project.id,
              ...mobileProjectFields,
              created_at: project.created_at,
            }));
        }

        if (!error) {
          await db.runAsync("UPDATE projects SET sync_status = 'synced' WHERE id = ?", project.id);
          pushed++;
        } else {
          console.error('[Sync] Project push failed:', error);
        }
      } catch (e) {
        console.error('[Sync] Project push failed:', e);
      }
    }

    // 2. Push pending variations
    const pendingVariations = await db.getAllAsync<any>(
      "SELECT * FROM variations WHERE sync_status = 'pending'"
    );
    for (const variation of pendingVariations) {
      try {
        const { data: existing } = await supabase
          .from('variations')
          .select('id')
          .eq('id', variation.id)
          .maybeSingle();

        // Mobile-owned variation fields — everything the mobile app captures.
        // Deliberately excludes: revision_number, parent_id, cost_items, client_email,
        // cc_emails, approval_token, client_approval_*, claim_type, eot_days_claimed,
        // basis_of_valuation, time_implication_unit, response_due_date, notice_id
        const mobileVariationFields = {
          project_id: variation.project_id,
          sequence_number: variation.sequence_number,
          title: variation.title,
          description: variation.description,
          instruction_source: variation.instruction_source,
          instructed_by: variation.instructed_by,
          reference_doc: variation.reference_doc,
          estimated_value: variation.estimated_value,
          status: variation.status,
          captured_at: variation.captured_at,
          latitude: variation.latitude,
          longitude: variation.longitude,
          location_accuracy: variation.location_accuracy,
          evidence_hash: variation.evidence_hash,
          notes: variation.notes,
          ai_description: variation.ai_description,
          ai_transcription: variation.ai_transcription,
        };

        let error;
        if (existing) {
          // UPDATE — only mobile-owned fields, preserves all web-only fields
          ({ error } = await supabase
            .from('variations')
            .update(mobileVariationFields)
            .eq('id', variation.id));
        } else {
          // INSERT — new variation
          ({ error } = await supabase
            .from('variations')
            .insert({
              id: variation.id,
              ...mobileVariationFields,
            }));
        }

        if (!error) {
          await db.runAsync("UPDATE variations SET sync_status = 'synced' WHERE id = ?", variation.id);
          pushed++;
        } else {
          console.error('[Sync] Variation push failed:', error);
        }
      } catch (e) {
        console.error('[Sync] Variation push failed:', e);
      }
    }

    // 3. Push pending photos (metadata + file upload)
    const pendingPhotos = await db.getAllAsync<any>(
      "SELECT * FROM photo_evidence WHERE sync_status = 'pending'"
    );
    for (const photo of pendingPhotos) {
      try {
        if (photo.local_uri) {
           try {
             const fileData = await FileSystem.readAsStringAsync(photo.local_uri, { encoding: 'base64' });
             const { error: uploadError } = await supabase.storage.from('evidence').upload(`${userId}/photos/${photo.id}.jpg`, decode(fileData), {
               contentType: 'image/jpeg',
               upsert: true
             });
             if (uploadError) {
               console.error('[Sync] Photo upload failed:', uploadError);
             }
           } catch {
             console.log('[Sync] Photo file not found locally, skipping upload:', photo.local_uri);
           }
        }

        // Photos are immutable — upsert is safe here (no web-only fields to corrupt)
        const { error } = await supabase.from('photo_evidence').upsert({
          id: photo.id,
          variation_id: photo.variation_id,
          sha256_hash: photo.sha256_hash,
          latitude: photo.latitude,
          longitude: photo.longitude,
          width: photo.width,
          height: photo.height,
          captured_at: photo.captured_at,
        }, { onConflict: 'id' });

        if (!error) {
          await db.runAsync("UPDATE photo_evidence SET sync_status = 'synced' WHERE id = ?", photo.id);
          pushed++;
        }
      } catch (e: any) {
        console.error('[Sync] Photo push failed:', e?.message || e, 'photo_id:', photo.id);
      }
    }

    // 4. Push pending variation notices
    const pendingNotices = await db.getAllAsync<any>(
      "SELECT * FROM variation_notices WHERE sync_status = 'pending'"
    );
    for (const notice of pendingNotices) {
      try {
        const { data: existing } = await supabase
          .from('variation_notices')
          .select('id')
          .eq('id', notice.id)
          .maybeSingle();

        // Mobile-owned notice fields
        const mobileNoticeFields = {
          project_id: notice.project_id,
          notice_number: notice.notice_number,
          sequence_number: notice.sequence_number,
          event_description: notice.event_description,
          event_date: notice.event_date,
          cost_flag: notice.cost_flag,
          time_flag: notice.time_flag,
          estimated_days: notice.estimated_days,
          contract_clause: notice.contract_clause,
          issued_by_name: notice.issued_by_name,
          issued_by_email: notice.issued_by_email,
          status: notice.status,
          issued_at: notice.issued_at,
          acknowledged_at: notice.acknowledged_at,
          variation_id: notice.variation_id,
          updated_at: notice.updated_at,
        };

        let error;
        if (existing) {
          ({ error } = await supabase
            .from('variation_notices')
            .update(mobileNoticeFields)
            .eq('id', notice.id));
        } else {
          ({ error } = await supabase
            .from('variation_notices')
            .insert({
              id: notice.id,
              ...mobileNoticeFields,
              company_id: null, // server trigger or web will set this
              created_at: notice.created_at,
            }));
        }

        if (!error) {
          await db.runAsync("UPDATE variation_notices SET sync_status = 'synced' WHERE id = ?", notice.id);
          pushed++;
        }
      } catch (e) {
        console.error('[Sync] Notice push failed:', e);
      }
    }

    // 5. Push pending voice notes (immutable — upsert is safe)
    const pendingVoice = await db.getAllAsync<any>(
      "SELECT * FROM voice_notes WHERE sync_status = 'pending'"
    );
    for (const vn of pendingVoice) {
      try {
        if (vn.local_uri) {
          try {
            const fileData = await FileSystem.readAsStringAsync(vn.local_uri, { encoding: 'base64' });
            const { error: uploadError } = await supabase.storage.from('evidence').upload(`${userId}/voice/${vn.id}.m4a`, decode(fileData), {
              contentType: 'audio/mp4',
              upsert: true
            });
            if (uploadError) console.error('[Sync] Voice upload failed:', uploadError);
          } catch {
            console.log('[Sync] Voice file not found locally, skipping upload');
          }
        }

        const { error } = await supabase.from('voice_notes').upsert({
          id: vn.id,
          variation_id: vn.variation_id,
          duration_seconds: vn.duration_seconds,
          transcription: vn.transcription,
          transcription_status: vn.transcription_status,
          sha256_hash: vn.sha256_hash,
          captured_at: vn.captured_at,
        }, { onConflict: 'id' });

        if (!error) {
          await db.runAsync("UPDATE voice_notes SET sync_status = 'synced' WHERE id = ?", vn.id);
          pushed++;
        }
      } catch (e) {
        console.error('[Sync] Voice push failed:', e);
      }
    }

    // 6. Push pending status_changes (append-only — insert only, no update)
    // status_changes don't have sync_status, so push by checking if id exists on server
    const localStatusChanges = await db.getAllAsync<any>('SELECT * FROM status_changes');
    for (const sc of localStatusChanges) {
      try {
        const { data: existing } = await supabase
          .from('status_changes')
          .select('id')
          .eq('id', sc.id)
          .maybeSingle();

        if (!existing) {
          await supabase.from('status_changes').insert({
            id: sc.id,
            variation_id: sc.variation_id,
            from_status: sc.from_status,
            to_status: sc.to_status,
            changed_at: sc.changed_at,
            changed_by: sc.changed_by,
            notes: sc.notes,
          });
          pushed++;
        }
      } catch (e) {
        console.error('[Sync] Status change push failed:', e);
      }
    }

    // ---- PULL: Server → Local ----

    // 1. Pull projects
    const { data: serverProjects, error: projPullErr } = await supabase
      .from('projects')
      .select('*');
    if (projPullErr) {
      console.error('[Sync] Pull projects error:', projPullErr);
    } else if (serverProjects) {
      for (const sp of serverProjects) {
        const local = await db.getFirstAsync<any>(
          'SELECT id, updated_at, sync_status FROM projects WHERE id = ?',
          sp.id
        );
        // Skip if local record is pending (hasn't been pushed yet)
        if (local?.sync_status === 'pending') continue;
        // Skip if local is newer or same age
        if (local && local.updated_at >= sp.updated_at) continue;

        if (local) {
          // UPDATE existing local record with server data
          await db.runAsync(
            `UPDATE projects SET
              name = ?, client = ?, reference = ?, address = ?,
              latitude = ?, longitude = ?, contract_type = ?,
              is_active = ?, company_id = ?, client_email = ?,
              contract_number = ?, notice_required = ?,
              updated_at = ?, sync_status = 'synced'
            WHERE id = ?`,
            sp.name, sp.client, sp.reference ?? '',
            sp.address, sp.latitude, sp.longitude,
            sp.contract_type, sp.is_active ? 1 : 0,
            sp.company_id, sp.client_email,
            sp.contract_number, sp.notice_required ? 1 : 0,
            sp.updated_at, sp.id
          );
        } else {
          // INSERT new local record
          await db.runAsync(
            `INSERT INTO projects
              (id, name, client, reference, address, latitude, longitude,
               contract_type, is_active, company_id, client_email,
               contract_number, notice_required,
               created_at, updated_at, sync_status, remote_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
            sp.id, sp.name, sp.client, sp.reference ?? '',
            sp.address, sp.latitude, sp.longitude,
            sp.contract_type, sp.is_active ? 1 : 0,
            sp.company_id, sp.client_email,
            sp.contract_number, sp.notice_required ? 1 : 0,
            sp.created_at, sp.updated_at, null
          );
        }
        pulled++;
      }
    }

    // 2. Pull variations
    const { data: serverVariations, error: varPullErr } = await supabase
      .from('variations')
      .select('*')
      .in('project_id', (serverProjects ?? []).map((p: any) => p.id));
    if (varPullErr) {
      console.error('[Sync] Pull variations error:', varPullErr);
    } else if (serverVariations) {
      for (const sv of serverVariations) {
        const local = await db.getFirstAsync<any>(
          'SELECT id, updated_at, sync_status FROM variations WHERE id = ?',
          sv.id
        );
        if (local?.sync_status === 'pending') continue;
        if (local && local.updated_at >= sv.updated_at) continue;

        if (local) {
          // UPDATE existing — pull all fields including web-only ones for display
          await db.runAsync(
            `UPDATE variations SET
              title = ?, description = ?, instruction_source = ?,
              instructed_by = ?, reference_doc = ?, estimated_value = ?,
              status = ?, notes = ?, ai_description = ?, ai_transcription = ?,
              revision_number = ?, parent_id = ?, notice_id = ?,
              response_due_date = ?, claim_type = ?, eot_days_claimed = ?,
              basis_of_valuation = ?, time_implication_unit = ?,
              cost_items = ?, client_email = ?, cc_emails = ?,
              client_approval_response = ?, client_approval_comment = ?,
              client_approved_at = ?, client_approved_by_email = ?,
              updated_at = ?, sync_status = 'synced'
            WHERE id = ?`,
            sv.title, sv.description ?? '', sv.instruction_source,
            sv.instructed_by, sv.reference_doc, sv.estimated_value ?? 0,
            sv.status, sv.notes, sv.ai_description, sv.ai_transcription,
            sv.revision_number ?? 0, sv.parent_id, sv.notice_id,
            sv.response_due_date, sv.claim_type, sv.eot_days_claimed,
            sv.basis_of_valuation, sv.time_implication_unit,
            sv.cost_items ? JSON.stringify(sv.cost_items) : null,
            sv.client_email, sv.cc_emails,
            sv.client_approval_response, sv.client_approval_comment,
            sv.client_approved_at, sv.client_approved_by_email,
            sv.updated_at, sv.id
          );
        } else {
          // INSERT new
          await db.runAsync(
            `INSERT INTO variations
              (id, project_id, sequence_number, variation_number,
               title, description, instruction_source, instructed_by,
               reference_doc, estimated_value, status, captured_at,
               latitude, longitude, location_accuracy, evidence_hash,
               notes, ai_description, ai_transcription,
               revision_number, parent_id, notice_id,
               response_due_date, claim_type, eot_days_claimed,
               basis_of_valuation, time_implication_unit,
               cost_items, client_email, cc_emails,
               client_approval_response, client_approval_comment,
               client_approved_at, client_approved_by_email,
               sync_status, remote_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
            sv.id, sv.project_id, sv.sequence_number, sv.variation_number,
            sv.title, sv.description ?? '', sv.instruction_source,
            sv.instructed_by, sv.reference_doc, sv.estimated_value ?? 0,
            sv.status, sv.captured_at,
            sv.latitude, sv.longitude, sv.location_accuracy,
            sv.evidence_hash, sv.notes,
            sv.ai_description, sv.ai_transcription,
            sv.revision_number ?? 0, sv.parent_id, sv.notice_id,
            sv.response_due_date, sv.claim_type, sv.eot_days_claimed,
            sv.basis_of_valuation, sv.time_implication_unit,
            sv.cost_items ? JSON.stringify(sv.cost_items) : null,
            sv.client_email, sv.cc_emails,
            sv.client_approval_response, sv.client_approval_comment,
            sv.client_approved_at, sv.client_approved_by_email,
            null
          );
        }
        pulled++;
      }
    }

    // 3. Pull variation_notices
    const { data: serverNotices, error: noticesPullErr } = await supabase
      .from('variation_notices')
      .select('*')
      .in('project_id', (serverProjects ?? []).map((p: any) => p.id));
    if (noticesPullErr) {
      console.error('[Sync] Pull variation_notices error:', noticesPullErr);
    } else if (serverNotices) {
      for (const sn of serverNotices) {
        const local = await db.getFirstAsync<any>(
          'SELECT id, sync_status, updated_at FROM variation_notices WHERE id = ?',
          sn.id
        );
        if (local?.sync_status === 'pending') continue;
        if (local && local.updated_at >= sn.updated_at) continue;

        if (local) {
          await db.runAsync(
            `UPDATE variation_notices SET
              event_description = ?, event_date = ?,
              cost_flag = ?, time_flag = ?, estimated_days = ?,
              contract_clause = ?, issued_by_name = ?, issued_by_email = ?,
              status = ?, issued_at = ?, acknowledged_at = ?,
              variation_id = ?, client_email = ?, cc_emails = ?,
              response_due_date = ?, cost_items = ?, time_implication_unit = ?,
              updated_at = ?, sync_status = 'synced'
            WHERE id = ?`,
            sn.event_description, sn.event_date,
            sn.cost_flag ? 1 : 0, sn.time_flag ? 1 : 0, sn.estimated_days,
            sn.contract_clause, sn.issued_by_name, sn.issued_by_email,
            sn.status, sn.issued_at, sn.acknowledged_at,
            sn.variation_id, sn.client_email, sn.cc_emails,
            sn.response_due_date,
            sn.cost_items ? JSON.stringify(sn.cost_items) : null,
            sn.time_implication_unit,
            sn.updated_at, sn.id
          );
        } else {
          await db.runAsync(
            `INSERT INTO variation_notices
              (id, project_id, notice_number, sequence_number,
               event_description, event_date, cost_flag, time_flag,
               estimated_days, contract_clause, issued_by_name, issued_by_email,
               status, issued_at, acknowledged_at, variation_id,
               client_email, cc_emails, response_due_date,
               cost_items, time_implication_unit,
               sync_status, remote_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?, ?)`,
            sn.id, sn.project_id, sn.notice_number, sn.sequence_number,
            sn.event_description, sn.event_date,
            sn.cost_flag ? 1 : 0, sn.time_flag ? 1 : 0,
            sn.estimated_days, sn.contract_clause,
            sn.issued_by_name, sn.issued_by_email,
            sn.status, sn.issued_at, sn.acknowledged_at,
            sn.variation_id, sn.client_email, sn.cc_emails,
            sn.response_due_date,
            sn.cost_items ? JSON.stringify(sn.cost_items) : null,
            sn.time_implication_unit,
            null, sn.created_at, sn.updated_at
          );
        }
        pulled++;
      }
    }

    // 4. Pull photo_evidence (immutable — insert only)
    const serverVariationIds = (serverVariations ?? []).map((v: any) => v.id);
    if (serverVariationIds.length > 0) {
      const { data: serverPhotos, error: photoPullErr } = await supabase
        .from('photo_evidence')
        .select('*')
        .in('variation_id', serverVariationIds);
      if (photoPullErr) {
        console.error('[Sync] Pull photos error:', photoPullErr);
      } else if (serverPhotos) {
        for (const sp of serverPhotos) {
          const local = await db.getFirstAsync<any>(
            'SELECT id FROM photo_evidence WHERE id = ?',
            sp.id
          );
          if (local) continue;
          await db.runAsync(
            `INSERT OR IGNORE INTO photo_evidence
              (id, variation_id, local_uri, remote_uri, sha256_hash,
               latitude, longitude, width, height, captured_at, sync_status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
            sp.id, sp.variation_id,
            sp.local_uri ?? '', sp.remote_uri ?? null,
            sp.sha256_hash ?? '', sp.latitude ?? null, sp.longitude ?? null,
            sp.width ?? null, sp.height ?? null, sp.captured_at
          );
          pulled++;
        }
      }

      // 5. Pull voice_notes (immutable — insert only)
      const { data: serverVoice, error: voicePullErr } = await supabase
        .from('voice_notes')
        .select('*')
        .in('variation_id', serverVariationIds);
      if (voicePullErr) {
        console.error('[Sync] Pull voice_notes error:', voicePullErr);
      } else if (serverVoice) {
        for (const sv of serverVoice) {
          const local = await db.getFirstAsync<any>(
            'SELECT id FROM voice_notes WHERE id = ?',
            sv.id
          );
          if (local) continue;
          await db.runAsync(
            `INSERT OR IGNORE INTO voice_notes
              (id, variation_id, local_uri, remote_uri, duration_seconds,
               transcription, transcription_status, sha256_hash,
               captured_at, sync_status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
            sv.id, sv.variation_id,
            sv.local_uri ?? '', sv.remote_uri ?? null,
            sv.duration_seconds ?? 0, sv.transcription ?? null,
            sv.transcription_status ?? 'none', sv.sha256_hash ?? null,
            sv.captured_at
          );
          pulled++;
        }
      }

      // 6. Pull status_changes (append-only)
      const { data: serverStatusChanges, error: scPullErr } = await supabase
        .from('status_changes')
        .select('*')
        .in('variation_id', serverVariationIds);
      if (scPullErr) {
        console.error('[Sync] Pull status_changes error:', scPullErr);
      } else if (serverStatusChanges) {
        for (const sc of serverStatusChanges) {
          const local = await db.getFirstAsync<any>(
            'SELECT id FROM status_changes WHERE id = ?',
            sc.id
          );
          if (local) continue;
          await db.runAsync(
            `INSERT OR IGNORE INTO status_changes
              (id, variation_id, from_status, to_status, changed_at, changed_by, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            sc.id, sc.variation_id, sc.from_status ?? null,
            sc.to_status, sc.changed_at, sc.changed_by ?? null, sc.notes ?? null
          );
          pulled++;
        }
      }
    }

    return { success: true, pushed, pulled };
  } catch (error) {
    console.error('[Sync] Failed:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      pushed,
      pulled,
    };
  }
}

export async function getPendingSyncCount(): Promise<number> {
  const db = await getDatabase();
  const tables = ['projects', 'variations', 'photo_evidence', 'voice_notes', 'variation_notices'];
  let total = 0;
  for (const table of tables) {
    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${table} WHERE sync_status = 'pending'`
    );
    total += result?.count ?? 0;
  }
  return total;
}
