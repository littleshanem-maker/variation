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
  preferred_standard?: 'AS4000' | 'AS2124' | 'both';
  plan?: 'free' | 'pro';
  variation_count?: number;
  variation_limit?: number | null;
  project_limit?: number | null;
  upgraded_at?: string | null;
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
  contract_number?: string;
  is_active: boolean;
  notice_required?: boolean;
  client_email?: string;
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
  cost_items?: Array<{ id: string; description: string; qty: number | ''; unit: string; rate: number | ''; total: number }>;
  time_implication_unit?: 'hours' | 'days' | null;
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
  notice_id?: string;  // FK to variation_notices, null if notice skipped
  revision_number?: number; // 0 = original, 1 = Rev 1, 2 = Rev 2 etc.
  parent_id?: string;       // FK to parent variation, null for originals
  response_due_date?: string;   // ISO date (YYYY-MM-DD) — user-set response deadline
  claim_type?: 'lump_sum' | 'cost_plus' | 'schedule_of_rates' | 'time_impact_only' | 'cost_and_time';
  eot_days_claimed?: number;
  basis_of_valuation?: 'agreement' | 'contract_rates' | 'daywork' | 'reasonable_rates';
  client_email?: string;
  cc_emails?: string;
  approval_token?: string;
  approval_token_expires_at?: string;
  client_approval_response?: 'approved' | 'rejected' | null;
  client_approval_comment?: string | null;
  client_approved_at?: string | null;
  client_approved_by_email?: string | null;
  created_at: string;
  updated_at: string;
}

export interface VariationNotice {
  id: string;
  project_id: string;
  company_id: string;
  notice_number: string;        // VN-001 format
  sequence_number: number;
  event_description: string;
  event_date: string;           // ISO date string
  cost_flag: boolean;
  cost_items?: Array<{ id: string; description: string; qty: number | ''; unit: string; rate: number | ''; total: number }>;
  time_flag: boolean;
  estimated_days?: number;
  time_implication_unit?: 'hours' | 'days' | null;
  contract_clause?: string;
  issued_by_name?: string;
  issued_by_email?: string;
  revision_number?: number;
  status: 'draft' | 'issued' | 'acknowledged';
  issued_at?: string;
  acknowledged_at?: string;
  response_due_date?: string; // ISO date (YYYY-MM-DD)
  client_email?: string;   // comma-separated TO addresses
  cc_emails?: string;      // comma-separated CC addresses
  created_at: string;
  updated_at: string;
}

export interface VariationRequestRevision {
  id: string;
  variation_id: string;
  revision_number: number;
  title?: string;
  description?: string;
  estimated_value?: number;
  cost_items?: Array<{ id: string; description: string; qty: number | ''; unit: string; rate: number | ''; total: number }>;
  status?: string;
  client_email?: string;
  response_due_date?: string;
  sent_to?: string;
  sent_cc?: string;
  sent_at?: string;
}

export interface NoticeRevision {
  id: string;
  notice_id: string;
  revision_number: number;
  event_description?: string;
  event_date?: string;
  contract_clause?: string;
  issued_by_name?: string;
  issued_by_email?: string;
  time_flag?: boolean;
  estimated_days?: number;
  time_implication_unit?: string;
  cost_flag?: boolean;
  cost_items?: Array<{ id: string; description: string; qty: number | ''; unit: string; rate: number | ''; total: number }>;
  sent_to?: string;
  sent_cc?: string;
  sent_at?: string;
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
  variation_id?: string;
  notice_id?: string;
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
