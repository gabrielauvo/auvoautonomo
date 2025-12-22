// @ts-nocheck
/**
 * Orçamentos - Detalhes do Orçamento
 *
 * Tela de visualização de um orçamento específico.
 */

import React, { useCallback, useState, useEffect } from 'react';
import { SafeAreaView, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { QuoteDetailScreen, QuoteWithItems } from '../../src/modules/quotes';
import { QuoteService } from '../../src/modules/quotes/QuoteService';
import { ClientService } from '../../src/modules/clients/ClientService';
import { Quote } from '../../src/db/schema';
import { useAuth } from '../../src/services';
import { useColors } from '../../src/design-system/ThemeProvider';
import { useTranslation } from '../../src/i18n';

export default function OrcamentoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const colors = useColors();
  const { t } = useTranslation();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [clientPhone, setClientPhone] = useState<string | undefined>(undefined);
  const [currentQuote, setCurrentQuote] = useState<QuoteWithItems | null>(null);

  // Configurar serviços e recarregar dados quando a tela receber foco
  useFocusEffect(
    useCallback(() => {
      if (user?.technicianId) {
        QuoteService.configure(user.technicianId);
        ClientService.configure(user.technicianId);
      }
      // Incrementa o trigger para forçar reload dos dados do orçamento
      setRefreshTrigger(prev => prev + 1);
    }, [user?.technicianId])
  );

  // Buscar telefone do cliente quando o orçamento carregar
  useEffect(() => {
    const loadClientPhone = async () => {
      if (!id) return;
      try {
        const quote = await QuoteService.getQuoteWithItems(id);
        setCurrentQuote(quote);
        if (quote?.clientId) {
          const client = await ClientService.getClient(quote.clientId);
          setClientPhone(client?.phone || undefined);
        }
      } catch (error) {
        console.error('[OrcamentoDetail] Error loading client:', error);
      }
    };
    loadClientPhone();
  }, [id, refreshTrigger]);

  // Handler para mudança de status
  const handleStatusChange = (updatedQuote: Quote) => {
    console.log('[OrcamentoDetail] Status changed:', updatedQuote.status);
  };

  // Handler para editar orçamento
  const handleEdit = (quote: QuoteWithItems) => {
    router.push(`/orcamentos/editar/${quote.id}`);
  };

  // Handler para deletar orçamento
  const handleDelete = () => {
    router.back();
  };

  // Handler para converter em cobrança
  const handleConvertToInvoice = (quote: QuoteWithItems) => {
    // Navega para a tela de criar cobrança com dados pré-preenchidos do orçamento
    router.push(
      `/cobrancas/nova?quoteId=${quote.id}&clientId=${quote.clientId}&clientName=${encodeURIComponent(quote.clientName || '')}&value=${quote.totalValue}&description=${encodeURIComponent(`Orçamento aprovado - ${quote.clientName || 'Cliente'}`)}`
    );
  };

  // Handler para converter em OS
  const handleConvertToWorkOrder = (quote: QuoteWithItems) => {
    router.push(`/os/novo?quoteId=${quote.id}&clientId=${quote.clientId}`);
  };

  // Handler para coletar assinatura
  const handleCollectSignature = (quote: QuoteWithItems) => {
    router.push(`/orcamentos/assinar/${quote.id}`);
  };

  // Handler para voltar
  const handleBack = () => {
    router.back();
  };

  if (!id) {
    return null;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      <QuoteDetailScreen
        quoteId={id}
        onStatusChange={handleStatusChange}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onConvertToInvoice={handleConvertToInvoice}
        onConvertToWorkOrder={handleConvertToWorkOrder}
        onCollectSignature={handleCollectSignature}
        onBack={handleBack}
        refreshTrigger={refreshTrigger}
        clientPhone={clientPhone}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
