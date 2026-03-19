'use client';

import { useState } from 'react';
import DemoRequestModal from './DemoRequestModal';

interface DemoButtonProps {
  className?: string;
  children?: React.ReactNode;
}

export default function DemoButton({ className, children }: DemoButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={className}
      >
        {children ?? 'Book a 15-min Demo'}
      </button>
      <DemoRequestModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
