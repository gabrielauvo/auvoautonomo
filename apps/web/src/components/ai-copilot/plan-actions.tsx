'use client';

/**
 * PlanActions Component
 * Confirmation/Cancel buttons for pending plans
 */

import { Check, X, Loader2, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlanActionsProps {
  onConfirm: () => void;
  onCancel: () => void;
  onEdit?: () => void;
  isLoading?: boolean;
  isBillingAction?: boolean;
}

export function PlanActions({
  onConfirm,
  onCancel,
  onEdit,
  isLoading = false,
  isBillingAction = false,
}: PlanActionsProps) {
  return (
    <div className="flex items-center gap-2 p-3 border-t border-gray-200 bg-gray-50">
      <div className="flex-1 text-sm text-gray-600">
        {isBillingAction ? (
          <span className="flex items-center gap-1.5 text-amber-700">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            Confirme para criar a cobrança
          </span>
        ) : (
          <span>Deseja confirmar esta operação?</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Edit button (optional) */}
        {onEdit && (
          <button
            onClick={onEdit}
            disabled={isLoading}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md',
              'border border-gray-300 text-gray-700 hover:bg-gray-100',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-colors'
            )}
          >
            <Pencil className="w-4 h-4" />
            Editar
          </button>
        )}

        {/* Cancel button */}
        <button
          onClick={onCancel}
          disabled={isLoading}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md',
            'border border-gray-300 text-gray-700 hover:bg-gray-100',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-colors'
          )}
        >
          <X className="w-4 h-4" />
          Cancelar
        </button>

        {/* Confirm button */}
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className={cn(
            'flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-md',
            'text-white transition-colors',
            isBillingAction
              ? 'bg-amber-600 hover:bg-amber-700'
              : 'bg-primary hover:bg-primary/90',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              {isBillingAction ? 'Sim, confirmo' : 'Confirmar'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default PlanActions;
