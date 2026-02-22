export interface Project {
  id: string;
  user_id: string;
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

export interface ProjectWithStats extends Project {
  variation_count: number;
  total_value: number;
  at_risk_value: number;
}
