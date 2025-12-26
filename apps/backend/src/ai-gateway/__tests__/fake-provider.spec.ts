/**
 * FakeLLMProvider Tests
 * Tests for contextual conversation handling
 */

import { FakeLLMProvider } from '../llm/fake-provider';

describe('FakeLLMProvider', () => {
  let provider: FakeLLMProvider;

  beforeEach(() => {
    provider = new FakeLLMProvider();
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
    expect(provider.name).toBe('fake');
  });

  it('should always be available', () => {
    expect(provider.isAvailable()).toBe(true);
  });

  describe('Pattern Matching', () => {
    it('should respond to greetings', async () => {
      const response = await provider.complete({
        messages: [{ role: 'user', content: 'olá' }],
      });

      const parsed = JSON.parse(response.content);
      expect(parsed.type).toBe('RESPONSE');
      expect(parsed.message).toContain('Olá');
    });

    it('should offer options when asking about quotes', async () => {
      const response = await provider.complete({
        messages: [{ role: 'user', content: 'quero fazer orçamentos' }],
      });

      const parsed = JSON.parse(response.content);
      expect(parsed.type).toBe('ASK_USER');
      expect(parsed.question).toContain('orçamentos');
      expect(parsed.options).toContain('Criar novo orçamento');
    });

    it('should ask for client name when creating quote without details', async () => {
      const response = await provider.complete({
        messages: [{ role: 'user', content: 'criar orçamento' }],
      });

      const parsed = JSON.parse(response.content);
      expect(parsed.type).toBe('ASK_USER');
      expect(parsed.question).toContain('qual cliente');
    });
  });

  describe('Contextual Responses', () => {
    it('should understand client name when asked for it', async () => {
      // First message: user wants to create quote
      const firstResponse = await provider.complete({
        messages: [{ role: 'user', content: 'criar orçamento' }],
      });

      const firstParsed = JSON.parse(firstResponse.content);
      expect(firstParsed.type).toBe('ASK_USER');
      expect(firstParsed.question).toContain('qual cliente');

      // Second message: user provides name "Danilo"
      const secondResponse = await provider.complete({
        messages: [
          { role: 'user', content: 'criar orçamento' },
          { role: 'assistant', content: firstResponse.content },
          { role: 'user', content: 'Danilo' },
        ],
      });

      const secondParsed = JSON.parse(secondResponse.content);
      expect(secondParsed.type).toBe('ASK_USER');
      expect(secondParsed.question).toContain('Danilo');
      expect(secondParsed.question).toContain('incluir');
    });

    it('should understand "criar um" as option selection', async () => {
      // First message: user asks about quotes
      const firstResponse = await provider.complete({
        messages: [{ role: 'user', content: 'quero fazer orçamentos' }],
      });

      const firstParsed = JSON.parse(firstResponse.content);
      expect(firstParsed.options).toContain('Criar novo orçamento');

      // Second message: user says "criar um"
      const secondResponse = await provider.complete({
        messages: [
          { role: 'user', content: 'quero fazer orçamentos' },
          { role: 'assistant', content: firstResponse.content },
          { role: 'user', content: 'criar um' },
        ],
      });

      const secondParsed = JSON.parse(secondResponse.content);
      expect(secondParsed.type).toBe('ASK_USER');
      expect(secondParsed.question).toContain('qual cliente');
    });

    it('should complete full quote creation flow', async () => {
      // Step 1: User wants to make quotes
      const step1 = await provider.complete({
        messages: [{ role: 'user', content: 'quero fazer orçamentos' }],
      });
      const parsed1 = JSON.parse(step1.content);
      expect(parsed1.options).toContain('Criar novo orçamento');

      // Step 2: User selects "Criar novo orçamento"
      const step2 = await provider.complete({
        messages: [
          { role: 'user', content: 'quero fazer orçamentos' },
          { role: 'assistant', content: step1.content },
          { role: 'user', content: 'Criar novo orçamento' },
        ],
      });
      const parsed2 = JSON.parse(step2.content);
      expect(parsed2.question).toContain('qual cliente');

      // Step 3: User provides client name
      const step3 = await provider.complete({
        messages: [
          { role: 'user', content: 'quero fazer orçamentos' },
          { role: 'assistant', content: step1.content },
          { role: 'user', content: 'Criar novo orçamento' },
          { role: 'assistant', content: step2.content },
          { role: 'user', content: 'Maria Silva' },
        ],
      });
      const parsed3 = JSON.parse(step3.content);
      expect(parsed3.question).toContain('Maria Silva');
      expect(parsed3.question).toContain('incluir');

      // Step 4: User provides items
      const step4 = await provider.complete({
        messages: [
          { role: 'user', content: 'quero fazer orçamentos' },
          { role: 'assistant', content: step1.content },
          { role: 'user', content: 'Criar novo orçamento' },
          { role: 'assistant', content: step2.content },
          { role: 'user', content: 'Maria Silva' },
          { role: 'assistant', content: step3.content },
          { role: 'user', content: 'Manutenção de ar condicionado' },
        ],
      });
      const parsed4 = JSON.parse(step4.content);
      expect(parsed4.type).toBe('RESPONSE');
      expect(parsed4.message).toContain('criado');
    });

    it('should complete full OS creation flow', async () => {
      // Step 1: User wants to create OS
      const step1 = await provider.complete({
        messages: [{ role: 'user', content: 'abrir ordem de serviço' }],
      });
      const parsed1 = JSON.parse(step1.content);
      expect(parsed1.question).toContain('qual cliente');

      // Step 2: User provides client name
      const step2 = await provider.complete({
        messages: [
          { role: 'user', content: 'abrir ordem de serviço' },
          { role: 'assistant', content: step1.content },
          { role: 'user', content: 'João' },
        ],
      });
      const parsed2 = JSON.parse(step2.content);
      expect(parsed2.question).toContain('João');
      expect(parsed2.question).toContain('serviço');

      // Step 3: User provides service description
      const step3 = await provider.complete({
        messages: [
          { role: 'user', content: 'abrir ordem de serviço' },
          { role: 'assistant', content: step1.content },
          { role: 'user', content: 'João' },
          { role: 'assistant', content: step2.content },
          { role: 'user', content: 'Instalação de câmeras' },
        ],
      });
      const parsed3 = JSON.parse(step3.content);
      expect(parsed3.type).toBe('RESPONSE');
      expect(parsed3.message).toContain('criada');
    });

    it('should handle payment method selection', async () => {
      // Step 1: User wants to create billing
      const step1 = await provider.complete({
        messages: [{ role: 'user', content: 'gerar cobrança' }],
      });
      const parsed1 = JSON.parse(step1.content);
      expect(parsed1.options).toContain('PIX');

      // Step 2: User selects PIX
      const step2 = await provider.complete({
        messages: [
          { role: 'user', content: 'gerar cobrança' },
          { role: 'assistant', content: step1.content },
          { role: 'user', content: 'PIX' },
        ],
      });
      const parsed2 = JSON.parse(step2.content);
      expect(parsed2.question).toContain('PIX');
      expect(parsed2.question).toContain('valor');
    });

    it('should handle cancellation', async () => {
      const step1 = await provider.complete({
        messages: [{ role: 'user', content: 'criar cliente' }],
      });

      const step2 = await provider.complete({
        messages: [
          { role: 'user', content: 'criar cliente' },
          { role: 'assistant', content: step1.content },
          { role: 'user', content: 'cancelar' },
        ],
      });

      const parsed = JSON.parse(step2.content);
      expect(parsed.type).toBe('RESPONSE');
      expect(parsed.message).toContain('Tudo bem');
    });
  });

  describe('Edge Cases', () => {
    it('should return default response for unknown input without context', async () => {
      const response = await provider.complete({
        messages: [{ role: 'user', content: 'xyz123' }],
      });

      const parsed = JSON.parse(response.content);
      expect(parsed.type).toBe('RESPONSE');
      expect(parsed.message).toContain('Não entendi');
    });

    it('should handle empty messages array', async () => {
      const response = await provider.complete({
        messages: [],
      });

      const parsed = JSON.parse(response.content);
      expect(parsed.type).toBe('RESPONSE');
    });

    it('should handle thank you messages', async () => {
      const response = await provider.complete({
        messages: [{ role: 'user', content: 'obrigado' }],
      });

      const parsed = JSON.parse(response.content);
      expect(parsed.type).toBe('RESPONSE');
      expect(parsed.message).toContain('nada');
    });
  });
});
