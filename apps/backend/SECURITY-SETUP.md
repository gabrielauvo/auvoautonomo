# Guia de Configuração de Segurança

## 1. Instalação de Dependências

Execute o seguinte comando para instalar o pacote de rate limiting:

```bash
npm install @nestjs/throttler
```

## 2. Configuração de Variáveis de Ambiente

Adicione as seguintes variáveis ao seu arquivo `.env`:

```env
# Ambiente
NODE_ENV=production

# Webhook Security
ASAAS_PLATFORM_WEBHOOK_TOKEN=your_secure_random_token_here

# JWT
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# CORS (adicione seus domínios permitidos)
CORS_ORIGIN=https://app.seudominio.com,https://www.seudominio.com
```

### Gerando Tokens Seguros

Use um dos métodos abaixo para gerar tokens seguros:

**Método 1 - Node.js:**
```javascript
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Método 2 - OpenSSL:**
```bash
openssl rand -hex 32
```

**Método 3 - Online (use apenas em desenvolvimento):**
https://www.random.org/strings/

## 3. Configuração do Banco de Dados

As correções de segurança não requerem alterações no schema do banco de dados, mas certifique-se de que os índices estão criados:

```bash
npx prisma migrate deploy
```

## 4. Testando Rate Limiting

### 4.1. Teste Local (Desenvolvimento)

```bash
# Teste com curl (deve falhar após 100 requests)
for i in {1..101}; do
  curl http://localhost:3001/api/endpoint
done
```

### 4.2. Teste de Webhook

```bash
# Sem token (deve falhar em produção)
curl -X POST http://localhost:3001/webhooks/billing/asaas \
  -H "Content-Type: application/json" \
  -d '{"event": "PAYMENT_CONFIRMED"}'

# Com token correto (deve funcionar)
curl -X POST http://localhost:3001/webhooks/billing/asaas \
  -H "Content-Type: application/json" \
  -H "asaas-access-token: seu_token_aqui" \
  -d '{"event": "PAYMENT_CONFIRMED"}'
```

## 5. Configurando Logs de Segurança

Configure um sistema de logging centralizado para monitorar eventos de segurança. Sugestões:

### 5.1. Winston (Recomendado)

```bash
npm install winston winston-daily-rotate-file
```

### 5.2. Datadog/New Relic

Integre com serviços de monitoramento profissionais para:
- Alertas em tempo real
- Dashboards de segurança
- Análise de padrões de ataque

## 6. Configurando Asaas Webhooks

No painel do Asaas:

1. Acesse **Configurações > Webhooks**
2. Configure a URL: `https://seudominio.com/webhooks/billing/asaas`
3. Adicione o header customizado:
   - Nome: `asaas-access-token`
   - Valor: O mesmo token configurado em `ASAAS_PLATFORM_WEBHOOK_TOKEN`
4. Selecione os eventos:
   - PAYMENT_CONFIRMED
   - PAYMENT_RECEIVED
   - PAYMENT_OVERDUE
   - PAYMENT_DELETED
   - PAYMENT_REFUNDED

## 7. Deployment Checklist

Antes de fazer deploy em produção:

- [ ] `NODE_ENV=production` configurado
- [ ] `ASAAS_PLATFORM_WEBHOOK_TOKEN` configurado com token forte
- [ ] `JWT_SECRET` configurado com token forte
- [ ] `CORS_ORIGIN` configurado com domínios corretos
- [ ] Pacote `@nestjs/throttler` instalado
- [ ] Migrations do Prisma executadas
- [ ] Logs de segurança configurados
- [ ] Webhooks do Asaas configurados com token
- [ ] SSL/TLS configurado (HTTPS)
- [ ] Firewall configurado para permitir apenas IPs necessários

## 8. Testando em Produção

### 8.1. Teste de Autenticação de Webhook

```bash
# Deve retornar 401 Unauthorized
curl -X POST https://seudominio.com/webhooks/billing/asaas \
  -H "Content-Type: application/json" \
  -d '{"event": "PAYMENT_CONFIRMED"}'
```

### 8.2. Teste de Rate Limiting

```bash
# Use ferramentas como Apache Bench
ab -n 200 -c 10 https://seudominio.com/api/health

# Você deve ver alguns requests retornando 429 Too Many Requests
```

## 9. Monitoramento Contínuo

Configure alertas para:

### 9.1. Alertas Críticos
- Tentativas de webhook sem token válido (> 5 por hora)
- Rate limiting atingido em endpoints sensíveis (> 10 por minuto)
- Falhas de autenticação (> 10 por minuto)

### 9.2. Alertas de Aviso
- Pagamentos duplicados detectados
- Race conditions em limites de plano
- ShareKeys inválidos (> 20 por hora)

### 9.3. Métricas para Dashboard
- Taxa de sucesso de webhooks
- Tempo de resposta de endpoints públicos
- Número de requests bloqueados por rate limiting
- Distribuição geográfica de acessos públicos

## 10. Backup e Recovery

### 10.1. Backup de Configurações

Faça backup regular de:
- Variáveis de ambiente (sem expor valores)
- Configurações de webhook
- Regras de rate limiting customizadas

### 10.2. Recovery Plan

Em caso de ataque ou problema:

1. **Imediato**:
   - Reduzir limites de rate limiting temporariamente
   - Bloquear IPs suspeitos no firewall
   - Rotacionar tokens de webhook se comprometidos

2. **Curto Prazo**:
   - Analisar logs para identificar padrão de ataque
   - Ajustar configurações de segurança conforme necessário
   - Notificar equipe e stakeholders

3. **Longo Prazo**:
   - Implementar melhorias baseadas na análise
   - Atualizar documentação de segurança
   - Realizar testes de penetração

## 11. Compliance e Auditoria

### 11.1. LGPD/GDPR

As correções implementadas ajudam com compliance:
- ✅ Mascaramento de emails em logs
- ✅ Proteção de dados sensíveis
- ✅ Auditoria de acessos

### 11.2. PCI-DSS (se aplicável)

- ✅ Rate limiting contra brute force
- ✅ Logs de segurança
- ✅ Validação de entrada
- ⚠️ Considere criptografia adicional para dados de cartão

## 12. Suporte e Manutenção

### Atualizações de Segurança

Mantenha as dependências atualizadas:

```bash
# Verificar vulnerabilidades
npm audit

# Corrigir automaticamente (quando possível)
npm audit fix

# Atualizar @nestjs/throttler
npm update @nestjs/throttler
```

### Contato

Para questões de segurança críticas, siga o processo de divulgação responsável:
1. Não abra issues públicas sobre vulnerabilidades
2. Contate o time de segurança diretamente
3. Aguarde correção antes de divulgar

---

**Última Atualização**: 2025-12-19
**Versão**: 1.0.0
