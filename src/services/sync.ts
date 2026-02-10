/**
 * Sync Service
 *
 * Manages bidirectional sync between local SQLite and cloud backend.
 * This is the engine that makes offline-first work.
 *
 * Sync strategy:
 * 1. All writes go to local SQLite first (instant, works offline)
 * 2. Background sync pushes pending changes when connectivity returns
 * 3. Pull from server for any changes made on other devices
 * 4. Conflict resolution: last-write-wins with server timestamp
 *
 * TODO: Implement actual API calls once backend is built.
 * For MVP, this is the interface — local-only storage works perfectly.
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { getDatabase } from '../db/schema';
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

/**
 * Start monitoring network connectivity.
 * Call once on app startup.
 */
export function startConnectivityMonitoring(): () => void {
  const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
    const connected = state.isConnected ?? false;
    if (connected !== currentlyConnected) {
      currentlyConnected = connected;
      listeners.forEach((l) => l(connected));

      if (connected) {
        // Connectivity restored — trigger sync
        syncPendingChanges().catch(console.error);
      }
    }
  });
  return unsubscribe;
}

// ============================================================
// SYNC OPERATIONS
// ============================================================

/**
 * Push all pending local changes to the server.
 * Called automatically when connectivity is restored,
 * and can be triggered manually by the user.
 */
export async function syncPendingChanges(): Promise<SyncResult> {
  if (!currentlyConnected) {
    return { success: false, message: 'No connectivity', synced: 0 };
  }

  const db = await getDatabase();
  let syncedCount = 0;

  try {
    // 1. Sync pending projects
    const pendingProjects = await db.getAllAsync(
      "SELECT * FROM projects WHERE sync_status = 'pending'"
    );
    for (const project of pendingProjects) {
      // TODO: POST to /api/projects
      // On success:
      // await db.runAsync("UPDATE projects SET sync_status = 'synced' WHERE id = ?", project.id);
      syncedCount++;
    }

    // 2. Sync pending variations
    const pendingVariations = await db.getAllAsync(
      "SELECT * FROM variations WHERE sync_status = 'pending'"
    );
    for (const variation of pendingVariations) {
      // TODO: POST to /api/variations
      syncedCount++;
    }

    // 3. Sync pending photo uploads
    const pendingPhotos = await db.getAllAsync(
      "SELECT * FROM photo_evidence WHERE sync_status = 'pending'"
    );
    for (const photo of pendingPhotos) {
      // TODO: Upload file to cloud storage, then POST metadata
      syncedCount++;
    }

    // 4. Sync pending voice notes
    const pendingVoice = await db.getAllAsync(
      "SELECT * FROM voice_notes WHERE sync_status = 'pending'"
    );
    for (const voice of pendingVoice) {
      // TODO: Upload file, POST metadata, trigger transcription
      syncedCount++;
    }

    return { success: true, synced: syncedCount };
  } catch (error) {
    console.error('[Sync] Failed:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      synced: syncedCount,
    };
  }
}

/**
 * Get count of items waiting to sync.
 * Shown in the UI as a sync indicator.
 */
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
// TYPES
// ============================================================

export interface SyncResult {
  success: boolean;
  message?: string;
  synced: number;
}
