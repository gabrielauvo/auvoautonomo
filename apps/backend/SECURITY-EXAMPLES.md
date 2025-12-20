# Exemplos de Implementação de Segurança

Este documento contém exemplos práticos de como usar as correções de segurança implementadas.

## 1. Usando checkAndIncrementLimit() em Controllers

### ❌ ERRADO - Vulnerável a TOCTOU Race Condition

```typescript
@Post()
async create(@Body() dto: CreateClientDto, @GetUser() user: User) {
  // PROBLEMA: Entre a checagem e a criação, outro request pode criar
  // fazendo com que o limite seja ultrapassado
  await this.planLimitsService.checkLimitOrThrow({
    userId: user.id,
    resource: 'CLIENT'
  });

  return this.prisma.client.create({
    data: {
      ...dto,
      userId: user.id
    }
  });
}
```

### ✅ CORRETO - Usando Transação Atômica

```typescript
@Post()
async create(@Body() dto: CreateClientDto, @GetUser() user: User) {
  return this.prisma.$transaction(async (tx) => {
    // Verifica o limite dentro da transação
    await this.planLimitsService.checkAndIncrementLimit(tx, {
      userId: user.id,
      resource: 'CLIENT'
    });

    // Cria o recurso na mesma transação
    return tx.client.create({
      data: {
        ...dto,
        userId: user.id
      }
    });
  });
}
```

## 2. Implementando Rate Limiting Customizado

### 2.1. Rate Limiting em Controller Específico

```typescript
import { Throttle } from '@nestjs/throttler';

@Controller('sensitive')
@Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests/minuto
export class SensitiveController {
  // Todos os endpoints herdam o rate limit de 10/min
}
```

### 2.2. Rate Limiting em Endpoint Específico

```typescript
@Controller('users')
export class UsersController {
  // Este endpoint usa o rate limit global (100/min)
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  // Este endpoint tem rate limit mais restritivo (5/min)
  @Post('password-reset')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.usersService.resetPassword(dto);
  }

  // Este endpoint pula o rate limiting (use com cuidado!)
  @Get('health')
  @SkipThrottle()
  healthCheck() {
    return { status: 'ok' };
  }
}
```

### 2.3. Rate Limiting Dinâmico por Usuário

```typescript
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Rate limit por usuário ao invés de IP
    return req.user?.id || req.ip;
  }
}

// No controller:
@Controller('api')
@UseGuards(CustomThrottlerGuard)
export class ApiController {
  // Rate limit aplicado por userId
}
```

## 3. Logs Seguros

### ❌ ERRADO - Expõe Dados Sensíveis

```typescript
async login(dto: LoginDto) {
  this.logger.log(`Login attempt: ${dto.email} with password ${dto.password}`); // NUNCA!

  const user = await this.prisma.user.findUnique({
    where: { email: dto.email }
  });

  if (!user) {
    this.logger.error(`User not found: ${dto.email}`); // Permite enumeração
    throw new UnauthorizedException('User not found');
  }
}
```

### ✅ CORRETO - Logs Seguros

```typescript
private maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

async login(dto: LoginDto) {
  this.logger.log(`Login attempt: ${this.maskEmail(dto.email)}`);

  const user = await this.prisma.user.findUnique({
    where: { email: dto.email }
  });

  if (!user) {
    // Mensagem genérica - não revela se usuário existe
    this.logger.warn('Login failed: invalid credentials');
    throw new UnauthorizedException('Invalid credentials');
  }
}
```

## 4. Validação de Webhooks

### ❌ ERRADO - Aceita Webhooks Sem Validação

```typescript
@Post('webhook')
async handleWebhook(@Body() payload: any) {
  // PROBLEMA: Qualquer um pode enviar dados falsos
  await this.processPayment(payload);
  return { success: true };
}
```

### ✅ CORRETO - Valida Token e Usa Rate Limiting

