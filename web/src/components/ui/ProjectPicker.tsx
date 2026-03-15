'use client';

/**
 * ProjectPicker — mobile-friendly project selector
 * On mobile: tapping opens a bottom sheet with large tap targets
 * On desktop: falls back to a styled native select
 */

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, X, Check } from 'lucide-react';

interface Project {
  id: string;
  name: string;
}

interface ProjectPickerProps {
  projects: Project[];
  value: string;
  onChange: (id: string) => void;
  required?: boolean;
  className?: string;
}

export default function ProjectPicker({ projects, value, onChange, required, className }: ProjectPickerProps) {
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  const selected = projects.find(p => p.id === value);

  // Close on outside tap
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    setTimeout(() => document.addEventListener('mousedown', handleClick), 0);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`w-full flex items-center justify-between border border-gray-300 rounded-lg px-3 py-3 text-[15px] bg-white focus:outline-none focus:ring-2 focus:ring-[#1B365D]/30 focus:border-[#1B365D] ${
          selected ? 'text-[#1C1C1E]' : 'text-gray-400'
        } ${className || ''}`}
      >
        <span className="truncate">{selected ? selected.name : 'Select a project…'}</span>
        <ChevronDown size={16} className="flex-shrink-0 text-gray-400 ml-2" />
      </button>

      {/* Bottom sheet overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div
            ref={sheetRef}
            className="w-full bg-white rounded-t-2xl overflow-hidden"
            style={{ maxHeight: '70vh' }}
          >
            {/* Handle + header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
              <span className="text-[15px] font-semibold text-[#1C1C1E]">Select Project</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Project list */}
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 60px)' }}>
              {projects.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { onChange(p.id); setOpen(false); }}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 active:bg-slate-100 border-b border-gray-50 last:border-b-0"
                >
                  <span className="text-[16px] text-[#1C1C1E] font-medium">{p.name}</span>
                  {p.id === value && <Check size={18} className="text-[#1B365D] flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
