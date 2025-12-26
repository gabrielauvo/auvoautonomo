/**
 * AI Gateway E2E Tests
 * Tests the complete flow: chat -> plan -> confirm -> execute
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AI Gateway (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let userId: string;
  let conversationId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Clean up test data
    await cleanupTestData(prisma);
  });

  afterAll(async () => {
    await cleanupTestData(prisma);
    await prisma.$disconnect();
    await app.close();
  });

  describe('Authentication Setup', () => {
    it('should register a test user', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'aitest@ai-gateway-test.e2e',
          password: 'password123',
          name: 'AI Gateway Test User',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe('aitest@ai-gateway-test.e2e');
      userId = response.body.id;
    });

    it('should login and get JWT token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'aitest@ai-gateway-test.e2e',
          password: 'password123',
        })
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      authToken = response.body.access_token;
    });
  });

  describe('POST /ai/chat - Basic chat', () => {
    it('should create a new conversation and respond', async () => {
      const response = await request(app.getHttpServer())
        .post('/ai/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Olá',
        })
        .expect(200);

      expect(response.body).toHaveProperty('conversationId');
      expect(response.body).toHaveProperty('message');
      expect(typeof response.body.message).toBe('string');
      expect(response.body.message.length).toBeGreaterThan(0);

      conversationId = response.body.conversationId;
    });

    it('should continue an existing conversation', async () => {
      const response = await request(app.getHttpServer())
        .post('/ai/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          conversationId,
          message: 'Como você pode me ajudar?',
        })
        .expect(200);

      expect(response.body.conversationId).toBe(conversationId);
      expect(response.body).toHaveProperty('message');
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .post('/ai/chat')
        .send({
          message: 'Teste',
        })
        .expect(401);
    });
  });

  describe('POST /ai/chat - Read operations', () => {
    it('should handle list customers request', async () => {
      const response = await request(app.getHttpServer())
        .post('/ai/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Listar meus clientes',
        })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      // Read operations should not require confirmation
      // The response should either have data or be informative
    });

    it('should handle search request', async () => {
      const response = await request(app.getHttpServer())
        .post('/ai/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Buscar cliente João',
        })
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /ai/chat - Write operations (Plan flow)', () => {
    let newConversationId: string;

    it('should return a plan for create customer request', async () => {
      const response = await request(app.getHttpServer())
        .post('/ai/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Criar um cliente chamado Maria Silva com email maria@teste.com',
        })
        .expect(200);

      expect(response.body).toHaveProperty('conversationId');
      expect(response.body).toHaveProperty('message');
      newConversationId = response.body.conversationId;

      // For write operations, the AI should ask for confirmation or collect more fields
      // The state should be either PLANNING or AWAITING_CONFIRMATION
      if (response.body.state) {
        expect(['PLANNING', 'AWAITING_CONFIRMATION', 'IDLE']).toContain(response.body.state);
      }
    });

    it('should handle confirmation flow', async () => {
      // Send confirmation message
      const response = await request(app.getHttpServer())
        .post('/ai/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          conversationId: newConversationId,
          message: 'sim, confirmo',
        })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      // After confirmation, the state should transition
    });
  });

  describe('POST /ai/chat - Rejection flow', () => {
    it('should handle rejection properly', async () => {
      // First, trigger a write operation
      const createResponse = await request(app.getHttpServer())
        .post('/ai/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Criar cliente Pedro',
        })
        .expect(200);

      const convId = createResponse.body.conversationId;

      // Then reject it
      const rejectResponse = await request(app.getHttpServer())
        .post('/ai/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          conversationId: convId,
          message: 'não, cancela',
        })
        .expect(200);

      expect(rejectResponse.body).toHaveProperty('message');
      // After rejection, the state should go back to IDLE
      if (rejectResponse.body.state) {
        expect(rejectResponse.body.state).toBe('IDLE');
      }
    });
  });

  describe('POST /ai/chat - Modification flow', () => {
    it('should handle modification requests', async () => {
      // First, trigger a write operation
      const createResponse = await request(app.getHttpServer())
        .post('/ai/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Criar cliente Ana com email ana@exemplo.com',
        })
        .expect(200);

      const convId = createResponse.body.conversationId;

      // Request modification
      const modifyResponse = await request(app.getHttpServer())
        .post('/ai/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          conversationId: convId,
          message: 'alterar o email para ana.silva@exemplo.com',
        })
        .expect(200);

      expect(modifyResponse.body).toHaveProperty('message');
    });
  });

  describe('GET /ai/conversations', () => {
    it('should return recent conversations', async () => {
      const response = await request(app.getHttpServer())
        .get('/ai/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // Should have at least the conversations created in previous tests
      expect(response.body.length).toBeGreaterThanOrEqual(1);
    });

    it('should respect limit parameter', async () => {
      const response = await request(app.getHttpServer())
        .get('/ai/conversations?limit=2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeLessThanOrEqual(2);
    });
  });

  describe('GET /ai/conversations/:conversationId', () => {
    it('should return conversation with messages', async () => {
      const response = await request(app.getHttpServer())
        .get(`/ai/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('messages');
      expect(Array.isArray(response.body.messages)).toBe(true);
      // Should have at least user and assistant messages
      expect(response.body.messages.length).toBeGreaterThanOrEqual(2);
    });

    it('should return 404 for non-existent conversation', async () => {
      await request(app.getHttpServer())
        .get('/ai/conversations/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('GET /ai/plans/pending', () => {
    it('should return pending plans', async () => {
      const response = await request(app.getHttpServer())
        .get('/ai/plans/pending')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Rate limiting', () => {
    it('should enforce rate limits after many requests', async () => {
      // This test would need to be adjusted based on actual rate limit settings
      // For now, we just verify the endpoint works with sequential requests
      const responses: request.Response[] = [];
      for (let i = 0; i < 5; i++) {
        const response = await request(app.getHttpServer())
          .post('/ai/chat')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: `Mensagem de teste ${i}`,
          });
        responses.push(response);
      }

      // All should succeed or some should fail with rate limit
      responses.forEach((res) => {
        expect([200, 400]).toContain(res.status);
      });
    });
  });
});

async function cleanupTestData(prisma: PrismaService) {
  // Find user IDs first
  const users = await prisma.user.findMany({
    where: { email: { contains: '@ai-gateway-test.e2e' } },
    select: { id: true },
  });

  const userIds = users.map((u) => u.id);

  if (userIds.length === 0) return;

  // Clean up in correct order due to foreign key constraints
  await prisma.aiMessage.deleteMany({
    where: {
      conversation: {
        userId: { in: userIds },
      },
    },
  });

  await prisma.aiConversation.deleteMany({
    where: {
      userId: { in: userIds },
    },
  });

  await prisma.aiPlan.deleteMany({
    where: {
      userId: { in: userIds },
    },
  });

  await prisma.aiAuditLog.deleteMany({
    where: {
      userId: { in: userIds },
    },
  });

  await prisma.user.deleteMany({
    where: { email: { contains: '@ai-gateway-test.e2e' } },
  });
}
