import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('ClientsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let userId: string;
  let clientId: string;

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
    await prisma.client.deleteMany({
      where: { email: { contains: '@clients-test.e2e' } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: '@clients-test.e2e' } },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.client.deleteMany({
      where: { email: { contains: '@clients-test.e2e' } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: '@clients-test.e2e' } },
    });

    await prisma.$disconnect();
    await app.close();
  });

  describe('Authentication Setup', () => {
    it('should register a test user', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'clientstest@clients-test.e2e',
          password: 'password123',
          name: 'Clients Test User',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe('clientstest@clients-test.e2e');
      userId = response.body.id;
    });

    it('should login and get JWT token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'clientstest@clients-test.e2e',
          password: 'password123',
        })
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      authToken = response.body.access_token;
    });
  });

  describe('POST /clients', () => {
    it('should create a new client', async () => {
      const response = await request(app.getHttpServer())
        .post('/clients')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Client 1',
          email: 'client1@clients-test.e2e',
          phone: '(11) 99999-9999',
          taxId: '123.456.789-00',
          address: 'Rua Teste, 123',
          city: 'São Paulo',
          state: 'SP',
          zipCode: '01234-567',
          notes: 'Test client notes',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Test Client 1');
      expect(response.body.email).toBe('client1@clients-test.e2e');
      expect(response.body.userId).toBe(userId);
      clientId = response.body.id;
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .post('/clients')
        .send({
          name: 'Test Client',
          phone: '(11) 99999-9999',
          taxId: '123.456.789-00',
        })
        .expect(401);
    });

    it('should fail with invalid data (missing required fields)', async () => {
      await request(app.getHttpServer())
        .post('/clients')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'incomplete@clients-test.e2e',
        })
        .expect(400);
    });

    it('should fail with invalid phone format', async () => {
      await request(app.getHttpServer())
        .post('/clients')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Client Invalid',
          phone: 'invalid-phone',
          taxId: '123.456.789-00',
        })
        .expect(400);
    });

    it('should fail with invalid taxId format', async () => {
      await request(app.getHttpServer())
        .post('/clients')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Client Invalid',
          phone: '(11) 99999-9999',
          taxId: 'invalid-tax-id',
        })
        .expect(400);
    });
  });

  describe('GET /clients', () => {
    it('should return all clients for the authenticated user', async () => {
      const response = await request(app.getHttpServer())
        .get('/clients')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('name');
      expect(response.body[0]).toHaveProperty('_count');
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .get('/clients')
        .expect(401);
    });
  });

  describe('GET /clients/search', () => {
    it('should search clients by name', async () => {
      const response = await request(app.getHttpServer())
        .get('/clients/search?q=Test Client 1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].name).toContain('Test Client 1');
    });

    it('should search clients by email', async () => {
      const response = await request(app.getHttpServer())
        .get('/clients/search?q=client1@clients-test.e2e')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].email).toBe('client1@clients-test.e2e');
    });

    it('should search clients by phone', async () => {
      const response = await request(app.getHttpServer())
        .get('/clients/search?q=99999-9999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should return empty array for non-matching query', async () => {
      const response = await request(app.getHttpServer())
        .get('/clients/search?q=NonExistentClient12345')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .get('/clients/search?q=test')
        .expect(401);
    });
  });

  describe('GET /clients/:id', () => {
    it('should return a single client by id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/clients/${clientId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', clientId);
      expect(response.body).toHaveProperty('name', 'Test Client 1');
      expect(response.body).toHaveProperty('equipment');
      expect(response.body).toHaveProperty('quotes');
      expect(response.body).toHaveProperty('workOrders');
      expect(response.body).toHaveProperty('invoices');
    });

    it('should return 404 for non-existent client', async () => {
      await request(app.getHttpServer())
        .get('/clients/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .get(`/clients/${clientId}`)
        .expect(401);
    });
  });

  describe('PATCH /clients/:id', () => {
    it('should update a client', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/clients/${clientId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Client Name',
          phone: '(11) 88888-8888',
        })
        .expect(200);

      expect(response.body.name).toBe('Updated Client Name');
      expect(response.body.phone).toBe('(11) 88888-8888');
      expect(response.body.email).toBe('client1@clients-test.e2e'); // Unchanged
    });

    it('should return 404 when updating non-existent client', async () => {
      await request(app.getHttpServer())
        .patch('/clients/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Should Fail',
        })
        .expect(404);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .patch(`/clients/${clientId}`)
        .send({
          name: 'Should Fail',
        })
        .expect(401);
    });
  });

  describe('GET /clients/count', () => {
    it('should return count of clients', async () => {
      const response = await request(app.getHttpServer())
        .get('/clients/count')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('count');
      expect(typeof response.body.count).toBe('number');
      expect(response.body.count).toBeGreaterThan(0);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .get('/clients/count')
        .expect(401);
    });
  });

  describe('DELETE /clients/:id', () => {
    it('should delete a client', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/clients/${clientId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', clientId);
    });

    it('should return 404 when client no longer exists', async () => {
      await request(app.getHttpServer())
        .get(`/clients/${clientId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 404 when deleting non-existent client', async () => {
      await request(app.getHttpServer())
        .delete('/clients/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .delete('/clients/some-id')
        .expect(401);
    });
  });

  describe('Plan Limits', () => {
    let limitTestToken: string;
    let limitTestUserId: string;

    it('should setup a FREE plan user', async () => {
      // Register user
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'limituser@clients-test.e2e',
          password: 'password123',
          name: 'Limit Test User',
        })
        .expect(201);

      limitTestUserId = registerResponse.body.id;

      // Login
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'limituser@clients-test.e2e',
          password: 'password123',
        })
        .expect(200);

      limitTestToken = loginResponse.body.access_token;
    });

    it('should allow creating clients up to the FREE plan limit (5)', async () => {
      for (let i = 1; i <= 5; i++) {
        await request(app.getHttpServer())
          .post('/clients')
          .set('Authorization', `Bearer ${limitTestToken}`)
          .send({
            name: `Limit Client ${i}`,
            email: `limitclient${i}@clients-test.e2e`,
            phone: `(11) 9999${i}-999${i}`,
            taxId: `123.456.789-0${i}`,
          })
          .expect(201);
      }
    });

    it('should return current usage showing limit reached', async () => {
      const response = await request(app.getHttpServer())
        .get('/plans/usage')
        .set('Authorization', `Bearer ${limitTestToken}`)
        .expect(200);

      expect(response.body.clients.current).toBe(5);
      expect(response.body.clients.limit).toBe(5);
    });

    it('should fail when trying to create 6th client (exceeds FREE plan limit)', async () => {
      const response = await request(app.getHttpServer())
        .post('/clients')
        .set('Authorization', `Bearer ${limitTestToken}`)
        .send({
          name: 'Limit Client 6',
          email: 'limitclient6@clients-test.e2e',
          phone: '(11) 99996-9996',
          taxId: '123.456.789-06',
        })
        .expect(403);

      expect(response.body.message).toContain('Client limit reached');
    });

    it('should allow creating client after deleting one', async () => {
      // Get first client
      const clientsResponse = await request(app.getHttpServer())
        .get('/clients')
        .set('Authorization', `Bearer ${limitTestToken}`)
        .expect(200);

      const firstClientId = clientsResponse.body[0].id;

      // Delete first client
      await request(app.getHttpServer())
        .delete(`/clients/${firstClientId}`)
        .set('Authorization', `Bearer ${limitTestToken}`)
        .expect(200);

      // Now should be able to create a new one
      await request(app.getHttpServer())
        .post('/clients')
        .set('Authorization', `Bearer ${limitTestToken}`)
        .send({
          name: 'Limit Client After Delete',
          email: 'limitclientnew@clients-test.e2e',
          phone: '(11) 99997-9997',
          taxId: '123.456.789-07',
        })
        .expect(201);
    });
  });
});
