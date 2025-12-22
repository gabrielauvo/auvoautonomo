'use client';

/**
 * SignatureSection - Seção de assinatura digital do cliente
 *
 * Exibe a assinatura digital coletada para a OS.
 * A coleta é feita pelo app mobile.
 */

import { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Skeleton,
  Alert,
} from '@/components/ui';
import {
  PenLine,
  CheckCircle,
  AlertCircle,
  User,
  Calendar,
} from 'lucide-react';

interface SignatureData {
  id: string;
  signerName: string;
  signerDocument?: string;
  signerRole?: string;
  signedAt: string;
  attachment?: {
    id: string;
    publicUrl?: string;
    storagePath?: string;
  };
}

interface SignatureSectionProps {
  workOrderId: string;
  workOrderStatus: string;
}

// Obter URL da assinatura
function getSignatureUrl(attachment?: SignatureData['attachment']): string | null {
  if (!attachment) return null;

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  if (attachment.publicUrl) {
    if (attachment.publicUrl.startsWith('http://') || attachment.publicUrl.startsWith('https://')) {
      return attachment.publicUrl;
    }
    return `${baseUrl}${attachment.publicUrl}`;
  }

  if (attachment.storagePath) {
    return `${baseUrl}/uploads/${attachment.storagePath}`;
  }

  return null;
}

// Formatar data
function formatDateTime(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function SignatureSection({ workOrderId, workOrderStatus }: SignatureSectionProps) {
  const [signature, setSignature] = useState<SignatureData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSignature() {
      try {
        setIsLoading(true);
        setError(null);

        // Usa o proxy /api/proxy para autenticação via HttpOnly cookies
        const response = await fetch(`/api/proxy/work-orders/${workOrderId}/signature`, {
          credentials: 'include', // Envia cookies HttpOnly
        });

        if (response.ok) {
          const text = await response.text();
          // Verificar se há conteúdo antes de parsear
          if (text && text.trim() && text !== 'null') {
            try {
              const data = JSON.parse(text);
              if (data && data.id) {
                setSignature(data);
              }
            } catch (parseError) {
              // Resposta vazia ou inválida - não é erro, apenas não tem assinatura
              console.log('[SignatureSection] No signature data');
            }
          }
        } else if (response.status === 404) {
          // Não encontrado - OK, não tem assinatura
          console.log('[SignatureSection] No signature found (404)');
        } else if (response.status === 401) {
          // Não autenticado - pode acontecer se sessão expirou
          console.log('[SignatureSection] Unauthorized (401)');
          setError('Sessão expirada');
        } else {
          // Outro erro
          console.error('[SignatureSection] Error response:', response.status);
          setError('Erro ao carregar assinatura');
        }
      } catch (err) {
        console.error('[SignatureSection] Error:', err);
        setError('Erro ao carregar assinatura');
      } finally {
        setIsLoading(false);
      }
    }

    if (workOrderId) {
      loadSignature();
    }
  }, [workOrderId]);

  // Loading
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Error
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PenLine className="h-5 w-5" />
            Assinatura do Cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="error">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Se não tem assinatura
  if (!signature) {
    const canCollectSignature = workOrderStatus === 'IN_PROGRESS' || workOrderStatus === 'DONE';

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PenLine className="h-5 w-5" />
            Assinatura do Cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
              <PenLine className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500 mb-2">
              Nenhuma assinatura coletada
            </p>
            <p className="text-xs text-gray-400">
              {canCollectSignature
                ? 'A assinatura pode ser coletada pelo app mobile.'
                : 'Inicie a OS para coletar a assinatura do cliente.'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Exibir assinatura
  const signatureUrl = getSignatureUrl(signature.attachment);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckCircle className="h-5 w-5 text-success" />
          <span className="text-success">Assinatura Coletada</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Imagem da assinatura */}
        {signatureUrl && (
          <div className="border rounded-lg p-4 bg-white">
            <img
              src={signatureUrl}
              alt={`Assinatura de ${signature.signerName}`}
              className="max-h-40 mx-auto object-contain"
            />
          </div>
        )}

        {/* Informações do assinante */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
          <div className="flex items-start gap-3">
            <User className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500">Assinante</p>
              <p className="text-sm font-medium text-gray-900">{signature.signerName}</p>
              {signature.signerRole && (
                <p className="text-xs text-gray-500">{signature.signerRole}</p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500">Data/Hora</p>
              <p className="text-sm font-medium text-gray-900">
                {formatDateTime(signature.signedAt)}
              </p>
            </div>
          </div>

          {signature.signerDocument && (
            <div className="flex items-start gap-3">
              <PenLine className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500">Documento</p>
                <p className="text-sm font-medium text-gray-900">{signature.signerDocument}</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default SignatureSection;
