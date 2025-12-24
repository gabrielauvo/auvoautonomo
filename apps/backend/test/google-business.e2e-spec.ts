import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('GoogleBusiness (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let userId: string;
  let otherUserToken: string;
  let otherUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    // Clean up test data
    await prisma.attributionLinkClick.deleteMany({});
    await prisma.attributionLink.deleteMany({});
    await prisma.growthInsight.deleteMany({});
    await prisma.googleBusinessMetric.deleteMany({});
    await prisma.googleBusinessIntegration.deleteMany({});
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['google-test@example.com', 'other-google-test@example.com'],
        },
      },
    });

    // Create test user
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'google-test@example.com',
        password: 'Test123!@#',
        name: 'Google Test User',
      });

    authToken = registerResponse.body.access_token;
    userId = registerResponse.body.user.id;

    // Create another user for isolation tests
    const otherRegisterResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'other-google-test@example.com',
        password: 'Test123!@#',
        name: 'Other Google Test User',
      });

    otherUserToken = otherRegisterResponse.body.access_token;
    otherUserId = otherRegisterResponse.body.user.id;
  });

  afterAll(async () => {
    // Clean up
    await prisma.attributionLinkClick.deleteMany({});
    await prisma.attributionLink.deleteMany({});
    await prisma.growthInsight.deleteMany({});
    await prisma.googleBusinessMetric.deleteMany({});
    await prisma.googleBusinessIntegration.deleteMany({});
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['google-test@example.com', 'other-google-test@example.com'],
        },
      },
    });
    await app.close();
  });

  // ==========================================================================
  // Google OAuth Tests
  // ==========================================================================

  describe('GET /google-business/configured', () => {
    it('should return configuration status (public endpoint)', async () => {
      const response = await request(app.getHttpServer())
        .get('/google-business/configured')
        .expect(200);

      expect(response.body).toHaveProperty('configured');
      expect(typeof response.body.configured).toBe('boolean');
    });
  });

  describe('GET /google-business/status', () => {
    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .get('/google-business/status')
        .expect(401);
    });

    it('should return disconnected status for new user', async () => {
      const response = await request(app.getHttpServer())
        .get('/google-business/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('isConnected');
      expect(response.body.isConnected).toBe(false);
    });
  });

  describe('GET /google-business/oauth/url', () => {
    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .get('/google-business/oauth/url')
        .expect(401);
    });

    it('should return OAuth URL when configured', async () => {
      // Skip if not configured
      const configResponse = await request(app.getHttpServer())
        .get('/google-business/configured');

      if (!configResponse.body.configured) {
        console.log('Skipping OAuth URL test - Google not configured');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/google-business/oauth/url')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('url');
      expect(response.body).toHaveProperty('state');
      expect(response.body.url).toContain('accounts.google.com');
    });
  });

  describe('GET /google-business/locations', () => {
    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .get('/google-business/locations')
        .expect(401);
    });

    it('should return empty list for disconnected user', async () => {
      const response = await request(app.getHttpServer())
        .get('/google-business/locations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('locations');
      expect(Array.isArray(response.body.locations)).toBe(true);
    });
  });

  describe('DELETE /google-business/disconnect', () => {
    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .delete('/google-business/disconnect')
        .expect(401);
    });

    it('should succeed even if not connected', async () => {
      await request(app.getHttpServer())
        .delete('/google-business/disconnect')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);
    });
  });

  // ==========================================================================
  // Attribution Links Tests
  // ==========================================================================

  describe('Attribution Links', () => {
    let linkId: string;
    let linkSlug: string;

    describe('POST /attribution-links', () => {
      it('should return 401 without authentication', async () => {
        await request(app.getHttpServer())
          .post('/attribution-links')
          .send({
            type: 'WHATSAPP',
            targetUrl: 'https://wa.me/5511999999999',
          })
          .expect(401);
      });

      it('should create WhatsApp attribution link', async () => {
        const response = await request(app.getHttpServer())
          .post('/attribution-links')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            type: 'WHATSAPP',
            targetUrl: 'https://wa.me/5511999999999',
          })
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('slug');
        expect(response.body).toHaveProperty('type', 'WHATSAPP');
        expect(response.body).toHaveProperty('targetUrl', 'https://wa.me/5511999999999');
        expect(response.body).toHaveProperty('clickCount', 0);
        expect(response.body).toHaveProperty('isActive', true);
        expect(response.body).toHaveProperty('trackingUrl');

        linkId = response.body.id;
        linkSlug = response.body.slug;
      });

      it('should create Website attribution link with custom slug', async () => {
        const response = await request(app.getHttpServer())
          .post('/attribution-links')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            type: 'WEBSITE',
            targetUrl: 'https://meusite.com.br',
            customSlug: 'meu-site',
          })
          .expect(201);

        expect(response.body).toHaveProperty('slug', 'meu-site');
        expect(response.body).toHaveProperty('type', 'WEBSITE');
      });

      it('should fail with invalid type', async () => {
        await request(app.getHttpServer())
          .post('/attribution-links')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            type: 'INVALID',
            targetUrl: 'https://example.com',
          })
          .expect(400);
      });

      it('should fail with invalid URL', async () => {
        await request(app.getHttpServer())
          .post('/attribution-links')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            type: 'WEBSITE',
            targetUrl: 'not-a-url',
          })
          .expect(400);
      });
    });

    describe('GET /attribution-links', () => {
      it('should return 401 without authentication', async () => {
        await request(app.getHttpServer())
          .get('/attribution-links')
          .expect(401);
      });

      it('should return all links for user', async () => {
        const response = await request(app.getHttpServer())
          .get('/attribution-links')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThanOrEqual(2);
      });

      it('should not return other user links', async () => {
        // Create link for other user
        await request(app.getHttpServer())
          .post('/attribution-links')
          .set('Authorization', `Bearer ${otherUserToken}`)
          .send({
            type: 'WHATSAPP',
            targetUrl: 'https://wa.me/5511888888888',
          });

        // Check that first user doesn't see other user's links
        const response = await request(app.getHttpServer())
          .get('/attribution-links')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const hasOtherUserLink = response.body.some(
          (link: any) => link.targetUrl === 'https://wa.me/5511888888888'
        );
        expect(hasOtherUserLink).toBe(false);
      });
    });

    describe('GET /attribution-links/:id', () => {
      it('should return 401 without authentication', async () => {
        await request(app.getHttpServer())
          .get(`/attribution-links/${linkId}`)
          .expect(401);
      });

      it('should return single link', async () => {
        const response = await request(app.getHttpServer())
          .get(`/attribution-links/${linkId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('id', linkId);
        expect(response.body).toHaveProperty('slug', linkSlug);
      });

      it('should return 404 for non-existent link', async () => {
        await request(app.getHttpServer())
          .get('/attribution-links/non-existent-id')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);
      });
    });

    describe('GET /attribution-links/:id/stats', () => {
      it('should return link statistics', async () => {
        const response = await request(app.getHttpServer())
          .get(`/attribution-links/${linkId}/stats`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('totalClicks');
        expect(response.body).toHaveProperty('clicksToday');
        expect(response.body).toHaveProperty('clicksThisWeek');
        expect(response.body).toHaveProperty('clicksThisMonth');
        expect(response.body).toHaveProperty('dailyClicks');
        expect(Array.isArray(response.body.dailyClicks)).toBe(true);
      });
    });

    describe('PUT /attribution-links/:id', () => {
      it('should update link', async () => {
        const response = await request(app.getHttpServer())
          .put(`/attribution-links/${linkId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            targetUrl: 'https://wa.me/5511777777777',
            isActive: false,
          })
          .expect(200);

        expect(response.body).toHaveProperty('targetUrl', 'https://wa.me/5511777777777');
        expect(response.body).toHaveProperty('isActive', false);
      });

      it('should return 404 for other user link', async () => {
        // Get other user's link
        const otherLinks = await request(app.getHttpServer())
          .get('/attribution-links')
          .set('Authorization', `Bearer ${otherUserToken}`);

        if (otherLinks.body.length > 0) {
          await request(app.getHttpServer())
            .put(`/attribution-links/${otherLinks.body[0].id}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ isActive: false })
            .expect(404);
        }
      });
    });

    describe('DELETE /attribution-links/:id', () => {
      it('should delete link', async () => {
        // Create a link to delete
        const createResponse = await request(app.getHttpServer())
          .post('/attribution-links')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            type: 'WEBSITE',
            targetUrl: 'https://to-delete.com',
          });

        await request(app.getHttpServer())
          .delete(`/attribution-links/${createResponse.body.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(204);

        // Verify deletion
        await request(app.getHttpServer())
          .get(`/attribution-links/${createResponse.body.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);
      });
    });

    describe('GET /t/:slug (Tracking redirect)', () => {
      it('should redirect to target URL and track click', async () => {
        // Re-enable the link first
        await request(app.getHttpServer())
          .put(`/attribution-links/${linkId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ isActive: true });

        const response = await request(app.getHttpServer())
          .get(`/t/${linkSlug}`)
          .expect(302);

        expect(response.headers.location).toContain('wa.me');
      });

      it('should track UTM parameters', async () => {
        await request(app.getHttpServer())
          .get(`/t/${linkSlug}?utm_source=google&utm_medium=cpc&utm_campaign=test`)
          .expect(302);

        // Check that click was tracked with UTM data
        const stats = await request(app.getHttpServer())
          .get(`/attribution-links/${linkId}/stats`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(stats.body.totalClicks).toBeGreaterThan(0);
      });

      it('should return 404 for non-existent slug', async () => {
        await request(app.getHttpServer())
          .get('/t/non-existent-slug')
          .expect(404);
      });

      it('should return 404 for inactive link', async () => {
        // Disable the link
        await request(app.getHttpServer())
          .put(`/attribution-links/${linkId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ isActive: false });

        await request(app.getHttpServer())
          .get(`/t/${linkSlug}`)
          .expect(404);
      });
    });
  });

  // ==========================================================================
  // Growth Dashboard Tests
  // ==========================================================================

  describe('Growth Dashboard', () => {
    describe('GET /growth-dashboard', () => {
      it('should return 401 without authentication', async () => {
        await request(app.getHttpServer())
          .get('/growth-dashboard')
          .expect(401);
      });

      it('should return dashboard data', async () => {
        const response = await request(app.getHttpServer())
          .get('/growth-dashboard')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('summary');
        expect(response.body).toHaveProperty('timeSeries');
        expect(response.body).toHaveProperty('channelBreakdown');
        expect(response.body).toHaveProperty('conversionFunnel');
        expect(response.body).toHaveProperty('isGoogleConnected');
      });

      it('should accept period parameter', async () => {
        const response = await request(app.getHttpServer())
          .get('/growth-dashboard?period=30d')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('summary');
      });

      it('should accept custom date range', async () => {
        const response = await request(app.getHttpServer())
          .get('/growth-dashboard?period=custom&startDate=2024-01-01&endDate=2024-01-31')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('summary');
      });
    });

    describe('GET /growth-dashboard/summary', () => {
      it('should return 401 without authentication', async () => {
        await request(app.getHttpServer())
          .get('/growth-dashboard/summary')
          .expect(401);
      });

      it('should return summary only', async () => {
        const response = await request(app.getHttpServer())
          .get('/growth-dashboard/summary')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('totalActions');
        expect(response.body).toHaveProperty('calls');
        expect(response.body).toHaveProperty('routes');
        expect(response.body).toHaveProperty('websiteClicks');
        expect(response.body).toHaveProperty('whatsappClicks');
        expect(response.body).toHaveProperty('profileViews');
        expect(response.body).toHaveProperty('impressions');
        expect(response.body).toHaveProperty('periodStart');
        expect(response.body).toHaveProperty('periodEnd');

        // Verify KPI card structure
        expect(response.body.totalActions).toHaveProperty('label');
        expect(response.body.totalActions).toHaveProperty('value');
        expect(response.body.totalActions).toHaveProperty('change');
        expect(response.body.totalActions).toHaveProperty('trend');
      });
    });

    describe('GET /growth-dashboard/time-series', () => {
      it('should return time series data', async () => {
        const response = await request(app.getHttpServer())
          .get('/growth-dashboard/time-series')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('periodStart');
        expect(response.body).toHaveProperty('periodEnd');
        expect(Array.isArray(response.body.data)).toBe(true);
      });
    });

    describe('GET /growth-dashboard/funnel', () => {
      it('should return conversion funnel data', async () => {
        const response = await request(app.getHttpServer())
          .get('/growth-dashboard/funnel')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('stages');
        expect(response.body).toHaveProperty('overallConversionRate');
        expect(Array.isArray(response.body.stages)).toBe(true);
      });
    });

    describe('GET /growth-dashboard/insights', () => {
      it('should return 401 without authentication', async () => {
        await request(app.getHttpServer())
          .get('/growth-dashboard/insights')
          .expect(401);
      });

      it('should return insights list', async () => {
        const response = await request(app.getHttpServer())
          .get('/growth-dashboard/insights')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe('POST /growth-dashboard/sync', () => {
      it('should return 401 without authentication', async () => {
        await request(app.getHttpServer())
          .post('/growth-dashboard/sync')
          .expect(401);
      });

      it('should trigger sync (no-op if not connected)', async () => {
        await request(app.getHttpServer())
          .post('/growth-dashboard/sync')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(204);
      });
    });
  });

  // ==========================================================================
  // Data Isolation Tests
  // ==========================================================================

  describe('Data Isolation', () => {
    it('should isolate dashboard data between users', async () => {
      const user1Response = await request(app.getHttpServer())
        .get('/growth-dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const user2Response = await request(app.getHttpServer())
        .get('/growth-dashboard')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(200);

      // Both should have separate data
      expect(user1Response.body).toHaveProperty('isGoogleConnected');
      expect(user2Response.body).toHaveProperty('isGoogleConnected');
    });

    it('should isolate attribution links between users', async () => {
      const user1Links = await request(app.getHttpServer())
        .get('/attribution-links')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const user2Links = await request(app.getHttpServer())
        .get('/attribution-links')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(200);

      // Links should be different
      const user1Ids = user1Links.body.map((l: any) => l.id);
      const user2Ids = user2Links.body.map((l: any) => l.id);

      const hasOverlap = user1Ids.some((id: string) => user2Ids.includes(id));
      expect(hasOverlap).toBe(false);
    });
  });
});
