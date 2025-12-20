import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Work Orders (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let userId: string;
  let clientId: string;
  let equipmentId: string;
  let quoteId: string;
  let workOrderId: string;

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
    await prisma.workOrderEquipment.deleteMany();
    await prisma.workOrder.deleteMany();
    await prisma.quoteItem.deleteMany();
    await prisma.quote.deleteMany();
    await prisma.equipment.deleteMany();
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
        email: 'workorder-test@test.com',
        password: 'Test123!@#',
        name: 'Work Order Test User',
      });

    authToken = signupResponse.body.access_token;
    userId = signupResponse.body.user.id;

    // Create test client
    const clientResponse = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Client for Work Orders',
        email: 'client@test.com',
        phone: '11999999999',
      });

    clientId = clientResponse.body.id;

    // Create test equipment
    const equipmentResponse = await request(app.getHttpServer())
      .post('/equipments')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        clientId,
        name: 'Ar-condicionado Split',
        type: 'Ar-condicionado',
        brand: 'LG',
        model: 'DUAL123',
      });

    equipmentId = equipmentResponse.body.id;

    // Create approved quote for testing
    const itemResponse = await request(app.getHttpServer())
      .post('/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Manutenção preventiva',
        type: 'SERVICE',
        unitPrice: 150,
      });

    const quoteResponse = await request(app.getHttpServer())
      .post('/quotes')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        clientId,
        items: [{ itemId: itemResponse.body.id, quantity: 1 }],
      });

    quoteId = quoteResponse.body.id;

    // Approve quote
    await request(app.getHttpServer())
      .patch(`/quotes/${quoteId}/status`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'SENT' });

    await request(app.getHttpServer())
      .patch(`/quotes/${quoteId}/status`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'APPROVED' });
  });

  afterAll(async () => {
    await prisma.workOrderEquipment.deleteMany();
    await prisma.workOrder.deleteMany();
    await prisma.quoteItem.deleteMany();
    await prisma.quote.deleteMany();
    await prisma.equipment.deleteMany();
    await prisma.item.deleteMany();
    await prisma.client.deleteMany();
    await prisma.user.deleteMany();
    await prisma.plan.deleteMany();
    await app.close();
  });

  describe('/work-orders (POST)', () => {
    it('should create a new work order', async () => {
      const createDto = {
        clientId,
        title: 'Manutenção ar-condicionado sala 3',
        description: 'Limpeza e troca de filtros',
        scheduledDate: '2025-12-15',
        notes: 'Cliente solicitou visita pela manhã',
        equipmentIds: [equipmentId],
      };

      const response = await request(app.getHttpServer())
        .post('/work-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        userId,
        clientId,
        title: createDto.title,
        description: createDto.description,
        status: 'SCHEDULED',
      });

      expect(response.body.equipments).toHaveLength(1);
      workOrderId = response.body.id;
    });

    it('should create work order from approved quote', async () => {
      const response = await request(app.getHttpServer())
        .post('/work-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          clientId,
          quoteId,
          title: 'Serviço conforme orçamento aprovado',
        })
        .expect(201);

      expect(response.body.quoteId).toBe(quoteId);
    });

    it('should reject work order with invalid client', async () => {
      await request(app.getHttpServer())
        .post('/work-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          clientId: 'invalid-client-id',
          title: 'Test',
        })
        .expect(403);
    });

    it('should reject work order without authentication', async () => {
      await request(app.getHttpServer())
        .post('/work-orders')
        .send({
          clientId,
          title: 'Test',
        })
        .expect(401);
    });
  });

  describe('/work-orders (GET)', () => {
    it('should return all work orders for authenticated user', async () => {
      const response = await request(app.getHttpServer())
        .get('/work-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should filter work orders by clientId', async () => {
      const response = await request(app.getHttpServer())
        .get(`/work-orders?clientId=${clientId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((wo) => {
        expect(wo.clientId).toBe(clientId);
      });
    });

    it('should filter work orders by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/work-orders?status=SCHEDULED')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((wo) => {
        expect(wo.status).toBe('SCHEDULED');
      });
    });
  });

  describe('/work-orders/:id (GET)', () => {
    it('should return work order with details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/work-orders/${workOrderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: workOrderId,
        userId,
        clientId,
        client: expect.any(Object),
        equipments: expect.any(Array),
      });
    });

    it('should return 404 for non-existent work order', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .get(`/work-orders/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('/work-orders/:id (PUT)', () => {
    it('should update work order details', async () => {
      const response = await request(app.getHttpServer())
        .put(`/work-orders/${workOrderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Manutenção URGENTE',
          notes: 'Atualizado para urgente',
        })
        .expect(200);

      expect(response.body.title).toBe('Manutenção URGENTE');
      expect(response.body.notes).toBe('Atualizado para urgente');
    });
  });

  describe('/work-orders/:id/status (PATCH)', () => {
    it('should update status from SCHEDULED to IN_PROGRESS', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/work-orders/${workOrderId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'IN_PROGRESS' })
        .expect(200);

      expect(response.body.status).toBe('IN_PROGRESS');
    });

    it('should update status from IN_PROGRESS to DONE', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/work-orders/${workOrderId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'DONE' })
        .expect(200);

      expect(response.body.status).toBe('DONE');
    });

    it('should reject invalid status transition', async () => {
      // Try to go from DONE to SCHEDULED (invalid)
      await request(app.getHttpServer())
        .patch(`/work-orders/${workOrderId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'SCHEDULED' })
        .expect(400);
    });
  });

  describe('Work order ownership validation', () => {
    let secondUserToken: string;

    beforeAll(async () => {
      const signupResponse = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'workorder-test2@test.com',
          password: 'Test123!@#',
          name: 'Second User',
        });

      secondUserToken = signupResponse.body.access_token;
    });

    it('should not allow first user to access second user work order', async () => {
      // Create work order as second user
      const clientResponse = await request(app.getHttpServer())
        .post('/clients')
        .set('Authorization', `Bearer ${secondUserToken}`)
        .send({
          name: 'Second User Client',
          email: 'secondclient@test.com',
        });

      const woResponse = await request(app.getHttpServer())
        .post('/work-orders')
        .set('Authorization', `Bearer ${secondUserToken}`)
        .send({
          clientId: clientResponse.body.id,
          title: 'Test',
        });

      const secondWoId = woResponse.body.id;

      // Try to access as first user
      await request(app.getHttpServer())
        .get(`/work-orders/${secondWoId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
