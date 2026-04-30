'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase';

interface Contact {
  email: string;
  name: string | null;
  use_count: number;
}

interface EmailAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  autoFocus?: boolean;
  companyId: string | null;
  className?: string;
  label?: string;
  labelSuffix?: string;
}

export default function EmailAutocomplete({
  value,
  onChange,
  onKeyDown,
  placeholder = 'client@company.com',
  autoFocus = false,
  companyId,
  className = '',
  label,
  labelSuffix,
}: EmailAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Contact[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch suggestions when last typed token changes
  const fetchSuggestions = useCallback(async (query: string) => {
    if (!companyId || query.length < 2) { setSuggestions([]); setOpen(false); return; }
    const supabase = createClient();
    const { data } = await supabase
      .from('client_contacts')
      .select('email, name, use_count')
      .eq('company_id', companyId)
      .or(`email.ilike.%${query}%,name.ilike.%${query}%`)
      .order('use_count', { ascending: false })
      .order('last_used', { ascending: false })
      .limit(8);
    if (data && data.length > 0) {
      setSuggestions(data);
      setOpen(true);
      setActiveIdx(-1);
    } else {
      setSuggestions([]);
      setOpen(false);
    }
  }, [companyId]);

  // Get the last email token being typed (handles comma-separated lists)
  function getLastToken(val: string) {
    const parts = val.split(',');
    return parts[parts.length - 1].trim();
  }

  function replaceLastToken(val: string, replacement: string) {
    const parts = val.split(',');
    parts[parts.length - 1] = ' ' + replacement;
    // Join and clean leading space on first item
    const joined = parts.join(',');
    return joined.startsWith(' ') ? joined.slice(1) : joined;
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newVal = e.target.value;
    onChange(newVal);
    const token = getLastToken(newVal);
    fetchSuggestions(token);
  }

  function selectSuggestion(contact: Contact) {
    const newVal = replaceLastToken(value, contact.email + ', ');
    onChange(newVal);
    setSuggestions([]);
    setOpen(false);
    setActiveIdx(-1);
    // Focus back on input after selection
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (open && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx(i => Math.min(i + 1, suggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx(i => Math.max(i - 1, -1));
        return;
      }
      if (e.key === 'Enter' && activeIdx >= 0) {
        e.preventDefault();
        selectSuggestion(suggestions[activeIdx]);
        return;
      }
      if (e.key === 'Escape') {
        setOpen(false);
        setActiveIdx(-1);
        return;
      }
    }
    onKeyDown?.(e);
  }

  // Close on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  return (
    <div className="relative">
      {label && (
        <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">
          {label}
          {labelSuffix && <span className="text-slate-400 normal-case font-normal"> {labelSuffix}</span>}
        </label>
      )}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          const token = getLastToken(value);
          if (token.length >= 2) fetchSuggestions(token);
        }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        className={`w-full px-3 py-1.5 text-[13px] border border-slate-200 rounded-md focus:ring-1 focus:ring-[#E76F00] outline-none bg-white ${className}`}
      />
      {open && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden"
        >
          {suggestions.map((c, i) => (
            <button
              key={c.email}
              type="button"
              onMouseDown={e => { e.preventDefault(); selectSuggestion(c); }}
              className={`w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-indigo-50 transition-colors ${i === activeIdx ? 'bg-indigo-50' : ''}`}
            >
              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-[#E76F00]">
                {(c.name?.[0] || c.email[0]).toUpperCase()}
              </div>
              <div className="min-w-0">
                {c.name && <div className="text-[12px] font-semibold text-slate-700 truncate">{c.name}</div>}
                <div className="text-[12px] text-slate-500 truncate">{c.email}</div>
              </div>
              {c.use_count > 1 && (
                <div className="ml-auto text-[11px] text-slate-300 flex-shrink-0">{c.use_count}×</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
