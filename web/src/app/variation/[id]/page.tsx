'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import StatusBadge from '@/components/StatusBadge';
import { createClient } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/utils';
import { printVariation } from '@/lib/print';
import type { Variation, Project, PhotoEvidence, VoiceNote, StatusChange } from '@/lib/types';

export default function VariationDetail() {
  const { id } = useParams<{ id: string }>();
  const [variation, setVariation] = useState<Variation | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [photos, setPhotos] = useState<PhotoEvidence[]>([]);
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  const [statusHistory, setStatusHistory] = useState<StatusChange[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadVariation(); }, [id]);

  async function loadVariation() {
    const supabase = createClient();
    const { data: v } = await supabase.from('variations').select('*').eq('id', id).single();
    if (!v) { setLoading(false); return; }
    setVariation(v);

    const { data: proj } = await supabase.from('projects').select('*').eq('id', v.project_id).single();
    setProject(proj);

    const { data: ph } = await supabase.from('photo_evidence').select('*').eq('variation_id', id).order('captured_at');
    setPhotos(ph || []);

    const { data: vn } = await supabase.from('voice_notes').select('*').eq('variation_id', id).order('captured_at');
    setVoiceNotes(vn || []);

    const { data: sc } = await supabase.from('status_changes').select('*').eq('variation_id', id).order('changed_at');
    setStatusHistory(sc || []);

    if (ph && ph.length > 0 && proj) {
      const urls: Record<string, string> = {};
      for (const photo of ph) {
        const { data } = await supabase.storage.from('evidence').createSignedUrl(
          `${proj.user_id}/photos/${photo.id}.jpg`, 3600
        );
        if (data?.signedUrl) urls[photo.id] = data.signedUrl;
      }
      setPhotoUrls(urls);
    }

    setLoading(false);
  }

  function handlePrint() {
    if (variation && project) {
      printVariation(variation, project, photos, photoUrls);
    }
  }

  if (loading) {
    return (
      <AppShell><TopBar title="Variation" />
        <div className="flex items-center justify-center h-96 text-[#9CA3AF] text-sm">Loading...</div>
      </AppShell>
    );
  }

  if (!variation || !project) {
    return (
      <AppShell><TopBar title="Variation" />
        <div className="flex items-center justify-center h-96 text-[#9CA3AF] text-sm">Variation not found</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <TopBar title={`Variation #${variation.sequence_number}`} onPrint={handlePrint} printLabel="Print Variation" />
      <div className="p-8 space-y-5 max-w-4xl">
        <Link href={`/project/${project.id}`} className="text-[12px] text-[#1B365D] hover:text-[#24466F] font-medium transition-colors duration-[120ms]">
          ← Back to {project.name}
        </Link>

        {/* Header Card */}
        <div className="bg-white rounded-md border border-[#E5E7EB] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[#1C1C1E]">{variation.title}</h2>
              <p className="text-[13px] text-[#6B7280] mt-1">{project.name} · {project.client}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold text-[#1C1C1E] tabular-nums">{formatCurrency(variation.estimated_value)}</div>
              <div className="mt-2"><StatusBadge status={variation.status} /></div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 mt-6 pt-5 border-t border-[#F0F0EE]">
            <div>
              <div className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em]">Instruction Source</div>
              <div className="text-[14px] text-[#1C1C1E] mt-1 capitalize">{variation.instruction_source?.replace(/_/g, ' ')}</div>
            </div>
            <div>
              <div className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em]">Instructed By</div>
              <div className="text-[14px] text-[#1C1C1E] mt-1">{variation.instructed_by || '—'}</div>
            </div>
            <div>
              <div className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em]">Captured</div>
              <div className="text-[14px] text-[#1C1C1E] mt-1">{formatDate(variation.captured_at)}</div>
            </div>
            {variation.reference_doc && (
              <div>
                <div className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em]">Reference Document</div>
                <div className="text-[14px] text-[#1C1C1E] mt-1">{variation.reference_doc}</div>
              </div>
            )}
            {variation.evidence_hash && (
              <div className="col-span-2">
                <div className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em]">Evidence Hash</div>
                <div className="text-[11px] text-[#9CA3AF] mt-1 font-mono break-all">{variation.evidence_hash}</div>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {(variation.description || variation.ai_description) && (
          <div className="bg-white rounded-md border border-[#E5E7EB] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-3">Description</h3>
            <p className="text-[14px] text-[#1C1C1E] leading-relaxed whitespace-pre-wrap">
              {variation.ai_description || variation.description}
            </p>
            {variation.ai_description && variation.description && (
              <details className="mt-4">
                <summary className="text-[12px] text-[#1B365D] cursor-pointer font-medium">View original</summary>
                <p className="text-[13px] text-[#6B7280] mt-2 whitespace-pre-wrap">{variation.description}</p>
              </details>
            )}
          </div>
        )}

        {/* Notes */}
        {variation.notes && (
          <div className="bg-white rounded-md border border-[#E5E7EB] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-3">Notes</h3>
            <p className="text-[14px] text-[#1C1C1E] whitespace-pre-wrap">{variation.notes}</p>
          </div>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <div className="bg-white rounded-md border border-[#E5E7EB] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-4">Photo Evidence ({photos.length})</h3>
            <div className="grid grid-cols-3 gap-3">
              {photos.map(photo => (
                <div key={photo.id} className="aspect-square bg-[#F8F8F6] rounded-md overflow-hidden border border-[#E5E7EB]">
                  {photoUrls[photo.id] ? (
                    <img src={photoUrls[photo.id]} alt="Evidence" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#9CA3AF] text-[13px]">Loading...</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Voice Notes */}
        {voiceNotes.length > 0 && (
          <div className="bg-white rounded-md border border-[#E5E7EB] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-4">Voice Notes ({voiceNotes.length})</h3>
            <div className="space-y-2">
              {voiceNotes.map(vn => (
                <div key={vn.id} className="flex items-start gap-3 p-3 bg-[#F8F8F6] rounded-md">
                  <div className="text-[#9CA3AF]">🎤</div>
                  <div className="flex-1">
                    <div className="text-[12px] text-[#9CA3AF]">{Math.round(vn.duration_seconds)}s · {formatDate(vn.captured_at)}</div>
                    {vn.transcription && (
                      <p className="text-[13px] text-[#6B7280] mt-1.5 italic leading-relaxed">&ldquo;{vn.transcription}&rdquo;</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status History */}
        {statusHistory.length > 0 && (
          <div className="bg-white rounded-md border border-[#E5E7EB] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-4">Status History</h3>
            <div className="space-y-2.5">
              {statusHistory.map(sc => (
                <div key={sc.id} className="flex items-center gap-4 text-[13px]">
                  <div className="text-[#9CA3AF] w-28 tabular-nums">{formatDate(sc.changed_at)}</div>
                  <div className="flex items-center gap-2">
                    {sc.from_status && <StatusBadge status={sc.from_status} />}
                    {sc.from_status && <span className="text-[#9CA3AF]">→</span>}
                    <StatusBadge status={sc.to_status} />
                  </div>
                  {sc.changed_by && <span className="text-[#6B7280]">by {sc.changed_by}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
