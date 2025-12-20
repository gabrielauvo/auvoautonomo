import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('ItemsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let userId: string;
  let itemId: string;
  let otherUserToken: string;
  let otherUserId: string;

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
    await prisma.item.deleteMany({
      where: {
        OR: [
          { name: { contains: 'Test Item' } },
          { code: { contains: 'TEST-' } },
        ],
      },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: '@items-test.e2e' } },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.item.deleteMany({
      where: {
        OR: [
          { name: { contains: 'Test Item' } },
          { code: { contains: 'TEST-' } },
        ],
      },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: '@items-test.e2e' } },
    });

    await prisma.$disconnect();
    await app.close();
  });

  describe('Authentication Setup', () => {
    it('should register first test user', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'itemsuser1@items-test.e2e',
          password: 'password123',
          name: 'Items Test User 1',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      userId = response.body.id;
    });

    it('should login first user and get JWT token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'itemsuser1@items-test.e2e',
          password: 'password123',
        })
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      authToken = response.body.access_token;
    });

    it('should register second test user', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'itemsuser2@items-test.e2e',
          password: 'password123',
          name: 'Items Test User 2',
        })
        .expect(201);

      otherUserId = response.body.id;
    });

    it('should login second user and get JWT token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'itemsuser2@items-test.e2e',
          password: 'password123',
        })
        .expect(200);

      otherUserToken = response.body.access_token;
    });
  });

  describe('POST /items', () => {
    it('should create a new product item', async () => {
      const response = await request(app.getHttpServer())
        .post('/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Item Product',
          description: 'A test product',
          type: 'PRODUCT',
          code: 'TEST-PROD-001',
          unitPrice: 150.0,
          costPrice: 100.0,
          unit: 'UN',
          category: 'Electronics',
          isActive: true,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Test Item Product');
      expect(response.body.type).toBe('PRODUCT');
      expect(response.body.unitPrice).toBe('150.00');
      expect(response.body.userId).toBe(userId);
      itemId = response.body.id;
    });

    it('should create a new service item', async () => {
      const response = await request(app.getHttpServer())
        .post('/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Item Service',
          description: 'A test service',
          type: 'SERVICE',
          code: 'TEST-SRV-001',
          unitPrice: 200.0,
          unit: 'hora',
          category: 'Consulting',
        })
        .expect(201);

      expect(response.body.name).toBe('Test Item Service');
      expect(response.body.type).toBe('SERVICE');
      expect(response.body.unit).toBe('hora');
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .post('/items')
        .send({
          name: 'Test Item',
          unitPrice: 100.0,
        })
        .expect(401);
    });

    it('should fail with invalid data (missing required fields)', async () => {
      await request(app.getHttpServer())
        .post('/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Missing name and price',
        })
        .expect(400);
    });

    it('should fail with negative unit price', async () => {
      await request(app.getHttpServer())
        .post('/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Invalid Item',
          unitPrice: -50.0,
        })
        .expect(400);
    });
  });

  describe('GET /items', () => {
    it('should return all items for the authenticated user', async () => {
      const response = await request(app.getHttpServer())
        .get('/items')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
      expect(response.body[0]).toHaveProperty('name');
      expect(response.body[0]).toHaveProperty('type');
    });

    it('should filter items by type (PRODUCT)', async () => {
      const response = await request(app.getHttpServer())
        .get('/items?type=PRODUCT')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((item: any) => {
        expect(item.type).toBe('PRODUCT');
      });
    });

    it('should filter items by type (SERVICE)', async () => {
      const response = await request(app.getHttpServer())
        .get('/items?type=SERVICE')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((item: any) => {
        expect(item.type).toBe('SERVICE');
      });
    });

    it('should search items by name', async () => {
      const response = await request(app.getHttpServer())
        .get('/items?search=Product')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(
        response.body.some((item: any) => item.name.includes('Product')),
      ).toBe(true);
    });

    it('should filter items by active status', async () => {
      const response = await request(app.getHttpServer())
        .get('/items?isActive=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((item: any) => {
        expect(item.isActive).toBe(true);
      });
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .get('/items')
        .expect(401);
    });

    it('should not return items from other users', async () => {
      // Create item for other user
      await request(app.getHttpServer())
        .post('/items')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({
          name: 'Other User Item',
          unitPrice: 50.0,
        })
        .expect(201);

      // Get items for first user
      const response = await request(app.getHttpServer())
        .get('/items')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should not contain other user's item
      const hasOtherUserItem = response.body.some(
        (item: any) => item.name === 'Other User Item',
      );
      expect(hasOtherUserItem).toBe(false);
    });
  });

  describe('GET /items/stats', () => {
    it('should return statistics for items', async () => {
      const response = await request(app.getHttpServer())
        .get('/items/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('products');
      expect(response.body).toHaveProperty('services');
      expect(response.body).toHaveProperty('active');
      expect(response.body).toHaveProperty('inactive');
      expect(typeof response.body.total).toBe('number');
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .get('/items/stats')
        .expect(401);
    });
  });

  describe('GET /items/:id', () => {
    it('should return a single item by id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/items/${itemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', itemId);
      expect(response.body).toHaveProperty('name', 'Test Item Product');
      expect(response.body).toHaveProperty('_count');
    });

    it('should return 404 for non-existent item', async () => {
      await request(app.getHttpServer())
        .get('/items/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .get(`/items/${itemId}`)
        .expect(401);
    });

    it('should not allow accessing other users items', async () => {
      // Try to access first user's item with second user's token
      await request(app.getHttpServer())
        .get(`/items/${itemId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(404);
    });
  });

  describe('PATCH /items/:id', () => {
    it('should update an item', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/items/${itemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Test Item',
          unitPrice: 180.0,
          isActive: false,
        })
        .expect(200);

      expect(response.body.name).toBe('Updated Test Item');
      expect(response.body.unitPrice).toBe('180.00');
      expect(response.body.isActive).toBe(false);
    });

    it('should return 404 when updating non-existent item', async () => {
      await request(app.getHttpServer())
        .patch('/items/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Should Fail',
        })
        .expect(404);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .patch(`/items/${itemId}`)
        .send({
          name: 'Should Fail',
        })
        .expect(401);
    });

    it('should not allow updating other users items', async () => {
      await request(app.getHttpServer())
        .patch(`/items/${itemId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({
          name: 'Should Fail',
        })
        .expect(404);
    });
  });

  describe('DELETE /items/:id', () => {
    it('should delete an item', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/items/${itemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', itemId);
    });

    it('should return 404 when item no longer exists', async () => {
      await request(app.getHttpServer())
        .get(`/items/${itemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 404 when deleting non-existent item', async () => {
      await request(app.getHttpServer())
        .delete('/items/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .delete('/items/some-id')
        .expect(401);
    });
  });
});
