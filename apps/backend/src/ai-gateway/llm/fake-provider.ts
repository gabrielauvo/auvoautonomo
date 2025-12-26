/**
 * Fake LLM Provider
 * For testing and development without real API calls
 */

import { Logger } from '@nestjs/common';
import {
  ILLMProvider,
  LLMCompletionRequest,
  LLMResponse,
} from './llm-provider.interface';

/**
 * Pattern-based response generator for testing
 */
interface FakeResponsePattern {
  pattern: RegExp;
  response: (match: RegExpMatchArray, messages: string) => LLMResponse;
}

export class FakeLLMProvider implements ILLMProvider {
  readonly name = 'fake';
  private readonly logger = new Logger(FakeLLMProvider.name);
  private readonly patterns: FakeResponsePattern[];

  constructor() {
    this.patterns = this.createPatterns();
  }

  isAvailable(): boolean {
    return true; // Always available
  }

  async complete(request: LLMCompletionRequest): Promise<LLMResponse> {
    const { messages } = request;

    // Get the last user message
    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === 'user')?.content || '';

    const allMessages = messages.map((m) => m.content).join('\n');

    this.logger.debug(`FakeLLM processing: ${lastUserMessage.substring(0, 100)}...`);

    // Find matching pattern
    for (const { pattern, response } of this.patterns) {
      const match = lastUserMessage.match(pattern);
      if (match) {
        return response(match, allMessages);
      }
    }

