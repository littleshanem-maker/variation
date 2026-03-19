'use client';

import { useState, useEffect, useRef } from 'react';
import { Paperclip, X, CheckCircle } from 'lucide-react';
import { useRole } from '@/lib/role';
import { createClient } from '@/lib/supabase';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const { company } = useRole();
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
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      const fd = new FormData();
      fd.append('message', message.trim());
      fd.append('userName', user?.user_metadata?.full_name || user?.email || 'Unknown');
      fd.append('userEmail', user?.email || '');
      fd.append('companyName', company?.name || '');
      if (file) fd.append('attachment', file);

      const res = await fetch('/api/feedback', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Failed');
      setSubmitted(true);
    } catch {
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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative w-full sm:max-w-md bg-[#0f1117] border border-white/[0.1] rounded-t-2xl sm:rounded-2xl shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.12]">
          <div>
            <h2 className="text-[15px] font-bold text-white">Share feedback</h2>
            <p className="text-xs text-white/60 mt-0.5">Tell us what's working, what's not, or what you'd love to see.</p>
          </div>
          <button onClick={handleClose} className="text-white/50 hover:text-white transition-colors ml-4 flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          <div className="px-5 py-10 text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle size={40} className="text-green-400" />
            </div>
            <h3 className="font-bold text-base mb-2">Thanks — got it.</h3>
            <p className="text-white/40 text-sm mb-6">We read every piece of feedback.</p>
            <button
              onClick={handleClose}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors"
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
              className="w-full bg-white/[0.08] border border-white/[0.2] rounded-xl px-4 py-3 text-sm text-white placeholder-white/40 focus:outline-none focus:border-indigo-400 resize-none transition-colors"
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
                <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2">
                  <Paperclip size={13} className="text-white/40 flex-shrink-0" />
                  <span className="text-xs text-white/60 truncate flex-1">{file.name}</span>
                  <button type="button" onClick={() => setFile(null)} className="text-white/30 hover:text-white/60">
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 text-xs text-white/60 hover:text-white transition-colors"
                >
                  <Paperclip size={13} />
                  Attach a screenshot or file
                </button>
              )}
            </div>

            {error && <p className="text-red-400 text-xs">{error}</p>}

            <button
              type="submit"
              disabled={loading || !message.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl text-sm transition-colors"
            >
              {loading ? 'Sending…' : 'Submit feedback'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
