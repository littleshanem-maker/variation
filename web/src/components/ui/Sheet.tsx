'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;

export function SheetContent({
  children,
  className,
  side = 'right',
}: {
  children: React.ReactNode;
  className?: string;
  side?: 'right' | 'left';
}) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <Dialog.Content
        className={cn(
          'fixed z-50 top-0 bottom-0 w-full max-w-[520px] bg-white shadow-2xl flex flex-col',
          'data-[state=open]:animate-in data-[state=closed]:animate-out duration-300',
          side === 'right'
            ? 'right-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right'
            : 'left-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
          className
        )}
      >
        {children}
        <Dialog.Close className="absolute top-4 right-4 p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
          <X size={18} />
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  );
}

export function SheetHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('px-6 py-5 border-b border-slate-100 flex-shrink-0', className)}>
      {children}
    </div>
  );
}

export function SheetBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex-1 overflow-y-auto px-6 py-5 space-y-5', className)}>
      {children}
    </div>
  );
}

export function SheetFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('px-6 py-4 border-t border-slate-100 flex-shrink-0 flex items-center gap-2', className)}>
      {children}
    </div>
  );
}

export function SheetTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Dialog.Title className={cn('text-[16px] font-semibold text-slate-900', className)}>
      {children}
    </Dialog.Title>
  );
}

export function SheetDescription({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Dialog.Description className={cn('text-[13px] text-slate-500 mt-0.5', className)}>
      {children}
    </Dialog.Description>
  );
}
