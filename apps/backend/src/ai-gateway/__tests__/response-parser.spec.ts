import { LLMResponseParser, responseParser } from '../llm/response-parser';

describe('LLMResponseParser', () => {
  let parser: LLMResponseParser;

  beforeEach(() => {
    parser = new LLMResponseParser();
  });

  describe('parse', () => {
    describe('PLAN responses', () => {
      it('should parse valid PLAN response', () => {
        const content = JSON.stringify({
          type: 'PLAN',
          action: 'customers.create',
          collectedFields: { name: 'John Doe', email: 'john@example.com' },
          missingFields: ['phone'],
          suggestedActions: ['Fornecer telefone'],
          requiresConfirmation: true,
        });

        const result = parser.parse(content);

        expect(result.success).toBe(true);
        expect(result.response?.type).toBe('PLAN');
        if (result.response?.type === 'PLAN') {
          expect(result.response.action).toBe('customers.create');
          expect(result.response.collectedFields).toEqual({ name: 'John Doe', email: 'john@example.com' });
          expect(result.response.missingFields).toEqual(['phone']);
        }
      });

      it('should parse PLAN response with defaults', () => {
        const content = JSON.stringify({
          type: 'PLAN',
          action: 'customers.create',
        });

        const result = parser.parse(content);

        expect(result.success).toBe(true);
        if (result.response?.type === 'PLAN') {
          expect(result.response.collectedFields).toEqual({});
          expect(result.response.missingFields).toEqual([]);
          expect(result.response.requiresConfirmation).toBe(true);
        }
      });
    });

    describe('CALL_TOOL responses', () => {
      it('should parse valid CALL_TOOL response', () => {
        const content = JSON.stringify({
          type: 'CALL_TOOL',
          tool: 'customers.search',
          params: { query: 'test', limit: 10 },
        });

        const result = parser.parse(content);

        expect(result.success).toBe(true);
        expect(result.response?.type).toBe('CALL_TOOL');
        if (result.response?.type === 'CALL_TOOL') {
          expect(result.response.tool).toBe('customers.search');
          expect(result.response.params).toEqual({ query: 'test', limit: 10 });
        }
      });

      it('should parse CALL_TOOL with empty params', () => {
        const content = JSON.stringify({
          type: 'CALL_TOOL',
          tool: 'customers.search',
        });

        const result = parser.parse(content);

        expect(result.success).toBe(true);
        if (result.response?.type === 'CALL_TOOL') {
          expect(result.response.params).toEqual({});
        }
      });
    });

    describe('ASK_USER responses', () => {
      it('should parse valid ASK_USER response', () => {
        const content = JSON.stringify({
          type: 'ASK_USER',
          question: 'Qual o nome do cliente?',
          context: 'Criando novo cliente',
          options: ['Opção 1', 'Opção 2'],
        });

        const result = parser.parse(content);

        expect(result.success).toBe(true);
        expect(result.response?.type).toBe('ASK_USER');
        if (result.response?.type === 'ASK_USER') {
          expect(result.response.question).toBe('Qual o nome do cliente?');
          expect(result.response.context).toBe('Criando novo cliente');
          expect(result.response.options).toEqual(['Opção 1', 'Opção 2']);
        }
      });
    });

    describe('RESPONSE (informative) responses', () => {
      it('should parse valid RESPONSE', () => {
        const content = JSON.stringify({
          type: 'RESPONSE',
          message: 'Aqui estão os dados solicitados.',
          data: { items: [1, 2, 3] },
        });

        const result = parser.parse(content);

        expect(result.success).toBe(true);
        expect(result.response?.type).toBe('RESPONSE');
        if (result.response?.type === 'RESPONSE') {
          expect(result.response.message).toBe('Aqui estão os dados solicitados.');
          expect(result.response.data).toEqual({ items: [1, 2, 3] });
        }
      });
    });

    describe('JSON extraction from content', () => {
      it('should extract JSON from markdown code block', () => {
        const content = `Vou criar o cliente para você.

\`\`\`json
{
  "type": "PLAN",
  "action": "customers.create",
  "collectedFields": { "name": "Test" },
  "missingFields": []
}
\`\`\`

Confirme a operação acima.`;

        const result = parser.parse(content);

        expect(result.success).toBe(true);
        expect(result.response?.type).toBe('PLAN');
      });

      it('should extract JSON from content without code block', () => {
        const content = `Aqui está o plano: {"type": "PLAN", "action": "test", "collectedFields": {}, "missingFields": []}`;

        const result = parser.parse(content);

        expect(result.success).toBe(true);
        expect(result.response?.type).toBe('PLAN');
      });

      it('should handle plain text as RESPONSE', () => {
        const content = 'Olá! Como posso ajudá-lo?';

        const result = parser.parse(content);

        expect(result.success).toBe(true);
        expect(result.response?.type).toBe('RESPONSE');
        if (result.response?.type === 'RESPONSE') {
          expect(result.response.message).toBe('Olá! Como posso ajudá-lo?');
        }
      });
    });

    describe('error handling', () => {
      it('should return error for empty content', () => {
        const result = parser.parse('');

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should return error for invalid JSON structure', () => {
        const content = JSON.stringify({
          type: 'INVALID_TYPE',
          data: 'test',
        });

        const result = parser.parse(content);

        // Invalid discriminator should still parse as plain text
        expect(result.success).toBe(true);
        expect(result.response?.type).toBe('RESPONSE');
      });

      it('should return error for PLAN missing action', () => {
        const content = JSON.stringify({
          type: 'PLAN',
          // action is missing
          collectedFields: {},
        });

        const result = parser.parse(content);

        expect(result.success).toBe(false);
        expect(result.error).toContain('action');
      });

      it('should return error for CALL_TOOL missing tool', () => {
        const content = JSON.stringify({
          type: 'CALL_TOOL',
          // tool is missing
          params: {},
        });

        const result = parser.parse(content);

        expect(result.success).toBe(false);
        expect(result.error).toContain('tool');
      });

      it('should return error for ASK_USER missing question', () => {
        const content = JSON.stringify({
          type: 'ASK_USER',
          // question is missing
          context: 'test',
        });

        const result = parser.parse(content);

        expect(result.success).toBe(false);
        expect(result.error).toContain('question');
      });

      it('should return error for RESPONSE missing message', () => {
        const content = JSON.stringify({
          type: 'RESPONSE',
          // message is missing
          data: {},
        });

        const result = parser.parse(content);

        expect(result.success).toBe(false);
        expect(result.error).toContain('message');
      });
    });
  });

  describe('helper methods', () => {
    it('isPlanResponse should correctly identify PLAN responses', () => {
      const plan = { type: 'PLAN' as const, action: 'test', collectedFields: {}, missingFields: [], suggestedActions: [], requiresConfirmation: true };
      const callTool = { type: 'CALL_TOOL' as const, tool: 'test', params: {} };

      expect(parser.isPlanResponse(plan)).toBe(true);
      expect(parser.isPlanResponse(callTool)).toBe(false);
    });

    it('isToolCall should correctly identify CALL_TOOL responses', () => {
      const callTool = { type: 'CALL_TOOL' as const, tool: 'test', params: {} };
      const plan = { type: 'PLAN' as const, action: 'test', collectedFields: {}, missingFields: [], suggestedActions: [], requiresConfirmation: true };

      expect(parser.isToolCall(callTool)).toBe(true);
      expect(parser.isToolCall(plan)).toBe(false);
    });

    it('planHasMissingFields should check for missing fields', () => {
      const planWithMissing = { type: 'PLAN' as const, action: 'test', collectedFields: {}, missingFields: ['field1'], suggestedActions: [], requiresConfirmation: true };
      const planWithoutMissing = { type: 'PLAN' as const, action: 'test', collectedFields: {}, missingFields: [], suggestedActions: [], requiresConfirmation: true };

      expect(parser.planHasMissingFields(planWithMissing)).toBe(true);
      expect(parser.planHasMissingFields(planWithoutMissing)).toBe(false);
    });

    it('isWriteTool should identify write operations', () => {
      expect(parser.isWriteTool('customers.create')).toBe(true);
      expect(parser.isWriteTool('workOrders.create')).toBe(true);
      expect(parser.isWriteTool('billing.createCharge')).toBe(true);
      expect(parser.isWriteTool('customers.search')).toBe(false);
      expect(parser.isWriteTool('billing.previewCharge')).toBe(false);
    });

    it('isBillingCreateTool should identify billing create tool', () => {
      expect(parser.isBillingCreateTool('billing.createCharge')).toBe(true);
      expect(parser.isBillingCreateTool('billing.previewCharge')).toBe(false);
      expect(parser.isBillingCreateTool('customers.create')).toBe(false);
    });
  });

  describe('singleton export', () => {
    it('responseParser should be a LLMResponseParser instance', () => {
      expect(responseParser).toBeInstanceOf(LLMResponseParser);
    });
  });
});
