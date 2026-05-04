/**
 * Generate a content hash for variation change detection.
 * Used to determine if revision_number should increment on resubmit.
 *
 * Only tracks fields that represent the "substance" of the variation.
 * Status, timestamps, emails, and approval metadata are excluded.
 */

const TRACKED_FIELDS = [
  'title',
  'description',
  'instruction_source',
  'instructed_by',
  'reference_doc',
  'estimated_value',
  'cost_items',
  'eot_days_claimed',
  'claim_type',
  'response_due_date',
  'basis_of_valuation',
] as const;

export async function computeContentHash(variation: Record<string, unknown>): Promise<string> {
  const payload: Record<string, unknown> = {};
  for (const field of TRACKED_FIELDS) {
    const val = variation[field];
    payload[field] = val != null ? JSON.stringify(val) : null;
  }
  const jsonStr = JSON.stringify(payload, Object.keys(payload).sort());
  const encoder = new TextEncoder();
  const data = encoder.encode(jsonStr);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
