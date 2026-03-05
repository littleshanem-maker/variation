'use client';

import { useEffect, useState, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useRole } from '@/lib/role';
import AttachmentPicker from '@/components/AttachmentPicker';
import type { Project, Variation } from '@/lib/types';

const inputClass =
  'w-full border border-gray-300 rounded-lg px-3 py-3 text-[15px] text-[#1C1C1E] bg-white focus:outline-none focus:ring-2 focus:ring-[#1B365D]/30 focus:border-[#1B365D] placeholder:text-gray-400';
const labelClass = 'block text-sm font-medium text-[#374151] mb-1.5';
const hintClass = 'text-[11px] text-[#9CA3AF] mt-1';

function NewVariationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProject = searchParams.get('project') || '';
  const duplicateId = searchParams.get('duplicate') || '';
  const { companyId, isLoading: roleLoading } = useRole();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  // Form state
  const todayStr = new Date().toISOString().split('T')[0];

  const [projectId, setProjectId] = useState(preselectedProject);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructionSource, setInstructionSource] = useState('verbal');
  const [instructedBy, setInstructedBy] = useState('');
  const [referenceDoc, setReferenceDoc] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [responseDueDate, setResponseDueDate] = useState('');
  const [claimType, setClaimType] = useState<'cost' | 'time' | 'cost_and_time'>('cost');
  const [eotDays, setEotDays] = useState('');
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
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('is_active', true)
      .order('name');
    setProjects(data || []);
    // Auto-select: single project, or URL-preselected project
    if (!preselectedProject && data?.length === 1) setProjectId(data[0].id);
    setLoadingProjects(false);

    // If duplicating, load source variation and pre-fill
    if (duplicateId) {
      const { data: src } = await supabase
        .from('variations')
        .select('*')
        .eq('id', duplicateId)
        .single();
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
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();
    const name =
      profile?.full_name ??
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      '';
    if (name) setRequestorName(name);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!projectId) { setError('Please select a project.'); return; }
    if (!title.trim()) { setError('Please enter a title.'); return; }
    if (!description.trim()) { setError('Please describe the variation.'); return; }

    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Sequence number
      const { data: existing } = await supabase
        .from('variations')
        .select('sequence_number')
        .eq('project_id', projectId)
        .order('sequence_number', { ascending: false })
        .limit(1);
      const nextSeq = existing && existing.length > 0 ? existing[0].sequence_number + 1 : 1;
      const variationNumber = `VAR-${String(nextSeq).padStart(3, '0')}`;

      // Requestor
      let reqName: string | null = requestorName.trim() || null;
      let reqEmail: string | null = user.email || null;
      if (!reqName) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
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
        response_due_date: responseDueDate || null,
        claim_type: claimType,
        eot_days_claimed: (claimType !== 'cost' && eotDays) ? parseInt(eotDays) : null,
        basis_of_valuation: basisOfValuation || null,
        status: 'draft',
        captured_at: new Date().toISOString(),
        requestor_name: reqName,
        requestor_email: reqEmail,
      });

      if (insertError) throw new Error(insertError.message);

      // Upload attachments
      if (attachments.length > 0) {
        for (const file of attachments) {
          const docId = crypto.randomUUID();
          const storagePath = `${user.id}/documents/${docId}/${file.name}`;
          const { error: uploadErr } = await supabase.storage.from('documents').upload(storagePath, file);
          if (!uploadErr) {
            await supabase.from('documents').insert({
              id: docId,
              variation_id: variationId,
              file_name: file.name,
              file_type: file.type,
              file_size: file.size,
              storage_path: storagePath,
            });
          }
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
    <div className="min-h-screen bg-[#F8F8F6] flex flex-col">
      {/* Header */}
      <header className="bg-[#1B365D] text-white px-4 py-4 flex items-center gap-3">
        <Image
          src="/variation-shield-logo.jpg"
          alt="Variation Shield"
          width={28}
          height={28}
          className="rounded-md object-cover"
        />
        <span className="font-semibold text-[15px] tracking-tight">Quick Request</span>
        <span className="ml-auto text-white/40 text-xs">+ New Variation Request</span>
      </header>

      <div className="flex-1 flex items-start justify-center px-4 pt-8 pb-12">
        <div className="w-full max-w-lg">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <h1 className="text-lg font-semibold text-[#1C1C1E] mb-1">New Variation Request</h1>
            <p className="text-[13px] text-[#6B7280] mb-6">
              Pursuant to AS 4000–1997 Cl. 36 / AS 2124–1992 Cl. 40
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Project */}
              {loadingProjects ? (
                <div className="h-12 bg-gray-100 rounded-lg animate-pulse" />
              ) : projects.length === 0 ? (
                <div className="text-sm text-[#6B7280] py-2">
                  No active projects.{' '}
                  <Link href="/" className="underline text-[#1B365D]">Create one on the dashboard</Link>.
                </div>
              ) : projects.length === 1 ? (
                <div className="px-4 py-3 bg-[#F3F4F6] rounded-lg text-sm text-[#1C1C1E] font-medium">
                  📋 {projects[0].name}
                </div>
              ) : (
                <div>
                  <label className={labelClass}>Project <span className="text-red-500">*</span></label>
                  <select
                    value={projectId}
                    onChange={e => setProjectId(e.target.value)}
                    className={inputClass}
                    required
                  >
                    <option value="">Select a project…</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}

              {/* Title */}
              <div>
                <label className={labelClass}>Variation title <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Concrete pump delay — Level 3"
                  className={inputClass}
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className={labelClass}>Description of works <span className="text-red-500">*</span></label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Describe the variation — what was directed, where on site, circumstances"
                  className={inputClass + ' resize-none'}
                  required
                />
              </div>

              {/* Instruction Source */}
              <div>
                <label className={labelClass}>Instruction source</label>
                <select value={instructionSource} onChange={e => setInstructionSource(e.target.value)} className={inputClass}>
                  <option value="verbal">Verbal</option>
                  <option value="email">Email</option>
                  <option value="site_instruction">Site Instruction</option>
                  <option value="drawing_revision">Drawing Revision</option>
                </select>
              </div>

              {/* Instructed By */}
              <div>
                <label className={labelClass}>Instructed by</label>
                <input
                  type="text"
                  value={instructedBy}
                  onChange={e => setInstructedBy(e.target.value)}
                  placeholder="e.g. Site superintendent, engineer, client rep"
                  className={inputClass}
                />
              </div>

              {/* Reference Document */}
              <div>
                <label className={labelClass}>Reference document</label>
                <input
                  type="text"
                  value={referenceDoc}
                  onChange={e => setReferenceDoc(e.target.value)}
                  placeholder="e.g. RFI-042, Rev C drawings, Email 4 Mar 2026"
                  className={inputClass}
                />
              </div>

              {/* Estimated Value */}
              <div>
                <label className={labelClass}>Estimated value (AUD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={estimatedValue}
                  onChange={e => setEstimatedValue(e.target.value)}
                  placeholder="0.00"
                  className={inputClass}
                />
              </div>

              {/* Response Due Date */}
              <div>
                <label className={labelClass}>Response due date</label>
                <input
                  type="date"
                  value={responseDueDate}
                  onChange={e => setResponseDueDate(e.target.value)}
                  className={inputClass}
                />
                <p className={hintClass}>Date by which a response is required from the Principal/Superintendent</p>
              </div>

              {/* Divider — AS Compliance */}
              <div className="pt-2 pb-1 border-t border-gray-100">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Claim details (AS 4000 / AS 2124)</p>
              </div>

              {/* Claim Type */}
              <div>
                <label className={labelClass}>Claim type</label>
                <select
                  value={claimType}
                  onChange={e => setClaimType(e.target.value as any)}
                  className={inputClass}
                >
                  <option value="cost">Cost only</option>
                  <option value="time">Time only (EOT)</option>
                  <option value="cost_and_time">Cost & Time</option>
                </select>
              </div>

              {/* EOT Days — conditional */}
              {showEot && (
                <div>
                  <label className={labelClass}>Extension of time claimed (calendar days)</label>
                  <input
                    type="number"
                    min="0"
                    value={eotDays}
                    onChange={e => setEotDays(e.target.value)}
                    placeholder="e.g. 5"
                    className={inputClass}
                  />
                  <p className={hintClass}>Number of calendar days claimed as extension to Practical Completion</p>
                </div>
              )}

              {/* Basis of Valuation */}
              <div>
                <label className={labelClass}>Basis of valuation</label>
                <select value={basisOfValuation} onChange={e => setBasisOfValuation(e.target.value)} className={inputClass}>
                  <option value="">Select…</option>
                  <option value="agreement">By agreement with Principal/Superintendent</option>
                  <option value="contract_rates">By rates/prices in the Contract</option>
                  <option value="daywork">By daywork rates</option>
                  <option value="reasonable_rates">By reasonable rates (no applicable Contract rates)</option>
                </select>
                <p className={hintClass}>As per Clause 36.3 (AS 4000) / Clause 40.2 (AS 2124)</p>
              </div>

              {/* Attachments */}
              <div className="pt-2 pb-1 border-t border-gray-100">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-3">Attachments</p>
                <AttachmentPicker files={attachments} onChange={setAttachments} label="Photos & Files" />
              </div>

              {/* Error */}
              {error && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={saving || loadingProjects || projects.length === 0}
                className="w-full bg-[#1B365D] hover:bg-[#24466F] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl text-lg transition-colors flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <span className="animate-spin text-base">⏳</span>
                    Creating…
                  </>
                ) : (
                  'CREATE VARIATION REQUEST →'
                )}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-[#9CA3AF] mt-6">
            <Link href="/" className="hover:underline">← Back to Dashboard</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function NewVariationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Loading...</div>}>
      <NewVariationForm />
    </Suspense>
  );
}