```typescript
@Post('webhook')
@Throttle({ default: { limit: 100, ttl: 60000 } })
async handleWebhook(
  @Body() payload: WebhookPayload,
  @Headers('webhook-token') token: string
) {
  // Valida token
  if (token !== this.configService.get('WEBHOOK_TOKEN')) {
    this.logger.warn('Invalid webhook token received');
    throw new UnauthorizedException('Invalid token');
  }

  // Valida assinatura HMAC (ainda melhor)
  const signature = this.generateSignature(payload);
  if (signature !== this.headers['x-webhook-signature']) {
    throw new UnauthorizedException('Invalid signature');
  }

  await this.processPayment(payload);
  return { success: true };
}

private generateSignature(payload: any): string {
  const crypto = require('crypto');
  const secret = this.configService.get('WEBHOOK_SECRET');
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}
```

## 5. Prevenção de Race Conditions

### 5.1. Usando Transações

```typescript
async transferFunds(fromUserId: string, toUserId: string, amount: number) {
  return this.prisma.$transaction(async (tx) => {
    // Lock otimista - busca e bloqueia registros
    const fromAccount = await tx.account.findUnique({
      where: { userId: fromUserId }
    });

    if (fromAccount.balance < amount) {
      throw new BadRequestException('Insufficient funds');
    }

    // Atualiza ambas as contas na mesma transação
    await tx.account.update({
      where: { userId: fromUserId },
      data: { balance: { decrement: amount } }
    });

    await tx.account.update({
      where: { userId: toUserId },
      data: { balance: { increment: amount } }
    });

    // Registra transferência
    return tx.transaction.create({
      data: {
        fromUserId,
        toUserId,
        amount,
        type: 'TRANSFER'
      }
    });
  });
}
```

### 5.2. Usando updateMany com Condições

```typescript
async activatePromotion(userId: string) {
  // Usa updateMany com WHERE para garantir que só ativa uma vez
  const result = await this.prisma.userPromotion.updateMany({
    where: {
      userId,
      status: 'PENDING', // Só atualiza se ainda estiver PENDING
      expiresAt: { gt: new Date() } // E não expirou
    },
    data: {
      status: 'ACTIVE',
      activatedAt: new Date()
    }
  });

  if (result.count === 0) {
    throw new BadRequestException('Promotion already activated or expired');
  }

  return { activated: true };
}
```

## 6. Idempotência em Webhooks

```typescript
async processPaymentWebhook(payload: PaymentWebhook) {
  const paymentId = payload.payment.id;

  // Verificar se já processado (idempotência)
  const existing = await this.prisma.paymentLog.findUnique({
    where: { externalId: paymentId }
  });

  if (existing) {
    this.logger.log(`Payment ${paymentId} already processed, skipping`);
    return { success: true, duplicate: true };
  }

  // Processar em transação
  return this.prisma.$transaction(async (tx) => {
    // Criar log primeiro (previne duplicação)
    await tx.paymentLog.create({
      data: {
        externalId: paymentId,
        status: 'PROCESSING',
        payload: JSON.stringify(payload)
      }
    });

    // Processar pagamento
    const result = await this.processPayment(tx, payload);

    // Atualizar log
    await tx.paymentLog.update({
      where: { externalId: paymentId },
      data: { status: 'COMPLETED' }
    });

    return result;
  });
}
```

## 7. Validação de Input Segura

### 7.1. DTOs com Validação Completa

```typescript
import { IsEmail, IsString, Length, Matches, IsOptional } from 'class-validator';

export class CreateUserDto {
  @IsEmail({}, { message: 'Email inválido' })
  @Length(5, 100)
  email: string;

  @IsString()
  @Length(8, 100, { message: 'Senha deve ter entre 8 e 100 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Senha deve conter maiúsculas, minúsculas e números'
  })
  password: string;

  @IsString()
  @Length(2, 100)
  @Matches(/^[a-zA-ZÀ-ÿ\s'-]+$/, {
    message: 'Nome contém caracteres inválidos'
  })
  name: string;

  @IsOptional()
  @IsString()
  @Matches(/^[\d.\-/]+$/, { message: 'Formato de documento inválido' })
  document?: string;
}
```

