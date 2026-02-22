'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import StatusBadge from '@/components/StatusBadge';
import { createClient } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/utils';
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

  useEffect(() => {
    loadVariation();
  }, [id]);

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

    // Load photo URLs from storage
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

  if (loading) {
    return (
      <AppShell>
        <TopBar title="Variation" />
        <div className="flex items-center justify-center h-96 text-gray-400">Loading...</div>
      </AppShell>
    );
  }

  if (!variation || !project) {
    return (
      <AppShell>
        <TopBar title="Variation" />
        <div className="flex items-center justify-center h-96 text-gray-400">Variation not found</div>
      </AppShell>
    );
  }

  const instructionLabel = variation.instruction_source?.replace(/_/g, ' ') || 'Unknown';

  return (
    <AppShell>
      <TopBar title={`Variation #${variation.sequence_number}`} />
      <div className="p-8 space-y-6 max-w-5xl">
        {/* Back link */}
        <Link href={`/project/${project.id}`} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
          ← Back to {project.name}
        </Link>

        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{variation.title}</h2>
              <p className="text-gray-500 mt-1">{project.name} · {project.client}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-gray-900">{formatCurrency(variation.estimated_value)}</div>
              <div className="mt-2"><StatusBadge status={variation.status} /></div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 mt-6 pt-6 border-t border-gray-100">
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase">Instruction Source</div>
              <div className="text-sm text-gray-900 mt-1 capitalize">{instructionLabel}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase">Instructed By</div>
              <div className="text-sm text-gray-900 mt-1">{variation.instructed_by || '—'}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase">Captured</div>
              <div className="text-sm text-gray-900 mt-1">{formatDate(variation.captured_at)}</div>
            </div>
            {variation.reference_doc && (
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase">Reference Document</div>
                <div className="text-sm text-gray-900 mt-1">{variation.reference_doc}</div>
              </div>
            )}
            {variation.evidence_hash && (
              <div className="col-span-2">
                <div className="text-xs font-semibold text-gray-500 uppercase">Evidence Hash</div>
                <div className="text-xs text-gray-500 mt-1 font-mono break-all">{variation.evidence_hash}</div>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {(variation.description || variation.ai_description) && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3">Description</h3>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {variation.ai_description || variation.description}
            </p>
            {variation.ai_description && variation.description && (
              <details className="mt-4">
                <summary className="text-xs text-blue-600 cursor-pointer font-medium">View original description</summary>
                <p className="text-sm text-gray-500 mt-2 whitespace-pre-wrap">{variation.description}</p>
              </details>
            )}
          </div>
        )}

        {/* Notes */}
        {variation.notes && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3">Notes</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{variation.notes}</p>
          </div>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4">Photo Evidence ({photos.length})</h3>
            <div className="grid grid-cols-3 gap-4">
              {photos.map(photo => (
                <div key={photo.id} className="aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                  {photoUrls[photo.id] ? (
                    <img src={photoUrls[photo.id]} alt="Evidence" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                      📷 Loading...
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Voice Notes */}
        {voiceNotes.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4">Voice Notes ({voiceNotes.length})</h3>
            <div className="space-y-3">
              {voiceNotes.map(vn => (
                <div key={vn.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl">🎤</div>
                  <div className="flex-1">
                    <div className="text-sm text-gray-500">
                      {Math.round(vn.duration_seconds)}s · {formatDate(vn.captured_at)}
                    </div>
                    {vn.transcription && (
                      <p className="text-sm text-gray-700 mt-2 italic">&ldquo;{vn.transcription}&rdquo;</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status History */}
        {statusHistory.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4">Status History</h3>
            <div className="space-y-3">
              {statusHistory.map(sc => (
                <div key={sc.id} className="flex items-center gap-4 text-sm">
                  <div className="text-gray-400 w-32">{formatDate(sc.changed_at)}</div>
                  <div className="flex items-center gap-2">
                    {sc.from_status && <StatusBadge status={sc.from_status} />}
                    {sc.from_status && <span className="text-gray-400">→</span>}
                    <StatusBadge status={sc.to_status} />
                  </div>
                  {sc.changed_by && <span className="text-gray-500">by {sc.changed_by}</span>}
                  {sc.notes && <span className="text-gray-400">— {sc.notes}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
