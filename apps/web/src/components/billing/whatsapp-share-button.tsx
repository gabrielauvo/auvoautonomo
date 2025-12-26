'use client';

/**
 * WhatsAppShareButton - Botão para enviar cobrança via WhatsApp
 *
 * Gera a mensagem padrão e abre o WhatsApp Web/App
 */

import { Button } from '@/components/ui';
import { useFormatting } from '@/context';
import { MessageSquare } from 'lucide-react';
import { Charge, billingTypeLabels, getPublicPaymentUrl } from '@/services/charges.service';

interface WhatsAppShareButtonProps {
  charge: Charge;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  showLabel?: boolean;
}

// Formatar data
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Gerar mensagem padrão
function generateWhatsAppMessage(
  charge: Charge,
  formatCurrency: (value: number, recordCurrency?: string) => string
): string {
  const paymentType = billingTypeLabels[charge.billingType] || 'Pagamento';

  // Usa a URL pública interna (não a do Asaas)
  const paymentLink = getPublicPaymentUrl(charge) || '';

  const parts = [
    `Olá${charge.client?.name ? `, ${charge.client.name.split(' ')[0]}` : ''}! 👋`,
    '',
    `Segue sua cobrança:`,
    '',
    `💰 *Valor:* ${formatCurrency(charge.value)}`,
    `📅 *Vencimento:* ${formatDate(charge.dueDate)}`,
    `💳 *Forma:* ${paymentType}`,
  ];

  if (charge.description) {
    parts.push(`📝 *Descrição:* ${charge.description}`);
  }

  if (paymentLink) {
    parts.push('', `🔗 *Link para pagamento:*`, paymentLink);
  }

  if (charge.billingType === 'PIX' && charge.urls.pixCopiaECola) {
    parts.push('', `📱 *PIX Copia e Cola:*`, charge.urls.pixCopiaECola);
  }

  parts.push('', 'Qualquer dúvida, estou à disposição! 😊');

  return parts.join('\n');
}

// Gerar URL do WhatsApp
function generateWhatsAppUrl(
  charge: Charge,
  formatCurrency: (value: number, recordCurrency?: string) => string,
  phone?: string
): string {
  const message = generateWhatsAppMessage(charge, formatCurrency);
  const encodedMessage = encodeURIComponent(message);

  // Se tiver telefone, adiciona ao link
  if (phone) {
    // Remove caracteres não numéricos
    const cleanPhone = phone.replace(/\D/g, '');
    // Adiciona código do país se não tiver
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    return `https://wa.me/${fullPhone}?text=${encodedMessage}`;
  }

  return `https://wa.me/?text=${encodedMessage}`;
}

export function WhatsAppShareButton({
  charge,
  variant = 'outline',
  size = 'default',
  showLabel = true,
}: WhatsAppShareButtonProps) {
  const { formatCurrency } = useFormatting();

  const handleClick = () => {
    const url = generateWhatsAppUrl(charge, formatCurrency, charge.client?.phone);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      leftIcon={<MessageSquare className="h-4 w-4" />}
      className="text-green-600 border-green-600 hover:bg-green-50"
    >
      {showLabel && 'WhatsApp'}
    </Button>
  );
}

export default WhatsAppShareButton;
