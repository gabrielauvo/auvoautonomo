# Planos e Limites

## Visão Geral

O sistema oferece três planos com diferentes níveis de acesso e limites de recursos. Os limites são verificados automaticamente antes da criação de novos recursos.

---

## Planos Disponíveis

### 🆓 Free Plan

**Preço**: Gratuito

**Limites**:
- ✅ Até 5 clientes
- ✅ Até 10 orçamentos
- ✅ Até 5 ordens de serviço
- ✅ Até 5 cobranças/faturas

**Recursos**:
- Gestão básica de clientes
- Criação de orçamentos simples
- Ordens de serviço básicas
- Emissão de faturas
- Catálogo de itens
- Sincronização mobile
- Suporte por email

**Ideal para**:
- Profissionais autônomos
- Pequenos negócios iniciando
- Teste do sistema

---

### 💼 Pro Plan

**Preço**: R$ 49,90/mês

**Limites**:
- ✅ Até 50 clientes
- ✅ Até 100 orçamentos
- ✅ Até 50 ordens de serviço
- ✅ Até 50 cobranças/faturas

**Recursos**:
- Todos os recursos do Free
- **Suporte prioritário**
- Relatórios avançados
- Exportação de dados
- Backup automático
- Templates personalizados

**Ideal para**:
- Pequenas empresas em crescimento
- Profissionais estabelecidos
- Equipes pequenas

---

### 🚀 Team Plan

**Preço**: R$ 99,90/mês

**Limites**:
- ✅ Clientes ilimitados
- ✅ Orçamentos ilimitados
- ✅ Ordens de serviço ilimitadas
- ✅ Cobranças/faturas ilimitadas

**Recursos**:
- Todos os recursos do Pro
- **Múltiplos usuários/equipe**
- **API access completo**
- Webhooks para integrações
- White label (marca própria)
- SLA de 99.9% uptime
- Gerente de conta dedicado
- Treinamento da equipe

**Ideal para**:
- Médias e grandes empresas
- Empresas com múltiplas equipes
- Necessidade de integrações
- Alto volume de operações

---

## Tabela Comparativa

| Recurso                    | Free    | Pro      | Team      |
|----------------------------|---------|----------|-----------|
| **Preço**                  | Grátis  | R$ 49,90 | R$ 99,90  |
| **Clientes**               | 5       | 50       | Ilimitado |
| **Orçamentos**             | 10      | 100      | Ilimitado |
| **Ordens de Serviço**      | 5       | 50       | Ilimitado |
| **Faturas**                | 5       | 50       | Ilimitado |
| **Usuários**               | 1       | 1        | Ilimitado |
| **Suporte**                | Email   | Priority | Dedicado  |
| **API Access**             | ❌      | ❌       | ✅        |
| **Webhooks**               | ❌      | ❌       | ✅        |
| **White Label**            | ❌      | ❌       | ✅        |
| **Backup Automático**      | ❌      | ✅       | ✅        |
| **Relatórios Avançados**   | ❌      | ✅       | ✅        |
| **Templates Custom**       | ❌      | ✅       | ✅        |

---

## Como os Limites Funcionam

### Verificação Automática

Antes de criar qualquer recurso (cliente, orçamento, OS, fatura), o sistema verifica automaticamente se o usuário está dentro dos limites do seu plano.

**Fluxo**:
1. Usuário tenta criar um novo recurso
2. Sistema verifica o plano atual do usuário
3. Sistema conta quantos recursos desse tipo o usuário já possui
4. Se `count >= limit` → **Bloqueio** com mensagem clara
5. Se `count < limit` → **Permitido**

### Mensagens de Erro

Quando um limite é atingido, o usuário recebe uma mensagem clara:

```
❌ Client limit reached. Your plan allows 5 clients.
   Upgrade to Pro for up to 50 clients.
```

```
❌ Quote limit reached. Your plan allows 10 quotes.
   Upgrade to Pro for up to 100 quotes.
```

---

## Limites Ilimitados (Team Plan)

No plano Team, os limites são representados por `-1` no banco de dados, indicando "ilimitado". O sistema interpreta isso corretamente e não aplica restrições.

**Implementação**:
```typescript
if (plan.maxClients === -1) {
  // Ilimitado, permite criar
  return;
}
// Senão, verifica o limite normalmente
```

---

## Upgrade/Downgrade de Plano

### Upgrade