### 7.2. Sanitização de Input

```typescript
import { Transform } from 'class-transformer';

export class SearchDto {
  @IsString()
  @Length(1, 100)
  @Transform(({ value }) => value.trim()) // Remove espaços
  @Transform(({ value }) => value.replace(/[<>]/g, '')) // Remove < e >
  query: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}
```

## 8. Proteção contra Enumeração

### ❌ ERRADO - Permite Enumeração

```typescript
@Get('users/:email')
async findByEmail(@Param('email') email: string) {
  const user = await this.prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new NotFoundException('User not found'); // Confirma que email não existe
  }

  return user;
}
```

### ✅ CORRETO - Previne Enumeração

```typescript
@Get('users/check')
@Throttle({ default: { limit: 10, ttl: 60000 } }) // Rate limit restritivo
async checkUser(@Query('email') email: string) {
  // Sempre retorna 200, não revela se existe ou não
  const user = await this.prisma.user.findUnique({ where: { email } });

  return {
    message: 'If this email exists, you will receive a verification code'
  };

  // Envia email apenas se existir
  if (user) {
    await this.emailService.sendVerificationCode(user.email);
  }
}
```

## 9. Auditoria e Compliance

### 9.1. Logging de Ações Sensíveis

```typescript
async deleteUser(userId: string, deletedBy: string) {
  return this.prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });

    // Log de auditoria ANTES de deletar
    await tx.auditLog.create({
      data: {
        action: 'USER_DELETED',
        performedBy: deletedBy,
        targetUserId: userId,
        targetUserEmail: this.maskEmail(user.email),
        timestamp: new Date(),
        ipAddress: this.requestIp,
        metadata: {
          reason: 'GDPR_REQUEST',
          retentionDays: 30
        }
      }
    });

    // Soft delete ao invés de hard delete
    return tx.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        email: `deleted_${userId}@example.com`, // Anonimiza
        name: 'Deleted User'
      }
    });
  });
}
```

### 9.2. Rastreamento de Acesso a Dados Sensíveis

```typescript
async getClientData(clientId: string, accessedBy: string) {
  // Log de acesso a dados sensíveis
  await this.prisma.dataAccessLog.create({
    data: {
      resourceType: 'CLIENT',
      resourceId: clientId,
      accessedBy,
      accessedAt: new Date(),
      purpose: 'VIEW_DETAILS'
    }
  });

  return this.prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      // Campos sensíveis requerem permissão especial
      cpf: this.hasPermission(accessedBy, 'VIEW_SENSITIVE_DATA'),
      phone: true
    }
  });
}
```

## 10. Testes de Segurança

### 10.1. Teste de Rate Limiting

```typescript
describe('Rate Limiting', () => {
  it('should block requests after limit', async () => {
    const requests = [];

    // Faz 101 requests
    for (let i = 0; i < 101; i++) {
      requests.push(
        request(app.getHttpServer())
          .get('/api/endpoint')
          .expect((res) => res.status)
      );
    }

    const results = await Promise.all(requests);
    const blocked = results.filter(r => r.status === 429);

    expect(blocked.length).toBeGreaterThan(0);
  });
});
```

### 10.2. Teste de Race Condition

```typescript
describe('Plan Limits Race Condition', () => {
  it('should not allow exceeding limits with concurrent requests', async () => {
    const userId = 'test-user';
    const limit = 10;

    // Cria 20 requests concorrentes
    const promises = Array(20).fill(null).map(() =>
      request(app.getHttpServer())
        .post('/clients')
        .send({ name: 'Test Client' })
        .set('Authorization', `Bearer ${userToken}`)
    );

    const results = await Promise.allSettled(promises);
    const succeeded = results.filter(r => r.status === 'fulfilled').length;

    // Apenas 10 devem ter sucesso
    expect(succeeded).toBeLessThanOrEqual(limit);
  });
});
```

---

**Mantenha este documento atualizado** conforme novas implementações de segurança forem adicionadas ao projeto.

**Última Atualização**: 2025-12-19
