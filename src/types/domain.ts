/**
 * Domain Types
 *
 * Core data model for Variation Shield.
 * All monetary values stored in cents to avoid floating-point issues.
 */

// ============================================================
// ENUMS
// ============================================================

export enum VariationStatus {
  DRAFT = 'draft',
  CAPTURED = 'captured', // legacy alias for draft — kept for backward compat
  SUBMITTED = 'submitted',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  DISPUTED = 'disputed',
  PAID = 'paid',
}

export enum SyncStatus {
  PENDING = 'pending',
  SYNCED = 'synced',
  FAILED = 'failed',
}

export enum InstructionSource {
  VERBAL = 'verbal_direction',
  SITE_INSTRUCTION = 'site_instruction',
  RFI = 'rfi_response',
  DRAWING = 'drawing_revision',
  LATENT = 'latent_condition',
  DELAY = 'delay_claim',
}

export enum ContractType {
  LUMP_SUM = 'lump_sum',
  SCHEDULE_OF_RATES = 'schedule_of_rates',
  COST_PLUS = 'cost_plus',
  DESIGN_AND_CONSTRUCT = 'design_and_construct',
}

// ============================================================
// CORE ENTITIES
// ============================================================

export interface Project {
  id: string;
  name: string;
  client: string;
  reference: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  contractType?: ContractType;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
  remoteId?: string;
}

export interface Variation {
  id: string;
  projectId: string;
  sequenceNumber: number;
  variationNumber: string; // VAR-001 format, derived from sequenceNumber
  title: string;
  description: string;
  instructionSource: InstructionSource;
  instructedBy?: string;
  referenceDoc?: string;
  estimatedValue: number; // cents
  status: VariationStatus;
  capturedAt: string;
  latitude?: number;
  longitude?: number;
  locationAccuracy?: number;
  evidenceHash?: string;
  notes?: string;
  syncStatus: SyncStatus;
  remoteId?: string;
  // Requestor info (who captured/submitted this variation)
  requestorName?: string;
  requestorEmail?: string;
  // AI-generated fields
  aiDescription?: string;
  aiTranscription?: string;
}

export interface PhotoEvidence {
  id: string;
  variationId: string;
  localUri: string;
  remoteUri?: string;
  sha256Hash: string;
  latitude?: number;
  longitude?: number;
  width?: number;
  height?: number;
  capturedAt: string;
  syncStatus: SyncStatus;
}

export interface VoiceNote {
  id: string;
  variationId: string;
  localUri: string;
  remoteUri?: string;
  durationSeconds: number;
  transcription?: string;
  transcriptionStatus: 'none' | 'pending' | 'complete' | 'failed';
  sha256Hash?: string;
  capturedAt: string;
  syncStatus: SyncStatus;
}

export interface StatusChange {
  id: string;
  variationId: string;
  fromStatus: VariationStatus | null;
  toStatus: VariationStatus;
  changedAt: string;
  changedBy?: string;
  notes?: string;
}

export interface VariationNotice {
  id: string;
  projectId: string;
  noticeNumber: string;
  sequenceNumber: number;
  eventDescription: string;
  eventDate: string;
  costFlag: boolean;
  timeFlag: boolean;
  estimatedDays?: number;
  contractClause?: string;
  issuedByName?: string;
  issuedByEmail?: string;
  status: 'draft' | 'issued' | 'acknowledged';
  issuedAt?: string;
  acknowledgedAt?: string;
  variationId?: string;
  syncStatus: string;
  remoteId?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// VIEW MODELS
// ============================================================

export interface ProjectSummary extends Project {
  variationCount: number;
  fieldVariationCount: number;
  totalValue: number;
  atRiskValue: number;
  lastCaptureAt?: string;
}

export interface VariationDetail extends Variation {
  photos: PhotoEvidence[];
  voiceNotes: VoiceNote[];
  statusHistory: StatusChange[];
  projectName?: string;
}

// ============================================================
// ROLES & MULTI-TENANCY
// ============================================================

export type UserRole = 'admin' | 'office' | 'field';

export interface Company {
  id: string;
  name: string;
  abn?: string;
  address?: string;
  phone?: string;
  logoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyMembership {
  id: string;
  companyId: string;
  userId: string;
  role: UserRole;
  isActive: boolean;
  invitedAt: string;
  acceptedAt?: string;
  company?: Company;
}

export interface Invitation {
  id: string;
  companyId: string;
  email: string;
  role: UserRole;
  token: string;
  expiresAt: string;
  acceptedAt?: string;
  createdAt: string;
  company?: Company;
}

// ============================================================
// AUTH
// ============================================================

export interface UserProfile {
  id: string;
  email: string;
  fullName?: string;
  memberships: CompanyMembership[];
  activeCompanyId?: string;
  activeRole?: UserRole;
  createdAt: string;
}

export interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}
