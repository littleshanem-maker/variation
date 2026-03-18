'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { formatCurrency, formatDate, getVariationNumber } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import { Sheet, SheetContent, SheetHeader, SheetBody, SheetFooter, SheetTitle, SheetDescription } from '@/components/ui/Sheet';
import { ArrowUpRight, Lock, Pencil, RotateCcw, CheckCircle, XCircle, AlertTriangle, FileText } from 'lucide-react';
import { useRole } from '@/lib/role';
import { getVariationHtmlForPdf } from '@/lib/print';
import { htmlToPdfBlob, shareOrDownloadPdf } from '@/lib/pdf';
import { getVariationEmailMeta } from '@/lib/email';
import type { Variation, Project, PhotoEvidence, VariationNotice } from '@/lib/types';

interface Props {
  variationId: string | null;
  open: boolean;
  onClose: () => void;
  onStatusChange?: () => void;
}

const metaLabel = 'text-[10px] font-medium uppercase tracking-wider text-slate-400';
const metaValue = 'text-[14px] font-medium text-slate-800 mt-0.5';

export default function VariationSlideOver({ variationId, open, onClose, onStatusChange }: Props) {
  const { company } = useRole();
  const [variation, setVariation] = useState<Variation | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [photos, setPhotos] = useState<PhotoEvidence[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [linkedNotice, setLinkedNotice] = useState<VariationNotice | null>(null);
  const [revisions, setRevisions] = useState<Variation[]>([]);
  const [sender, setSender] = useState<{ name: string; email: string }>({ name: '', email: '' });
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [sendingPdf, setSendingPdf] = useState(false);

  // Dispute reason state
  const [showDisputeInput, setShowDisputeInput] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');

  useEffect(() => {
    if (variationId && open) {
      loadVariation(variationId);
      setShowDisputeInput(false);
      setDisputeReason('');
    }
  }, [variationId, open]);

  async function loadVariation(id: string) {
    setLoading(true);
    const supabase = createClient();

    // Fetch user for sender metadata (needed for PDF)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setSender({
        name: user.user_metadata?.full_name || user.user_metadata?.name || '',
        email: user.email || '',
      });
    }

    const { data: v } = await supabase.from('variations').select('*').eq('id', id).single();
    if (!v) { setLoading(false); return; }
    setVariation(v);

    const { data: proj } = await supabase.from('projects').select('*').eq('id', v.project_id).single();
    setProject(proj);

    // Fetch revisions (for PDF revision history)
    const { data: revData } = await supabase
      .from('variations')
      .select('*')
      .eq('project_id', v.project_id)
      .eq('sequence_number', v.sequence_number)
      .order('revision_number', { ascending: true });
    setRevisions(revData ?? []);

    // Fetch linked notice if present
    if (v.notice_id) {
      const { data: noticeData } = await supabase.from('variation_notices').select('*').eq('id', v.notice_id).single();
      setLinkedNotice(noticeData ?? null);
    } else {
      setLinkedNotice(null);
    }

    const { data: ph } = await supabase.from('photo_evidence').select('*').eq('variation_id', id).order('captured_at');
    setPhotos(ph || []);

    if (ph?.length && proj) {
      const urls: Record<string, string> = {};
      for (const photo of ph.slice(0, 4)) { // cap at 4 photos in slide-over
        const { data } = await supabase.storage.from('evidence').createSignedUrl(
          `${proj.created_by}/photos/${photo.id}.jpg`, 3600
        );
        if (data?.signedUrl) urls[photo.id] = data.signedUrl;
      }
      setPhotoUrls(urls);
    }

    setLoading(false);
  }

  async function handleSendPdf() {
    if (!variation || !project) return;
    setSendingPdf(true);
    try {
      const { html, css } = getVariationHtmlForPdf(
        variation, project, photos, photoUrls,
        company?.name || '', sender, linkedNotice, revisions,
        { logoUrl: company?.logo_url, abn: company?.abn, address: company?.address, phone: company?.phone, preferredStandard: company?.preferred_standard }
      );
      const blob = await htmlToPdfBlob(html, css);
      const { subject, body, filename } = getVariationEmailMeta(variation, project);
      await shareOrDownloadPdf(blob, filename, subject, body);
    } catch (err) {
      console.error('PDF send failed:', err);
      alert('PDF generation failed. Try reducing the number of photos, or try again.');
    } finally {
      setSendingPdf(false);
    }
  }

  async function advanceStatus(newStatus: string, extra?: { notes?: string }) {
    if (!variation) return;
    setActing(true);
    const supabase = createClient();
    const oldStatus = variation.status;

    const updatePayload: Record<string, string> = { status: newStatus };
    if (extra?.notes) updatePayload.notes = extra.notes;

    await supabase.from('variations').update(updatePayload).eq('id', variation.id);
    await supabase.from('status_changes').insert({
      id: crypto.randomUUID(),
      variation_id: variation.id,
      from_status: oldStatus,
      to_status: newStatus,
      changed_at: new Date().toISOString(),
      changed_by: 'Office',
    });

    await loadVariation(variation.id);
    setActing(false);
    setShowDisputeInput(false);
    setDisputeReason('');
    onStatusChange?.();
  }

  const isSubmitted = variation?.status === 'submitted';
  const isDraft = variation?.status === 'draft' || variation?.status === 'captured';
  const isDisputed = variation?.status === 'disputed';
  const isResolved = ['approved', 'paid', 'rejected'].includes(variation?.status ?? '');

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <SheetContent>
        {loading || !variation ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            {loading ? 'Loading…' : 'Not found'}
          </div>
        ) : (
          <>
            {/* Header */}
            <SheetHeader>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[12px] font-mono font-semibold text-indigo-600 uppercase tracking-wider">
                  {getVariationNumber(variation)}
                </span>
                <StatusBadge status={variation.status} />
              </div>
              <SheetTitle>{variation.title}</SheetTitle>
              <SheetDescription>{project?.name} · {project?.client}</SheetDescription>

              {/* Status banner */}
              {isSubmitted && !variation.client_approval_response && (
                <div className="flex items-center gap-2 mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-[12px] text-amber-700 font-medium">
                  <Lock size={12} className="flex-shrink-0" />
                  Awaiting client response.
                </div>
              )}
              {isSubmitted && variation.client_approval_response === 'approved' && (
                <div className="flex items-center gap-2 mt-3 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[12px] text-emerald-700 font-medium">
                  <CheckCircle size={12} className="flex-shrink-0" />
                  ✅ Approved by client via email link
                  {variation.client_approved_at && <span className="text-emerald-500 font-normal ml-1">· {new Date(variation.client_approved_at).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })}</span>}
                </div>
              )}
              {isDisputed && variation.client_approval_response === 'rejected' && (
                <div className="flex flex-col gap-1 mt-3 px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-[12px] text-rose-700 font-medium">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={12} className="flex-shrink-0" />
                    ❌ Rejected by client via email link
                    {variation.client_approved_at && <span className="text-rose-400 font-normal">· {new Date(variation.client_approved_at).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })}</span>}
                  </div>
                  {variation.client_approval_comment && <div className="text-[11px] text-rose-600 font-normal pl-4">"{variation.client_approval_comment}"</div>}
                </div>
              )}
              {isDisputed && !variation.client_approval_response && (
                <div className="flex items-center gap-2 mt-3 px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-[12px] text-rose-700 font-medium">
                  <AlertTriangle size={12} className="flex-shrink-0" />
                  Disputed — revise and resubmit.
                </div>
              )}
              {isResolved && (
                <div className="flex items-center gap-2 mt-3 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[12px] text-slate-600 font-medium">
                  <CheckCircle size={12} className="flex-shrink-0" />
                  {variation.status.charAt(0).toUpperCase() + variation.status.slice(1)} — no further action needed.
                </div>
              )}
            </SheetHeader>

            {/* Body */}
            <SheetBody>
              {/* Value */}
              <div className="flex items-baseline justify-between py-4 border-b border-slate-100">
                <span className={metaLabel}>Estimated Value</span>
                <span className="text-[28px] font-bold text-slate-900 tabular-nums">
                  {formatCurrency(variation.estimated_value)}
                </span>
              </div>

              {/* Metadata grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className={metaLabel}>Instruction Source</div>
                  <div className={metaValue}>{variation.instruction_source?.replace(/_/g, ' ') || '—'}</div>
                </div>
                <div>
                  <div className={metaLabel}>Instructed By</div>
                  <div className={metaValue}>{variation.instructed_by || '—'}</div>
                </div>
                <div>
                  <div className={metaLabel}>Captured</div>
                  <div className={metaValue}>{formatDate(variation.captured_at)}</div>
                </div>
                {variation.response_due_date && (() => {
                  const due = new Date(variation.response_due_date + 'T00:00:00');
                  const daysLeft = Math.ceil((due.getTime() - Date.now()) / 86400000);
                  const overdue = daysLeft < 0;
                  return (
                    <div>
                      <div className={metaLabel}>Response Due</div>
                      <div className={`text-[14px] font-semibold mt-0.5 ${overdue ? 'text-rose-600' : daysLeft <= 3 ? 'text-amber-600' : 'text-slate-800'}`}>
                        {due.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}
                        <span className="ml-1.5 text-[12px] font-normal">
                          ({overdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`})
                        </span>
                      </div>
                    </div>
                  );
                })()}
                {variation.reference_doc && (
                  <div className="col-span-2">
                    <div className={metaLabel}>Reference Document</div>
                    <div className={metaValue}>{variation.reference_doc}</div>
                  </div>
                )}
              </div>

              {/* Description */}
              {(variation.ai_description || variation.description) && (
                <div>
                  <div className={`${metaLabel} mb-2`}>Description</div>
                  <p className="text-[14px] text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {variation.ai_description || variation.description}
                  </p>
                </div>
              )}

              {/* Notes */}
              {variation.notes && (
                <div>
                  <div className={`${metaLabel} mb-2`}>Notes</div>
                  <p className="text-[13px] text-slate-500 leading-relaxed whitespace-pre-wrap">{variation.notes}</p>
                </div>
              )}

              {/* Photos (max 4) */}
              {photos.length > 0 && (
                <div>
                  <div className={`${metaLabel} mb-2`}>Evidence ({photos.length} photo{photos.length !== 1 ? 's' : ''})</div>
                  <div className="grid grid-cols-2 gap-2">
                    {photos.slice(0, 4).map(photo => (
                      <div key={photo.id} className="aspect-video bg-slate-100 rounded-lg overflow-hidden">
                        {photoUrls[photo.id]
                          ? <img src={photoUrls[photo.id]} alt="Evidence" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs">Loading…</div>
                        }
                      </div>
                    ))}
                  </div>
                  {photos.length > 4 && (
                    <p className="text-[11px] text-slate-400 mt-1">+{photos.length - 4} more — open full detail to view all</p>
                  )}
                </div>
              )}

              {/* Dispute reason input — shows when user clicks Dispute */}
              {showDisputeInput && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl">
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-rose-700 mb-2">
                    Reason for Dispute (required)
                  </label>
                  <textarea
                    value={disputeReason}
                    onChange={e => setDisputeReason(e.target.value)}
                    rows={3}
                    placeholder="Describe why this variation is being disputed…"
                    className="w-full px-3 py-2 text-[14px] border border-rose-200 rounded-lg focus:ring-2 focus:ring-rose-400 focus:border-rose-400 outline-none resize-none bg-white"
                    autoFocus
                  />
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => { setShowDisputeInput(false); setDisputeReason(''); }}
                      className="px-3 py-1.5 text-[13px] text-slate-600 hover:text-slate-900 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => advanceStatus('disputed', { notes: `DISPUTE REASON: ${disputeReason}` })}
                      disabled={!disputeReason.trim() || acting}
                      className="px-4 py-1.5 text-[13px] font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-40 transition-colors"
                    >
                      {acting ? 'Saving…' : 'Confirm Dispute'}
                    </button>
                  </div>
                </div>
              )}
            </SheetBody>

            {/* Footer — primary action full-width, secondary actions in 2-col grid */}
            <SheetFooter className="flex-col items-stretch gap-2">
              {/* Step 1: Draft */}
              {isDraft && !showDisputeInput && (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href={`/variation/${variation.id}`}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-[13px] font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    onClick={onClose}
                  >
                    <ArrowUpRight size={14} /> View Variation
                  </Link>
                  <Link
                    href={`/variation/${variation.id}`}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-[13px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
                    onClick={onClose}
                  >
                    <Pencil size={14} /> Revise &amp; Resubmit
                  </Link>
                </div>
              )}

              {/* Step 2: Submitted */}
              {isSubmitted && !showDisputeInput && (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href={`/variation/${variation.id}`}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-[13px] font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    onClick={onClose}
                  >
                    <ArrowUpRight size={14} /> View Variation
                  </Link>
                  <Link
                    href={`/variation/${variation.id}`}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-[13px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
                    onClick={onClose}
                  >
                    <Pencil size={14} /> Revise &amp; Resubmit
                  </Link>
                </div>
              )}

              {/* Step 3: Disputed */}
              {isDisputed && !showDisputeInput && (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href={`/variation/${variation.id}`}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-[13px] font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    onClick={onClose}
                  >
                    <ArrowUpRight size={14} /> View Variation
                  </Link>
                  <Link
                    href={`/variation/${variation.id}`}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-[13px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
                    onClick={onClose}
                  >
                    <Pencil size={14} /> Revise &amp; Resubmit
                  </Link>
                </div>
              )}

              {/* Resolved (approved/paid) */}
              {isResolved && !showDisputeInput && (
                <Link
                  href={`/variation/${variation.id}`}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-[13px] font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  onClick={onClose}
                >
                  <ArrowUpRight size={14} /> View Variation
                </Link>
              )}
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
