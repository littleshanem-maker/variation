'use client';

import { useRef } from 'react';
import { Paperclip, X, Image as ImageIcon, FileText } from 'lucide-react';

interface AttachmentPickerProps {
  files: File[];
  onChange: (files: File[]) => void;
  label?: string;
}

const ACCEPT = '.jpg,.jpeg,.png,.heic,.webp,.pdf,.doc,.docx,.xls,.xlsx';
const MAX_MB = 20;

function fileIcon(file: File) {
  if (file.type.startsWith('image/')) return <ImageIcon size={14} className="text-[#E76F00] flex-shrink-0" />;
  return <FileText size={14} className="text-[#6B7280] flex-shrink-0" />;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AttachmentPicker({ files, onChange, label = 'Attachments' }: AttachmentPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const valid = Array.from(incoming).filter(f => f.size <= MAX_MB * 1024 * 1024);
    onChange([...files, ...valid]);
  }

  function removeFile(index: number) {
    onChange(files.filter((_, i) => i !== index));
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  }

  return (
    <div>
      <label className="block text-[11px] font-medium uppercase tracking-wider text-[#6B7280] mb-1.5">
        {label}
      </label>

      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="flex flex-col items-center justify-center gap-1.5 px-4 py-5 border-2 border-dashed border-[#D8D2C4] rounded-lg cursor-pointer hover:border-[#E76F00] hover:bg-[#F5F2EA]/40 transition-colors"
      >
        <Paperclip size={18} className="text-[#6B7280]" />
        <p className="text-[13px] text-[#6B7280]">
          <span className="font-medium text-[#E76F00]">Click to attach</span> or drag and drop
        </p>
        <p className="text-[11px] text-[#6B7280]">Photos (JPG, PNG, HEIC), PDF, Word, Excel — max {MAX_MB} MB each</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={e => addFiles(e.target.files)}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {files.map((file, i) => (
            <li key={i} className="flex items-center gap-2 px-3 py-2 bg-[#F5F2EA] border border-[#D8D2C4] rounded-lg">
              {fileIcon(file)}
              <span className="flex-1 text-[13px] text-[#334155] truncate min-w-0">{file.name}</span>
              <span className="text-[11px] text-[#6B7280] flex-shrink-0">{formatSize(file.size)}</span>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); removeFile(i); }}
                className="flex-shrink-0 text-[#6B7280] hover:text-[#B42318] transition-colors"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
