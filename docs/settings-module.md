# Módulo de Configurações (Settings)

## Visão Geral

O módulo de configurações permite ao usuário gerenciar todas as preferências do sistema, incluindo dados pessoais, informações da empresa, templates de documentos, notificações e segurança.

## Rotas

| Rota | Descrição |
|------|-----------|
| `/settings` | Redireciona para `/settings/account` |
| `/settings/account` | Configurações de conta do usuário |
| `/settings/company` | Configurações da empresa |
| `/settings/plan` | Plano e assinatura (PLG) |
| `/settings/templates` | Templates de documentos |
| `/settings/notifications` | Preferências de notificação |
| `/settings/security` | Segurança e sessões |

## Arquitetura

```
apps/web/src/
├── app/(dashboard)/settings/
│   ├── layout.tsx              # Layout com sidebar
│   ├── page.tsx                # Redirect
│   ├── account/page.tsx        # Configurações de conta
│   ├── company/page.tsx        # Configurações da empresa
│   ├── plan/page.tsx           # Plano e PLG
│   ├── templates/page.tsx      # Templates de documentos
│   ├── notifications/page.tsx  # Notificações
│   └── security/page.tsx       # Segurança
├── components/settings/
│   ├── index.ts                # Barrel export
│   ├── color-picker.tsx        # Seletor de cores
│   ├── upload-logo.tsx         # Upload de logo
│   ├── plan-usage-bar.tsx      # Barra de uso do plano
│   ├── template-preview.tsx    # Preview de templates
│   └── notification-message-editor.tsx  # Editor de mensagens
├── services/
│   └── settings.service.ts     # Service com API e tipos
└── hooks/
    └── use-settings.ts         # React Query hooks
```

## Funcionalidades

### 1. Configurações de Conta (`/settings/account`)

- Nome completo
- Email (somente leitura)
- Telefone
- Idioma (pt-BR, en-US, es)
- Timezone
- Alteração de senha

### 2. Configurações da Empresa (`/settings/company`)

- **Dados cadastrais:**
  - Nome fantasia
  - Razão social
  - CPF/CNPJ
  - Inscrição estadual
  - Email comercial
  - Telefone/WhatsApp

- **Endereço:**
  - CEP, Logradouro, Número
  - Complemento, Bairro
  - Cidade, Estado

- **Logo:**
  - Upload drag-and-drop
  - Formatos: PNG, JPG, WebP
  - Tamanho máximo: 2MB
  - Preview em tempo real

- **Branding (cores):**
  - Cor primária
  - Cor secundária
  - Cor do texto
  - Cor de destaque
  - Preview do template

### 3. Plano e Assinatura (`/settings/plan`)

#### Planos disponíveis:

| Recurso | FREE | PRO | TEAM |
|---------|------|-----|------|
| Preço | R$ 0 | R$ 49,90/mês | R$ 99,90/mês |
| Clientes | 20 | Ilimitado | Ilimitado |
| Orçamentos | 20/mês | Ilimitado | Ilimitado |
| OS | 20/mês | Ilimitado | Ilimitado |
| Cobranças | 20/mês | Ilimitado | Ilimitado |
| Usuários | 1 | 1 | 5 |
| Templates | Básico | Personalizado | Personalizado |
| API | - | - | ✓ |

#### Fluxo de Upgrade:

1. Usuário clica em "Fazer upgrade"
2. Frontend chama `POST /billing/upgrade`
3. Backend cria link de pagamento no Asaas
4. Frontend abre nova aba com URL de pagamento
5. Usuário completa pagamento
6. Webhook do Asaas atualiza status
7. Plano é atualizado imediatamente

### 4. Templates (`/settings/templates`)

#### Template de Orçamento:
- Exibir/ocultar logo
- Posição da logo (esquerda, centro, direita)
- Cores primária e secundária
- Texto do cabeçalho
- Texto do rodapé
- Mensagem padrão
- Termos e condições
- Campo de assinatura

#### Template de Ordem de Serviço:
- Exibir/ocultar logo
- Posição da logo
- Cor principal
- Layout (compacto/detalhado)
- Exibir checklist no PDF
- Campo de assinatura do cliente

#### Template de Cobrança:
- Mensagem padrão do WhatsApp
- Mensagem de lembrete
- Assunto do email

#### Placeholders disponíveis:
- `{nome_cliente}` - Nome do cliente
- `{valor}` - Valor formatado (R$)
- `{data}` - Data formatada
- `{link_pagamento}` - Link de pagamento
- `{numero_os}` - Número da OS
- `{numero_orcamento}` - Número do orçamento

### 5. Notificações (`/settings/notifications`)

