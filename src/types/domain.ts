/**
 * Variation Capture — Core Domain Types
 *
 * These types model the core business domain: projects, variations,
 * evidence artifacts, and the immutable evidence chain.
 *
 * Design principles:
 * - Offline-first: all IDs are UUIDs generated client-side
 * - Immutable evidence: captured artifacts get SHA-256 hashes at creation
 * - Append-only: status changes are tracked, originals never modified
 */

// ============================================================
// ENUMS
// ============================================================

export enum VariationStatus {
  /** Just captured on site — raw evidence, AI description pending or generated */
  CAPTURED = 'captured',
  /** Formally submitted to client/head contractor */
  SUBMITTED = 'submitted',
  /** Approved by client — awaiting payment */
  APPROVED = 'approved',
  /** Client disputes the claim */
  DISPUTED = 'disputed',
  /** Payment received */
  PAID = 'paid',
}

export enum InstructionSource {
  SITE_INSTRUCTION = 'site_instruction',
  RFI_RESPONSE = 'rfi_response',
  VERBAL_DIRECTION = 'verbal_direction',
  DRAWING_REVISION = 'drawing_revision',
  LATENT_CONDITION = 'latent_condition',
  EMAIL = 'email',
  OTHER = 'other',
}

export enum SyncStatus {
  /** Created or modified locally, not yet synced */
  PENDING = 'pending',
  /** Successfully synced to server */
  SYNCED = 'synced',
  /** Sync attempted but failed — will retry */
  FAILED = 'failed',
}

// ============================================================
// CORE ENTITIES
// ============================================================

export interface Project {
  id: string; // UUID, generated client-side
  name: string;
  client: string;
  reference: string; // e.g. "WT-2026-4B"
  address?: string;
  latitude?: number;
  longitude?: number;
  contractType?: 'lump_sum' | 'schedule_of_rates' | 'cost_plus' | 'design_construct';
  isActive: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string;
  syncStatus: SyncStatus;
}

export interface Variation {
  id: string; // UUID
  projectId: string;
  sequenceNumber: number; // Auto-incremented per project (VAR-001, VAR-002...)
  title: string;
  status: VariationStatus;
  estimatedValue: number; // cents, to avoid floating point
  approvedValue?: number; // cents
  instructionSource: InstructionSource;
  instructionReference?: string; // e.g. "SI-2026-052"
  instructedBy?: string; // Name of person who gave instruction
  description?: string; // AI-generated or manually entered
  aiDescription?: string; // The raw AI-generated description
  notes?: string; // User's additional notes
  capturedAt: string; // ISO 8601 — when evidence was captured on site
  capturedBy: string; // User ID
  submittedAt?: string;
  approvedAt?: string;
  latitude?: number;
  longitude?: number;
  locationAccuracy?: number; // metres
  evidenceHash: string; // SHA-256 of combined evidence artifacts
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
}

export interface PhotoEvidence {
  id: string; // UUID
  variationId: string;
  localUri: string; // file:// path on device
  remoteUri?: string; // Cloud storage URL after sync
  thumbnailUri?: string;
  mimeType: string;
  fileSizeBytes: number;
  width: number;
  height: number;
  latitude?: number;
  longitude?: number;
  capturedAt: string;
  sha256Hash: string; // Integrity hash of the original file
  sortOrder: number;
  syncStatus: SyncStatus;
}

export interface VoiceNote {
  id: string; // UUID
  variationId: string;
  localUri: string;
  remoteUri?: string;
  mimeType: string;
  durationSeconds: number;
  fileSizeBytes: number;
  transcription?: string; // Whisper transcription result
  transcriptionConfidence?: number; // 0-1
  capturedAt: string;
  sha256Hash: string;
  syncStatus: SyncStatus;
}

/**
 * Immutable log of all status changes.
 * Append-only — records are never modified or deleted.
 */
export interface StatusChange {
  id: string;
  variationId: string;
  fromStatus: VariationStatus | null; // null for initial capture
  toStatus: VariationStatus;
  changedBy: string;
  changedAt: string;
  notes?: string;
}

// ============================================================
// USER & AUTH
// ============================================================

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: 'owner' | 'foreman' | 'admin' | 'viewer';
  organisationId: string;
}

export interface Organisation {
  id: string;
  name: string;
  abn?: string; // Australian Business Number
  plan: 'starter' | 'pro' | 'enterprise';
}

// ============================================================
// VIEW MODELS (derived for UI)
// ============================================================

export interface ProjectSummary extends Project {
  variationCount: number;
  totalValue: number; // cents
  atRiskValue: number; // cents — captured + submitted + disputed
  lastCaptureAt?: string;
}

export interface VariationWithEvidence extends Variation {
  photos: PhotoEvidence[];
  voiceNote?: VoiceNote;
  statusHistory: StatusChange[];
}

// ============================================================
// CAPTURE FLOW (in-progress state)
// ============================================================

export interface CaptureInProgress {
  projectId: string;
  photos: {
    uri: string;
    width: number;
    height: number;
    latitude?: number;
    longitude?: number;
    capturedAt: string;
  }[];
  voiceNote?: {
    uri: string;
    durationSeconds: number;
    capturedAt: string;
  };
  instructionSource: InstructionSource;
  instructionReference?: string;
  instructedBy?: string;
  estimatedValue?: number; // cents
  notes?: string;
  startedAt: string;
  latitude?: number;
  longitude?: number;
}
