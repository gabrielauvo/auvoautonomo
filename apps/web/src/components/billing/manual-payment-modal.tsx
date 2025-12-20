'use client';

/**
 * ManualPaymentModal - Modal para registrar pagamento manual
 *
 * Permite registrar que o cliente pagou em dinheiro ou outra forma
 */

import { useState } from 'react';
import { Modal, Button, Input, Textarea, FormField, Alert } from '@/components/ui';
import { DollarSign, Calendar, FileText, AlertCircle } from 'lucide-react';
import { ManualPaymentDto } from '@/services/charges.service';

interface ManualPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: ManualPaymentDto) => Promise<void>;
  isLoading: boolean;
  chargeValue: number;
}

// Formatar valor em moeda
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// Opções de forma de pagamento
const PAYMENT_METHODS = [
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'CARTAO_DEBITO', label: 'Cartão de Débito' },
  { value: 'CARTAO_CREDITO', label: 'Cartão de Crédito' },
  { value: 'TRANSFERENCIA', label: 'Transferência Bancária' },
  { value: 'PIX_EXTERNO', label: 'PIX (fora do sistema)' },
  { value: 'OUTRO', label: 'Outro' },
];

export function ManualPaymentModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  chargeValue,
}: ManualPaymentModalProps) {
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [value, setValue] = useState(chargeValue.toString());
  const [paymentMethod, setPaymentMethod] = useState('DINHEIRO');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!paymentDate) {
      setError('Informe a data do pagamento');
      return;
    }

    if (!value || parseFloat(value) <= 0) {
      setError('Informe um valor válido');
      return;
    }

    setError(null);

    try {
      await onConfirm({
        paymentDate,
        value: parseFloat(value),
        paymentMethod,
        notes: notes || undefined,
      });
      // Reset form
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setValue(chargeValue.toString());
      setPaymentMethod('DINHEIRO');
      setNotes('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar pagamento');
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Registrar Pagamento Manual"
      size="md"
    >
      <div className="space-y-4">
        <Alert variant="info">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            <span className="text-sm">
              Valor original da cobrança: <strong>{formatCurrency(chargeValue)}</strong>
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

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Data do pagamento *">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="pl-10"
                disabled={isLoading}
              />
            </div>
          </FormField>

          <FormField label="Valor recebido *">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                R$
              </span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="pl-10"
                disabled={isLoading}
              />
            </div>
          </FormField>
        </div>

        <FormField label="Forma de pagamento">
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full h-10 px-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={isLoading}
          >
            {PAYMENT_METHODS.map((method) => (
              <option key={method.value} value={method.value}>
                {method.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Observações">
          <div className="relative">
            <FileText className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações sobre o pagamento..."
              className="pl-10"
              rows={2}
              disabled={isLoading}
            />
          </div>
        </FormField>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="ghost" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            loading={isLoading}
            leftIcon={<DollarSign className="h-4 w-4" />}
          >
            Registrar Pagamento
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default ManualPaymentModal;
