'use client';

/**
 * Dialog Component - shadcn/ui compatible Dialog
 * Wraps Modal with open/onOpenChange interface for compatibility
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Modal, ModalFooter } from './modal';

export { ModalFooter as DialogFooter } from './modal';

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

/**
 * Dialog component with shadcn/ui compatible interface
 */
export function Dialog({ open, onOpenChange, children }: DialogProps) {
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

