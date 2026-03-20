'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useRole } from '@/lib/role';
import type { Project } from '@/lib/types';
import ProjectPicker from '@/components/ui/ProjectPicker';
import { Home, Settings } from 'lucide-react';

interface CaptureResult {
  variationId: string;
  variationNumber: string;
  projectName: string;
  capturedAt: string;
}

function CapturePageContent() {
  const searchParams = useSearchParams();
  const isOnboarding = searchParams.get('onboarding') === 'true';
  const onboardingProjectId = searchParams.get('project') ?? '';
  const router = useRouter();

  const { companyId, isField, isLoading: roleLoading, userId } = useRole();

  // Early auth gate — render nothing until session is confirmed, redirect immediately if not authed
  const [authChecked, setAuthChecked] = useState(false);
  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.replace('/login');
        return;
      }
      setAuthChecked(true);
    }
    checkAuth();
  }, []);

  // Projects
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [loadingProjects, setLoadingProjects] = useState(true);

  // Form fields
  const [description, setDescription] = useState('');
  const [instructedBy, setInstructedBy] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [responseDueDate, setResponseDueDate] = useState('');
  const [requestorName, setRequestorName] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Onboarding UI state
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showExtraFields, setShowExtraFields] = useState(false);

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
    if (!roleLoading && companyId) {
      loadProjects();
      loadProfile();
    }
  }, [roleLoading, companyId]);

  async function loadProjects() {
    const supabase = createClient();
    let query = supabase
      .from('projects')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (companyId) query = query.eq('company_id', companyId);
    const { data, error } = await query;

    if (!error && data) {
      setProjects(data as Project[]);
      if (isOnboarding && onboardingProjectId) {
        // Pre-select the onboarding project
        setSelectedProjectId(onboardingProjectId);
      } else if (data.length === 1) {
        setSelectedProjectId(data[0].id);
      }
    }
    setLoadingProjects(false);
  }

  async function loadProfile() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.replace('/login'); return; }

    // Try display_name from company_members first (set via Settings)
    const { data: member } = await supabase
      .from('company_members')
      .select('display_name')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (member?.display_name) {
      setRequestorName(member.display_name);
      return;
    }

    // Fall back to profiles table or user_metadata
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    const meta = user.user_metadata ?? {};
    const givenName = (meta.given_name ?? meta.first_name ?? '') as string;
    const familyName = (meta.family_name ?? meta.last_name ?? '') as string;
    const combined = [givenName, familyName].filter(Boolean).join(' ');

    const name =
      profile?.full_name ??
      (meta.full_name as string | undefined) ??
      (meta.name as string | undefined) ??
      combined ??
      '';

    if (name) setRequestorName(name);
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false });
    const projectName = projects.find(p => p.id === selectedProjectId)?.name || '';
    const stampText = projectName ? `${projectName} · ${dateStr} ${timeStr}` : `${dateStr} ${timeStr}`;

    // Try to get GPS, then stamp regardless
    const stampPhoto = (gpsText?: string) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new window.Image() as HTMLImageElement;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0);

          // Build stamp lines
          const lines = [stampText];
          if (gpsText) lines.push(gpsText);

          const padding = Math.round(img.width * 0.012);
          const fontSize = Math.round(img.width * 0.028);
          ctx.font = `bold ${fontSize}px monospace`;

          const lineH = fontSize + padding;
          const boxH = lineH * lines.length + padding * 2;
          const boxW = Math.max(...lines.map(l => ctx.measureText(l).width)) + padding * 2;
          const x = padding;
          const y = img.height - boxH - padding;

          // Semi-transparent black background
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(x, y, boxW, boxH);

          // White text
          ctx.fillStyle = '#ffffff';
          lines.forEach((line, i) => {
            ctx.fillText(line, x + padding, y + padding + fontSize + i * lineH);
          });

          canvas.toBlob((blob) => {
            if (!blob) return;
            const stamped = new File([blob], file.name, { type: 'image/jpeg' });
            setPhotoFile(stamped);
            setPhotoPreview(canvas.toDataURL('image/jpeg', 0.92));
          }, 'image/jpeg', 0.92);
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude.toFixed(5);
          const lng = pos.coords.longitude.toFixed(5);
          stampPhoto(`${lat}, ${lng}`);
        },
        () => stampPhoto(), // GPS denied/unavailable — stamp without coords
        { timeout: 4000, maximumAge: 60000 }
      );
    } else {
      stampPhoto();
    }
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
      setError('Please enter a title for this variation.');
      return;
    }
    // In non-onboarding mode, response due date is required (except field users)
    if (!isOnboarding && !isField && !responseDueDate) {
      setError('Please set a response due date.');
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
        response_due_date: responseDueDate || null,
        status: 'draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (insertError) {
        setError('Failed to save: ' + insertError.message);
        setSubmitting(false);
        return;
      }

      // Upload photo if attached
      if (photoFile) {
        try {
          const { data: { user: photoUser } } = await supabase.auth.getUser();
          const uploadUserId = photoUser?.id ?? userId;
          if (!uploadUserId) throw new Error('No user ID for upload');
          const ext = photoFile.name.split('.').pop() || 'jpg';
          const docId = crypto.randomUUID();
          const storagePath = `${uploadUserId}/documents/${docId}/photo-${Date.now()}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(storagePath, photoFile, { contentType: photoFile.type, upsert: false });

          if (!uploadError) {
            const { error: docInsertError } = await supabase.from('documents').insert({
              id: docId,
              notice_id: noticeId,
              file_name: photoFile.name,
              file_type: photoFile.type,
              file_size: photoFile.size,
              storage_path: storagePath,
              uploaded_at: new Date().toISOString(),
            });
            if (docInsertError) console.error('Photo DB insert error:', docInsertError);
          } else {
            console.error('Photo storage upload error:', uploadError);
          }
        } catch (photoErr) {
          console.error('Photo upload failed (non-fatal):', photoErr);
          // Don't block submission if photo fails
        }
      }

      // Get project name for confirmation
      const project = projects.find((p) => p.id === selectedProjectId);

      if (isOnboarding) {
        // In onboarding mode, redirect to the variations register with success flag
        router.push('/variations?onboarding=success');
        return;
      }

      setResult({
        variationId: noticeId,
        variationNumber: noticeNumber,
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
    setResponseDueDate('');
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

  // Block render until auth is confirmed
  if (!authChecked) return null;

  // ── SUCCESS OVERLAY — shown over the form ───────────────────
  const SuccessOverlay = result ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-5">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Compact success row */}
        <div className="bg-emerald-500 px-5 py-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5"/>
            </svg>
          </div>
          <div>
            <div className="text-white font-bold text-[16px] leading-tight">Notice Captured</div>
            <div className="text-emerald-100 text-[12px] mt-0.5">
              {new Date(result.capturedAt).toLocaleString('en-AU', { timeStyle: 'short', dateStyle: 'short' })}
            </div>
          </div>
        </div>
        {/* Detail */}
        <div className="px-5 py-4 text-center border-b border-slate-100">
          <div className="text-[22px] font-bold text-slate-900">{result.variationNumber}</div>
          <div className="text-[13px] text-slate-500 mt-0.5">{result.projectName}</div>
        </div>
        {/* Actions */}
        <div className="px-5 py-4 flex flex-col gap-2">
          <button
            onClick={handleCaptureAnother}
            className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl text-[15px] transition-colors active:bg-indigo-700"
          >
            Capture Another
          </button>
          <Link
            href={`/notice/${result.variationId}`}
            className="block w-full text-center text-slate-400 font-medium py-2 text-[13px]"
          >
            View Notice →
          </Link>
        </div>
      </div>
    </div>
  ) : null;

  // Derive the onboarding project object (for display name)
  const onboardingProject = isOnboarding && onboardingProjectId
    ? projects.find(p => p.id === onboardingProjectId)
    : null;

  // ── FORM ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F8F8F6] flex flex-col pb-20">
      {SuccessOverlay}
      <CaptureHeader />

      <div className="flex-1 flex items-start justify-center px-4 pt-4 pb-6">
        <div className="w-full max-w-lg">

          {/* Onboarding welcome banner */}
          {isOnboarding && !bannerDismissed && (
            <div
              className="mb-4 px-4 py-3.5 rounded-lg flex items-start justify-between gap-3"
              style={{ backgroundColor: '#EEF2FF', border: '1px solid #C7D2FE', color: '#1E1B4B' }}
            >
              <div>
                <div className="text-[14px] font-semibold mb-0.5">⚡ You&apos;re 60 seconds from your first captured variation.</div>
                <div className="text-[13px]" style={{ color: '#3730A3' }}>Fill in the title and hit Save.</div>
              </div>
              <button
                onClick={() => setBannerDismissed(true)}
                className="flex-shrink-0 text-[16px] leading-none mt-0.5"
                style={{ color: '#6366F1' }}
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          )}

          {/* Context note for non-field users (non-onboarding only) */}
          {!isOnboarding && !roleLoading && !isField && (
            <div className="mb-4 px-4 py-2.5 bg-[#FDF8ED] border border-[#C8943E]/40 rounded-lg text-xs text-[#92722E]">
              Quick notice mode — for the full register,{' '}
              <Link href="/" className="underline">go to Dashboard</Link>.
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <h1 className="text-lg font-semibold text-[#1C1C1E] mb-5">
              Capture a Variation Notice
            </h1>

            <form onSubmit={handleSubmit} className="space-y-3">

              {/* Project — locked (read-only) in onboarding mode, normal otherwise */}
              {isOnboarding ? (
                loadingProjects ? (
                  <div className="h-12 bg-gray-100 rounded-lg animate-pulse" />
                ) : (
                  <div className="px-4 py-3 bg-[#F3F4F6] rounded-lg text-sm text-[#1C1C1E] font-medium">
                    📋 {onboardingProject?.name ?? 'Your project'}
                  </div>
                )
              ) : loadingProjects ? (
                <div className="h-12 bg-gray-100 rounded-lg animate-pulse" />
              ) : projects.length === 0 ? (
                <div className="text-sm text-[#6B7280] py-2">
                  No active projects found.{' '}
                  <Link href="/dashboard" className="underline text-[#1B365D]">Create one on the dashboard</Link>.
                </div>
              ) : projects.length === 1 ? (
                <div className="px-4 py-3 bg-[#F3F4F6] rounded-lg text-sm text-[#1C1C1E] font-medium">
                  📋 {projects[0].name}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">Project</label>
                  <ProjectPicker
                    projects={projects}
                    value={selectedProjectId}
                    onChange={setSelectedProjectId}
                    required
                  />
                </div>
              )}

              {/* Title / Description */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">
                  {isOnboarding ? 'Variation title' : 'What happened?'}{' '}
                  <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={isOnboarding ? 2 : 3}
                  placeholder={
                    isOnboarding
                      ? 'e.g. Additional blockwork to Level 3 corridor'
                      : 'Describe the change — what was directed, by whom, where on site'
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-3 text-[15px] text-[#1C1C1E] resize-none focus:outline-none focus:ring-2 focus:ring-[#1B365D]/30 focus:border-[#1B365D] placeholder:text-gray-400"
                  required
                />
              </div>

              {/* Onboarding: collapsible extra fields */}
              {isOnboarding ? (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowExtraFields(!showExtraFields)}
                    className="text-[13px] font-medium text-[#6B7280] hover:text-[#1C1C1E] transition-colors"
                  >
                    {showExtraFields ? 'Hide extra details ▴' : 'Add more details ▾'}
                  </button>

                  {showExtraFields && (
                    <div className="mt-4 space-y-5">
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
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[14px] text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#1B365D]/30 focus:border-[#1B365D] placeholder:text-gray-400"
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
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[14px] text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#1B365D]/30 focus:border-[#1B365D]"
                        />
                      </div>

                      {/* Response Due Date — hidden for field users */}
                      {!isField && (
                      <div>
                        <label className="block text-sm font-medium text-[#374151] mb-1.5">
                          Response due date <span className="text-[#9CA3AF] font-normal">(optional)</span>
                        </label>
                        <input
                          type="date"
                          value={responseDueDate}
                          onChange={(e) => setResponseDueDate(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[14px] text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#1B365D]/30 focus:border-[#1B365D]"
                        />
                      </div>
                      )}

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
                              className="w-full h-28 object-cover rounded-lg border border-gray-200"
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
                            className="w-full border-2 border-dashed border-gray-300 rounded-lg py-3 text-sm text-[#6B7280] hover:border-gray-400 hover:text-[#4B5563] transition-colors flex flex-col items-center gap-1"
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


                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Non-onboarding: show all fields as normal */}

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
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[14px] text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#1B365D]/30 focus:border-[#1B365D] placeholder:text-gray-400"
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
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[14px] text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#1B365D]/30 focus:border-[#1B365D]"
                    />
                  </div>

                  {/* Response Due Date — hidden for field users */}
                  {!isField && (
                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-1.5">
                      Response due date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={responseDueDate}
                      onChange={(e) => setResponseDueDate(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[14px] text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#1B365D]/30 focus:border-[#1B365D]"
                    />
                  </div>
                  )}

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
                          className="w-full h-28 object-cover rounded-lg border border-gray-200"
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
                        className="w-full border-2 border-dashed border-gray-300 rounded-lg py-3 text-sm text-[#6B7280] hover:border-gray-400 hover:text-[#4B5563] transition-colors flex flex-col items-center gap-1"
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


                </>
              )}

              {/* Error */}
              {error && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting || loadingProjects || (!isOnboarding && projects.length === 0)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl text-base transition-colors flex items-center justify-center gap-2"
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

          {!isField && (
            <p className="text-center text-xs text-[#9CA3AF] mt-6">
              <Link href="/dashboard" className="hover:underline">← Back to Dashboard</Link>
            </p>
          )}
        </div>
      </div>

      {/* Bottom nav — field users only */}
      {isField && (
        <div className="fixed bottom-0 left-0 right-0 bg-slate-900 flex items-center justify-around px-2 py-3 z-50">
          <Link href="/field" className="flex flex-col items-center gap-1 px-10 py-1">
            <Home size={20} className="text-slate-400" />
            <span className="text-[10px] font-medium text-slate-400">Home</span>
          </Link>
          <Link href="/settings" className="flex flex-col items-center gap-1 px-10 py-1">
            <Settings size={20} className="text-slate-400" />
            <span className="text-[10px] font-medium text-slate-400">Settings</span>
          </Link>
        </div>
      )}
    </div>
  );
}

export default function CapturePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F8F8F6] flex flex-col">
        <CaptureHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[#9CA3AF] text-sm">Loading…</div>
        </div>
      </div>
    }>
      <CapturePageContent />
    </Suspense>
  );
}

function CaptureHeader() {
  const { company } = useRole();
  return (
    <header className="bg-slate-900 text-white px-5 pt-12 pb-5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <span className="font-semibold text-[14px] text-white/90 tracking-tight">{company?.name || 'Variation Shield'}</span>
        </div>

      </div>
      <div className="mt-4">
        <h1 className="text-[22px] font-bold text-white tracking-tight leading-tight">Capture a Notice</h1>
        <p className="text-[13px] text-white/40 mt-0.5">Record a site instruction before you move on</p>
      </div>
    </header>
  );
}
