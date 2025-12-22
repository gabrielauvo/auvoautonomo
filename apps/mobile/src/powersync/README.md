# PowerSync Setup Guide

Este guia explica como configurar o PowerSync Cloud para o projeto Auvo Mobile.

## 1. Criar conta no PowerSync Cloud

1. Acesse [app.powersync.com](https://app.powersync.com)
2. Crie uma conta ou faça login
3. Crie uma nova instância

## 2. Conectar ao PostgreSQL

No dashboard do PowerSync:

1. Vá em **Connections** > **Add Connection**
2. Selecione **PostgreSQL**
3. Configure os dados de conexão:
   - **Host**: `psql-monorepo-prod.postgres.database.azure.com`
   - **Port**: `5432`
   - **Database**: `monorepo_prod`
   - **Username**: `adminuser`
   - **Password**: (sua senha)
   - **SSL**: `Required`

4. Teste a conexão e salve

## 3. Configurar Sync Rules

No dashboard, vá em **Sync Rules** e configure:

```yaml
bucket_definitions:
  # Dados do técnico (filtrados por technician_id)
  technician_data:
    parameters:
      - SELECT id as technician_id FROM "User" WHERE id = token_parameters.sub
    data:
      - SELECT * FROM "Client" WHERE "userId" = bucket.technician_id
      - SELECT * FROM "WorkOrder" WHERE "technicianId" = bucket.technician_id
      - SELECT * FROM "Quote" WHERE "technicianId" = bucket.technician_id
      - SELECT * FROM "Invoice" WHERE "technicianId" = bucket.technician_id
      - SELECT * FROM "ChecklistInstance" WHERE "technicianId" = bucket.technician_id
      - SELECT * FROM "ChecklistAttachment" WHERE "technicianId" = bucket.technician_id
      - SELECT * FROM "Signature" WHERE "technicianId" = bucket.technician_id
      - SELECT * FROM "ExecutionSession" WHERE "technicianId" = bucket.technician_id

  # Quote items (via relacionamento)
  quote_items:
    parameters:
      - SELECT id as technician_id FROM "User" WHERE id = token_parameters.sub
    data:
      - SELECT qi.* FROM "QuoteItem" qi
        JOIN "Quote" q ON qi."quoteId" = q.id
        WHERE q."technicianId" = bucket.technician_id

  # Checklist answers (via relacionamento)
  checklist_answers:
    parameters:
      - SELECT id as technician_id FROM "User" WHERE id = token_parameters.sub
    data:
      - SELECT ca.* FROM "ChecklistAnswer" ca
        JOIN "ChecklistInstance" ci ON ca."instanceId" = ci.id
        WHERE ci."technicianId" = bucket.technician_id

  # Dados globais (todos os usuários veem)
  global_data:
    data:
      - SELECT * FROM "ChecklistTemplate" WHERE "isActive" = true
      - SELECT * FROM "ProductCategory" WHERE "isActive" = true
      - SELECT * FROM "Item" WHERE "isActive" = true
```

## 4. Configurar Autenticação

O PowerSync usará o mesmo JWT token do backend NestJS.

No dashboard, vá em **Authentication**:

1. Selecione **Custom JWT**
2. Configure o JWT Secret (mesmo usado no backend)
3. O campo `sub` do token deve conter o `userId`

## 5. Obter URL da instância

Após configurar tudo, copie a URL da instância:
- Formato: `https://<instance-id>.powersync.journeyapps.com`

## 6. Configurar no App

Edite o arquivo `.env`:

```env
EXPO_PUBLIC_POWERSYNC_URL=https://<sua-instancia>.powersync.journeyapps.com
```

## 7. Testar

1. Reinicie o Expo:
   ```bash
   npx expo start --clear
   ```

2. Faça login no app

3. Verifique no dashboard do PowerSync:
   - **Connections** > deve mostrar conexão ativa
   - **Sync** > deve mostrar dados sincronizando

## Troubleshooting

### Erro de conexão
- Verifique se o PostgreSQL permite conexões do IP do PowerSync
- Verifique credenciais no dashboard

### Dados não sincronizam
- Verifique as Sync Rules
- Confira se o `technician_id` está correto no token JWT
- Veja os logs no dashboard do PowerSync

### Erro de autenticação
- Verifique se o JWT secret está correto
- Confira se o token tem o campo `sub` com o userId

## Notas importantes

1. **Migrations pendentes**: O app irá automaticamente processar mutations do sistema antigo antes de iniciar o PowerSync

2. **Banco de dados**: O PowerSync cria um novo banco (`auvo-powersync.db`), separado do antigo (`prodesign.db`)

3. **Real-time**: Após conectado, mudanças no PostgreSQL são propagadas automaticamente para o app via WebSocket

4. **Offline**: O app funciona 100% offline. Mudanças são sincronizadas quando houver conexão
