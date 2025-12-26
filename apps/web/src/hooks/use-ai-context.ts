/**
 * useAiContext Hook
 * Provides page context for AI Copilot
 */

import { useMemo } from 'react';
import { usePathname, useParams } from 'next/navigation';
import { ChatContext } from '../services/ai-chat.service';

export interface UseAiContextOptions {
  /** Override entity ID */
  entityId?: string;
  /** Override entity type */
  entityType?: 'customer' | 'workOrder' | 'quote' | 'charge';
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface UseAiContextReturn {
  /** Current page context */
  context: ChatContext;
  /** Current page name */
  pageName: string;
  /** Whether on a detail page */
  isDetailPage: boolean;
  /** Whether on a list page */
  isListPage: boolean;
}

/**
 * Map pathname to page name and entity type
 */
function parsePathname(pathname: string): {
  pageName: string;
  entityType?: ChatContext['entityType'];
  isDetailPage: boolean;
  isListPage: boolean;
} {
  const parts = pathname.split('/').filter(Boolean);

  // Remove (dashboard) group from path
  const cleanParts = parts.filter((p) => !p.startsWith('('));

  // Default values
  let pageName = 'dashboard';
  let entityType: ChatContext['entityType'];
  let isDetailPage = false;
  let isListPage = false;

  if (cleanParts.length === 0) {
    return { pageName, entityType, isDetailPage, isListPage };
  }

  const firstPart = cleanParts[0];

  switch (firstPart) {
    case 'clients':
      pageName = 'Clientes';
      entityType = 'customer';
      isListPage = cleanParts.length === 1;
      isDetailPage = cleanParts.length >= 2 && !['new', 'import'].includes(cleanParts[1]);
      break;

    case 'work-orders':
      pageName = 'Ordens de Serviço';
      entityType = 'workOrder';
      isListPage = cleanParts.length === 1;
      isDetailPage = cleanParts.length >= 2 && cleanParts[1] !== 'new';
      break;

    case 'quotes':
      pageName = 'Orçamentos';
      entityType = 'quote';
      isListPage = cleanParts.length === 1;
      isDetailPage = cleanParts.length >= 2 && cleanParts[1] !== 'new';
      break;

    case 'billing':
      if (cleanParts[1] === 'charges') {
        pageName = 'Cobranças';
        entityType = 'charge';
        isListPage = cleanParts.length === 2;
        isDetailPage = cleanParts.length >= 3 && cleanParts[2] !== 'new';
      } else {
        pageName = 'Financeiro';
      }
      break;

    case 'schedule':
      pageName = 'Agenda';
      break;

    case 'catalog':
      pageName = 'Catálogo';
      break;

    case 'expenses':
      pageName = 'Despesas';
      break;

    case 'inventory':
      pageName = 'Estoque';
      break;

    case 'reports':
      pageName = 'Relatórios';
      break;

    case 'settings':
      pageName = 'Configurações';
      break;

    case 'dashboard':
    default:
      pageName = 'Dashboard';
      break;
  }

  return { pageName, entityType, isDetailPage, isListPage };
}

export function useAiContext(options: UseAiContextOptions = {}): UseAiContextReturn {
  const pathname = usePathname();
  const params = useParams();

  const { pageName, entityType, isDetailPage, isListPage } = useMemo(
    () => parsePathname(pathname),
    [pathname]
  );

  // Get entity ID from params or options
  const entityId = useMemo(() => {
    if (options.entityId) return options.entityId;
    if (params?.id && typeof params.id === 'string') return params.id;
    return undefined;
  }, [options.entityId, params?.id]);

  // Build context
  const context = useMemo<ChatContext>(() => {
    return {
      currentPage: pathname,
      entityId: entityId,
      entityType: options.entityType || entityType,
      metadata: {
        pageName,
        isDetailPage,
        isListPage,
        ...options.metadata,
      },
    };
  }, [
    pathname,
    entityId,
    entityType,
    options.entityType,
    options.metadata,
    pageName,
    isDetailPage,
    isListPage,
  ]);

  return {
    context,
    pageName,
    isDetailPage,
    isListPage,
  };
}

export default useAiContext;
