/**
 * Sync Service — Phase 2
 *
 * Bidirectional sync between local SQLite and Supabase.
 * Strategy: Local-first, push pending on connectivity, pull server changes.
 * Conflict resolution: Last-write-wins with server timestamp.
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

    // ---- PUSH: Local → Server ----

    // 1. Sync pending projects
    const pendingProjects = await db.getAllAsync<any>(
      "SELECT * FROM projects WHERE sync_status = 'pending'"
    );
    for (const project of pendingProjects) {
      try {
        const { error } = await supabase.from('projects').upsert({
          id: project.id,
          user_id: userId,
          name: project.name,
          client: project.client,
          reference: project.reference,
          address: project.address,
          latitude: project.latitude,
          longitude: project.longitude,
          contract_type: project.contract_type,
          is_active: project.is_active,
          created_at: project.created_at,
          updated_at: project.updated_at,
        }, { onConflict: 'id' });

        if (!error) {
          await db.runAsync("UPDATE projects SET sync_status = 'synced' WHERE id = ?", project.id);
          pushed++;
        }
      } catch (e) {
        console.error('[Sync] Project push failed:', e);
      }
    }

    // 2. Sync pending variations
    const pendingVariations = await db.getAllAsync<any>(
      "SELECT * FROM variations WHERE sync_status = 'pending'"
    );
    for (const variation of pendingVariations) {
      try {
        const { error } = await supabase.from('variations').upsert({
          id: variation.id,
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
          evidence_hash: variation.evidence_hash,
          notes: variation.notes,
          ai_description: variation.ai_description,
          ai_transcription: variation.ai_transcription,
        }, { onConflict: 'id' });

        if (!error) {
          await db.runAsync("UPDATE variations SET sync_status = 'synced' WHERE id = ?", variation.id);
          pushed++;
        }
      } catch (e) {
        console.error('[Sync] Variation push failed:', e);
      }
    }

    // 3. Sync pending photos (metadata + file upload)
    const pendingPhotos = await db.getAllAsync<any>(
      "SELECT * FROM photo_evidence WHERE sync_status = 'pending'"
    );
    for (const photo of pendingPhotos) {
      try {
        // Upload photo file to Supabase Storage
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
        console.error('[Sync] Photo push failed:', e?.message || e, 'photo_id:', photo.id, 'local_uri:', photo.local_uri);
      }
    }

    // 4. Sync pending voice notes
    const pendingVoice = await db.getAllAsync<any>(
      "SELECT * FROM voice_notes WHERE sync_status = 'pending'"
    );
    for (const voice of pendingVoice) {
      try {
        // Upload voice file if needed
        if (voice.local_uri) {
           try {
             const fileData = await FileSystem.readAsStringAsync(voice.local_uri, { encoding: 'base64' });
             const { error: uploadError } = await supabase.storage.from('evidence').upload(`${userId}/voice/${voice.id}.m4a`, decode(fileData), {
               contentType: 'audio/m4a',
               upsert: true
             });
             if (uploadError) console.error('[Sync] Voice upload failed:', uploadError);
           } catch {
             console.log('[Sync] Voice file not found locally, skipping upload:', voice.local_uri);
           }
        }

        const { error } = await supabase.from('voice_notes').upsert({
          id: voice.id,
          variation_id: voice.variation_id,
          duration_seconds: voice.duration_seconds,
          transcription: voice.transcription,
          transcription_status: voice.transcription_status,
          sha256_hash: voice.sha256_hash,
          captured_at: voice.captured_at,
        }, { onConflict: 'id' });

        if (!error) {
          await db.runAsync("UPDATE voice_notes SET sync_status = 'synced' WHERE id = ?", voice.id);
          pushed++;
        }
      } catch (e) {
        console.error('[Sync] Voice push failed:', e);
      }
    }

    // ---- PULL: Server → Local ----
    // Fetch server records and upsert locally.
    // Skip any local record that has sync_status = 'pending' (not yet pushed).
    // Use server updated_at (or captured_at for immutable records) to avoid
    // overwriting newer local data with stale server data.

    // 1. Pull projects
    const { data: serverProjects, error: projPullErr } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId);
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
        await db.runAsync(
          `INSERT OR REPLACE INTO projects
            (id, name, client, reference, address, latitude, longitude,
             contract_type, is_active, created_at, updated_at, sync_status, remote_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
          sp.id, sp.name, sp.client, sp.reference ?? '',
          sp.address, sp.latitude, sp.longitude,
          sp.contract_type, sp.is_active ? 1 : 0,
          sp.created_at, sp.updated_at, sp.remote_id ?? null
        );
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
        await db.runAsync(
          `INSERT OR REPLACE INTO variations
            (id, project_id, sequence_number, title, description,
             instruction_source, instructed_by, reference_doc,
             estimated_value, status, captured_at, latitude, longitude,
             location_accuracy, evidence_hash, notes, sync_status,
             remote_id, ai_description, ai_transcription)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?, ?)`,
          sv.id, sv.project_id, sv.sequence_number, sv.title,
          sv.description ?? '', sv.instruction_source, sv.instructed_by ?? null,
          sv.reference_doc ?? null, sv.estimated_value ?? 0, sv.status,
          sv.captured_at, sv.latitude ?? null, sv.longitude ?? null,
          sv.location_accuracy ?? null, sv.evidence_hash ?? null,
          sv.notes ?? null, sv.remote_id ?? null,
          sv.ai_description ?? null, sv.ai_transcription ?? null
        );
        pulled++;
      }
    }

    // 3. Pull photo_evidence (immutable after capture — use captured_at)
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
            'SELECT id, sync_status FROM photo_evidence WHERE id = ?',
            sp.id
          );
          if (local?.sync_status === 'pending') continue;
          if (local) continue; // Already have it and it's synced — no updates on photos
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

      // 4. Pull voice_notes
      const { data: serverVoice, error: voicePullErr } = await supabase
        .from('voice_notes')
        .select('*')
        .in('variation_id', serverVariationIds);
      if (voicePullErr) {
        console.error('[Sync] Pull voice_notes error:', voicePullErr);
      } else if (serverVoice) {
        for (const sv of serverVoice) {
          const local = await db.getFirstAsync<any>(
            'SELECT id, sync_status FROM voice_notes WHERE id = ?',
            sv.id
          );
          if (local?.sync_status === 'pending') continue;
          if (local) continue; // Voice notes are immutable after capture
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

      // 5. Pull status_changes (append-only, no sync_status column)
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
          if (local) continue; // Already have it
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
