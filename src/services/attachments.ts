/**
 * Attachments Service
 *
 * Document picking, persistent storage, opening, and display helpers.
 * Works on both native (expo-file-system) and web (browser File API).
 */

import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Crypto from 'expo-crypto';
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

// ── Web helpers ──────────────────────────────────────────────

function pickFileWeb(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '*/*';
    input.onchange = () => {
      const file = input.files?.[0] ?? null;
      resolve(file);
    };
    // User cancelled
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

function readFileAsBase64Web(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data URL prefix to get raw base64
      const base64 = result.split(',')[1] ?? result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fileToObjectUrl(file: File): string {
  return URL.createObjectURL(file);
}

// ── Cross-platform picker ────────────────────────────────────

export async function pickAttachment(): Promise<PickedAttachment | null> {
  if (Platform.OS === 'web') {
    return pickAttachmentWeb();
  }
  return pickAttachmentNative();
}

async function pickAttachmentWeb(): Promise<PickedAttachment | null> {
  const file = await pickFileWeb();
  if (!file) return null;

  const base64 = await readFileAsBase64Web(file);
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    base64,
  ).catch(() => 'hash-failed');

  // Use object URL as the "local URI" on web
  const uri = fileToObjectUrl(file);

  return {
    id: generateId(),
    uri,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || undefined,
    hash,
  };
}

async function pickAttachmentNative(): Promise<PickedAttachment | null> {
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
  if (Platform.OS === 'web') {
    window.open(localUri, '_blank');
    return;
  }
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
