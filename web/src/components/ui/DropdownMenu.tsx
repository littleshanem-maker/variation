'use client';

import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/cn';

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export function DropdownMenuContent({
  children,
  className,
  align = 'end',
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        align={align}
        sideOffset={4}
        className={cn(
          'z-50 min-w-[160px] bg-[#FFFCF5] border border-[#D8D2C4] rounded-lg shadow-lg p-1',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          'data-[side=bottom]:slide-in-from-top-2',
          className
        )}
        {...props}
      >
        {children}
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  children,
  className,
  destructive,
  onSelect,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & { destructive?: boolean }) {
  return (
    <DropdownMenuPrimitive.Item
      onSelect={onSelect}
      className={cn(
        'flex items-center gap-2 px-2.5 py-2 text-[13px] rounded-md cursor-pointer outline-none select-none transition-colors',
        destructive
          ? 'text-[#B42318] hover:bg-[#FBE6E4] focus:bg-[#FBE6E4]'
          : 'text-[#334155] hover:bg-[#F5F2EA] focus:bg-[#F5F2EA]',
        className
      )}
      {...props}
    >
      {children}
    </DropdownMenuPrimitive.Item>
  );
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn('my-1 h-px bg-[#F5F2EA]', className)}
    />
  );
}