    // Default response
    return this.createDefaultResponse();
  }

  private createPatterns(): FakeResponsePattern[] {
    return [
      // Customer creation flow
      {
        pattern: /criar\s+(cliente|customer)/i,
        response: (match, messages) => {
          // Check if we have name in the message
          const nameMatch = messages.match(/nome[:\s]+([^\n,]+)/i);
          const emailMatch = messages.match(/email[:\s]+([^\s,]+@[^\s,]+)/i);
          const phoneMatch = messages.match(/(?:telefone|phone)[:\s]+([0-9\s\-\(\)]+)/i);

          const collectedFields: Record<string, string> = {};
          const missingFields: string[] = [];

          if (nameMatch) collectedFields.name = nameMatch[1].trim();
          else missingFields.push('name');

          if (emailMatch) collectedFields.email = emailMatch[1].trim();
          if (phoneMatch) collectedFields.phone = phoneMatch[1].trim();

          if (missingFields.length > 0) {
            return this.createPlanResponse('customers.create', collectedFields, missingFields);
          }

          // All required fields collected, ask for confirmation
          return this.createConfirmationRequest('customers.create', collectedFields);
        },
      },

      // Confirmation responses
      {
        pattern: /^(sim|confirmo|sim,?\s*confirmo|ok|pode|confirmar)$/i,
        response: () => {
          // This should be handled by state machine, but provide fallback
          return {
            content: JSON.stringify({
              type: 'RESPONSE',
              message: 'Por favor, inicie uma nova operação. Não há nenhuma ação pendente.',
            }),
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          };
        },
      },

      // Customer search
      {
        pattern: /(?:buscar|listar|pesquisar|procurar)\s+(?:clientes?|customers?)/i,
        response: () => ({
          content: JSON.stringify({
            type: 'CALL_TOOL',
            tool: 'customers.search',
            params: { query: '', limit: 20, offset: 0 },
          }),
          usage: { inputTokens: 20, outputTokens: 30, totalTokens: 50 },
        }),
      },

      // Work order creation
      {
        pattern: /criar\s+(?:ordem\s+de\s+servi[çc]o|os|work\s*order)/i,
        response: (match, messages) => {
          const customerIdMatch = messages.match(/cliente[:\s]+([a-f0-9-]{36})/i);
          const titleMatch = messages.match(/t[íi]tulo[:\s]+([^\n]+)/i);

          const collectedFields: Record<string, string> = {};
          const missingFields: string[] = [];

          if (customerIdMatch) collectedFields.customerId = customerIdMatch[1];
          else missingFields.push('customerId');

          if (titleMatch) collectedFields.title = titleMatch[1].trim();
          else missingFields.push('title');

          missingFields.push('items');

          return this.createPlanResponse('workOrders.create', collectedFields, missingFields);
        },
      },

      // Billing preview
      {
        pattern: /(?:cobrar|cobrança|pagamento|boleto|pix)/i,
        response: (match, messages) => {
          const customerIdMatch = messages.match(/cliente[:\s]+([a-f0-9-]{36})/i);
          const valueMatch = messages.match(/(?:valor|value)[:\s]+R?\$?\s*([0-9,.]+)/i);
          const typeMatch = messages.match(/(?:tipo|type)[:\s]+(pix|boleto|cartao|cart[aã]o|credit)/i);

          const collectedFields: Record<string, unknown> = {};
          const missingFields: string[] = [];

          if (customerIdMatch) collectedFields.customerId = customerIdMatch[1];
          else missingFields.push('customerId');

          if (valueMatch) {
            collectedFields.value = parseFloat(valueMatch[1].replace(',', '.'));
          } else {
            missingFields.push('value');
          }

          if (typeMatch) {
            const typeMap: Record<string, string> = {
              pix: 'PIX',
              boleto: 'BOLETO',
              cartao: 'CREDIT_CARD',
              cartão: 'CREDIT_CARD',
              credit: 'CREDIT_CARD',
            };
            collectedFields.billingType = typeMap[typeMatch[1].toLowerCase()];
          } else {
            missingFields.push('billingType');
          }

          missingFields.push('dueDate');

          return this.createPlanResponse('billing.previewCharge', collectedFields, missingFields);
        },
      },

      // Quote creation
      {
        pattern: /criar\s+(?:or[çc]amento|quote)/i,
        response: (match, messages) => {
          const customerIdMatch = messages.match(/cliente[:\s]+([a-f0-9-]{36})/i);
          const titleMatch = messages.match(/t[íi]tulo[:\s]+([^\n]+)/i);

          const collectedFields: Record<string, string> = {};
          const missingFields: string[] = [];

          if (customerIdMatch) collectedFields.customerId = customerIdMatch[1];
          else missingFields.push('customerId');

          if (titleMatch) collectedFields.title = titleMatch[1].trim();
          else missingFields.push('title');

          missingFields.push('items');

          return this.createPlanResponse('quotes.create', collectedFields, missingFields);
        },
      },
    ];
  }

  private createPlanResponse(
    tool: string,
    collectedFields: Record<string, unknown>,
    missingFields: string[],
  ): LLMResponse {
    const plan = {
      type: 'PLAN',
      action: tool,
      collectedFields,
      missingFields,
      suggestedActions: missingFields.length > 0
        ? [`Fornecer: ${missingFields.join(', ')}`]
        : ['Confirmar operação'],
      requiresConfirmation: true,
    };

    let message = '';
    if (missingFields.length > 0) {
      message = `Para criar, preciso das seguintes informações:\n${missingFields.map(f => `- ${f}`).join('\n')}`;
    } else {
      message = 'Todos os campos coletados. Confirma a operação?';
    }

    return {
      content: JSON.stringify({
        ...plan,
        message,
      }),
      usage: { inputTokens: 50, outputTokens: 100, totalTokens: 150 },
    };
  }

  private createConfirmationRequest(
    tool: string,
    params: Record<string, unknown>,
  ): LLMResponse {
    const summary = Object.entries(params)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join('\n');

    return {
      content: JSON.stringify({
        type: 'PLAN',
        action: tool,
        collectedFields: params,
        missingFields: [],
        suggestedActions: ['Confirmar operação'],
        requiresConfirmation: true,
        message: `Resumo da operação:\n${summary}\n\nDeseja confirmar?`,
      }),
      usage: { inputTokens: 30, outputTokens: 80, totalTokens: 110 },
    };
  }

  private createDefaultResponse(): LLMResponse {
    return {
      content: JSON.stringify({
        type: 'RESPONSE',
        message: 'Olá! Sou o AI Copilot do Auvo. Posso ajudá-lo a:\n' +
          '- Gerenciar clientes (buscar, criar, atualizar)\n' +
          '- Criar ordens de serviço\n' +
          '- Criar orçamentos\n' +
          '- Gerar cobranças (PIX, Boleto, Cartão)\n\n' +
          'O que você gostaria de fazer?',
      }),
      usage: { inputTokens: 20, outputTokens: 60, totalTokens: 80 },
    };
  }
}
