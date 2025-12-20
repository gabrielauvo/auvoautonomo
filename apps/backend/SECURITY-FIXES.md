# Correções de Segurança Críticas - Backend

Este documento descreve as correções de segurança implementadas no backend do sistema.

## Resumo das Correções

### 1. **billing-webhook.controller.ts** - Webhook com Autenticação Obrigatória
**Problema**: Webhooks aceitavam requests sem validação de token em produção.

**Correção Implementada**:
- ✅ Validação de token OBRIGATÓRIA em ambiente de produção
- ✅ Em desenvolvimento, token é validado apenas se configurado
- ✅ Erro fatal se token não estiver configurado em produção
- ✅ Rate limiting: 100 requests/minuto por IP em todos os endpoints de webhook
- ✅ Logs de segurança para tentativas inválidas

**Arquivos Modificados**:
- `src/billing/billing-webhook.controller.ts`

**Variáveis de Ambiente Necessárias**:
```env
ASAAS_PLATFORM_WEBHOOK_TOKEN=seu_token_secreto_aqui
NODE_ENV=production
```

---

### 2. **asaas-billing.service.ts** - Proteção contra Race Conditions
**Problema**: Pagamentos duplicados e inconsistências por race conditions.

**Correção Implementada**:
- ✅ Transações atômicas no processamento de webhooks
- ✅ Idempotência no `handlePaymentConfirmed()` - previne processamento duplicado
- ✅ Verificação de duplicação no `savePaymentHistory()`
- ✅ Lock otimista no `activateSubscription()` usando `updateMany` com condições WHERE

**Arquivos Modificados**:
- `src/billing/asaas-billing.service.ts`

**Benefícios**:
- Pagamentos confirmados uma única vez mesmo com webhooks duplicados
- Histórico de pagamentos sem duplicação
- Ativação de assinatura segura contra concorrência

---

### 3. **plan-limits.service.ts** - Correção TOCTOU (Time-of-Check to Time-of-Use)
**Problema**: Race condition permitia ultrapassar limites do plano.

**Correção Implementada**:
- ✅ Novo método `checkAndIncrementLimit()` para uso dentro de transações
- ✅ Verificação e criação de recursos de forma atômica
- ✅ Documentação clara sobre uso correto do método

**Arquivos Modificados**:
- `src/billing/plan-limits.service.ts`

**Uso Recomendado**:
```typescript
// ERRADO - Vulnerável a TOCTOU:
await planLimitsService.checkLimitOrThrow({ userId, resource: 'CLIENT' });
await prisma.client.create({ data: ... });

// CORRETO - Atômico e seguro:
await prisma.$transaction(async (tx) => {
  await planLimitsService.checkAndIncrementLimit(tx, { userId, resource: 'CLIENT' });
  await tx.client.create({ data: ... });
});
```

---

### 4. **auth.service.ts** - Proteção de Dados Sensíveis em Logs
**Problema**: Possível exposição de emails e dados sensíveis em logs.

**Correção Implementada**:
- ✅ Função `maskEmail()` para mascarar emails em logs (ex: j***e@e***e.com)
- ✅ Logs seguros sem expor dados sensíveis
- ✅ Aumento de bcrypt rounds de 10 para 12 (maior segurança)
- ✅ Mensagens genéricas de erro para prevenir enumeração de usuários
- ✅ Logs estruturados para auditoria de segurança

**Arquivos Modificados**:
- `src/auth/auth.service.ts`

**Benefícios**:
- Logs não expõem emails completos
- Previne ataques de enumeração de usuários
- Hashing de senhas mais seguro

---

### 5. **app.module.ts** - Rate Limiting Global
**Problema**: Ausência de proteção global contra ataques DDoS e brute force.

**Correção Implementada**:
- ✅ ThrottlerModule configurado globalmente com 3 níveis:
  - **short**: 10 req/segundo (previne floods rápidos)
  - **medium**: 100 req/minuto (uso normal)
  - **long**: 1000 req/hora (usuários muito ativos)
- ✅ ThrottlerGuard aplicado globalmente a todas as rotas
- ✅ Controllers podem customizar com `@Throttle()` ou desabilitar com `@SkipThrottle()`

**Arquivos Modificados**:
- `src/app.module.ts`

**Dependência Necessária**:
```bash
npm install @nestjs/throttler
```

---

### 6. **quotes-public.controller.ts** - Rate Limiting em Endpoints Públicos
**Problema**: Endpoints públicos sem proteção contra brute force e enumeração.

**Correção Implementada**:
- ✅ Rate limiting específico por endpoint:
  - GET (visualização): 20 req/minuto
  - POST (assinatura/rejeição): 5 req/minuto
- ✅ Validação de formato de shareKey (previne enumeração)
- ✅ Validação de input com class-validator
- ✅ Proteção contra injeção de caracteres maliciosos

**Arquivos Modificados**:
- `src/quotes/quotes-public.controller.ts`

---

## Recomendações Adicionais

### 1. Configuração de Produção
Certifique-se de configurar estas variáveis de ambiente em produção:

```env
NODE_ENV=production
ASAAS_PLATFORM_WEBHOOK_TOKEN=token_secreto_aleatorio_seguro
DATABASE_URL=postgresql://...
JWT_SECRET=seu_jwt_secret_forte
```

### 2. Monitoramento
Implemente monitoramento para:
- Logs de falhas de autenticação (possíveis ataques)
- Rate limiting atingido (possíveis ataques DDoS)
- Erros em transações de pagamento
- Tentativas de acesso com shareKeys inválidos

### 3. Revisão de Controllers
Revise outros controllers que criam recursos para usar o novo método `checkAndIncrementLimit()`:
- `clients.controller.ts`
- `quotes.controller.ts`
- `work-orders.controller.ts`
- `client-payments.controller.ts`

### 4. Testes
Execute testes para verificar:
- Idempotência de webhooks (enviar mesmo webhook 2x)
- Race conditions em criação de recursos (requests concorrentes)
- Rate limiting (deve retornar 429 após limite)
- Validação de tokens em produção

### 5. Auditoria de Logs
Os logs agora incluem informações de segurança:
- Tentativas de login falhas
- Webhooks com token inválido
- Rate limiting atingido
- Validação de shareKeys falhas

Configure um sistema de alerta para monitorar esses eventos.

---

## Checklist de Segurança Completo

- [x] Webhook com autenticação obrigatória em produção
- [x] Rate limiting em webhooks
- [x] Proteção contra race conditions em pagamentos
- [x] Transações atômicas para verificação de limites (TOCTOU)
- [x] Mascaramento de dados sensíveis em logs
- [x] Rate limiting global configurado
- [x] Rate limiting específico em endpoints públicos
- [x] Validação de shareKeys
- [x] Aumento de rounds de bcrypt
- [x] Mensagens genéricas de erro (anti-enumeração)

## Status: ✅ TODAS AS CORREÇÕES IMPLEMENTADAS

---

**Data da Implementação**: 2025-12-19
**Autor**: Claude Code (Anthropic)
