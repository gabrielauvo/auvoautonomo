# Chave Pix para Recebimento

## Visão Geral

Esta funcionalidade permite que prestadores de serviço configurem uma chave Pix para exibição em cobranças enviadas aos clientes. A chave Pix é exibida tanto em mensagens de WhatsApp/Email quanto em PDFs de fatura, facilitando o recebimento de pagamentos.

## Estrutura de Dados

### Campos no Modelo User

```prisma
model User {
  pixKey              String?   // Chave Pix do prestador
  pixKeyType          String?   // Tipo da chave: CPF, CNPJ, EMAIL, PHONE, RANDOM
  pixKeyOwnerName     String?   // Nome do favorecido (exibido ao cliente)
  pixKeyEnabled       Boolean   @default(false) // Se a chave está ativa
}
```

### Campos no Modelo UsageLimitsConfig (Feature Flag)

```prisma
model UsageLimitsConfig {
  enablePixKey        Boolean  @default(true) // Flag de plano - habilita a funcionalidade
}
```

## Tipos de Chave Pix Suportados

| Tipo | Descrição | Normalização |
|------|-----------|--------------|
| `CPF` | CPF do prestador | Remove formatação (apenas dígitos) |
| `CNPJ` | CNPJ da empresa | Remove formatação (apenas dígitos) |
| `EMAIL` | E-mail cadastrado | Converte para minúsculas |
| `PHONE` | Telefone celular | Formato E.164 (+5511999999999) |
| `RANDOM` | Chave aleatória gerada pelo banco | Mantém como informado |

## Normalização de Chaves

O backend normaliza automaticamente as chaves Pix ao salvar:

```typescript
// CPF: 123.456.789-00 → 12345678900
// CNPJ: 12.345.678/0001-00 → 12345678000100
// PHONE: (11) 99999-9999 → +5511999999999
// EMAIL: User@Example.COM → user@example.com
// RANDOM: abc-123-def → abc-123-def (sem alteração)
```

## API Endpoints

### GET /settings/company

Retorna as configurações da empresa incluindo dados Pix:

```json
{
  "pixKey": "12345678900",
  "pixKeyType": "CPF",
  "pixKeyOwnerName": "João Prestador",
  "pixKeyEnabled": true,
  "pixKeyFeatureEnabled": true
}
```

### PUT /settings/company

Atualiza as configurações da empresa:

```json
{
  "pixKey": "123.456.789-00",
  "pixKeyType": "CPF",
  "pixKeyOwnerName": "João Prestador",
  "pixKeyEnabled": true
}
```

## Feature Flags

A funcionalidade usa dois níveis de controle:

1. **Nível de Plano** (`UsageLimitsConfig.enablePixKey`):
   - Controlado pelo administrador do sistema
   - Define se o plano do usuário tem acesso à funcionalidade
   - Default: `true` (habilitado para todos os planos)

2. **Nível de Usuário** (`User.pixKeyEnabled`):
   - Controlado pelo próprio usuário
   - Permite que o usuário ative/desative a exibição da chave
   - Default: `false` (desabilitado até o usuário configurar)

A chave Pix só é exibida quando **ambas** as flags estão ativas.

## Exibição nas Notificações

### WhatsApp/Email (Templates)

Quando habilitada, a chave Pix aparece em um bloco destacado:

**Mensagem de texto (WhatsApp):**
```
📱 *PIX para pagamento*
Chave: 12345678900
Tipo: CPF
Favorecido: João Prestador
Copie e cole a chave no seu banco para pagar via Pix.
```

**E-mail (HTML):**
Bloco estilizado com fundo azul claro (#E0F2FE) e borda lateral.

### Tipos de Notificação com Pix

- `PAYMENT_CREATED` - Nova cobrança criada
- `PAYMENT_OVERDUE` - Cobrança em atraso
- `PAYMENT_REMINDER_BEFORE_DUE` - Lembrete antes do vencimento
- `PAYMENT_REMINDER_AFTER_DUE` - Lembrete após vencimento

## Exibição no PDF

### PDF de Fatura (Invoice)

Quando habilitada, uma seção "Pix para pagamento" é adicionada ao PDF:

```
┌─────────────────────────────────────────────────┐
│  Pix para pagamento                              │
├─────────────────────────────────────────────────┤
│  Chave Pix  │  12345678900                       │
│  Tipo       │  CPF                               │
│  Favorecido │  João Prestador                    │
├─────────────────────────────────────────────────┤
│  Copie e cole a chave no seu banco para pagar   │
│  via Pix.                                        │
└─────────────────────────────────────────────────┘
```

## Interface do Usuário

### Web (Dados da Empresa)

Seção "Recebimento via Pix" em `/settings/company`:
- Toggle para ativar/desativar exibição
- Dropdown para tipo de chave
- Campo para a chave Pix
- Campo para nome do favorecido
- Botão para copiar chave

### Mobile (Perfil > Empresa)

Mesma estrutura da versão web, adaptada para mobile:
- Switch para ativar/desativar
- Picker modal para tipo de chave
- Inputs para chave e favorecido

## Testes

Testes unitários em:
- `src/settings/pix-key-normalization.spec.ts` - Normalização de chaves
- `src/notifications/templates/notification-templates.spec.ts` - Renderização do bloco Pix

Para executar:
```bash
cd apps/backend
pnpm test -- --testPathPattern="pix-key|notification-templates"
```

## Migration

A migration `20251222_add_pix_key_fields` adiciona os campos necessários:

```sql
ALTER TABLE "users" ADD COLUMN "pixKey" TEXT;
ALTER TABLE "users" ADD COLUMN "pixKeyType" TEXT;
ALTER TABLE "users" ADD COLUMN "pixKeyOwnerName" TEXT;
ALTER TABLE "users" ADD COLUMN "pixKeyEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "usage_limits_config" ADD COLUMN "enablePixKey" BOOLEAN NOT NULL DEFAULT true;
```

## Considerações de Segurança

- Chaves Pix são dados pessoais e devem ser tratadas como tal
- A chave só é exposta em contextos onde o usuário explicitamente habilitou
- Validação conservadora: aceita qualquer formato, normaliza silenciosamente
- Não há validação de propriedade da chave (responsabilidade do usuário)
