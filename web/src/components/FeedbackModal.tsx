'use client';

import { useState, useEffect, useRef } from 'react';
import { Paperclip, X, CheckCircle } from 'lucide-react';
import { useRole } from '@/lib/role';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const { company, userId } = useRole();
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textRef.current?.focus(), 50);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleClose = () => {
    setMessage('');
    setFile(null);
    setError('');
    setSubmitted(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setLoading(true);
    setError('');

    try {
      console.log('[FeedbackModal] submitting feedback...');
      const payload = {
        message: message.trim(),
        userName: company?.name ? `User at ${company.name}` : (userId ? `User ${userId.slice(0, 8)}` : 'Unknown'),
        userEmail: '',
        companyName: company?.name || '',
      };
      console.log('[FeedbackModal] payload:', JSON.stringify({ ...payload, message: payload.message.slice(0, 50) }));

      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      console.log('[FeedbackModal] response status:', res.status);
      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        console.error('[FeedbackModal] response error body:', errBody);
        throw new Error(`Failed: ${res.status}`);
      }
      setSubmitted(true);
    } catch (err) {
      console.error('[FeedbackModal] caught error:', err);
      setError('Something went wrong — please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="absolute inset-0 bg-[#111827]/60 backdrop-blur-sm" />

      <div className="relative w-full sm:max-w-md bg-[#17212B] border border-[#FFFCF5]/[0.1] rounded-t-2xl sm:rounded-2xl shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#FFFCF5]/[0.12]">
          <div>
            <h2 className="text-[15px] font-medium text-[#FFFCF5]">Share feedback</h2>
            <p className="text-xs text-[#FFFCF5]/60 mt-0.5">Tell us what's working, what's not, or what you'd love to see.</p>
          </div>
          <button onClick={handleClose} className="text-[#FFFCF5]/50 hover:text-[#FFFCF5] transition-colors ml-4 flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          <div className="px-5 py-10 text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle size={40} className="text-[#2E7D32]" />
            </div>
            <h3 className="font-medium text-base mb-2">Thanks — got it.</h3>
            <p className="text-[#FFFCF5]/40 text-sm mb-6">We read every piece of feedback.</p>
            <button
              onClick={handleClose}
              className="bg-[#E76F00] hover:bg-[#E76F00] text-[#FFFCF5] font-medium px-5 py-2.5 rounded-lg text-sm transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <textarea
              ref={textRef}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Describe the issue or suggestion..."
              rows={5}
              required
              className="w-full bg-[#FFFCF5]/[0.08] border border-[#FFFCF5]/[0.2] rounded-xl px-4 py-3 text-sm text-[#FFFCF5] placeholder-#FFFCF5/40 focus:outline-none focus:border-[#E76F00] resize-none transition-colors"
            />

            {/* Attachment */}
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <div className="flex items-center gap-2 bg-[#FFFCF5]/[0.04] border border-[#FFFCF5]/[0.08] rounded-lg px-3 py-2">
                  <Paperclip size={13} className="text-[#FFFCF5]/40 flex-shrink-0" />
                  <span className="text-xs text-[#FFFCF5]/60 truncate flex-1">{file.name}</span>
                  <button type="button" onClick={() => setFile(null)} className="text-[#FFFCF5]/30 hover:text-[#FFFCF5]/60">
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 text-xs text-[#FFFCF5]/60 hover:text-[#FFFCF5] transition-colors"
                >
                  <Paperclip size={13} />
                  Attach a screenshot or file
                </button>
              )}
            </div>

            {error && <p className="text-[#B42318] text-xs">{error}</p>}

            <button
              type="submit"
              disabled={loading || !message.trim()}
              className="w-full bg-[#E76F00] hover:bg-[#E76F00] disabled:opacity-40 text-[#FFFCF5] font-medium py-3 rounded-xl text-sm transition-colors"
            >
              {loading ? 'Sending…' : 'Submit feedback'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
