import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PaymentStatus, PaymentBillingType, AsaasEnvironment } from '@prisma/client';

describe('FinancialDashboard (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let userId: string;
  let clientId: string;
  let workOrderId: string;
  let otherUserToken: string;
  let otherUserId: string;
  let otherClientId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    // Clean up test data
    await prisma.clientPayment.deleteMany({});
    await prisma.workOrder.deleteMany({});
    await prisma.quote.deleteMany({});
    await prisma.client.deleteMany({});
    await prisma.asaasIntegration.deleteMany({});
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['financial-test@example.com', 'other-financial-test@example.com'],
        },
      },
    });

    // Create test user
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'financial-test@example.com',
        password: 'Test123!@#',
        name: 'Financial Test User',
      });

    authToken = registerResponse.body.access_token;
    userId = registerResponse.body.user.id;

    // Create another user for isolation tests
    const otherRegisterResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'other-financial-test@example.com',
        password: 'Test123!@#',
        name: 'Other Financial Test User',
      });

    otherUserToken = otherRegisterResponse.body.access_token;
    otherUserId = otherRegisterResponse.body.user.id;

    // Create test client
    const clientResponse = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Financial Client',
        email: 'client@test.com',
        phone: '11999999999',
      });

    clientId = clientResponse.body.id;

    // Create other user's client
    const otherClientResponse = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${otherUserToken}`)
      .send({
        name: 'Other User Client',
        email: 'other-client@test.com',
      });

    otherClientId = otherClientResponse.body.id;

    // Create work order
    const workOrderResponse = await request(app.getHttpServer())
      .post('/work-orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        clientId,
        title: 'Test Work Order',
        description: 'Test description',
        status: 'SCHEDULED',
      });

    workOrderId = workOrderResponse.body.id;

    // Create test payments directly in database
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Payment 1: Received this month (PIX)
    await prisma.clientPayment.create({
      data: {
        userId,
        clientId,
        asaasPaymentId: 'test_pay_received_1',
        billingType: PaymentBillingType.PIX,
        value: 500,
        description: 'Received payment 1',
        dueDate: new Date(currentYear, currentMonth, 10),
        status: PaymentStatus.RECEIVED,
        paidAt: new Date(currentYear, currentMonth, 10),
      },
    });

    // Payment 2: Received this month (BOLETO)
    await prisma.clientPayment.create({
      data: {
        userId,
        clientId,
        asaasPaymentId: 'test_pay_received_2',
        billingType: PaymentBillingType.BOLETO,
        value: 300,
        description: 'Received payment 2',
        dueDate: new Date(currentYear, currentMonth, 12),
        status: PaymentStatus.CONFIRMED,
        paidAt: new Date(currentYear, currentMonth, 12),
      },
    });

    // Payment 3: Pending (future due date)
    await prisma.clientPayment.create({
      data: {
        userId,
        clientId,
        workOrderId,
        asaasPaymentId: 'test_pay_pending_1',
        billingType: PaymentBillingType.CREDIT_CARD,
        value: 250,
        description: 'Pending payment',
        dueDate: new Date(currentYear, currentMonth + 1, 15),
        status: PaymentStatus.PENDING,
      },
    });

    // Payment 4: Overdue
    await prisma.clientPayment.create({
      data: {
        userId,
        clientId,
        asaasPaymentId: 'test_pay_overdue_1',
        billingType: PaymentBillingType.BOLETO,
        value: 150,
        description: 'Overdue payment',
        dueDate: new Date(currentYear, currentMonth - 1, 1),
        status: PaymentStatus.OVERDUE,
      },
    });

    // Payment 5: Deleted (canceled)
    await prisma.clientPayment.create({
      data: {
        userId,
        clientId,
        asaasPaymentId: 'test_pay_deleted_1',
        billingType: PaymentBillingType.PIX,
        value: 100,
        description: 'Deleted payment',
        dueDate: new Date(currentYear, currentMonth, 5),
        status: PaymentStatus.DELETED,
      },
    });

    // Payment 6: Refunded
    await prisma.clientPayment.create({
      data: {
        userId,
        clientId,
        asaasPaymentId: 'test_pay_refunded_1',
        billingType: PaymentBillingType.CREDIT_CARD,
        value: 75,
        description: 'Refunded payment',
        dueDate: new Date(currentYear, currentMonth, 8),
        status: PaymentStatus.REFUNDED,
      },
    });

    // Create payment for other user (should not appear in our queries)
    await prisma.clientPayment.create({
      data: {
        userId: otherUserId,
        clientId: otherClientId,
        asaasPaymentId: 'other_user_pay_1',
        billingType: PaymentBillingType.PIX,
        value: 10000,
        description: 'Other user payment',
        dueDate: new Date(currentYear, currentMonth, 15),
        status: PaymentStatus.RECEIVED,
        paidAt: new Date(currentYear, currentMonth, 15),
      },
    });
  });

  afterAll(async () => {
    // Clean up
    await prisma.clientPayment.deleteMany({});
    await prisma.workOrder.deleteMany({});
    await prisma.client.deleteMany({});
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['financial-test@example.com', 'other-financial-test@example.com'],
        },
      },
    });
    await app.close();
  });

  describe('GET /financial/dashboard/overview', () => {
    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .get('/financial/dashboard/overview')
        .expect(401);
    });

    it('should return overview for current month', async () => {
      const response = await request(app.getHttpServer())
        .get('/financial/dashboard/overview')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('period');
      expect(response.body).toHaveProperty('received');
      expect(response.body).toHaveProperty('pending');
      expect(response.body).toHaveProperty('overdue');
      expect(response.body).toHaveProperty('canceled');
      expect(response.body).toHaveProperty('refused');
      expect(response.body).toHaveProperty('totalExpected');
      expect(response.body).toHaveProperty('netRevenue');
      expect(response.body).toHaveProperty('invoicedCount');
      expect(response.body).toHaveProperty('paidCount');
      expect(response.body).toHaveProperty('averageTicket');
      expect(response.body).toHaveProperty('paymentDistribution');

      // Verify received amount (500 + 300 = 800)
      expect(response.body.received).toBe(800);

      // Verify paid count
      expect(response.body.paidCount).toBe(2);

      // Verify payment distribution
      expect(response.body.paymentDistribution.PIX).toBe(500);
      expect(response.body.paymentDistribution.BOLETO).toBe(300);
    });

    it('should not include other user data', async () => {
      const response = await request(app.getHttpServer())
        .get('/financial/dashboard/overview')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Other user has 10000 - should not be included
      expect(response.body.received).toBeLessThan(10000);
    });

    it('should handle last_month period', async () => {
      const response = await request(app.getHttpServer())
        .get('/financial/dashboard/overview?period=last_month')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.period).toBe('last_month');
    });

    it('should handle custom period', async () => {
      const response = await request(app.getHttpServer())
        .get('/financial/dashboard/overview?period=custom&startDate=2025-01-01&endDate=2025-12-31')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.period).toBe('custom');
    });
  });

  describe('GET /financial/dashboard/revenue-by-day', () => {
    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .get('/financial/dashboard/revenue-by-day')
        .expect(401);
    });

    it('should return daily revenue', async () => {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      const response = await request(app.getHttpServer())
        .get(`/financial/dashboard/revenue-by-day?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('date');
      expect(response.body[0]).toHaveProperty('value');

      // Check total revenue matches
      const totalRevenue = response.body.reduce((sum: number, day: any) => sum + day.value, 0);
      expect(totalRevenue).toBe(800); // 500 + 300
    });
  });

  describe('GET /financial/dashboard/revenue-by-client', () => {
    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .get('/financial/dashboard/revenue-by-client')
        .expect(401);
    });

    it('should return revenue grouped by client', async () => {
      const response = await request(app.getHttpServer())
        .get('/financial/dashboard/revenue-by-client')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('clientId');
      expect(response.body[0]).toHaveProperty('name');
      expect(response.body[0]).toHaveProperty('totalPaid');
      expect(response.body[0]).toHaveProperty('count');
    });

    it('should not include other user clients', async () => {
      const response = await request(app.getHttpServer())
        .get('/financial/dashboard/revenue-by-client')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const otherClient = response.body.find((c: any) => c.clientId === otherClientId);
      expect(otherClient).toBeUndefined();
    });
  });

  describe('GET /financial/dashboard/payments', () => {
    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .get('/financial/dashboard/payments')
        .expect(401);
    });

    it('should return all payments for user', async () => {
      const response = await request(app.getHttpServer())
        .get('/financial/dashboard/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(6); // 6 payments created for this user
    });

    it('should filter by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/financial/dashboard/payments?status=RECEIVED')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.length).toBe(1);
      expect(response.body[0].status).toBe('RECEIVED');
    });

    it('should filter by billingType', async () => {
      const response = await request(app.getHttpServer())
        .get('/financial/dashboard/payments?billingType=PIX')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.every((p: any) => p.billingType === 'PIX')).toBe(true);
    });

    it('should filter by clientId', async () => {
      const response = await request(app.getHttpServer())
        .get(`/financial/dashboard/payments?clientId=${clientId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.every((p: any) => p.clientId === clientId)).toBe(true);
    });

    it('should filter by workOrderId', async () => {
      const response = await request(app.getHttpServer())
        .get(`/financial/dashboard/payments?workOrderId=${workOrderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.length).toBe(1);
      expect(response.body[0].workOrderId).toBe(workOrderId);
    });

    it('should not return other user payments', async () => {
      const response = await request(app.getHttpServer())
        .get('/financial/dashboard/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const otherUserPayment = response.body.find((p: any) =>
        p.asaasPaymentId === 'other_user_pay_1'
      );
      expect(otherUserPayment).toBeUndefined();
    });
  });

  describe('GET /financial/dashboard/client/:clientId', () => {
    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .get(`/financial/dashboard/client/${clientId}`)
        .expect(401);
    });

    it('should return client financial extract', async () => {
      const response = await request(app.getHttpServer())
        .get(`/financial/dashboard/client/${clientId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('clientId', clientId);
      expect(response.body).toHaveProperty('clientName');
      expect(response.body).toHaveProperty('totalPaid');
      expect(response.body).toHaveProperty('totalPending');
      expect(response.body).toHaveProperty('totalOverdue');
      expect(response.body).toHaveProperty('history');
      expect(Array.isArray(response.body.history)).toBe(true);

      // Verify totals
      expect(response.body.totalPaid).toBe(800); // 500 + 300
    });

    it('should return 404 for non-existent client', async () => {
      await request(app.getHttpServer())
        .get('/financial/dashboard/client/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 404 for other user client', async () => {
      await request(app.getHttpServer())
        .get(`/financial/dashboard/client/${otherClientId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('GET /financial/dashboard/work-order/:workOrderId', () => {
    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .get(`/financial/dashboard/work-order/${workOrderId}`)
        .expect(401);
    });

    it('should return work order financial extract', async () => {
      const response = await request(app.getHttpServer())
        .get(`/financial/dashboard/work-order/${workOrderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('workOrderId', workOrderId);
      expect(response.body).toHaveProperty('workOrderTitle');
      expect(response.body).toHaveProperty('totalPaid');
      expect(response.body).toHaveProperty('totalPending');
      expect(response.body).toHaveProperty('totalOverdue');
      expect(response.body).toHaveProperty('payments');
      expect(Array.isArray(response.body.payments)).toBe(true);

      // Verify pending amount for this work order
      expect(response.body.totalPending).toBe(250);
    });

    it('should return 404 for non-existent work order', async () => {
      await request(app.getHttpServer())
        .get('/financial/dashboard/work-order/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('Data Isolation', () => {
    it('should completely isolate data between users', async () => {
      // Get overview for first user
      const userResponse = await request(app.getHttpServer())
        .get('/financial/dashboard/overview')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Get overview for other user
      const otherUserResponse = await request(app.getHttpServer())
        .get('/financial/dashboard/overview')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(200);

      // First user should have 800 received
      expect(userResponse.body.received).toBe(800);

      // Other user should have 10000 received
      expect(otherUserResponse.body.received).toBe(10000);

      // They should not see each other's data
      expect(userResponse.body.received).not.toBe(otherUserResponse.body.received);
    });
  });
});
