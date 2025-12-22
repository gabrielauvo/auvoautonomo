# Termos de Aceite para Orçamentos

## Visão Geral

A funcionalidade de **Termos de Aceite** permite que prestadores de serviço configurem termos e condições que seus clientes devem ler e aceitar antes de assinar um orçamento. Esta é uma funcionalidade exclusiva para **planos pagos** (PRO e superiores).

## Benefícios

1. **Proteção Legal**: Garante que o cliente leu e concordou com os termos antes de aprovar o orçamento
2. **Trilha de Auditoria**: Registra data/hora do aceite, versão dos termos e hash do conteúdo
3. **Flexibilidade**: O prestador pode personalizar completamente o texto dos termos
4. **Controle de Versão**: Toda alteração nos termos incrementa a versão automaticamente

## Como Funciona

### 1. Configuração pelo Prestador

1. Acesse **Configurações** > **Templates** > **Termos de Aceite**
2. Ative a opção "Exigir aceite de termos"
3. Digite o texto dos termos no editor
4. Clique em "Salvar"

### 2. Experiência do Cliente

Quando o cliente acessa o link do orçamento e tenta assinar:

1. Um modal aparece com os termos de aceite
2. O cliente deve rolar até o final do texto
3. Deve marcar o checkbox "Li e aceito os termos"
4. Só então pode prosseguir para a assinatura

### 3. Assinatura no App Mobile

O fluxo é similar ao web:

1. Ao clicar em "Assinar", o modal de termos aparece
2. O técnico/cliente deve ler e aceitar
3. Após aceitar, o pad de assinatura é exibido

## Trilha de Auditoria

Cada assinatura registra:

- `termsAcceptedAt`: Data/hora exata do aceite
- `termsHash`: Hash SHA256 do conteúdo aceito
- `termsVersion`: Número da versão dos termos

Isso permite verificar posteriormente qual versão exata foi aceita.

## Endpoints da API

### GET /settings/acceptance-terms
Retorna configuração atual dos termos de aceite.

**Resposta:**
```json
{
  "enabled": true,
  "termsContent": "Texto dos termos...",
  "version": 3,
  "updatedAt": "2024-01-15T10:00:00Z",
  "termsHash": "abc123..."
}
```

### PUT /settings/acceptance-terms
Atualiza configuração dos termos.

**Corpo:**
```json
{
  "enabled": true,
  "termsContent": "Novo texto dos termos..."
}
```

**Nota**: Requer plano PRO ou superior. Retorna 403 se o plano não suportar.

### GET /public/quotes/:shareKey/acceptance-terms
Retorna termos para página pública do orçamento.

**Resposta:**
```json
{
  "required": true,
  "termsContent": "Texto dos termos...",
  "version": 3,
  "termsHash": "abc123..."
}
```

### POST /public/quotes/:shareKey/sign-and-approve
Assina e aprova orçamento (inclui dados de aceite).

**Corpo com termos:**
```json
{
  "imageBase64": "...",
  "signerName": "João Silva",
  "signerDocument": "123.456.789-00",
  "termsAcceptedAt": "2024-01-15T10:00:00Z",
  "termsHash": "abc123...",
  "termsVersion": 3
}
```

## Restrições

- **Plano Gratuito**: Não tem acesso à funcionalidade
- **Planos Pagos**: Podem configurar e exigir termos de aceite

Se o prestador tentar ativar a funcionalidade sem plano compatível, receberá uma mensagem indicando a necessidade de upgrade.

## Testes

A funcionalidade possui cobertura de testes unitários em:

- `settings.service.spec.ts`: Testes de configuração de termos
- `quotes-public.service.spec.ts`: Testes de validação na assinatura
- `plan-limits.service.spec.ts`: Testes de gating por plano

Para executar:
```bash
cd apps/backend
npm test -- --testPathPattern="settings.service.spec|quotes-public.service.spec|plan-limits.service.spec"
```

## Arquivos Modificados

### Backend
- `prisma/schema.prisma`: Novos campos no modelo `TemplateSettings` e `Signature`
- `billing/interfaces/billing.interfaces.ts`: Feature flag `ACCEPTANCE_TERMS`
- `billing/plan-limits.service.ts`: Suporte ao novo feature
- `settings/settings.service.ts`: Métodos de gerenciamento de termos
- `settings/settings.controller.ts`: Endpoints de termos
- `quotes/quotes-public.service.ts`: Validação de aceite na assinatura
- `quotes/quotes-public.controller.ts`: DTOs e endpoint público

### Web (Dashboard)
- `settings/templates/page.tsx`: Nova aba de Termos de Aceite
- `services/settings.service.ts`: Métodos de API
- `hooks/use-settings.ts`: React Query hooks

### Web (Público)
- `p/quotes/[shareKey]/page.tsx`: Modal de termos na página pública

### Mobile
- `modules/quotes/AcceptanceTermsModal.tsx`: Componente de modal
- `modules/quotes/QuoteSignatureScreen.tsx`: Integração do modal
- `modules/quotes/QuoteSignatureService.ts`: Busca de termos

## Considerações de Segurança

1. O hash SHA256 garante integridade do conteúdo aceito
2. IP e User-Agent são registrados na assinatura
3. Rate limiting protege contra ataques de força bruta
4. Validação no backend impede assinaturas sem aceite quando exigido
