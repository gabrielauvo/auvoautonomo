'use client';

/**
 * ChatMessage Component
 * Renders a single chat message with support for plans and entity links
 */

import { ChatMessage as ChatMessageType, PlanData, EntityLink } from '@/services/ai-chat.service';
import { cn } from '@/lib/utils';
import { Bot, User, CheckCircle, XCircle, ExternalLink, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface ChatMessageProps {
  message: ChatMessageType;
  isLast?: boolean;
}

export function ChatMessage({ message, isLast }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  return (
    <div
      className={cn(
        'flex gap-3 py-3 px-4',
        isUser && 'flex-row-reverse',
        isAssistant && 'bg-gray-50'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          isUser ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'
        )}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Content */}
      <div className={cn('flex-1 min-w-0', isUser && 'text-right')}>
        {/* Message text */}
        <div
          className={cn(
            'inline-block max-w-[85%] rounded-lg px-4 py-2 text-sm',
            isUser
              ? 'bg-primary text-white rounded-br-none'
              : 'bg-white border border-gray-200 rounded-bl-none'
          )}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>

        {/* Plan card */}
        {message.plan && isAssistant && (
          <PlanCard plan={message.plan} />
        )}

        {/* Executed tools results */}
        {message.executedTools && message.executedTools.length > 0 && (
          <ExecutedToolsCard tools={message.executedTools} />
        )}

        {/* Entity links */}
        {message.entityLinks && message.entityLinks.length > 0 && (
          <EntityLinksCard links={message.entityLinks} />
        )}

        {/* Timestamp */}
        <div
          className={cn(
            'text-xs text-gray-400 mt-1',
            isUser ? 'text-right' : 'text-left'
          )}
        >
          {formatTime(message.timestamp)}
        </div>
      </div>
    </div>
  );
}

/**
 * Plan Card Component
 */
interface PlanCardProps {
  plan: PlanData;
}

function PlanCard({ plan }: PlanCardProps) {
  const actionNames: Record<string, string> = {
    'customers.create': 'Criar Cliente',
    'workOrders.create': 'Criar Ordem de Serviço',
    'quotes.create': 'Criar Orçamento',
    'billing.previewCharge': 'Preview de Cobrança',
    'billing.createCharge': 'Criar Cobrança',
  };

  const actionName = actionNames[plan.action] || plan.action;
  const isBilling = plan.action.startsWith('billing.');

  return (
    <div className="mt-3 ml-0 max-w-[85%]">
      <div
        className={cn(
          'rounded-lg border p-4',
          isBilling ? 'border-amber-300 bg-amber-50' : 'border-blue-200 bg-blue-50'
        )}
      >
        <div className="flex items-start gap-2 mb-3">
          {isBilling && <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />}
          <div>
            <h4 className="font-medium text-gray-900">{actionName}</h4>
            {isBilling && (
              <p className="text-xs text-amber-700 mt-1">
                Esta ação irá gerar uma cobrança real
              </p>
            )}
          </div>
        </div>

        {/* Parameters */}
        <div className="space-y-1 text-sm">
          {Object.entries(plan.params)
            .filter(([key]) => !['idempotencyKey', 'previewId'].includes(key))
            .map(([key, value]) => (
              <div key={key} className="flex gap-2">
                <span className="text-gray-500 capitalize">{formatParamName(key)}:</span>
                <span className="text-gray-900 font-medium">
                  {formatParamValue(value)}
                </span>
              </div>
            ))}
        </div>

        {/* Missing fields */}
        {plan.missingFields && plan.missingFields.length > 0 && (
          <div className="mt-3 pt-3 border-t border-blue-200">
            <p className="text-sm text-blue-700">
              Campos faltantes: {plan.missingFields.join(', ')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Executed Tools Card Component
 */
interface ExecutedToolsCardProps {
  tools: Array<{
    tool: string;
    success: boolean;
    result?: unknown;
    error?: string;
  }>;
}

function ExecutedToolsCard({ tools }: ExecutedToolsCardProps) {
  return (
    <div className="mt-2 ml-0 max-w-[85%] space-y-1">
      {tools.map((tool, index) => (
        <div
          key={index}
          className={cn(
            'flex items-center gap-2 text-xs px-3 py-1.5 rounded-md',
            tool.success
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-700'
          )}
        >
          {tool.success ? (
            <CheckCircle className="w-3.5 h-3.5" />
          ) : (
            <XCircle className="w-3.5 h-3.5" />
          )}
          <span className="font-medium">{formatToolName(tool.tool)}</span>
          {tool.error && <span className="text-red-600">- {tool.error}</span>}
        </div>
      ))}
    </div>
  );
}

/**
 * Entity Links Card Component
 */
interface EntityLinksCardProps {
  links: EntityLink[];
}

function EntityLinksCard({ links }: EntityLinksCardProps) {
  return (
    <div className="mt-2 ml-0 max-w-[85%] space-y-1">
      {links.map((link, index) => (
        <Link
          key={index}
          href={link.url}
          className="flex items-center gap-2 text-sm px-3 py-2 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          <span>{link.label}</span>
        </Link>
      ))}
    </div>
  );
}

// Helpers

function formatTime(date: Date): string {
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatParamName(name: string): string {
  const names: Record<string, string> = {
    customerId: 'Cliente',
    name: 'Nome',
    email: 'E-mail',
    phone: 'Telefone',
    title: 'Título',
    description: 'Descrição',
    value: 'Valor',
    dueDate: 'Vencimento',
    billingType: 'Tipo',
    items: 'Itens',
    scheduledDate: 'Data Agendada',
  };
  return names[name] || name;
}

function formatParamValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'number') {
    // Format as currency if it looks like money
    if (value >= 1 && value <= 1000000) {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(value);
    }
    return value.toString();
  }
  if (Array.isArray(value)) return `${value.length} item(s)`;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatToolName(tool: string): string {
  const names: Record<string, string> = {
    'customers.search': 'Buscar clientes',
    'customers.get': 'Ver cliente',
    'customers.create': 'Criar cliente',
    'workOrders.search': 'Buscar ordens',
    'workOrders.get': 'Ver ordem',
    'workOrders.create': 'Criar ordem',
    'quotes.search': 'Buscar orçamentos',
    'quotes.get': 'Ver orçamento',
    'quotes.create': 'Criar orçamento',
    'billing.searchCharges': 'Buscar cobranças',
    'billing.getCharge': 'Ver cobrança',
    'billing.previewCharge': 'Preview cobrança',
    'billing.createCharge': 'Criar cobrança',
    'kb.search': 'Buscar na base',
  };
  return names[tool] || tool;
}

export default ChatMessage;
