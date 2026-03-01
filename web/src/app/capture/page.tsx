'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { useRole } from '@/lib/role';
import type { Project } from '@/lib/types';

interface CaptureResult {
  variationId: string;
  variationNumber: string;
  projectName: string;
  capturedAt: string;
}

export default function CapturePage() {
  const { companyId, isField, isLoading: roleLoading, userId } = useRole();

  // Projects
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [loadingProjects, setLoadingProjects] = useState(true);

  // Form fields
  const [description, setDescription] = useState('');
  const [instructedBy, setInstructedBy] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [requestorName, setRequestorName] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CaptureResult | null>(null);

  // Set default datetime to now
  useEffect(() => {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setOccurredAt(local);
  }, []);

  // Load projects once company is known
  useEffect(() => {
    if (!roleLoading) {
      loadProjects();
      loadProfile();
    }
  }, [roleLoading, companyId]);

  async function loadProjects() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setProjects(data as Project[]);
      if (data.length === 1) {
        setSelectedProjectId(data[0].id);
      }
    }
    setLoadingProjects(false);
  }

  async function loadProfile() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Try full_name from profiles table
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

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function removePhoto() {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedProjectId) {
      setError('Please select a project.');
      return;
    }
    if (!description.trim()) {
      setError('Please describe what happened.');
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get next VN sequence number for this project
      const { data: existing } = await supabase
        .from('variation_notices')
        .select('sequence_number')
        .eq('project_id', selectedProjectId)
        .order('sequence_number', { ascending: false })
        .limit(1);

      const nextSeq = existing && existing.length > 0 ? existing[0].sequence_number + 1 : 1;
      const noticeNumber = `VN-${String(nextSeq).padStart(3, '0')}`;

      // Parse occurredAt to extract date only (event_date is date-only field)
      const eventDate = occurredAt
        ? new Date(occurredAt).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      const noticeId = crypto.randomUUID();
      const { error: insertError } = await supabase.from('variation_notices').insert({
        id: noticeId,
        project_id: selectedProjectId,
        company_id: companyId,
        sequence_number: nextSeq,
        notice_number: noticeNumber,
        event_description: description.trim(),
        event_date: eventDate,
        cost_flag: true,
        time_flag: false,
        issued_by_name: requestorName.trim() || null,
        issued_by_email: user.email || null,
        status: 'draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (insertError) {
        setError('Failed to save: ' + insertError.message);
        setSubmitting(false);
        return;
      }

      // Photo evidence attaches to variations, not notices — skip photo upload here.
      // Photo can be added after converting this notice to a Variation Request.

      // Get project name for confirmation
      const project = projects.find((p) => p.id === selectedProjectId);

      setResult({
        variationId: noticeId,       // holds notice ID
        variationNumber: noticeNumber, // holds VN-001 format
        projectName: project?.name ?? 'Your project',
        capturedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleCaptureAnother() {
    setResult(null);
    setDescription('');
    setInstructedBy('');
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    // Keep same project selected and requestor name
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setOccurredAt(local);
  }

  // ── SUCCESS CARD ────────────────────────────────────────────
  if (result) {
    return (
      <div className="min-h-screen bg-[#F8F8F6] flex flex-col">
        <CaptureHeader />
        <div className="flex-1 flex items-start justify-center px-4 pt-12 pb-8">
          <div className="w-full max-w-lg">
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
              <div className="text-4xl mb-3">✓</div>
              <h2 className="text-xl font-semibold text-green-800 mb-1">
                Variation Notice captured
              </h2>
              <p className="text-3xl font-bold text-green-900 mb-1">{result.variationNumber}</p>
              <p className="text-sm text-green-700 mb-6">{result.projectName}</p>
              <p className="text-xs text-green-600 mb-8">
                {new Date(result.capturedAt).toLocaleString('en-AU', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
              <div className="flex flex-col gap-3">
                <Link
                  href={`/notice/${result.variationId}`}
                  className="block w-full border border-green-300 text-green-800 font-medium py-3 px-4 rounded-lg text-sm hover:bg-green-100 transition-colors"
                >
                  View Notice →
                </Link>
                <button
                  onClick={handleCaptureAnother}
                  className="w-full bg-[#E85D1A] hover:bg-[#C94E14] text-white font-semibold py-4 px-6 rounded-xl text-base transition-colors"
                >
                  Capture Another Notice
                </button>
              </div>
            </div>
            <p className="text-center text-xs text-[#9CA3AF] mt-6">
              <Link href="/" className="hover:underline">← Back to Dashboard</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── FORM ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F8F8F6] flex flex-col">
      <CaptureHeader />

      <div className="flex-1 flex items-start justify-center px-4 pt-8 pb-12">
        <div className="w-full max-w-lg">

          {/* Context note for non-field users */}
          {!roleLoading && !isField && (
            <div className="mb-4 px-4 py-2.5 bg-[#FDF8ED] border border-[#C8943E]/40 rounded-lg text-xs text-[#92722E]">
              Quick notice mode — for the full register,{' '}
              <Link href="/" className="underline">go to Dashboard</Link>.
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <h1 className="text-lg font-semibold text-[#1C1C1E] mb-5">
              Capture a Variation Notice
            </h1>

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Project select */}
              {loadingProjects ? (
                <div className="h-12 bg-gray-100 rounded-lg animate-pulse" />
              ) : projects.length === 0 ? (
                <div className="text-sm text-[#6B7280] py-2">
                  No active projects found.{' '}
                  <Link href="/" className="underline text-[#1B365D]">Create one on the dashboard</Link>.
                </div>
              ) : projects.length === 1 ? (
                <div className="px-4 py-3 bg-[#F3F4F6] rounded-lg text-sm text-[#1C1C1E] font-medium">
                  📋 {projects[0].name}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">Project</label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-3 text-[15px] text-[#1C1C1E] bg-white focus:outline-none focus:ring-2 focus:ring-[#1B365D]/30 focus:border-[#1B365D]"
                    required
                  >
                    <option value="">Select a project…</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* What happened */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">
                  What happened? <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Describe the change — what was directed, by whom, where on site"
                  className="w-full border border-gray-300 rounded-lg px-3 py-3 text-[15px] text-[#1C1C1E] resize-none focus:outline-none focus:ring-2 focus:ring-[#1B365D]/30 focus:border-[#1B365D] placeholder:text-gray-400"
                  required
                />
              </div>

              {/* Who instructed it */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">
                  Who instructed it?
                </label>
                <input
                  type="text"
                  value={instructedBy}
                  onChange={(e) => setInstructedBy(e.target.value)}
                  placeholder="e.g. Site foreman, client rep, engineer"
                  className="w-full border border-gray-300 rounded-lg px-3 py-3 text-[15px] text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#1B365D]/30 focus:border-[#1B365D] placeholder:text-gray-400"
                />
              </div>

              {/* Date / Time */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">
                  When did it happen?
                </label>
                <input
                  type="datetime-local"
                  value={occurredAt}
                  onChange={(e) => setOccurredAt(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-3 text-[15px] text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#1B365D]/30 focus:border-[#1B365D]"
                />
              </div>

              {/* Photo */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">
                  Photo evidence <span className="text-[#9CA3AF] font-normal">(optional)</span>
                </label>
                {photoPreview ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoPreview}
                      alt="Preview"
                      className="w-full h-48 object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={removePhoto}
                      className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md hover:bg-black/80"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-gray-300 rounded-lg py-8 text-sm text-[#6B7280] hover:border-gray-400 hover:text-[#4B5563] transition-colors flex flex-col items-center gap-2"
                  >
                    <span className="text-2xl">📷</span>
                    Tap to attach a photo
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </div>

              {/* Your name */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">
                  Your name <span className="text-[#9CA3AF] font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={requestorName}
                  onChange={(e) => setRequestorName(e.target.value)}
                  placeholder="Your name or reference"
                  className="w-full border border-gray-300 rounded-lg px-3 py-3 text-[15px] text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#1B365D]/30 focus:border-[#1B365D] placeholder:text-gray-400"
                />
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
                disabled={submitting || loadingProjects || projects.length === 0}
                className="w-full bg-[#E85D1A] hover:bg-[#C94E14] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl text-lg transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <span className="animate-spin text-base">⏳</span>
                    Capturing…
                  </>
                ) : (
                  'CAPTURE NOTICE →'
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

function CaptureHeader() {
  return (
    <header className="bg-[#1B365D] text-white px-4 py-4 flex items-center gap-3">
      <Image
        src="/variation-shield-logo.jpg"
        alt="Variation Shield"
        width={28}
        height={28}
        className="rounded-md object-cover"
      />
      <span className="font-semibold text-[15px] tracking-tight">Quick Notice</span>
      <span className="ml-auto text-white/40 text-xs">⚡ Quick mode</span>
    </header>
  );
}
