'use client';

/**
 * CancelChargeModal - Modal para cancelar cobrança
 *
 * Exige motivo do cancelamento
 */

import { useState } from 'react';
import { Modal, Button, Textarea, FormField, Alert } from '@/components/ui';
import { XCircle, AlertCircle } from 'lucide-react';

interface CancelChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  isLoading: boolean;
}

export function CancelChargeModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}: CancelChargeModalProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!reason.trim()) {
      setError('Informe o motivo do cancelamento');
      return;
    }

    setError(null);

    try {
      await onConfirm(reason);
      setReason('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao cancelar cobrança');
    }
  };

  const handleClose = () => {
    setError(null);
    setReason('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Cancelar Cobrança"
      size="md"
    >
      <div className="space-y-4">
        <Alert variant="error">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">
              Esta ação não pode ser desfeita. A cobrança será cancelada no Asaas.
            </span>
          </div>
        </Alert>

        {error && (
          <Alert variant="error">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          </Alert>
        )}

        <FormField label="Motivo do cancelamento *">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Informe o motivo do cancelamento..."
            rows={3}
            disabled={isLoading}
          />
        </FormField>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="ghost" onClick={handleClose} disabled={isLoading}>
            Voltar
          </Button>
          <Button
            variant="error"
            onClick={handleConfirm}
            loading={isLoading}
            disabled={!reason.trim()}
            leftIcon={<XCircle className="h-4 w-4" />}
          >
            Cancelar Cobrança
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default CancelChargeModal;
