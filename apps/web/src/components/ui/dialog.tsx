'use client';

/**
 * Dialog Component - Alias for Modal
 * Re-exports Modal as Dialog for compatibility
 */

export { Modal as Dialog, ModalFooter as DialogFooter } from './modal';

// Additional Dialog components for shadcn/ui compatibility
import * as React from 'react';
import { cn } from '@/lib/utils';
import { Modal, ModalFooter } from './modal';

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function DialogRoot({ open, onOpenChange, children }: DialogProps) {
  return (
    <Modal isOpen={open ?? false} onClose={() => onOpenChange?.(false)}>
      {children}
    </Modal>
  );
}

export function DialogTrigger({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) {
  return <>{children}</>;
}

export function DialogContent({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('', className)}>{children}</div>;
}

export function DialogHeader({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('mb-4', className)}>{children}</div>;
}

export function DialogTitle({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <h2 className={cn('text-lg font-semibold', className)}>{children}</h2>;
}

export function DialogDescription({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <p className={cn('text-sm text-gray-500', className)}>{children}</p>;
}

export { ModalFooter as DialogFooterAlt };
