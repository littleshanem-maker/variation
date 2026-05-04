/**
 * Dedup variations to show only the latest revision per variation.
 *
 * The variations table can have multiple rows per VAR number when revisions exist
 * (e.g., VAR-003 Rev 0 and VAR-003 Rev 1). This function keeps only the row with
 * the highest revision_number for each (project_id, sequence_number) pair.
 *
 * Use this in every list/register/dashboard query that reads from the variations table.
 * Alternatively, queries can read from the `latest_variations` Supabase view (migration 044)
 * which does the same thing server-side.
 */
export function dedupeToLatestRevision<
  T extends { project_id: string; sequence_number: number; revision_number?: number }
>(variations: T[]): T[] {
  const latest = new Map<string, T>();
  for (const v of variations) {
    const key = `${v.project_id}:${v.sequence_number}`;
    const existing = latest.get(key);
    if (!existing || (v.revision_number ?? 0) > (existing.revision_number ?? 0)) {
      latest.set(key, v);
    }
  }
  return Array.from(latest.values());
}
