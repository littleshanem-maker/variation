'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase';
import { formatNoticeNumber } from '@/lib/utils';
import { useRole } from '@/lib/role';
import type { Project } from '@/lib/types';

function NewNoticeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProjectId = searchParams.get('projectId');
  const { companyId } = useRole();

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(preselectedProjectId || '');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [eventDescription, setEventDescription] = useState('');
  const [costFlag, setCostFlag] = useState(true);
  const [timeFlag, setTimeFlag] = useState(false);
  const [estimatedDays, setEstimatedDays] = useState('');
  const [contractClause, setContractClause] = useState('');
  const [issuedByName, setIssuedByName] = useState('');
  const [issuedByEmail, setIssuedByEmail] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: projs } = await supabase
        .from('projects')
        .select('*')
        .eq('is_active', true)
        .order('name');
      setProjects(projs || []);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setIssuedByEmail(user.email || '');
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        const fullName =
          profile?.full_name ??
          (user.user_metadata?.full_name as string | undefined) ??
          (user.user_metadata?.name as string | undefined) ??
          '';
        setIssuedByName(fullName);
      }
    }
    load();
  }, []);

  async function handleSave(issueImmediately: boolean) {
    if (!projectId || !eventDescription.trim() || !companyId) return;
    setSaving(true);

    const supabase = createClient();

    const { data: existing } = await supabase
      .from('variation_notices')
      .select('sequence_number')
      .eq('project_id', projectId)
      .order('sequence_number', { ascending: false })
      .limit(1);

    const nextSeq = existing && existing.length > 0 ? existing[0].sequence_number + 1 : 1;
    const noticeNumber = formatNoticeNumber(nextSeq);
    const nowIso = new Date().toISOString();

    const { data: inserted, error } = await supabase
      .from('variation_notices')
      .insert({
        project_id: projectId,
        company_id: companyId,
        notice_number: noticeNumber,
        sequence_number: nextSeq,
        event_description: eventDescription.trim(),
        event_date: eventDate,
        cost_flag: costFlag,
        time_flag: timeFlag,
        estimated_days: timeFlag && estimatedDays ? parseInt(estimatedDays) : null,
        contract_clause: contractClause.trim() || null,
        issued_by_name: issuedByName.trim() || null,
        issued_by_email: issuedByEmail.trim() || null,
        status: issueImmediately ? 'issued' : 'draft',
        issued_at: issueImmediately ? nowIso : null,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select()
      .single();

    if (!error && inserted) {
      router.push(`/notice/${inserted.id}`);
    } else {
      console.error('Failed to create notice:', error);
    }
    setSaving(false);
  }

  const inputClass = "w-full px-3 py-2 text-[14px] border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#1B365D] focus:border-[#1B365D] outline-none";
  const labelClass = "block text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] mb-1";
  const toggleBase = "relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors duration-200 cursor-pointer";

  return (
    <AppShell>
      <TopBar title="New Variation Notice" />
      <div className="p-4 md:p-8 space-y-4 md:space-y-5 max-w-2xl">
        <div>
          <Link
            href={preselectedProjectId ? `/project/${preselectedProjectId}` : '/'}
            className="text-[12px] text-[#1B365D] hover:text-[#24466F] font-medium transition-colors duration-[120ms]"
          >
            ← {preselectedProjectId ? 'Back to Project' : 'Back to Dashboard'}
          </Link>
          <h2 className="text-xl font-semibold text-[#1C1C1E] mt-3">New Variation Notice</h2>
          <p className="text-[13px] text-[#6B7280] mt-1">Issue a formal notice of a variation event. A full Variation Request can be linked later.</p>
        </div>

        <div className="bg-white rounded-md border border-[#E5E7EB] p-4 md:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] space-y-4">
          {/* Project */}
          <div>
            <label className={labelClass}>Project *</label>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className={inputClass + ' bg-white'}
            >
              <option value="">Select a project…</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name} — {p.client}</option>
              ))}
            </select>
          </div>

          {/* Event Date */}
          <div>
            <label className={labelClass}>Event Date *</label>
            <input
              type="date"
              value={eventDate}
              onChange={e => setEventDate(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Event Description */}
          <div>
            <label className={labelClass}>Event Description *</label>
            <textarea
              value={eventDescription}
              onChange={e => setEventDescription(e.target.value)}
              className={inputClass + ' resize-none'}
              rows={4}
              placeholder="Describe what happened on site that constitutes a variation event…"
            />
          </div>

          {/* Implications row */}
          <div className="grid grid-cols-2 gap-4 md:gap-6">
            <div>
              <label className={labelClass}>Cost Implication</label>
              <div className="flex items-center gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => setCostFlag(!costFlag)}
                  className={`${toggleBase} ${costFlag ? 'bg-[#1B365D]' : 'bg-[#D1D5DB]'}`}
                  aria-checked={costFlag}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-200 ${costFlag ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-[14px] text-[#1C1C1E]">{costFlag ? 'Yes' : 'No'}</span>
              </div>
            </div>
            <div>
              <label className={labelClass}>Time Implication</label>
              <div className="flex items-center gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => setTimeFlag(!timeFlag)}
                  className={`${toggleBase} ${timeFlag ? 'bg-[#1B365D]' : 'bg-[#D1D5DB]'}`}
                  aria-checked={timeFlag}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-200 ${timeFlag ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-[14px] text-[#1C1C1E]">{timeFlag ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </div>

          {timeFlag && (
            <div>
              <label className={labelClass}>Estimated Days</label>
              <input
                type="number"
                value={estimatedDays}
                onChange={e => setEstimatedDays(e.target.value)}
                className={inputClass}
                placeholder="e.g. 5"
                min="1"
              />
            </div>
          )}

          {/* Contract Clause */}
          <div>
            <label className={labelClass}>Contract Clause (optional)</label>
            <input
              type="text"
              value={contractClause}
              onChange={e => setContractClause(e.target.value)}
              className={inputClass}
              placeholder="e.g. Clause 36.1 AS 4000"
            />
          </div>

          {/* Issued By */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Issued By Name</label>
              <input
                type="text"
                value={issuedByName}
                onChange={e => setIssuedByName(e.target.value)}
                className={inputClass}
                placeholder="Your name"
              />
            </div>
            <div>
              <label className={labelClass}>Issued By Email</label>
              <input
                type="email"
                value={issuedByEmail}
                onChange={e => setIssuedByEmail(e.target.value)}
                className={inputClass}
                placeholder="your@email.com"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button
            onClick={() => handleSave(false)}
            disabled={saving || !projectId || !eventDescription.trim()}
            className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 text-[13px] font-medium text-[#6B7280] border border-[#E5E7EB] rounded-md hover:bg-[#F5F3EF] disabled:opacity-40 transition-colors duration-[120ms] text-center"
          >
            {saving ? 'Saving...' : 'Save as Draft'}
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving || !projectId || !eventDescription.trim()}
            className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 text-[13px] font-medium text-white bg-[#1B365D] rounded-md hover:bg-[#24466F] disabled:opacity-40 transition-colors duration-[120ms] shadow-[0_1px_2px_rgba(0,0,0,0.1)] text-center"
          >
            {saving ? 'Saving...' : 'Issue Immediately'}
          </button>
        </div>
      </div>
    </AppShell>
  );
}

export default function NewNoticePage() {
  return (
    <Suspense fallback={<AppShell><TopBar title="New Variation Notice" /><div className="flex items-center justify-center h-96 text-[#9CA3AF] text-sm">Loading...</div></AppShell>}>
      <NewNoticeForm />
    </Suspense>
  );
}
