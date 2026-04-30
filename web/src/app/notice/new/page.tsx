'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase';
import { formatNoticeNumber } from '@/lib/utils';
import { useRole } from '@/lib/role';
import AttachmentPicker from '@/components/AttachmentPicker';
import CostItemsTable, { type CostItem } from '@/components/CostItemsTable';
import ProjectPicker from '@/components/ui/ProjectPicker';
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
  const [timeUnit, setTimeUnit] = useState<'days' | 'hours'>('days');
  const [contractClause, setContractClause] = useState('');
  const [issuedByName, setIssuedByName] = useState('');
  const [issuedByEmail, setIssuedByEmail] = useState('');
  const [costItems, setCostItems] = useState<CostItem[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
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
        const meta = user.user_metadata ?? {};
        const givenName = (meta.given_name ?? meta.first_name ?? '') as string;
        const familyName = (meta.family_name ?? meta.last_name ?? '') as string;
        const combined = [givenName, familyName].filter(Boolean).join(' ');
        const fullName =
          profile?.full_name ??
          (meta.full_name as string | undefined) ??
          (meta.name as string | undefined) ??
          combined ??
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
        cost_items: costFlag ? costItems : [],
        time_flag: timeFlag,
        estimated_days: timeFlag && estimatedDays ? parseInt(estimatedDays) : null,
        time_implication_unit: timeFlag && estimatedDays ? timeUnit : null,
        contract_clause: contractClause.trim() || null,
        issued_by_name: issuedByName.trim() || null,
        issued_by_email: issuedByEmail.trim() || null,
        status: 'draft',
        issued_at: null,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select()
      .single();

    if (!error && inserted) {
      // Upload attachments
      if (attachments.length > 0) {
        const supabase2 = createClient();
        const { data: { user } } = await supabase2.auth.getUser();
        if (user) {
          for (const file of attachments) {
            const docId = crypto.randomUUID();
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const storagePath = `${user.id}/documents/${docId}/${safeName}`;
            const ext = file.name.split('.').pop() || 'bin';
            const { error: uploadErr } = await supabase2.storage.from('documents').upload(storagePath, file, { contentType: file.type });
            if (uploadErr) { console.error('Storage upload error:', uploadErr); continue; }
            const { error: docErr } = await supabase2.from('documents').insert({
              id: docId,
              notice_id: inserted.id,
              file_name: file.name,
              file_type: file.type || `application/${ext}`,
              file_size: file.size,
              storage_path: storagePath,
              uploaded_at: new Date().toISOString(),
            });
            if (docErr) console.error('Document insert error:', docErr);
          }
        }
      }
      router.push(`/notice/${inserted.id}`);
    } else {
      console.error('Failed to create notice:', error);
    }
    setSaving(false);
  }

  const inputClass = "w-full px-3 py-2 text-[14px] border border-[#D8D2C4] rounded-md focus:ring-1 focus:ring-[#17212B] focus:border-[#17212B] outline-none";
  const labelClass = "block text-[11px] font-medium text-[#64748B] uppercase tracking-[0.02em] mb-1";
  const toggleBase = "relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors duration-200 cursor-pointer";

  return (
    <AppShell>
      <TopBar title="New Variation Notice" />
      <div className="p-4 md:p-8 space-y-4 md:space-y-5 ">
        <div>
          <Link
            href={preselectedProjectId ? `/project/${preselectedProjectId}` : '/'}
            className="hidden md:flex items-center gap-2 w-full bg-white border border-[#D8D2C4] rounded-md px-4 py-3 text-[14px] font-semibold text-[#17212B] hover:bg-[#F0F4FA] active:bg-[#E8EFF8] transition-colors duration-[120ms] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {preselectedProjectId ? 'Back to Project' : 'Back to Dashboard'}
          </Link>
          <h2 className="text-xl font-semibold text-[#111827] mt-3">New Variation Notice</h2>
          <p className="text-[13px] text-[#334155] mt-1">Issue a formal notice of a variation event. A full Variation Request can be linked later.</p>
        </div>

        <div className="bg-white rounded-md border border-[#D8D2C4] p-4 md:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] space-y-4">
          {/* Project */}
          <div>
            <label className={labelClass}>Project *</label>
            <ProjectPicker
              projects={projects.map(p => ({ id: p.id, name: p.client ? `${p.name} — ${p.client}` : p.name }))}
              value={projectId}
              onChange={setProjectId}
              required
            />
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
                  className={`${toggleBase} ${costFlag ? 'bg-[#17212B]' : 'bg-[#D1D5DB]'}`}
                  aria-checked={costFlag}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-200 ${costFlag ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-[14px] text-[#111827]">{costFlag ? 'Yes' : 'No'}</span>
              </div>
            </div>
            <div>
              <label className={labelClass}>Time Implication</label>
              <div className="flex items-center gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => setTimeFlag(!timeFlag)}
                  className={`${toggleBase} ${timeFlag ? 'bg-[#17212B]' : 'bg-[#D1D5DB]'}`}
                  aria-checked={timeFlag}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-200 ${timeFlag ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-[14px] text-[#111827]">{timeFlag ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </div>

          {/* Cost breakdown table */}
          {costFlag && (
            <div>
              <label className={labelClass}>Cost Breakdown</label>
              <div className="mt-2 bg-[#F9FAFB] rounded-lg border border-[#D8D2C4] p-3">
                <CostItemsTable items={costItems} onChange={setCostItems} />
              </div>
            </div>
          )}

          {timeFlag && (
            <div>
              <label className={labelClass}>Time Implication</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={estimatedDays}
                  onChange={e => setEstimatedDays(e.target.value)}
                  className={`${inputClass} flex-1`}
                  placeholder="e.g. 4"
                  min="1"
                />
                <select
                  value={timeUnit}
                  onChange={e => setTimeUnit(e.target.value as 'days' | 'hours')}
                  className="px-3 py-2 text-[14px] border border-[#D8D2C4] rounded-md bg-white text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#17212B]"
                >
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </select>
              </div>
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

        {/* Attachments */}
        <div className="bg-white rounded-md border border-[#D8D2C4] p-4 md:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <AttachmentPicker files={attachments} onChange={setAttachments} label="Photos & Files (optional)" />
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            disabled={saving}
            className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 text-[13px] font-medium text-[#334155] border border-[#D8D2C4] rounded-md hover:bg-[#F5F3EF] disabled:opacity-40 transition-colors duration-[120ms] text-center"
          >
            Cancel
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={saving || !projectId || !eventDescription.trim()}
            className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 text-[13px] font-semibold text-white bg-[#E76F00] hover:bg-[#C75A00] rounded-md disabled:opacity-40 transition-colors duration-[120ms] shadow-[0_1px_2px_rgba(0,0,0,0.1)] text-center"
          >
            {saving ? 'Creating…' : 'Create Variation Notice'}
          </button>
        </div>
      </div>
    </AppShell>
  );
}

export default function NewNoticePage() {
  return (
    <Suspense fallback={<AppShell><TopBar title="New Variation Notice" /><div className="flex items-center justify-center h-96 text-[#64748B] text-sm">Loading...</div></AppShell>}>
      <NewNoticeForm />
    </Suspense>
  );
}
