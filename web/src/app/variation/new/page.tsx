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

const inputClass = 'w-full px-3 py-2 text-[14px] border border-[#D8D2C4] rounded-md focus:ring-1 focus:ring-[#17212B] focus:border-[#17212B] outline-none bg-[#FFFCF5]';
const labelClass = 'block text-[11px] font-medium text-[#4B5563] uppercase tracking-[0.02em] mb-1';

function NewRequestForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProject = searchParams.get('project') || '';
  const duplicateId = searchParams.get('duplicate') || '';
  const { companyId, isLoading: roleLoading, company } = useRole();

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
  const [claimType, setClaimType] = useState<'lump_sum' | 'cost_plus' | 'schedule_of_rates' | 'time_impact_only' | 'cost_and_time'>('lump_sum');
  const [eotDays, setEotDays] = useState('');
  const [eotUnit, setEotUnit] = useState<'days' | 'hours'>('days');
  const [basisOfValuation, setBasisOfValuation] = useState('');
  const [requestorName, setRequestorName] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState<{ count: number; limit: number; totalValue: number } | null>(null);

  useEffect(() => {
    if (!roleLoading) {
      loadProjects();
      loadProfile();
    }
  }, [roleLoading]);

  async function loadProjects() {
    const supabase = createClient();
    let projectsQuery = supabase.from('projects').select('*').eq('is_active', true).order('name');
    if (companyId) projectsQuery = projectsQuery.eq('company_id', companyId);
    const { data } = await projectsQuery;
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

      // Free tier limit check
      if (companyId) {
        const companyData = company ?? (await supabase
          .from('companies')
          .select('plan, variation_count, variation_limit')
          .eq('id', companyId)
          .single()).data;

        if (companyData?.plan === 'free' && companyData.variation_limit !== null) {
          if ((companyData.variation_count || 0) >= companyData.variation_limit) {
            // Calculate total value for the conversion wall
            const { data: varData } = await supabase
              .from('variations')
              .select('estimated_value, project_id')
              .in('project_id', (await supabase.from('projects').select('id').eq('company_id', companyId)).data?.map((p: any) => p.id) || []);
            const totalValue = (varData || []).reduce((sum: number, v: any) => sum + (v.estimated_value || 0), 0);
            setSaving(false);
            setLimitReached({ count: companyData.variation_count || 0, limit: companyData.variation_limit, totalValue });
            return;
          }
        }
      }

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
        eot_days_claimed: (claimType !== 'lump_sum' && claimType !== 'cost_plus' && claimType !== 'schedule_of_rates' && eotDays) ? parseInt(eotDays) : null,
        time_implication_unit: (claimType !== 'lump_sum' && claimType !== 'cost_plus' && claimType !== 'schedule_of_rates') ? eotUnit : null,
        basis_of_valuation: basisOfValuation || null,
        status: 'draft',
        captured_at: new Date().toISOString(),
        requestor_name: reqName,
        requestor_email: reqEmail,
      });

      if (insertError) throw new Error(insertError.message);

      if (attachments.length > 0) {
        const { data: { user: upUser } } = await supabase.auth.getUser();
        for (const file of attachments) {
          const docId = crypto.randomUUID();
          const ext = file.name.split('.').pop() || 'bin';
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const storagePath = `${upUser!.id}/documents/${docId}/${safeName}`;
          const { error: uploadErr } = await supabase.storage.from('documents').upload(storagePath, file, { contentType: file.type });
          if (uploadErr) { console.error('Storage upload error:', uploadErr); continue; }
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

      // Check if we should show a banner on the next page (free tier milestones)
      if (companyId) {
        const { data: freshCompany } = await supabase
          .from('companies')
          .select('plan, variation_count, variation_limit')
          .eq('id', companyId)
          .single();
        if (freshCompany && freshCompany.plan === 'free' && freshCompany.variation_limit !== null) {
          const newCount = (freshCompany.variation_count || 0);
          if (newCount === freshCompany.variation_limit) {
            sessionStorage.setItem('vs_variation_banner', 'final');
          } else if (newCount === freshCompany.variation_limit - 1) {
            sessionStorage.setItem('vs_variation_banner', 'warning');
          }
        }
      }

      router.push(`/variation/${variationId}`);
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong. Please try again.');
      setSaving(false);
    }
  }

  const isCostOnly = claimType === 'lump_sum' || claimType === 'cost_plus' || claimType === 'schedule_of_rates';
  const showCostBreakdown = isCostOnly || claimType === 'cost_and_time';
  const showEot = claimType === 'time_impact_only' || claimType === 'cost_and_time';

  function handleExportCsv() {
    // Trigger CSV download via the export API
    const a = document.createElement('a');
    a.href = '/api/export-variations';
    a.download = 'variation-shield-export.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <AppShell>
      <TopBar title="New Variation Request" />

      {/* Conversion Wall Modal */}
      {limitReached && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111827]/60 backdrop-blur-sm p-4">
          <div className="bg-[#FFFCF5] rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#F5F2EA] flex items-center justify-center mx-auto mb-5">
              <svg width="28" height="28" fill="none" stroke="#E76F00" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <h2 className="text-xl font-medium text-[#111827] mb-2">
              You've documented {limitReached.count} variation{limitReached.count !== 1 ? 's' : ''} worth ${(limitReached.totalValue / 100).toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} — want to keep going?
            </h2>
            <p className="text-[#334155] text-sm mb-2">
              Upgrade to Pro and keep capturing — unlimited variations, projects, and team members.
            </p>
            <p className="text-[#4B5563] text-xs mb-7">
              Or export what you have and go back to spreadsheets.
            </p>
            <div className="space-y-3">
              <a
                href={`https://buy.stripe.com/3cI00j9wN8ZQ1Gs90XfrW02`}
                className="block w-full py-3 rounded-xl bg-[#E76F00] hover:bg-[#C75A00] text-[#FFFCF5] font-medium text-sm transition-colors"
              >
                Upgrade to Pro — $299/mo
              </a>
              <a
                href="https://leveragedsystems.com.au/schedule"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-3 rounded-xl border border-[#D8D2C4] text-[#334155] font-medium text-sm hover:bg-[#F5F2EA] transition-colors"
              >
                Book a Demo →
              </a>
              <button
                onClick={handleExportCsv}
                className="block w-full py-3 rounded-xl text-[#4B5563] text-sm hover:text-[#334155] transition-colors"
              >
                Export My Data
              </button>
            </div>
            <p className="text-xs text-[#4B5563] mt-5">
              Your existing {limitReached.count} variations are safe — you can still view, edit, and download them.
            </p>
          </div>
        </div>
      )}
      <div className="p-4 md:p-8 space-y-4 md:space-y-5 ">

        {/* Back + title */}
        <div>
          <Link
            href="/dashboard"
            className="hidden md:flex items-center gap-2 w-full bg-[#FFFCF5] border border-[#D8D2C4] rounded-md px-4 py-3 text-[14px] font-medium text-[#17212B] hover:bg-[#F5F2EA] active:bg-[#F5F2EA] transition-colors duration-[120ms] shadow-[0_1px_2px_rgba(17,24,39,0.04)]"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to Dashboard
          </Link>
          <h2 className="text-xl font-medium text-[#111827] mt-3">New Variation Request</h2>
          <p className="text-[13px] text-[#334155] mt-1">Pursuant to AS 4000–1997 Cl. 36 / AS 2124–1992 Cl. 40</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
          {/* Core details card */}
          <div className="bg-[#FFFCF5] rounded-md border border-[#D8D2C4] p-4 md:p-6 shadow-[0_1px_2px_rgba(17,24,39,0.04)] space-y-4">

            {/* Project */}
            <div>
              <label className={labelClass}>Project *</label>
              {loadingProjects ? (
                <div className="h-9 bg-[#F5F2EA] rounded-md animate-pulse" />
              ) : projects.length === 0 ? (
                <p className="text-[13px] text-[#334155] py-1">No active projects. <Link href="/dashboard" className="underline text-[#17212B]">Create one on the dashboard</Link>.</p>
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
            {showCostBreakdown && (
              <div>
                <label className={labelClass}>Cost Breakdown</label>
                <div className="mt-1 bg-[#FFFCF5] rounded-lg border border-[#D8D2C4] p-3">
                  <CostItemsTable
                    items={costItems}
                    onChange={setCostItems}
                    onTotalChange={cents => setEstimatedValue((cents / 100).toFixed(2))}
                  />
                </div>
                {isCostOnly && (
                  <p className="text-[12px] text-[#334155] mt-2">
                    {claimType === 'lump_sum' && "Provide a single price for the complete scope of works."}
                    {claimType === 'cost_plus' && "Break down materials, labour, and other costs. Margin applied separately."}
                    {claimType === 'schedule_of_rates' && "Apply contract schedule rates to the quantities shown."}
                  </p>
                )}
              </div>
            )}


            {/* Response due date */}
            <div>
              <label className={labelClass}>Response Due Date <span className="text-[#B42318]">*</span></label>
              <input type="date" required value={responseDueDate} onChange={e => setResponseDueDate(e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* AS Compliance card */}
          <div className="bg-[#FFFCF5] rounded-md border border-[#D8D2C4] p-4 md:p-6 shadow-[0_1px_2px_rgba(17,24,39,0.04)] space-y-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#4B5563]">Claim Details (AS 4000 / AS 2124)</p>

            {/* Claim type */}
            <div>
              <label className={labelClass}>Claim Type</label>
              <select value={claimType} onChange={e => setClaimType(e.target.value as any)} className={inputClass}>
                <option value="lump_sum">Lump Sum</option>
                <option value="cost_plus">Cost Plus</option>
                <option value="schedule_of_rates">Schedule of Rates</option>
                <option value="time_impact_only">Time Impact Only</option>
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
                    className="px-3 py-2 text-[14px] border border-[#D8D2C4] rounded-md bg-[#FFFCF5] text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#17212B]">
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
          <div className="bg-[#FFFCF5] rounded-md border border-[#D8D2C4] p-4 md:p-6 shadow-[0_1px_2px_rgba(17,24,39,0.04)]">
            <AttachmentPicker files={attachments} onChange={setAttachments} label="Photos & Files (optional)" />
          </div>

          {/* Error */}
          {error && (
            <div className="px-4 py-3 bg-[#FBE6E4] border border-[#D8D2C4] rounded-md text-[13px] text-[#7A1810]">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Link
              href="/dashboard"
              className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 text-[13px] font-medium text-[#334155] border border-[#D8D2C4] rounded-md hover:bg-[#F5F2EA] transition-colors duration-[120ms] text-center"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving || loadingProjects}
              className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 text-[13px] font-medium text-[#FFFCF5] bg-[#E76F00] hover:bg-[#C75A00] rounded-md disabled:opacity-40 transition-colors duration-[120ms] shadow-[0_1px_2px_rgba(17,24,39,0.1)] text-center"
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
    <Suspense fallback={<AppShell><TopBar title="New Variation Request" /><div className="flex items-center justify-center h-96 text-[#4B5563] text-sm">Loading…</div></AppShell>}>
      <NewRequestForm />
    </Suspense>
  );
}
