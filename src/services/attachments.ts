/**
 * Attachments Service
 *
 * Document picking, persistent storage, opening, and display helpers.
 */

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { hashFile } from './evidenceChain';
import { generateId } from '../utils/helpers';

export interface PickedAttachment {
  id: string;
  uri: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  hash: string;
}

export async function pickAttachment(): Promise<PickedAttachment | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];

  // Copy to persistent app storage so cache clearing doesn't lose the file
  const destDir = FileSystem.documentDirectory + 'attachments/';
  await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
  const safeFileName = asset.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const destUri = destDir + generateId() + '_' + safeFileName;
  await FileSystem.copyAsync({ from: asset.uri, to: destUri });

  const hash = await hashFile(destUri).catch(() => 'hash-failed');

  return {
    id: generateId(),
    uri: destUri,
    fileName: asset.name,
    fileSize: asset.size ?? undefined,
    mimeType: asset.mimeType ?? undefined,
    hash,
  };
}

export async function openAttachment(localUri: string): Promise<void> {
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(localUri);
  }
}

export function getFileIcon(mimeType?: string): string {
  if (!mimeType) return 'document-outline';
  if (mimeType.includes('pdf')) return 'document-text-outline';
  if (mimeType.includes('image')) return 'image-outline';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'document-outline';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'grid-outline';
  if (mimeType.includes('email') || mimeType.includes('message')) return 'mail-outline';
  return 'attach-outline';
}

export function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
