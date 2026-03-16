'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useRole } from '@/lib/role';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import AttachmentPicker from '@/components/AttachmentPicker';
import CostItemsTable, { type CostItem } from '@/components/CostItemsTable';
import type { Project } from '@/lib/types';
import ProjectPicker from '@/components/ui/ProjectPicker';

const inputClass = 'w-full px-3 py-2 text-[14px] border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#1B365D] focus:border-[#1B365D] outline-none bg-white';
const labelClass = 'block text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] mb-1';

function NewRequestForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProject = searchParams.get('project') || '';
  const duplicateId = searchParams.get('duplicate') || '';
  const { companyId, isLoading: roleLoading } = useRole();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  // Form fields
  const [projectId, setProjectId] = useState(preselectedProject);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructionSource, setInstructionSource] = useState('verbal');
  const [instructedBy, setInstructedBy] = useState('');
  const [referenceDoc, setReferenceDoc] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [costItems, setCostItems] = useState<CostItem[]>([]);
  const [responseDueDate, setResponseDueDate] = useState('');
  const [claimType, setClaimType] = useState<'cost' | 'time' | 'cost_and_time'>('cost');
  const [eotDays, setEotDays] = useState('');
  const [eotUnit, setEotUnit] = useState<'days' | 'hours'>('days');
  const [basisOfValuation, setBasisOfValuation] = useState('');
  const [requestorName, setRequestorName] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roleLoading && companyId) {
      loadProjects();
      loadProfile();
    }
  }, [roleLoading, companyId]);

  async function loadProjects() {
    const supabase = createClient();
    const { data } = await supabase.from('projects').select('*').eq('is_active', true).order('name');
    setProjects(data || []);
    if (!preselectedProject && data?.length === 1) setProjectId(data[0].id);
    setLoadingProjects(false);

    if (duplicateId) {
      const { data: src } = await supabase.from('variations').select('*').eq('id', duplicateId).single();
      if (src) {
        setProjectId(src.project_id);
        setTitle(`${src.title} (copy)`);
        setDescription(src.description || src.ai_description || '');
        setInstructionSource(src.instruction_source || 'verbal');
        setInstructedBy(src.instructed_by || '');
        setReferenceDoc(src.reference_doc || '');
        setEstimatedValue(src.estimated_value ? (src.estimated_value / 100).toFixed(2) : '');
      }
    }
  }

  async function loadProfile() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
    const name = profile?.full_name ?? (user.user_metadata?.full_name as string) ?? (user.user_metadata?.name as string) ?? '';
    if (name) setRequestorName(name);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!projectId) { setError('Please select a project.'); return; }
    if (!title.trim()) { setError('Please enter a title.'); return; }
    if (!description.trim()) { setError('Please describe the variation.'); return; }
    if (!responseDueDate) { setError('Please set a response due date.'); return; }

    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: existing } = await supabase
        .from('variations').select('sequence_number')
        .eq('project_id', projectId)
        .order('sequence_number', { ascending: false }).limit(1);
      const nextSeq = existing && existing.length > 0 ? existing[0].sequence_number + 1 : 1;
      const variationNumber = `VAR-${String(nextSeq).padStart(3, '0')}`;

      let reqName: string | null = requestorName.trim() || null;
      const reqEmail: string | null = user.email || null;
      if (!reqName) {
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
        reqName = profile?.full_name ?? (user.user_metadata?.full_name as string) ?? null;
      }

      const valueCents = estimatedValue ? Math.round(parseFloat(estimatedValue) * 100) : 0;
      const variationId = crypto.randomUUID();

      const { error: insertError } = await supabase.from('variations').insert({
        id: variationId,
        project_id: projectId,
        sequence_number: nextSeq,
        variation_number: variationNumber,
        title: title.trim(),
        description: description.trim(),
        instruction_source: instructionSource,
        instructed_by: instructedBy.trim() || null,
        reference_doc: referenceDoc.trim() || null,
        estimated_value: valueCents,
        cost_items: costItems,
        response_due_date: responseDueDate || null,
        claim_type: claimType,
        eot_days_claimed: (claimType !== 'cost' && eotDays) ? parseInt(eotDays) : null,
        time_implication_unit: claimType !== 'cost' ? eotUnit : null,
        basis_of_valuation: basisOfValuation || null,
        status: 'draft',
        captured_at: new Date().toISOString(),
        requestor_name: reqName,
        requestor_email: reqEmail,
      });

      if (insertError) throw new Error(insertError.message);

      if (attachments.length > 0) {
        for (const file of attachments) {
          const docId = crypto.randomUUID();
          const ext = file.name.split('.').pop() || 'bin';
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const storagePath = `variations/${variationId}/${Date.now()}-${safeName}`;
          const { error: uploadErr } = await supabase.storage.from('documents').upload(storagePath, file, { contentType: file.type });
          if (uploadErr) {
            console.error('Storage upload error:', uploadErr);
            continue;
          }
          const { error: docErr } = await supabase.from('documents').insert({
            id: docId,
            variation_id: variationId,
            file_name: file.name,
            file_type: file.type || `application/${ext}`,
            file_size: file.size,
            storage_path: storagePath,
            uploaded_at: new Date().toISOString(),
          });
          if (docErr) console.error('Document insert error:', docErr);
        }
      }

      router.push(`/variation/${variationId}`);
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong. Please try again.');
      setSaving(false);
    }
  }

  const showEot = claimType === 'time' || claimType === 'cost_and_time';

  return (
    <AppShell>
      <TopBar title="New Variation Request" />
      <div className="p-4 md:p-8 space-y-4 md:space-y-5 max-w-2xl">

        {/* Back + title */}
        <div>
          <Link
            href="/"
            className="hidden md:flex items-center gap-2 w-full bg-white border border-[#E5E7EB] rounded-md px-4 py-3 text-[14px] font-semibold text-[#1B365D] hover:bg-[#F0F4FA] active:bg-[#E8EFF8] transition-colors duration-[120ms] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to Dashboard
          </Link>
          <h2 className="text-xl font-semibold text-[#1C1C1E] mt-3">New Variation Request</h2>
          <p className="text-[13px] text-[#6B7280] mt-1">Pursuant to AS 4000–1997 Cl. 36 / AS 2124–1992 Cl. 40</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
          {/* Core details card */}
          <div className="bg-white rounded-md border border-[#E5E7EB] p-4 md:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] space-y-4">

            {/* Project */}
            <div>
              <label className={labelClass}>Project *</label>
              {loadingProjects ? (
                <div className="h-9 bg-slate-100 rounded-md animate-pulse" />
              ) : projects.length === 0 ? (
                <p className="text-[13px] text-[#6B7280] py-1">No active projects. <Link href="/" className="underline text-[#1B365D]">Create one on the dashboard</Link>.</p>
              ) : projects.length === 1 ? (
                <div className="px-3 py-2 bg-slate-50 rounded-md text-[14px] text-[#1C1C1E] font-medium border border-[#E5E7EB]">
                  {projects[0].name}
                </div>
              ) : (
                <ProjectPicker
                  projects={projects}
                  value={projectId}
                  onChange={setProjectId}
                  required
                />
              )}
            </div>

            {/* Title */}
            <div>
              <label className={labelClass}>Variation Title *</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Concrete pump delay — Level 3" className={inputClass} required />
            </div>

            {/* Description */}
            <div>
              <label className={labelClass}>Description of Works *</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                rows={4} placeholder="Describe the variation — what was directed, where on site, circumstances"
                className={inputClass + ' resize-none'} required />
            </div>

            {/* Instruction source + Instructed by */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Instruction Source</label>
                <select value={instructionSource} onChange={e => setInstructionSource(e.target.value)} className={inputClass}>
                  <option value="verbal">Verbal</option>
                  <option value="email">Email</option>
                  <option value="site_instruction">Site Instruction</option>
                  <option value="drawing_revision">Drawing Revision</option>
                  <option value="rfi">RFI</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Instructed By</label>
                <input type="text" value={instructedBy} onChange={e => setInstructedBy(e.target.value)}
                  placeholder="e.g. Site superintendent" className={inputClass} />
              </div>
            </div>

            {/* Reference doc */}
            <div>
              <label className={labelClass}>Reference Document</label>
              <input type="text" value={referenceDoc} onChange={e => setReferenceDoc(e.target.value)}
                placeholder="e.g. RFI-042, Email 4 Mar 2026" className={inputClass} />
            </div>

            {/* Cost breakdown */}
            {claimType !== 'time' && (
              <div>
                <label className={labelClass}>Cost Breakdown</label>
                <div className="mt-1 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB] p-3">
                  <CostItemsTable
                    items={costItems}
                    onChange={setCostItems}
                    onTotalChange={cents => setEstimatedValue((cents / 100).toFixed(2))}
                  />
                </div>

              </div>
            )}


            {/* Response due date */}
            <div>
              <label className={labelClass}>Response Due Date <span className="text-red-500">*</span></label>
              <input type="date" required value={responseDueDate} onChange={e => setResponseDueDate(e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* AS Compliance card */}
          <div className="bg-white rounded-md border border-[#E5E7EB] p-4 md:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">Claim Details (AS 4000 / AS 2124)</p>

            {/* Claim type */}
            <div>
              <label className={labelClass}>Claim Type</label>
              <select value={claimType} onChange={e => setClaimType(e.target.value as any)} className={inputClass}>
                <option value="cost">Cost only</option>
                <option value="time">Time only (EOT)</option>
                <option value="cost_and_time">Cost & Time</option>
              </select>
            </div>

            {showEot && (
              <div>
                <label className={labelClass}>Time Implication</label>
                <div className="flex gap-2">
                  <input type="number" min="0" value={eotDays} onChange={e => setEotDays(e.target.value)}
                    placeholder="e.g. 5" className={`${inputClass} flex-1`} />
                  <select value={eotUnit} onChange={e => setEotUnit(e.target.value as 'days' | 'hours')}
                    className="px-3 py-2 text-[14px] border border-[#E5E7EB] rounded-md bg-white text-[#1C1C1E] focus:outline-none focus:ring-1 focus:ring-[#1B365D]">
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                </div>
              </div>
            )}

            {/* Basis of valuation */}
            <div>
              <label className={labelClass}>Basis of Valuation</label>
              <select value={basisOfValuation} onChange={e => setBasisOfValuation(e.target.value)} className={inputClass}>
                <option value="">Select…</option>
                <option value="agreement">By agreement with Principal/Superintendent</option>
                <option value="contract_rates">By rates/prices in the Contract</option>
                <option value="daywork">By daywork rates</option>
                <option value="reasonable_rates">By reasonable rates (no applicable Contract rates)</option>
              </select>
            </div>
          </div>

          {/* Attachments card */}
          <div className="bg-white rounded-md border border-[#E5E7EB] p-4 md:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <AttachmentPicker files={attachments} onChange={setAttachments} label="Photos & Files (optional)" />
          </div>

          {/* Error */}
          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-md text-[13px] text-red-700">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Link
              href="/"
              className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 text-[13px] font-medium text-[#6B7280] border border-[#E5E7EB] rounded-md hover:bg-[#F5F3EF] transition-colors duration-[120ms] text-center"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving || loadingProjects}
              className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 text-[13px] font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-40 transition-colors duration-[120ms] shadow-[0_1px_2px_rgba(0,0,0,0.1)] text-center"
            >
              {saving ? 'Creating…' : 'Create Variation Request'}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

export default function NewVariationPage() {
  return (
    <Suspense fallback={<AppShell><TopBar title="New Variation Request" /><div className="flex items-center justify-center h-96 text-slate-400 text-sm">Loading…</div></AppShell>}>
      <NewRequestForm />
    </Suspense>
  );
}
