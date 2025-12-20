import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Equipments (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let userId: string;
  let clientId: string;
  let equipmentId: string;

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
    await prisma.equipment.deleteMany();
    await prisma.client.deleteMany();
    await prisma.user.deleteMany();
    await prisma.plan.deleteMany();

    // Create a test plan
    const plan = await prisma.plan.create({
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

    // Create and authenticate a test user
    const signupResponse = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email: 'equipment-test@test.com',
        password: 'Test123!@#',
        name: 'Equipment Test User',
      });

    authToken = signupResponse.body.access_token;
    userId = signupResponse.body.user.id;

    // Create a test client
    const clientResponse = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Client for Equipment',
        email: 'client@test.com',
        phone: '11999999999',
        address: 'Rua Teste, 123',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01234-567',
      });

    clientId = clientResponse.body.id;
  });

  afterAll(async () => {
    await prisma.equipment.deleteMany();
    await prisma.client.deleteMany();
    await prisma.user.deleteMany();
    await prisma.plan.deleteMany();
    await app.close();
  });

  describe('/equipmentss (POST)', () => {
    it('should create a new equipment', async () => {
      const createEquipmentDto = {
        clientId,
        type: 'Ar-condicionado Split 12000 BTUs',
        brand: 'LG',
        model: 'S4-W12JA3AA',
        serialNumber: 'SN123456789',
        installationDate: '2024-01-15',
        warrantyEndDate: '2026-01-15',
        notes: 'Instalado na sala principal',
      };

      const response = await request(app.getHttpServer())
        .post('/equipments')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createEquipmentDto)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        userId,
        clientId,
        type: createEquipmentDto.type,
        brand: createEquipmentDto.brand,
        model: createEquipmentDto.model,
        serialNumber: createEquipmentDto.serialNumber,
        notes: createEquipmentDto.notes,
        client: {
          id: clientId,
          name: 'Test Client for Equipment',
        },
      });

      expect(response.body.createdAt).toBeDefined();
      expect(response.body.updatedAt).toBeDefined();

      equipmentId = response.body.id;
    });

    it('should reject equipment creation with invalid clientId', async () => {
      const createEquipmentDto = {
        clientId: 'invalid-client-id',
        type: 'Ar-condicionado',
        brand: 'LG',
      };

      await request(app.getHttpServer())
        .post('/equipments')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createEquipmentDto)
        .expect(403);
    });

    it('should reject equipment creation without required fields', async () => {
      const createEquipmentDto = {
        clientId,
        // missing type and brand
      };

      await request(app.getHttpServer())
        .post('/equipments')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createEquipmentDto)
        .expect(400);
    });

    it('should reject equipment creation without authentication', async () => {
      const createEquipmentDto = {
        clientId,
        type: 'Ar-condicionado',
        brand: 'LG',
      };

      await request(app.getHttpServer())
        .post('/equipments')
        .send(createEquipmentDto)
        .expect(401);
    });
  });

  describe('/equipments (GET)', () => {
    it('should return all equipment for authenticated user', async () => {
      const response = await request(app.getHttpServer())
        .get('/equipments')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toMatchObject({
        id: expect.any(String),
        userId,
        clientId,
        type: expect.any(String),
        client: {
          id: expect.any(String),
          name: expect.any(String),
        },
      });
    });

    it('should filter equipment by clientId', async () => {
      const response = await request(app.getHttpServer())
        .get(`/equipments?clientId=${clientId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((equipment) => {
        expect(equipment.clientId).toBe(clientId);
      });
    });

    it('should filter equipment by type', async () => {
      const response = await request(app.getHttpServer())
        .get('/equipments?type=Ar-condicionado')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((equipment) => {
        expect(equipment.type.toLowerCase()).toContain('ar-condicionado');
      });
    });

    it('should filter equipment by both clientId and type', async () => {
      const response = await request(app.getHttpServer())
        .get(`/equipments?clientId=${clientId}&type=Ar-condicionado`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((equipment) => {
        expect(equipment.clientId).toBe(clientId);
        expect(equipment.type.toLowerCase()).toContain('ar-condicionado');
      });
    });

    it('should reject filtering by invalid clientId', async () => {
      await request(app.getHttpServer())
        .get('/equipments?clientId=invalid-client-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });

    it('should reject request without authentication', async () => {
      await request(app.getHttpServer()).get('/equipments').expect(401);
    });
  });

  describe('/equipments/by-client/:clientId (GET)', () => {
    it('should return all equipment for a specific client', async () => {
      const response = await request(app.getHttpServer())
        .get(`/equipments/by-client/${clientId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((equipment) => {
        expect(equipment.clientId).toBe(clientId);
        expect(equipment.userId).toBe(userId);
      });
    });

    it('should reject request for client that does not belong to user', async () => {
      await request(app.getHttpServer())
        .get('/equipments/by-client/invalid-client-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });

    it('should reject request without authentication', async () => {
      await request(app.getHttpServer())
        .get(`/equipments/by-client/${clientId}`)
        .expect(401);
    });
  });

  describe('/equipments/:id (GET)', () => {
    it('should return a single equipment by id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/equipments/${equipmentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: equipmentId,
        userId,
        clientId,
        type: 'Ar-condicionado Split 12000 BTUs',
        brand: 'LG',
        model: 'S4-W12JA3AA',
        serialNumber: 'SN123456789',
        client: {
          id: clientId,
          name: expect.any(String),
          email: expect.any(String),
          phone: expect.any(String),
        },
      });

      expect(response.body.workOrders).toBeDefined();
      expect(Array.isArray(response.body.workOrders)).toBe(true);
    });

    it('should return 404 for non-existent equipment', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .get(`/equipments/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should reject request without authentication', async () => {
      await request(app.getHttpServer())
        .get(`/equipments/${equipmentId}`)
        .expect(401);
    });
  });

  describe('/equipments/:id (PATCH)', () => {
    it('should update equipment', async () => {
      const updateEquipmentDto = {
        brand: 'Samsung',
        model: 'Updated Model XYZ',
        notes: 'Updated notes for equipment',
      };

      const response = await request(app.getHttpServer())
        .patch(`/equipments/${equipmentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateEquipmentDto)
        .expect(200);

      expect(response.body).toMatchObject({
        id: equipmentId,
        userId,
        clientId,
        brand: updateEquipmentDto.brand,
        model: updateEquipmentDto.model,
        notes: updateEquipmentDto.notes,
      });

      expect(response.body.updatedAt).toBeDefined();
    });

    it('should update equipment clientId if valid', async () => {
      // Create another client
      const newClientResponse = await request(app.getHttpServer())
        .post('/clients')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Second Test Client',
          email: 'client2@test.com',
          phone: '11988888888',
        });

      const newClientId = newClientResponse.body.id;

      const updateEquipmentDto = {
        clientId: newClientId,
      };

      const response = await request(app.getHttpServer())
        .patch(`/equipments/${equipmentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateEquipmentDto)
        .expect(200);

      expect(response.body.clientId).toBe(newClientId);
      expect(response.body.client.id).toBe(newClientId);

      // Restore original clientId
      await request(app.getHttpServer())
        .patch(`/equipments/${equipmentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ clientId })
        .expect(200);
    });

    it('should reject update with invalid clientId', async () => {
      const updateEquipmentDto = {
        clientId: 'invalid-client-id',
      };

      await request(app.getHttpServer())
        .patch(`/equipments/${equipmentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateEquipmentDto)
        .expect(403);
    });

    it('should return 404 for non-existent equipment', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const updateEquipmentDto = {
        brand: 'Samsung',
      };

      await request(app.getHttpServer())
        .patch(`/equipments/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateEquipmentDto)
        .expect(404);
    });

    it('should reject request without authentication', async () => {
      const updateEquipmentDto = {
        brand: 'Samsung',
      };

      await request(app.getHttpServer())
        .patch(`/equipments/${equipmentId}`)
        .send(updateEquipmentDto)
        .expect(401);
    });
  });

  describe('/equipments/:id (DELETE)', () => {
    it('should delete equipment', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/equipments/${equipmentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: equipmentId,
      });

      // Verify equipment was deleted
      await request(app.getHttpServer())
        .get(`/equipments/${equipmentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 404 when trying to delete non-existent equipment', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .delete(`/equipments/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should reject request without authentication', async () => {
      await request(app.getHttpServer())
        .delete(`/equipments/${equipmentId}`)
        .expect(401);
    });
  });

  describe('Equipment ownership validation', () => {
    let secondUserToken: string;
    let secondUserId: string;
    let secondClientId: string;
    let secondEquipmentId: string;

    beforeAll(async () => {
      // Create second user
      const signupResponse = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'equipment-test2@test.com',
          password: 'Test123!@#',
          name: 'Second Equipment Test User',
        });

      secondUserToken = signupResponse.body.access_token;
      secondUserId = signupResponse.body.user.id;

      // Create client for second user
      const clientResponse = await request(app.getHttpServer())
        .post('/clients')
        .set('Authorization', `Bearer ${secondUserToken}`)
        .send({
          name: 'Second User Client',
          email: 'secondclient@test.com',
          phone: '11977777777',
        });

      secondClientId = clientResponse.body.id;

      // Create equipment for second user
      const equipmentResponse = await request(app.getHttpServer())
        .post('/equipments')
        .set('Authorization', `Bearer ${secondUserToken}`)
        .send({
          clientId: secondClientId,
          type: 'Geladeira',
          brand: 'Brastemp',
          model: 'Frost Free',
        });

      secondEquipmentId = equipmentResponse.body.id;
    });

    it('should not allow first user to access second user equipment', async () => {
      await request(app.getHttpServer())
        .get(`/equipments/${secondEquipmentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should not allow first user to update second user equipment', async () => {
      await request(app.getHttpServer())
        .patch(`/equipments/${secondEquipmentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ brand: 'Hacked' })
        .expect(404);
    });

    it('should not allow first user to delete second user equipment', async () => {
      await request(app.getHttpServer())
        .delete(`/equipments/${secondEquipmentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should not allow creating equipment with another user client', async () => {
      await request(app.getHttpServer())
        .post('/equipments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          clientId: secondClientId,
          type: 'Ar-condicionado',
          brand: 'LG',
        })
        .expect(403);
    });
  });
});
