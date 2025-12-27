/**
 * Share Service
 *
 * Serviço para compartilhamento de documentos via WhatsApp e outros canais.
 * Integra com a API para gerar links públicos de orçamentos e ordens de serviço.
 */

import { Linking, Share, Alert } from 'react-native';
import { AuthService } from './AuthService';
import { fetchWithTimeout } from '../utils/fetch-with-timeout';

// =============================================================================
// CONSTANTS
// =============================================================================

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || 'http://localhost:3000';

// =============================================================================
// TYPES
// =============================================================================

export type ShareEntityType = 'quote' | 'work-order';

export interface ShareLinkResponse {
  shareKey: string;
  url: string;
}

// =============================================================================
// SHARE SERVICE
// =============================================================================

export const ShareService = {
  /**
   * Busca ou cria a shareKey para um orçamento
   */
  async getQuoteShareLink(quoteId: string): Promise<ShareLinkResponse> {
    const token = await AuthService.getAccessToken();

    if (!token) {
      throw new Error('Não autenticado');
    }

    const response = await fetchWithTimeout(`${API_URL}/quotes/${quoteId}/share`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000, // 15s timeout
      retries: 2,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Erro ao gerar link de compartilhamento');
    }

    const data = await response.json();

    return {
      shareKey: data.shareKey,
      url: `${WEB_URL}/p/quotes/${data.shareKey}`,
    };
  },

  /**
   * Busca ou cria a shareKey para uma ordem de serviço
   */
  async getWorkOrderShareLink(workOrderId: string): Promise<ShareLinkResponse> {
    const token = await AuthService.getAccessToken();

    if (!token) {
      throw new Error('Não autenticado');
    }

    const response = await fetchWithTimeout(`${API_URL}/work-orders/${workOrderId}/share`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000, // 15s timeout
      retries: 2,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Erro ao gerar link de compartilhamento');
    }

    const data = await response.json();

    return {
      shareKey: data.shareKey,
      url: `${WEB_URL}/p/work-orders/${data.shareKey}`,
    };
  },

  /**
   * Abre o WhatsApp com uma mensagem pré-formatada
   * @param phone - Número do telefone (com código do país, sem espaços ou caracteres especiais)
   * @param message - Mensagem a ser enviada
   */
  async openWhatsApp(phone: string, message: string): Promise<void> {
    // Limpa o número de telefone (remove espaços, traços, parênteses)
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');

    // Remove o + se existir (WhatsApp URL usa número sem +)
    const phoneNumber = cleanPhone.startsWith('+') ? cleanPhone.substring(1) : cleanPhone;

    // Se não começar com código do país, assume Brasil (55)
    const fullPhone = phoneNumber.length <= 11 ? `55${phoneNumber}` : phoneNumber;

    const whatsappUrl = `whatsapp://send?phone=${fullPhone}&text=${encodeURIComponent(message)}`;

    const canOpen = await Linking.canOpenURL(whatsappUrl);

    if (canOpen) {
      await Linking.openURL(whatsappUrl);
    } else {
      // Fallback para WhatsApp Web
      const webUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
      await Linking.openURL(webUrl);
    }
  },

  /**
   * Compartilha um orçamento via WhatsApp
   */
  async shareQuoteViaWhatsApp(
    quoteId: string,
    clientPhone: string,
    clientName: string,
    totalValue: string,
  ): Promise<void> {
    const { url } = await this.getQuoteShareLink(quoteId);

    const message = `Olá ${clientName}!\n\nSegue o orçamento no valor de ${totalValue}.\n\nAcesse o link para visualizar os detalhes e aprovar:\n${url}\n\nQualquer dúvida, estou à disposição!`;

    await this.openWhatsApp(clientPhone, message);
  },

  /**
   * Compartilha um orçamento aprovado via WhatsApp (confirmação)
   */
  async shareApprovedQuoteViaWhatsApp(
    quoteId: string,
    clientPhone: string,
    clientName: string,
    totalValue: string,
  ): Promise<void> {
    const { url } = await this.getQuoteShareLink(quoteId);

    const message = `Olá ${clientName}!\n\nSeu orçamento no valor de ${totalValue} foi aprovado!\n\nAcesse o link para visualizar os detalhes:\n${url}\n\nAgradecemos a preferência!`;

    await this.openWhatsApp(clientPhone, message);
  },

  /**
   * Compartilha uma ordem de serviço via WhatsApp
   */
  async shareWorkOrderViaWhatsApp(
    workOrderId: string,
    clientPhone: string,
    clientName: string,
    title: string,
  ): Promise<void> {
    const { url } = await this.getWorkOrderShareLink(workOrderId);

    const message = `Olá ${clientName}!\n\nSegue o relatório do serviço "${title}".\n\nAcesse o link para visualizar os detalhes:\n${url}\n\nAgradecemos a preferência!`;

    await this.openWhatsApp(clientPhone, message);
  },

  /**
   * Compartilha usando o sistema nativo de compartilhamento
   */
  async shareNative(title: string, message: string, url?: string): Promise<void> {
    try {
      await Share.share({
        title,
        message: url ? `${message}\n\n${url}` : message,
        url, // iOS only
      });
    } catch (error: any) {
      if (error.message !== 'User did not share') {
        throw error;
      }
    }
  },

  /**
   * Copia o link para a área de transferência
   * Nota: Expo não tem acesso direto ao Clipboard, usar react-native Clipboard se necessário
   */
  async copyLink(url: string): Promise<void> {
    // Usar o Clipboard nativo através do Share como fallback
    await Share.share({
      message: url,
    });
  },
};

export default ShareService;
