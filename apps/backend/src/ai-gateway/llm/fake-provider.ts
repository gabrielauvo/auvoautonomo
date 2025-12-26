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

    // Get the last assistant message for context
    const lastAssistantMessage = [...messages]
      .reverse()
      .find((m) => m.role === 'assistant')?.content || '';

    const allMessages = messages.map((m) => m.content).join('\n');

    this.logger.debug(`FakeLLM processing: ${lastUserMessage.substring(0, 100)}...`);

    // First, check if this is a contextual response to a previous question
    const contextualResponse = this.handleContextualResponse(lastUserMessage, lastAssistantMessage);
    if (contextualResponse) {
      return contextualResponse;
    }

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

  /**
   * Handle contextual responses based on previous assistant question
   */
  private handleContextualResponse(
    userMessage: string,
    lastAssistantMessage: string,
  ): LLMResponse | null {
    // Parse the last assistant message to understand context
    let assistantContext: { type?: string; question?: string; options?: string[] } = {};
    try {
      assistantContext = JSON.parse(lastAssistantMessage);
    } catch {
      // Not a JSON response, check for known question patterns in text
      assistantContext = { question: lastAssistantMessage };
    }

    const question = assistantContext.question || lastAssistantMessage;
    const userInput = userMessage.trim();

    // Check if user selected one of the offered options
    if (assistantContext.options && assistantContext.options.length > 0) {
      const selectedOption = this.matchOption(userInput, assistantContext.options);
      if (selectedOption) {
        return this.handleOptionSelection(selectedOption, question);
      }
    }

    // Context: Asked for client name (for quote, OS, billing, etc.)
    if (this.isAskingForClientName(question)) {
      // User provided a name - proceed with action
      if (this.looksLikeName(userInput)) {
        return this.handleClientNameProvided(userInput, question);
      }
    }

    // Context: Asked for phone number
    if (this.isAskingForPhone(question)) {
      if (this.looksLikePhone(userInput) || userInput.toLowerCase() === 'pular telefone') {
        return this.handlePhoneProvided(userInput, question);
      }
    }

    // Context: Asked for service description (OS)
    if (this.isAskingForService(question)) {
      // Any non-empty response is a service description
      if (userInput.length > 2) {
        return this.handleServiceDescriptionProvided(userInput, question);
      }
    }

    // Context: Asked for quote items
    if (this.isAskingForQuoteItems(question)) {
      if (userInput.length > 2) {
        return this.handleQuoteItemsProvided(userInput, question);
      }
    }

    // Context: Asked for payment method
    if (this.isAskingForPaymentMethod(question)) {
      const method = this.detectPaymentMethod(userInput);
      if (method) {
        return this.handlePaymentMethodSelected(method);
      }
    }

    return null;
  }

  /**
   * Match user input to available options
   */
  private matchOption(userInput: string, options: string[]): string | null {
    const normalized = userInput.toLowerCase().trim();

    for (const option of options) {
      const optionLower = option.toLowerCase();
      // Exact match or partial match
      if (normalized === optionLower ||
          optionLower.includes(normalized) ||
          normalized.includes(optionLower)) {
        return option;
      }
    }

    // Check for common variations
    const variations: Record<string, string[]> = {
      'Criar novo cliente': ['criar', 'novo cliente', 'criar cliente'],
      'Buscar cliente': ['buscar', 'procurar', 'pesquisar'],
      'Criar novo orçamento': ['criar', 'novo', 'criar um', 'fazer', 'montar'],
      'Ver orçamentos pendentes': ['ver', 'pendentes', 'listar'],
      'Abrir nova OS': ['abrir', 'nova', 'criar'],
      'Ver OS pendentes': ['ver', 'pendentes', 'listar'],
      'PIX': ['pix'],
      'Boleto': ['boleto'],
      'Cartão de Crédito': ['cartão', 'cartao', 'crédito', 'credito'],
      'Ver meus clientes': ['ver clientes', 'meus clientes', 'listar clientes'],
      'Cancelar': ['cancelar', 'não', 'nao', 'deixa', 'esquece'],
      'Pular telefone': ['pular', 'sem telefone', 'não tem'],
    };

    for (const [option, vars] of Object.entries(variations)) {
      if (options.includes(option) && vars.some(v => normalized.includes(v))) {
        return option;
      }
    }

    return null;
  }

  /**
   * Handle when user selects an option
   */
  private handleOptionSelection(option: string, _context: string): LLMResponse {
    switch (option) {
      case 'Criar novo cliente':
      case 'Criar cliente':
        return this.createAskUserResponse(
          `Vamos cadastrar um novo cliente! 📝\n\n**Qual o nome do cliente?**`,
          ['Cancelar'],
        );

      case 'Buscar cliente':
        return {
          content: JSON.stringify({
            type: 'CALL_TOOL',
            tool: 'customers.search',
            params: { query: '', limit: 20, offset: 0 },
          }),
          usage: { inputTokens: 20, outputTokens: 30, totalTokens: 50 },
        };

      case 'Criar novo orçamento':
      case 'Fazer orçamento':
        return this.createAskUserResponse(
          `Vamos criar um orçamento! 📋\n\n` +
          `**Para qual cliente é esse orçamento?**\n\n` +
          `Digite o nome do cliente ou parte do nome para eu buscar.`,
          ['Ver meus clientes', 'Cancelar'],
        );

      case 'Ver orçamentos pendentes':
        return {
          content: JSON.stringify({
            type: 'CALL_TOOL',
            tool: 'quotes.search',
            params: { status: 'PENDING', limit: 20 },
          }),
          usage: { inputTokens: 20, outputTokens: 30, totalTokens: 50 },
        };

      case 'Abrir nova OS':
      case 'Abrir OS':
        return this.createAskUserResponse(
          `Vamos abrir uma ordem de serviço! 🔧\n\n` +
          `**Para qual cliente é essa OS?**\n\n` +
          `Digite o nome do cliente ou parte do nome.`,
          ['Ver meus clientes', 'Cancelar'],
        );

      case 'Ver OS pendentes':
        return {
          content: JSON.stringify({
            type: 'CALL_TOOL',
            tool: 'workOrders.search',
            params: { status: 'PENDING', limit: 20 },
          }),
          usage: { inputTokens: 20, outputTokens: 30, totalTokens: 50 },
        };

      case 'PIX':
      case 'Boleto':
      case 'Cartão de Crédito':
        return this.handlePaymentMethodSelected(option);

      case 'Gerar cobrança':
        return this.createAskUserResponse(
          `Vamos gerar uma cobrança! 💰\n\n**Como você quer cobrar?**`,
          ['PIX', 'Boleto', 'Cartão de Crédito', 'Cancelar'],
        );

      case 'Ver meus clientes':
        return {
          content: JSON.stringify({
            type: 'CALL_TOOL',
            tool: 'customers.search',
            params: { query: '', limit: 20, offset: 0 },
          }),
          usage: { inputTokens: 20, outputTokens: 30, totalTokens: 50 },
        };

      case 'Cancelar':
      case 'Pular telefone':
        return {
          content: JSON.stringify({
            type: 'RESPONSE',
            message: 'Tudo bem! 👍 Se precisar de algo, é só me chamar!',
          }),
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        };

      default:
        return this.createDefaultResponse();
    }
  }

  /**
   * Check if question is asking for client name
   */
  private isAskingForClientName(question: string): boolean {
    const patterns = [
      /qual\s+(?:o\s+)?(?:nome\s+d[oa]\s+)?cliente/i,
      /para\s+qual\s+cliente/i,
      /nome\s+do\s+cliente/i,
      /digite\s+o\s+nome/i,
    ];
    return patterns.some(p => p.test(question));
  }

  /**
   * Check if question is asking for phone
   */
  private isAskingForPhone(question: string): boolean {
    return /telefone|celular|fixo/i.test(question);
  }

  /**
   * Check if question is asking for service description
   */
  private isAskingForService(question: string): boolean {
    return /servi[çc]o\s+a\s+ser\s+realizado|descreva.*trabalho/i.test(question);
  }

  /**
   * Check if question is asking for quote items
   */
  private isAskingForQuoteItems(question: string): boolean {
    return /incluir\s+no\s+or[çc]amento|servi[çc]os\s+ou\s+produtos/i.test(question);
  }

  /**
   * Check if question is asking for payment method
   */
  private isAskingForPaymentMethod(question: string): boolean {
    return /como\s+(?:voc[eê]\s+)?quer\s+cobrar|forma\s+de\s+pagamento/i.test(question);
  }

  /**
   * Check if input looks like a name
   */
  private looksLikeName(input: string): boolean {
    // At least 2 characters, not a common command/keyword
    const commands = ['cancelar', 'não', 'sim', 'ok', 'ver', 'listar', 'buscar', 'criar'];
    return input.length >= 2 && !commands.includes(input.toLowerCase());
  }

  /**
   * Check if input looks like a phone number
   */
  private looksLikePhone(input: string): boolean {
    // Remove non-digits and check if we have enough digits for a phone
    const digits = input.replace(/\D/g, '');
    return digits.length >= 8;
  }

  /**
   * Detect payment method from user input
   */
  private detectPaymentMethod(input: string): string | null {
    const lower = input.toLowerCase();
    if (lower.includes('pix')) return 'PIX';
    if (lower.includes('boleto')) return 'Boleto';
    if (lower.includes('cart') || lower.includes('créd') || lower.includes('cred')) return 'Cartão de Crédito';
    return null;
  }

  /**
   * Handle when client name is provided
   */
  private handleClientNameProvided(clientName: string, question: string): LLMResponse {
    // Check what we're creating for this client
    if (question.includes('orçamento') || question.includes('quote')) {
      return this.createAskUserResponse(
        `Vou criar um orçamento para **${clientName}**! 📋\n\n` +
        `**O que você quer incluir no orçamento?**\n\n` +
        `Me conte os serviços ou produtos que deseja adicionar.`,
        ['Cancelar'],
      );
    }

    if (question.includes('OS') || question.includes('ordem')) {
      return this.createAskUserResponse(
        `Vou abrir uma OS para **${clientName}**! 🔧\n\n` +
        `**Qual o serviço a ser realizado?**\n\n` +
        `Descreva brevemente o trabalho.`,
        ['Cancelar'],
      );
    }

    if (question.includes('cobrança') || question.includes('cobrar')) {
      return this.createAskUserResponse(
        `Vou gerar uma cobrança para **${clientName}**! 💰\n\n` +
        `**Qual o valor da cobrança?**\n\n` +
        `Digite o valor (ex: 150,00)`,
        ['Cancelar'],
      );
    }

    // Default: creating a client
    return this.createAskUserResponse(
      `Vou criar o cliente **${clientName}**! 📝\n\n` +
      `**Qual o telefone do cliente?**\n` +
      `(Pode ser celular ou fixo)`,
      ['Pular telefone', 'Cancelar'],
    );
  }

  /**
   * Handle when phone is provided
   */
  private handlePhoneProvided(phone: string, _question: string): LLMResponse {
    const phoneDisplay = phone.toLowerCase() === 'pular telefone' ? 'não informado' : phone;
    return {
      content: JSON.stringify({
        type: 'RESPONSE',
        message: `Perfeito! Vou criar o cliente com telefone: **${phoneDisplay}** ✅\n\n` +
          `Cliente criado com sucesso! 🎉`,
      }),
      usage: { inputTokens: 20, outputTokens: 40, totalTokens: 60 },
    };
  }

  /**
   * Handle when service description is provided
   */
  private handleServiceDescriptionProvided(description: string, _question: string): LLMResponse {
    return {
      content: JSON.stringify({
        type: 'RESPONSE',
        message: `Ordem de serviço criada! 🔧✅\n\n` +
          `**Serviço:** ${description}\n\n` +
          `A OS foi criada com sucesso!`,
      }),
      usage: { inputTokens: 20, outputTokens: 40, totalTokens: 60 },
    };
  }

  /**
   * Handle when quote items are provided
   */
  private handleQuoteItemsProvided(items: string, _question: string): LLMResponse {
    return {
      content: JSON.stringify({
        type: 'RESPONSE',
        message: `Orçamento criado! 📋✅\n\n` +
          `**Itens:** ${items}\n\n` +
          `O orçamento foi criado com sucesso!`,
      }),
      usage: { inputTokens: 20, outputTokens: 40, totalTokens: 60 },
    };
  }

  /**
   * Handle payment method selection
   */
  private handlePaymentMethodSelected(method: string): LLMResponse {
    return this.createAskUserResponse(
      `Ótimo! Cobrança via **${method}**! 💰\n\n` +
      `**Qual o valor da cobrança?**\n\n` +
      `Digite o valor (ex: 150,00)`,
      ['Cancelar'],
    );
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
        pattern: /(?:criar|cadastrar|novo|adicionar)\s*(?:uma?\s+)?(?:novo\s+)?(?:cliente|customer)s?$/i,
        response: () => {
          return this.createAskUserResponse(
            `Vamos cadastrar um novo cliente! 📝\n\n` +
            `**Qual o nome do cliente?**`,
            ['Cancelar'],
          );
        },
      },

      // Pergunta sobre como criar cliente
      {
        pattern: /como\s+(?:fa[çc]o\s+(?:para\s+)?|posso\s+|adiciono?\s*|crio\s*|cadastro\s*)(?:uma?\s+)?(?:novo\s+)?(?:cliente|customer)/i,
        response: () => {
          return {
            content: JSON.stringify({
              type: 'RESPONSE',
              message: 'Para criar um novo cliente, basta me dizer! 👥\n\n' +
                'Você pode digitar algo como:\n' +
                '• "Criar cliente João Silva"\n' +
                '• "Novo cliente"\n' +
                '• "Cadastrar cliente"\n\n' +
                '**Quer que eu crie um cliente agora?**',
            }),
            usage: { inputTokens: 20, outputTokens: 50, totalTokens: 70 },
          };
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

      // Criar orçamento - sem detalhes (inclui plural)
      {
        pattern: /(?:criar|fazer|gerar|cadastrar|novo|montar|adicionar)\s*(?:uma?\s+)?(?:or[çc]amento|quote)s?$/i,
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