✅ **Efeito imediato**: Novos limites aplicados instantaneamente
✅ **Dados preservados**: Todos os dados existentes são mantidos
✅ **Acesso a novos recursos**: Recursos premium disponíveis imediatamente

### Downgrade

⚠️ **Importante**:
- Se o usuário já tem mais recursos do que o novo limite permite, os dados **não são deletados**
- Usuário pode visualizar dados existentes
- **Não pode criar novos** até que esteja abaixo do limite
- Pode deletar recursos para voltar a ficar dentro do limite

**Exemplo**:
```
Usuário no Pro com 30 clientes downgrade para Free (limite: 5)
→ Os 30 clientes continuam acessíveis
→ Não pode criar novos clientes até deletar 25
→ Mensagem: "You have 30 clients, but your plan allows only 5.
             Delete 25 clients or upgrade to create new ones."
```

---

## Monitoramento de Uso

### Endpoint de Uso Atual

`GET /plans/usage`

**Resposta**:
```json
{
  "clients": {
    "current": 3,
    "limit": 5,
    "unlimited": false
  },
  "quotes": {
    "current": 7,
    "limit": 10,
    "unlimited": false
  },
  "workOrders": {
    "current": 2,
    "limit": 5,
    "unlimited": false
  },
  "invoices": {
    "current": 1,
    "limit": 5,
    "unlimited": false
  }
}
```

### Indicadores Visuais

**No frontend**, mostrar barras de progresso:

```
Clientes: [████████░░] 3/5 (60%)
Orçamentos: [███████░░░] 7/10 (70%)
Ordens de Serviço: [████░░░░░░] 2/5 (40%)
Faturas: [██░░░░░░░░] 1/5 (20%)
```

**Alertas**:
- 🟢 Verde: < 70% do limite
- 🟡 Amarelo: 70-90% do limite
- 🔴 Vermelho: > 90% do limite
- 🚫 Bloqueado: 100% do limite

---

## Implementação Técnica

### Decorator `@CheckLimit()`

Usado nos controllers para aplicar verificação automática:

```typescript
@Post('clients')
@UseGuards(JwtAuthGuard, UsageLimitGuard)
@CheckLimit('clients')
async createClient(@Body() dto: CreateClientDto) {
  return this.clientsService.create(dto);
}
```

### Guard `UsageLimitGuard`

Executa antes do controller:

```typescript
class UsageLimitGuard {
  async canActivate(context: ExecutionContext) {
    const limitType = this.reflector.get(LIMIT_TYPE_KEY, context.getHandler());
    const user = context.switchToHttp().getRequest().user;

    await this.plansService.checkLimit(user.id, limitType);
    // Se passar, permite; se não, lança ForbiddenException
  }
}
```

### Service Methods

```typescript
class PlansService {
  async checkClientLimit(userId: string): Promise<void>
  async checkQuoteLimit(userId: string): Promise<void>
  async checkWorkOrderLimit(userId: string): Promise<void>
  async checkInvoiceLimit(userId: string): Promise<void>
}
```

---

## Regras de Negócio

1. **Novos usuários**: Sempre começam no plano Free
2. **Trial**: Não há período de trial (Free já é gratuito)
3. **Cancelamento**: Ao cancelar Pro/Team, volta para Free
4. **Pagamento**: Renovação mensal automática
5. **Nota Fiscal**: Emitida automaticamente via gateway de pagamento
6. **Reembolso**: Proporcional ao tempo não utilizado

---

## FAQ

### O que acontece se eu atingir o limite?

Você recebe uma mensagem clara indicando qual limite foi atingido e opções para upgrade. Seus dados existentes permanecem intactos e acessíveis.

### Posso voltar para o plano Free?

Sim, a qualquer momento. Seus dados serão preservados, mas você não poderá criar novos recursos se estiver acima dos limites do Free.

### Os limites são por usuário ou por conta?

Por usuário. No Team Plan, cada usuário pode ter seus próprios limites ou compartilhar o mesmo limite (a definir).

### Posso aumentar o limite de apenas um recurso?

No momento, não. Os planos são pacotes fixos. Para necessidades customizadas, entre em contato com o suporte.

### O que significa "ilimitado" no Team?

Significa sem limite artificial do sistema. Ainda há limites práticos de infraestrutura, mas são muito altos e adequados para empresas grandes.

---

## Contato e Suporte

- **Free Plan**: support@example.com (resposta em 48h)
- **Pro Plan**: priority@example.com (resposta em 24h)
- **Team Plan**: Gerente de conta dedicado (resposta em 4h)
