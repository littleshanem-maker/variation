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
  logo_url?: string;
  created_at: string;
  updated_at: string;
}

export interface CompanyMembership {
  id: string;
  company_id: string;
  user_id: string;
  role: UserRole;
  is_active: boolean;
  invited_at: string;
  accepted_at?: string;
  company?: Company;
}

export interface Invitation {
  id: string;
  company_id: string;
  email: string;
  role: UserRole;
  token: string;
  expires_at: string;
  accepted_at?: string;
  created_at: string;
  company?: Company;
}

// ============================================================
// CORE ENTITIES
// ============================================================

export interface Project {
  id: string;
  company_id: string;
  created_by: string;
  name: string;
  client: string;
  reference: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  contract_type?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Variation {
  id: string;
  project_id: string;
  sequence_number: number;
  variation_number?: string; // VAR-001 format, derived from sequence_number if not stored
  title: string;
  description: string;
  instruction_source: string;
  instructed_by?: string;
  reference_doc?: string;
  estimated_value: number; // cents
  status: string;
  captured_at: string;
  latitude?: number;
  longitude?: number;
  evidence_hash?: string;
  notes?: string;
  requestor_name?: string;
  requestor_email?: string;
  ai_description?: string;
  ai_transcription?: string;
  created_at: string;
  updated_at: string;
}

export interface PhotoEvidence {
  id: string;
  variation_id: string;
  remote_uri?: string;
  sha256_hash: string;
  latitude?: number;
  longitude?: number;
  width?: number;
  height?: number;
  captured_at: string;
}

export interface VoiceNote {
  id: string;
  variation_id: string;
  remote_uri?: string;
  duration_seconds: number;
  transcription?: string;
  transcription_status: string;
  sha256_hash?: string;
  captured_at: string;
}

export interface StatusChange {
  id: string;
  variation_id: string;
  from_status?: string;
  to_status: string;
  changed_at: string;
  changed_by?: string;
  notes?: string;
}

export interface Document {
  id: string;
  variation_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  uploaded_at: string;
}

export interface ProjectWithStats extends Project {
  variation_count: number;
  total_value: number;
  at_risk_value: number;
}
