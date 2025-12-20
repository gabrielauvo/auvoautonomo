'use client';

/**
 * PixQRCodeModal - Modal para exibir QR Code PIX
 *
 * Exibe o QR Code e código copia-e-cola para pagamento PIX
 */

import { useState } from 'react';
import { Modal, Button, Alert } from '@/components/ui';
import { Copy, Check, QrCode, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PixQRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  pixQrCodeUrl?: string;
  pixCopiaECola?: string;
  value: number;
}

// Formatar valor em moeda
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function PixQRCodeModal({
  isOpen,
  onClose,
  pixQrCodeUrl,
  pixCopiaECola,
  value,
}: PixQRCodeModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!pixCopiaECola) return;

    try {
      await navigator.clipboard.writeText(pixCopiaECola);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Erro ao copiar:', err);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Pagamento PIX" size="sm">
      <div className="space-y-6">
        {/* Valor */}
        <div className="text-center">
          <p className="text-sm text-gray-500">Valor da cobrança</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(value)}</p>
        </div>

        {/* QR Code */}
        {pixQrCodeUrl ? (
          <div className="flex flex-col items-center">
            <div className="p-4 bg-white border-2 border-gray-200 rounded-lg">
              <img
                src={pixQrCodeUrl}
                alt="QR Code PIX"
                className="w-48 h-48 object-contain"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Escaneie o QR Code com o app do seu banco
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center py-8">
            <QrCode className="h-12 w-12 text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">QR Code não disponível</p>
          </div>
        )}

        {/* Código Copia e Cola */}
        {pixCopiaECola && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              PIX Copia e Cola
            </label>
            <div className="relative">
              <div className="p-3 bg-gray-50 rounded-lg border text-xs font-mono text-gray-600 break-all max-h-24 overflow-y-auto">
                {pixCopiaECola}
              </div>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'absolute top-2 right-2',
                  copied && 'bg-success-50 border-success text-success'
                )}
                onClick={handleCopy}
                leftIcon={
                  copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )
                }
              >
                {copied ? 'Copiado!' : 'Copiar'}
              </Button>
            </div>
          </div>
        )}

        {/* Instruções */}
        <Alert variant="info">
          <div className="text-sm">
            <p className="font-medium">Como pagar:</p>
            <ol className="list-decimal list-inside mt-1 space-y-1 text-xs">
              <li>Abra o app do seu banco</li>
              <li>Escolha pagar com PIX</li>
              <li>Escaneie o QR Code ou cole o código</li>
              <li>Confirme o pagamento</li>
            </ol>
          </div>
        </Alert>

        {/* Ações */}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
          {pixQrCodeUrl && (
            <a href={pixQrCodeUrl} target="_blank" rel="noopener noreferrer">
              <Button leftIcon={<ExternalLink className="h-4 w-4" />}>
                Abrir QR Code
              </Button>
            </a>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default PixQRCodeModal;
