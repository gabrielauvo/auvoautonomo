/**
 * Fake LLM Provider
 * For testing and development without real API calls
 * Uses friendly, natural language responses for end users
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
      // ==========================================
      // CLIENTE / CUSTOMER
      // ==========================================

      // Criar cliente - com nome fornecido
      {
        pattern: /(?:criar|cadastrar|novo|adicionar)\s*(?:um\s+)?(?:cliente|customer)\s+(.+)/i,
        response: (match) => {
          const clientName = match[1].trim();
          return this.createAskUserResponse(
            `Vou criar o cliente "${clientName}" para você! 📝\n\n` +
            `Preciso de mais algumas informações:\n\n` +
            `**Qual o telefone do cliente?**\n` +
            `(Pode ser celular ou fixo)`,
            ['Pular telefone', 'Cancelar'],
          );
        },
      },

      // Criar cliente - sem nome
      {
        pattern: /(?:criar|cadastrar|novo|adicionar)\s*(?:um\s+)?(?:cliente|customer)$/i,
        response: () => {
          return this.createAskUserResponse(
            `Vamos cadastrar um novo cliente! 📝\n\n` +
            `**Qual o nome do cliente?**`,
            ['Cancelar'],
          );
        },
      },

      // Buscar/listar clientes
      {
        pattern: /(?:buscar|listar|pesquisar|procurar|ver|mostrar|encontrar)\s*(?:os\s+)?(?:meus\s+)?(?:clientes?|customers?)/i,
        response: () => ({
          content: JSON.stringify({
            type: 'CALL_TOOL',
            tool: 'customers.search',
            params: { query: '', limit: 20, offset: 0 },
          }),
          usage: { inputTokens: 20, outputTokens: 30, totalTokens: 50 },
        }),
      },

      // Intenção de cliente genérica
      {
        pattern: /(?:quero|preciso|gostaria|ajud[ae]|me\s+ajud[ae]).*(?:cliente|customer)/i,
        response: () => {
          return this.createAskUserResponse(
            `Posso ajudar com clientes! 👥\n\n` +
            `O que você gostaria de fazer?`,
            ['Criar novo cliente', 'Buscar cliente', 'Cancelar'],
          );
        },
      },

      // ==========================================
      // ORÇAMENTO / QUOTE
      // ==========================================

      // Criar orçamento - com detalhes
      {
        pattern: /(?:criar|fazer|gerar|cadastrar|novo|montar|adicionar)\s*(?:um\s+)?(?:or[çc]amento|quote)\s+(?:para|pro?)\s+(.+)/i,
        response: (match) => {
          const clientRef = match[1].trim();
          return this.createAskUserResponse(
            `Vou criar um orçamento para "${clientRef}"! 📋\n\n` +
            `**O que você quer incluir no orçamento?**\n\n` +
            `Me conte os serviços ou produtos que deseja adicionar.`,
            ['Cancelar'],
          );
        },
      },

      // Criar orçamento - sem detalhes
      {
        pattern: /(?:criar|fazer|gerar|cadastrar|novo|montar|adicionar)\s*(?:um\s+)?(?:or[çc]amento|quote)$/i,
        response: () => {
          return this.createAskUserResponse(
            `Vamos criar um orçamento! 📋\n\n` +
            `**Para qual cliente é esse orçamento?**\n\n` +
            `Digite o nome do cliente ou parte do nome para eu buscar.`,
            ['Ver meus clientes', 'Cancelar'],
          );
        },
      },

      // Apenas "orçamento" sozinho
      {
        pattern: /^(?:or[çc]amento|quote)s?$/i,
        response: () => {
          return this.createAskUserResponse(
            `Você quer trabalhar com orçamentos? 📋\n\n` +
            `O que posso fazer por você?`,
            ['Criar novo orçamento', 'Ver orçamentos pendentes', 'Cancelar'],
          );
        },
      },

      // Intenção de orçamento genérica
      {
        pattern: /(?:quero|preciso|gostaria|ajud[ae]|me\s+ajud[ae]|como).*(?:or[çc]amento|quote)/i,
        response: () => {
          return this.createAskUserResponse(
            `Posso ajudar com orçamentos! 📋\n\n` +
            `O que você gostaria de fazer?`,
            ['Criar novo orçamento', 'Ver orçamentos pendentes', 'Cancelar'],
          );
        },
      },

      // ==========================================
      // ORDEM DE SERVIÇO / WORK ORDER
      // ==========================================

      // Criar OS - com detalhes
      {
        pattern: /(?:criar|cadastrar|nova?|abrir|adicionar)\s*(?:uma?\s+)?(?:ordem\s+de\s+servi[çc]o|os)\s+(?:para|pro?)\s+(.+)/i,
        response: (match) => {
          const clientRef = match[1].trim();
          return this.createAskUserResponse(
            `Vou abrir uma OS para "${clientRef}"! 🔧\n\n` +
            `**Qual o serviço a ser realizado?**\n\n` +
            `Descreva brevemente o trabalho.`,
            ['Cancelar'],
          );
        },
      },

      // Criar OS - sem detalhes
      {
        pattern: /(?:criar|cadastrar|nova?|abrir|adicionar)\s*(?:uma?\s+)?(?:ordem\s+de\s+servi[çc]o|os)$/i,
        response: () => {
          return this.createAskUserResponse(
            `Vamos abrir uma ordem de serviço! 🔧\n\n` +
            `**Para qual cliente é essa OS?**\n\n` +
            `Digite o nome do cliente ou parte do nome.`,
            ['Ver meus clientes', 'Cancelar'],
          );
        },
      },

      // Intenção de OS genérica
      {
        pattern: /(?:quero|preciso|gostaria|ajud[ae]|me\s+ajud[ae]|como).*(?:ordem\s+de\s+servi[çc]o|os)/i,
        response: () => {
          return this.createAskUserResponse(
            `Posso ajudar com ordens de serviço! 🔧\n\n` +
            `O que você gostaria de fazer?`,
            ['Abrir nova OS', 'Ver OS pendentes', 'Cancelar'],
          );
        },
      },

      // ==========================================
      // COBRANÇA / BILLING
      // ==========================================

      // Criar cobrança com valor
      {
        pattern: /(?:cobrar|gerar\s+cobran[çc]a|criar\s+cobran[çc]a).*?(?:de\s+)?R?\$?\s*(\d+(?:[.,]\d{2})?)/i,
        response: (match) => {
          const value = match[1].replace(',', '.');
          return this.createAskUserResponse(
            `Vou gerar uma cobrança de **R$ ${parseFloat(value).toFixed(2)}**! 💰\n\n` +
            `**Para qual cliente é essa cobrança?**\n\n` +
            `Digite o nome do cliente.`,
            ['Ver meus clientes', 'Cancelar'],
          );
        },
      },

      // Cobrança genérica
      {
        pattern: /(?:cobrar|cobran[çc]a|pagamento|boleto|pix|gerar\s+cobran)/i,
        response: () => {
          return this.createAskUserResponse(
            `Vamos gerar uma cobrança! 💰\n\n` +
            `**Como você quer cobrar?**`,
            ['PIX', 'Boleto', 'Cartão de Crédito', 'Cancelar'],
          );
        },
      },

      // ==========================================
      // CONFIRMAÇÕES
      // ==========================================

      {
        pattern: /^(sim|confirmo|sim,?\s*confirmo|ok|pode|confirmar|isso|exato|correto)$/i,
        response: () => {
          return {
            content: JSON.stringify({
              type: 'RESPONSE',
              message: '✅ Entendido! Mas parece que não há nenhuma operação pendente.\n\n' +
                'Como posso ajudar você agora?',
            }),
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          };
        },
      },

      // Cancelar
      {
        pattern: /^(n[aã]o|cancelar|cancela|deixa|esquece|para)$/i,
        response: () => {
          return {
            content: JSON.stringify({
              type: 'RESPONSE',
              message: 'Tudo bem! Operação cancelada. 👍\n\n' +
                'Se precisar de algo, é só me chamar!',
            }),
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          };
        },
      },

      // ==========================================
      // SAUDAÇÕES E AJUDA GERAL
      // ==========================================

      // Saudações
      {
        pattern: /^(oi|ol[aá]|hey|hi|hello|bom\s+dia|boa\s+tarde|boa\s+noite|e\s+a[ií])$/i,
        response: () => {
          return {
            content: JSON.stringify({
              type: 'RESPONSE',
              message: 'Olá! 👋 Sou seu assistente do Auvo.\n\n' +
                'Posso ajudar você a:\n' +
                '• Criar e gerenciar **clientes**\n' +
                '• Fazer **orçamentos**\n' +
                '• Abrir **ordens de serviço**\n' +
                '• Gerar **cobranças** (PIX, Boleto, Cartão)\n\n' +
                'O que você precisa hoje?',
            }),
            usage: { inputTokens: 20, outputTokens: 60, totalTokens: 80 },
          };
        },
      },

      // Pedido de ajuda
      {
        pattern: /(?:ajuda|help|me\s+ajud[ae]|preciso\s+de\s+ajuda)/i,
        response: () => {
          return this.createAskUserResponse(
            `Claro! Estou aqui para ajudar! 🤝\n\n` +
            `O que você precisa fazer?`,
            ['Criar cliente', 'Fazer orçamento', 'Abrir OS', 'Gerar cobrança'],
          );
        },
      },

      // O que você faz / pode fazer
      {
        pattern: /(?:o\s+que\s+(?:voc[eê]|vc)\s+(?:faz|pode|consegue)|quais?\s+(?:s[aã]o\s+)?(?:suas?\s+)?fun[çc][oõ]es)/i,
        response: () => {
          return {
            content: JSON.stringify({
              type: 'RESPONSE',
              message: 'Posso ajudar você com várias tarefas do dia a dia! 🚀\n\n' +
                '**👥 Clientes**\n' +
                'Criar, buscar e atualizar cadastros\n\n' +
                '**📋 Orçamentos**\n' +
                'Montar orçamentos para seus clientes\n\n' +
                '**🔧 Ordens de Serviço**\n' +
                'Abrir e acompanhar OS\n\n' +
                '**💰 Cobranças**\n' +
                'Gerar PIX, Boleto ou Cartão\n\n' +
                'É só me dizer o que precisa!',
            }),
            usage: { inputTokens: 20, outputTokens: 100, totalTokens: 120 },
          };
        },
      },

      // Agradecimentos
      {
        pattern: /(?:obrigad[oa]|valeu|thanks|vlw|brigad)/i,
        response: () => {
          return {
            content: JSON.stringify({
              type: 'RESPONSE',
              message: 'Por nada! 😊 Precisando, é só chamar!',
            }),
            usage: { inputTokens: 10, outputTokens: 15, totalTokens: 25 },
          };
        },
      },
    ];
  }

  /**
   * Create a friendly ASK_USER response
   */
  private createAskUserResponse(
    question: string,
    options: string[],
  ): LLMResponse {
    return {
      content: JSON.stringify({
        type: 'ASK_USER',
        question,
        options,
      }),
      usage: { inputTokens: 30, outputTokens: 50, totalTokens: 80 },
    };
  }

  /**
   * Default response for unrecognized inputs
   */
  private createDefaultResponse(): LLMResponse {
    return {
      content: JSON.stringify({
        type: 'RESPONSE',
        message: 'Oi! 👋 Não entendi bem o que você precisa.\n\n' +
          'Posso ajudar com:\n' +
          '• **Clientes** - "criar cliente João"\n' +
          '• **Orçamentos** - "fazer orçamento"\n' +
          '• **OS** - "abrir ordem de serviço"\n' +
          '• **Cobranças** - "gerar cobrança PIX"\n\n' +
          'Tenta de novo? 😊',
      }),
      usage: { inputTokens: 20, outputTokens: 60, totalTokens: 80 },
    };
  }
}
