/**
 * Settings Module Tests
 *
 * Testes para o módulo de configurações
 */

import {
  isLimitReached,
  getUsagePercentage,
  formatPlanPrice,
  replacePlaceholders,
  PLAN_FEATURES,
  DEFAULT_BRANDING,
  DEFAULT_NOTIFICATION_MESSAGES,
} from '@/services/settings.service';

describe('Settings Service - Helpers', () => {
  describe('isLimitReached', () => {
    it('deve retornar false para limite ilimitado (-1)', () => {
      expect(isLimitReached(100, -1)).toBe(false);
      expect(isLimitReached(9999, -1)).toBe(false);
    });

    it('deve retornar true quando limite atingido', () => {
      expect(isLimitReached(20, 20)).toBe(true);
      expect(isLimitReached(25, 20)).toBe(true);
    });

    it('deve retornar false quando abaixo do limite', () => {
      expect(isLimitReached(15, 20)).toBe(false);
      expect(isLimitReached(0, 20)).toBe(false);
    });
  });

  describe('getUsagePercentage', () => {
    it('deve retornar 0 para limite ilimitado', () => {
      expect(getUsagePercentage(50, -1)).toBe(0);
    });

    it('deve calcular percentual corretamente', () => {
      expect(getUsagePercentage(10, 20)).toBe(50);
      expect(getUsagePercentage(5, 20)).toBe(25);
      expect(getUsagePercentage(20, 20)).toBe(100);
    });

    it('deve limitar em 100%', () => {
      expect(getUsagePercentage(25, 20)).toBe(100);
      expect(getUsagePercentage(100, 20)).toBe(100);
    });
  });

  describe('formatPlanPrice', () => {
    it('deve formatar preço grátis', () => {
      expect(formatPlanPrice(0)).toBe('Grátis');
    });

    it('deve formatar preço em reais', () => {
      const result = formatPlanPrice(49.9);
      expect(result).toContain('R$');
      expect(result).toContain('49,90');
    });

    it('deve formatar preços maiores', () => {
      const result = formatPlanPrice(99.9);
      expect(result).toContain('R$');
      expect(result).toContain('99,90');
    });
  });

  describe('replacePlaceholders', () => {
    it('deve substituir placeholders corretamente', () => {
      const message = 'Olá {nome_cliente}, seu valor é {valor}';
      const data = {
        nome_cliente: 'João',
        valor: 'R$ 100,00',
      };

      const result = replacePlaceholders(message, data);

      expect(result).toBe('Olá João, seu valor é R$ 100,00');
    });

    it('deve substituir múltiplas ocorrências', () => {
      const message = '{nome} comprou {valor}, pagou {valor}';
      const data = {
        nome: 'Maria',
        valor: 'R$ 50,00',
      };

      const result = replacePlaceholders(message, data);

      expect(result).toBe('Maria comprou R$ 50,00, pagou R$ 50,00');
    });

    it('deve manter placeholders não encontrados', () => {
      const message = 'Olá {nome_cliente}, data: {data}';
      const data = {
        nome_cliente: 'João',
      };

      const result = replacePlaceholders(message, data);

      expect(result).toBe('Olá João, data: {data}');
    });
  });
});

describe('PLAN_FEATURES', () => {
  it('deve ter todos os planos definidos', () => {
    expect(PLAN_FEATURES).toHaveProperty('FREE');
    expect(PLAN_FEATURES).toHaveProperty('PRO');
    expect(PLAN_FEATURES).toHaveProperty('TEAM');
  });

  describe('Plano FREE', () => {
    const free = PLAN_FEATURES.FREE;

    it('deve ter preço zero', () => {
      expect(free.price).toBe(0);
    });

    it('deve ter limites definidos', () => {
      expect(free.limits.maxClients).toBe(20);
      expect(free.limits.maxQuotes).toBe(20);
      expect(free.limits.maxWorkOrders).toBe(20);
      expect(free.limits.maxPayments).toBe(20);
      expect(free.limits.maxUsers).toBe(1);
    });

    it('deve ter features listadas', () => {
      expect(free.features.length).toBeGreaterThan(0);
    });
  });

  describe('Plano PRO', () => {
    const pro = PLAN_FEATURES.PRO;

    it('deve ter preço correto', () => {
      expect(pro.price).toBe(49.9);
    });

    it('deve ter limites ilimitados', () => {
      expect(pro.limits.maxClients).toBe(-1);
      expect(pro.limits.maxQuotes).toBe(-1);
      expect(pro.limits.maxWorkOrders).toBe(-1);
      expect(pro.limits.maxPayments).toBe(-1);
    });

    it('deve ter mais features que FREE', () => {
      expect(pro.features.length).toBeGreaterThan(PLAN_FEATURES.FREE.features.length);
    });
  });

  describe('Plano TEAM', () => {
    const team = PLAN_FEATURES.TEAM;

    it('deve ter preço maior que PRO', () => {
      expect(team.price).toBeGreaterThan(PLAN_FEATURES.PRO.price);
    });

    it('deve suportar múltiplos usuários', () => {
      expect(team.limits.maxUsers).toBe(5);
    });
  });
});

describe('DEFAULT VALUES', () => {
  describe('DEFAULT_BRANDING', () => {
    it('deve ter todas as cores definidas', () => {
      expect(DEFAULT_BRANDING.primaryColor).toBeDefined();
      expect(DEFAULT_BRANDING.secondaryColor).toBeDefined();
      expect(DEFAULT_BRANDING.textColor).toBeDefined();
      expect(DEFAULT_BRANDING.backgroundColor).toBeDefined();
      expect(DEFAULT_BRANDING.accentColor).toBeDefined();
    });

    it('deve ter cores em formato hex', () => {
      expect(DEFAULT_BRANDING.primaryColor).toMatch(/^#[0-9A-F]{6}$/i);
      expect(DEFAULT_BRANDING.secondaryColor).toMatch(/^#[0-9A-F]{6}$/i);
    });
  });

  describe('DEFAULT_NOTIFICATION_MESSAGES', () => {
    it('deve ter todas as mensagens definidas', () => {
      expect(DEFAULT_NOTIFICATION_MESSAGES.paymentReminder).toBeDefined();
      expect(DEFAULT_NOTIFICATION_MESSAGES.paymentOverdue).toBeDefined();
      expect(DEFAULT_NOTIFICATION_MESSAGES.workOrderReminder).toBeDefined();
      expect(DEFAULT_NOTIFICATION_MESSAGES.quoteFollowUp).toBeDefined();
    });

    it('deve conter placeholders nas mensagens', () => {
      expect(DEFAULT_NOTIFICATION_MESSAGES.paymentReminder).toContain('{nome_cliente}');
      expect(DEFAULT_NOTIFICATION_MESSAGES.paymentReminder).toContain('{valor}');
      expect(DEFAULT_NOTIFICATION_MESSAGES.paymentReminder).toContain('{data}');
    });
  });
});
