# Exemplo de Uso - Verificação de Limites

## Como Usar o Guard de Limites em um Novo Módulo

Quando você for criar um novo módulo (ex: Clients, Quotes), siga este padrão para aplicar verificação de limites automaticamente.

## Passo 1: Criar o Controller

```typescript
import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsageLimitGuard } from '../plans/guards/usage-limit.guard';
import { CheckLimit } from '../plans/decorators/check-limit.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('clients')
@UseGuards(JwtAuthGuard) // Sempre proteger com autenticação
export class ClientsController {
  constructor(private clientsService: ClientsService) {}

  @Post()
  @UseGuards(UsageLimitGuard) // Adicionar guard de limite
  @CheckLimit('clients') // Especificar qual limite verificar
  async create(@Body() dto: CreateClientDto, @CurrentUser() user: any) {
    // Se chegou aqui, o usuário está dentro do limite!
    return this.clientsService.create(dto, user.id);
  }

  @Get()
  async findAll(@CurrentUser() user: any) {
    // Listar não precisa de verificação de limite
    return this.clientsService.findAll(user.id);
  }
}
```

## Passo 2: Criar o Service

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateClientDto, userId: string) {
    return this.prisma.client.create({
      data: {
        ...dto,
        userId,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.client.findMany({
      where: { userId },
    });
  }
}
```

## Passo 3: Registrar no Module

```typescript
import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { PlansModule } from '../plans/plans.module';

@Module({
  imports: [PlansModule], // Importar PlansModule para ter acesso ao guard
  controllers: [ClientsController],
  providers: [ClientsService],
})
export class ClientsModule {}
```

## Fluxo Completo

```
1. Cliente → POST /clients
2. JwtAuthGuard verifica token e injeta user
3. UsageLimitGuard executa:
   - Lê @CheckLimit('clients')
   - Chama PlansService.checkClientLimit(user.id)
   - Se OK → continua
   - Se limite atingido → 403 Forbidden
4. Controller executa create()
5. Service salva no banco
6. Retorna 201 Created
```

## Tipos de Limites Disponíveis

```typescript
type LimitType = 'clients' | 'quotes' | 'work-orders' | 'invoices';
```

## Exemplos para Cada Recurso

### Clientes
```typescript
@Post('clients')
@UseGuards(JwtAuthGuard, UsageLimitGuard)
@CheckLimit('clients')
async createClient(@Body() dto: CreateClientDto) { ... }
```

### Orçamentos
```typescript
@Post('quotes')
@UseGuards(JwtAuthGuard, UsageLimitGuard)
@CheckLimit('quotes')
async createQuote(@Body() dto: CreateQuoteDto) { ... }
```

### Ordens de Serviço
```typescript
@Post('work-orders')
@UseGuards(JwtAuthGuard, UsageLimitGuard)
@CheckLimit('work-orders')
async createWorkOrder(@Body() dto: CreateWorkOrderDto) { ... }
```

### Faturas
```typescript
@Post('invoices')
@UseGuards(JwtAuthGuard, UsageLimitGuard)
@CheckLimit('invoices')
async createInvoice(@Body() dto: CreateInvoiceDto) { ... }
```

## Resposta de Erro

Quando o limite é atingido, o cliente recebe:

**Status**: `403 Forbidden`

**Body**:
```json
{
  "statusCode": 403,
  "message": "Client limit reached. Your plan allows 5 clients.",
  "error": "Forbidden"
}
```

## Frontend - Verificar Uso Antes de Criar

Para melhorar a UX, verifique o uso antes de tentar criar:

```typescript
// No frontend
const checkUsage = async () => {
  const response = await fetch('/plans/usage', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const usage = await response.json();

  if (usage.clients.current >= usage.clients.limit) {
    showUpgradeDialog('Você atingiu o limite de clientes do seu plano.');
    return false;
  }
  return true;
};

const createClient = async (data) => {
  if (await checkUsage()) {
    // Prosseguir com criação
  }
};
```

## Mostrar Barra de Uso

```typescript
const UsageBar = ({ current, limit, unlimited }) => {
  if (unlimited) return <Badge>Ilimitado</Badge>;

  const percentage = (current / limit) * 100;
  const color = percentage >= 90 ? 'red' : percentage >= 70 ? 'yellow' : 'green';

  return (
    <div>
      <ProgressBar value={current} max={limit} color={color} />
      <span>{current}/{limit} ({percentage.toFixed(0)}%)</span>
    </div>
  );
};
```

## Testes

### Testar Criação Dentro do Limite

```typescript
it('should create client when under limit', async () => {
  const response = await request(app.getHttpServer())
    .post('/clients')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Test Client' })
    .expect(201);

  expect(response.body).toHaveProperty('id');
});
```

### Testar Bloqueio no Limite

```typescript
it('should block creation when limit reached', async () => {
  // Criar 5 clientes (limite do Free)
  for (let i = 0; i < 5; i++) {
    await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Client ${i}` });
  }

  // Tentar criar o 6º
  const response = await request(app.getHttpServer())
    .post('/clients')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Client 6' })
    .expect(403);

  expect(response.body.message).toContain('limit reached');
});
```

## Importante

- ✅ **Sempre** use `JwtAuthGuard` antes de `UsageLimitGuard`
- ✅ Use `@CheckLimit()` para especificar o tipo de limite
- ✅ Importe `PlansModule` no seu módulo
- ✅ Trate erros 403 no frontend com mensagens amigáveis
- ✅ Mostre uso atual para o usuário
- ❌ Não aplique limite em rotas GET (listar)
- ❌ Não aplique limite em rotas PUT/DELETE (atualizar/deletar)