#### Preferências de Email:
- Novo orçamento criado
- Orçamento aprovado/recusado
- Nova OS criada
- OS concluída
- Pagamento recebido
- Pagamento em atraso

#### Preferências de WhatsApp:
- Lembretes de pagamento
- Lembretes de agendamento (OS)

#### Configuração de Lembretes:
- Dias antes do vencimento (0-30)
- No dia do vencimento (sim/não)
- Dias após vencimento (0-30)
- Dias antes do agendamento da OS (0-7)

#### Mensagens Personalizadas:
- Lembrete de pagamento
- Cobrança em atraso
- Lembrete de OS
- Follow-up de orçamento

### 6. Segurança (`/settings/security`)

- Alteração de senha
- Visualização de sessões ativas
- Encerrar sessão específica
- Encerrar todas as sessões
- Excluir conta (zona de perigo)

## Endpoints da API

### Perfil
```
GET    /settings/profile
PUT    /settings/profile
POST   /settings/change-password
POST   /settings/avatar
```

### Empresa
```
GET    /settings/company
PUT    /settings/company
POST   /settings/company/logo
DELETE /settings/company/logo
```

### Plano/Billing
```
GET    /billing/subscription
POST   /billing/upgrade
POST   /billing/cancel
POST   /billing/reactivate
```

### Templates
```
GET    /settings/templates
PUT    /settings/templates/quote
PUT    /settings/templates/work-order
PUT    /settings/templates/charge
POST   /settings/templates/{type}/reset
```

### Notificações
```
GET    /settings/notifications
PUT    /settings/notifications/preferences
PUT    /settings/notifications/messages
```

### Segurança
```
GET    /settings/security
POST   /settings/security/logout-all
DELETE /settings/security/sessions/{id}
POST   /settings/delete-account
```

## Componentes

### ColorPicker
Seletor de cores com presets e input customizado.

```tsx
<ColorPicker
  label="Cor primária"
  value="#7C3AED"
  onChange={(color) => setColor(color)}
  disabled={false}
/>
```

### UploadLogo
Upload de logo com drag-and-drop e preview.

```tsx
<UploadLogo
  currentLogoUrl={logoUrl}
  onUpload={handleUpload}
  onRemove={handleRemove}
  isUploading={isPending}
  maxSizeMB={2}
/>
```

### PlanUsageBar
Barra de progresso do uso do plano com cores dinâmicas.

```tsx
<PlanUsageBar
  label="Clientes"
  current={15}
  max={20}
  showPercentage={true}
/>
```

### TemplatePreview
Preview ao vivo de templates de documentos.

```tsx
<TemplatePreview
  type="quote"
  logoUrl={logoUrl}
  primaryColor="#7C3AED"
  companyName="Minha Empresa"
  showLogo={true}
/>
```

### NotificationMessageEditor
Editor de mensagens com suporte a placeholders.

```tsx
<NotificationMessageEditor
  label="Lembrete de pagamento"
  value={message}
  onChange={setMessage}
  defaultValue={defaultMessage}
/>
```

## Hooks Disponíveis

```typescript
// Perfil
useProfile()
useUpdateProfile()
useChangePassword()
useUploadAvatar()

// Empresa
useCompanySettings()
useUpdateCompanySettings()
useUploadLogo()
useDeleteLogo()

// Plano
useSubscription()
useUpgradePlan()
useCancelSubscription()
useReactivateSubscription()

// Templates
useTemplateSettings()
useUpdateQuoteTemplate()
useUpdateWorkOrderTemplate()
useUpdateChargeTemplate()
useResetTemplate()

// Notificações
useNotificationSettings()
useUpdateNotificationPreferences()
useUpdateNotificationMessages()

// Segurança
useSecurityInfo()
useLogoutAllSessions()
useRevokeSession()
useDeleteAccount()
```

## Tratamento de Erros PLG

Quando o limite do plano é atingido, a API retorna:

```json
{
  "error": "LIMIT_REACHED",
  "resource": "CLIENT",
  "plan": "FREE",
  "max": 20,
  "current": 20
}
```

O frontend exibe:
- Card de upsell com botão de upgrade
- Mensagem clara sobre o limite atingido
- Barra de uso em vermelho (100%)

## Testes

```bash
# Executar testes do módulo
npm test -- src/__tests__/settings/
```

Testes cobrem:
- Helpers do service (isLimitReached, getUsagePercentage, etc.)
- Configurações de planos (PLAN_FEATURES)
- Valores padrão (DEFAULT_BRANDING, DEFAULT_NOTIFICATION_MESSAGES)
- Substituição de placeholders
