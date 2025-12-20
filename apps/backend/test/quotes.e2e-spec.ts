import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Quotes (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let userId: string;
  let clientId: string;
  let itemId1: string;
  let itemId2: string;
  let quoteId: string;

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

    // Clean database
    await prisma.quoteItem.deleteMany();
    await prisma.quote.deleteMany();
    await prisma.item.deleteMany();
    await prisma.client.deleteMany();
    await prisma.user.deleteMany();
    await prisma.plan.deleteMany();

    // Create test plan
    await prisma.plan.create({
      data: {
        type: 'FREE',
        name: 'Free Plan',
        price: 0,
        maxClients: 10,
        maxQuotes: 10,
        maxWorkOrders: 10,
        maxInvoices: 10,
        features: ['basic'],
      },
    });

    // Create and authenticate user
    const signupResponse = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email: 'quotes-test@test.com',
        password: 'Test123!@#',
        name: 'Quotes Test User',
      });

    authToken = signupResponse.body.access_token;
    userId = signupResponse.body.user.id;

    // Create test client
    const clientResponse = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Client for Quotes',
        email: 'client@test.com',
        phone: '11999999999',
      });

    clientId = clientResponse.body.id;

    // Create test items
    const item1Response = await request(app.getHttpServer())
      .post('/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Serviço de Manutenção',
        type: 'SERVICE',
        unitPrice: 100,
      });

    itemId1 = item1Response.body.id;

    const item2Response = await request(app.getHttpServer())
      .post('/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Peça de Reposição',
        type: 'PRODUCT',
        unitPrice: 50,
      });

    itemId2 = item2Response.body.id;
  });

  afterAll(async () => {
    await prisma.quoteItem.deleteMany();
    await prisma.quote.deleteMany();
    await prisma.item.deleteMany();
    await prisma.client.deleteMany();
    await prisma.user.deleteMany();
    await prisma.plan.deleteMany();
    await app.close();
  });

  describe('/quotes (POST)', () => {
    it('should create a new quote with correct total calculation', async () => {
      const createQuoteDto = {
        clientId,
        items: [
          { itemId: itemId1, quantity: 2 }, // 2 * 100 = 200
          { itemId: itemId2, quantity: 1.5 }, // 1.5 * 50 = 75
        ],
        discountValue: 25,
        notes: 'Test quote with discount',
      };

      const response = await request(app.getHttpServer())
        .post('/quotes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createQuoteDto)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        userId,
        clientId,
        status: 'DRAFT',
        discountValue: '25.00',
        totalValue: '250.00', // 200 + 75 - 25 = 250
        notes: 'Test quote with discount',
      });

      expect(response.body.items).toHaveLength(2);
      expect(response.body.client).toBeDefined();

      quoteId = response.body.id;
    });

    it('should reject quote with clientId from another user', async () => {
      await request(app.getHttpServer())
        .post('/quotes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          clientId: 'invalid-client-id',
          items: [{ itemId: itemId1, quantity: 1 }],
        })
        .expect(403);
    });

    it('should reject quote with discount greater than total', async () => {
      await request(app.getHttpServer())
        .post('/quotes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          clientId,
          items: [{ itemId: itemId1, quantity: 1 }], // Total = 100
          discountValue: 150, // Discount > Total
        })
        .expect(400);
    });

    it('should reject quote without authentication', async () => {
      await request(app.getHttpServer())
        .post('/quotes')
        .send({
          clientId,
          items: [{ itemId: itemId1, quantity: 1 }],
        })
        .expect(401);
    });
  });

  describe('/quotes (GET)', () => {
    it('should return all quotes for authenticated user', async () => {
      const response = await request(app.getHttpServer())
        .get('/quotes')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toMatchObject({
        id: expect.any(String),
        userId,
        status: expect.any(String),
        client: expect.any(Object),
        _count: { items: expect.any(Number) },
      });
    });

    it('should filter quotes by clientId', async () => {
      const response = await request(app.getHttpServer())
        .get(`/quotes?clientId=${clientId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((quote) => {
        expect(quote.clientId).toBe(clientId);
      });
    });

    it('should filter quotes by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/quotes?status=DRAFT')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((quote) => {
        expect(quote.status).toBe('DRAFT');
      });
    });

    it('should reject request without authentication', async () => {
      await request(app.getHttpServer()).get('/quotes').expect(401);
    });
  });

  describe('/quotes/:id (GET)', () => {
    it('should return quote with all items and client details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/quotes/${quoteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: quoteId,
        userId,
        clientId,
        status: 'DRAFT',
        client: {
          id: clientId,
          name: expect.any(String),
          email: expect.any(String),
        },
      });

      expect(response.body.items).toHaveLength(2);
      expect(response.body.items[0]).toMatchObject({
        id: expect.any(String),
        quantity: expect.any(String),
        unitPrice: expect.any(String),
        totalPrice: expect.any(String),
        item: expect.any(Object),
      });
    });

    it('should return 404 for non-existent quote', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .get(`/quotes/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('/quotes/:id (PUT)', () => {
    it('should update quote discount and recalculate total', async () => {
      const updateDto = {
        discountValue: 50, // Changed from 25 to 50
        notes: 'Updated discount',
      };

      const response = await request(app.getHttpServer())
        .put(`/quotes/${quoteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body).toMatchObject({
        id: quoteId,
        discountValue: '50.00',
        totalValue: '225.00', // 275 - 50 = 225
        notes: 'Updated discount',
      });
    });

    it('should reject discount greater than items total', async () => {
      await request(app.getHttpServer())
        .put(`/quotes/${quoteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ discountValue: 500 })
        .expect(400);
    });

    it('should return 404 for non-existent quote', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .put(`/quotes/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ notes: 'Test' })
        .expect(404);
    });
  });

  describe('/quotes/:id/items (POST)', () => {
    it('should add item to quote and recalculate total', async () => {
      const addItemDto = {
        itemId: itemId1,
        quantity: 1, // 1 * 100 = 100
      };

      const response = await request(app.getHttpServer())
        .post(`/quotes/${quoteId}/items`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(addItemDto)
        .expect(201);

      expect(response.body.items).toHaveLength(3);
      expect(response.body.totalValue).toBe('325.00'); // 275 + 100 - 50 = 325
    });

    it('should reject invalid itemId', async () => {
      await request(app.getHttpServer())
        .post(`/quotes/${quoteId}/items`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ itemId: 'invalid-item-id', quantity: 1 })
        .expect(400);
    });
  });

  describe('/quotes/:id/items/:itemId (PUT)', () => {
    let quoteItemId: string;

    beforeAll(async () => {
      const quote = await request(app.getHttpServer())
        .get(`/quotes/${quoteId}`)
        .set('Authorization', `Bearer ${authToken}`);

      quoteItemId = quote.body.items[0].id;
    });

    it('should update item quantity and recalculate prices', async () => {
      const updateDto = { quantity: 3 }; // Changed to 3

      const response = await request(app.getHttpServer())
        .put(`/quotes/${quoteId}/items/${quoteItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateDto)
        .expect(200);

      const updatedItem = response.body.items.find(i => i.id === quoteItemId);
      expect(updatedItem.quantity).toBe('3.000');
      expect(response.body.totalValue).not.toBe('325.00'); // Total changed
    });

    it('should return 404 for non-existent quote item', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .put(`/quotes/${quoteId}/items/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ quantity: 1 })
        .expect(404);
    });
  });

  describe('/quotes/:id/items/:itemId (DELETE)', () => {
    let quoteItemId: string;

    beforeAll(async () => {
      const quote = await request(app.getHttpServer())
        .get(`/quotes/${quoteId}`)
        .set('Authorization', `Bearer ${authToken}`);

      quoteItemId = quote.body.items[0].id;
    });

    it('should remove item and recalculate total', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/quotes/${quoteId}/items/${quoteItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items.length).toBeLessThan(3);
    });

    it('should return 404 for non-existent quote item', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .delete(`/quotes/${quoteId}/items/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('/quotes/:id/status (PATCH)', () => {
    it('should update status from DRAFT to SENT', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/quotes/${quoteId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'SENT' })
        .expect(200);

      expect(response.body.status).toBe('SENT');
    });

    it('should update status from SENT to APPROVED', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/quotes/${quoteId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'APPROVED' })
        .expect(200);

      expect(response.body.status).toBe('APPROVED');
    });

    it('should reject invalid status transition', async () => {
      // Try to go from APPROVED to DRAFT (invalid)
      await request(app.getHttpServer())
        .patch(`/quotes/${quoteId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'DRAFT' })
        .expect(400);
    });

    it('should return 404 for non-existent quote', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .patch(`/quotes/${fakeId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'SENT' })
        .expect(404);
    });
  });

  describe('Quote ownership validation', () => {
    let secondUserToken: string;
    let secondQuoteId: string;

    beforeAll(async () => {
      // Create second user
      const signupResponse = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'quotes-test2@test.com',
          password: 'Test123!@#',
          name: 'Second Quotes Test User',
        });

      secondUserToken = signupResponse.body.access_token;

      // Create client for second user
      const clientResponse = await request(app.getHttpServer())
        .post('/clients')
        .set('Authorization', `Bearer ${secondUserToken}`)
        .send({
          name: 'Second User Client',
          email: 'secondclient@test.com',
        });

      const secondClientId = clientResponse.body.id;

      // Create item for second user
      const itemResponse = await request(app.getHttpServer())
        .post('/items')
        .set('Authorization', `Bearer ${secondUserToken}`)
        .send({
          name: 'Second User Item',
          type: 'SERVICE',
          unitPrice: 100,
        });

      const secondItemId = itemResponse.body.id;

      // Create quote for second user
      const quoteResponse = await request(app.getHttpServer())
        .post('/quotes')
        .set('Authorization', `Bearer ${secondUserToken}`)
        .send({
          clientId: secondClientId,
          items: [{ itemId: secondItemId, quantity: 1 }],
        });

      secondQuoteId = quoteResponse.body.id;
    });

    it('should not allow first user to access second user quote', async () => {
      await request(app.getHttpServer())
        .get(`/quotes/${secondQuoteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should not allow first user to update second user quote', async () => {
      await request(app.getHttpServer())
        .put(`/quotes/${secondQuoteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ notes: 'Hacked' })
        .expect(404);
    });

    it('should not allow first user to delete second user quote', async () => {
      await request(app.getHttpServer())
        .delete(`/quotes/${secondQuoteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
