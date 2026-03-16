'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';

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
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = projects.find(p => p.id === value);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between border rounded-lg px-3 py-3 text-[15px] bg-white focus:outline-none focus:ring-2 focus:ring-[#1B365D]/30 transition-colors ${
          open ? 'border-[#1B365D]' : 'border-gray-300'
        } ${selected ? 'text-[#1C1C1E]' : 'text-gray-400'} ${className || ''}`}
      >
        <span className="truncate">{selected ? selected.name : 'Select a project…'}</span>
        <ChevronDown
          size={16}
          className={`flex-shrink-0 text-gray-400 ml-2 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Inline dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-40 overflow-hidden max-h-56 overflow-y-auto">
          {projects.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { onChange(p.id); setOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-3.5 text-left text-[15px] text-[#1C1C1E] hover:bg-slate-50 active:bg-slate-100 transition-colors ${
                i < projects.length - 1 ? 'border-b border-[#F0F0EE]' : ''
              }`}
            >
              <span>{p.name}</span>
              {p.id === value && <Check size={15} className="text-indigo-600 flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
