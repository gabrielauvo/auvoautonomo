import {
  isGoogleBusinessConfigured,
  getGoogleIntegrationStatus,
  getGoogleOAuthUrl,
  getGoogleLocations,
  selectGoogleLocation,
  disconnectGoogle,
  getAttributionLinks,
  getAttributionLink,
  createAttributionLink,
  updateAttributionLink,
  deleteAttributionLink,
  getAttributionLinkStats,
  getDashboardData,
  getDashboardSummary,
  triggerMetricsSync,
  getGrowthInsights,
  markInsightAsRead,
  dismissInsight,
  googleBusinessService,
} from '../google-business.service';
import api from '../api';

// Mock the api module
jest.mock('../api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
  getErrorMessage: jest.fn((error) => {
    if (error?.response?.data?.message) return error.response.data.message;
    if (error?.message) return error.message;
    return 'Unknown error';
  }),
}));

const mockedApi = api as jest.Mocked<typeof api>;

describe('GoogleBusinessService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Google OAuth Tests
  // ==========================================================================

  describe('isGoogleBusinessConfigured', () => {
    it('should return true when configured', async () => {
      mockedApi.get.mockResolvedValue({ data: { configured: true } });

      const result = await isGoogleBusinessConfigured();

      expect(result).toBe(true);
      expect(api.get).toHaveBeenCalledWith('/google-business/configured');
    });

    it('should return false when not configured', async () => {
      mockedApi.get.mockResolvedValue({ data: { configured: false } });

      const result = await isGoogleBusinessConfigured();

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockedApi.get.mockRejectedValue(new Error('Network error'));

      const result = await isGoogleBusinessConfigured();

      expect(result).toBe(false);
    });
  });

  describe('getGoogleIntegrationStatus', () => {
    const mockStatus = {
      status: 'CONNECTED' as const,
      googleLocationName: 'Oficina do João',
      lastSyncAt: '2024-01-15T10:00:00Z',
      isConnected: true,
    };

    it('should return integration status', async () => {
      mockedApi.get.mockResolvedValue({ data: mockStatus });

      const result = await getGoogleIntegrationStatus();

      expect(result).toEqual(mockStatus);
      expect(api.get).toHaveBeenCalledWith('/google-business/status');
    });

    it('should throw error on failure', async () => {
      mockedApi.get.mockRejectedValue({
        response: { data: { message: 'Unauthorized' } },
      });

      await expect(getGoogleIntegrationStatus()).rejects.toThrow('Unauthorized');
    });
  });

  describe('getGoogleOAuthUrl', () => {
    const mockOAuthResponse = {
      url: 'https://accounts.google.com/oauth?client_id=xxx',
      state: 'random-state-123',
    };

    it('should return OAuth URL', async () => {
      mockedApi.get.mockResolvedValue({ data: mockOAuthResponse });

      const result = await getGoogleOAuthUrl();

      expect(result).toEqual(mockOAuthResponse);
      expect(api.get).toHaveBeenCalledWith('/google-business/oauth/url', { params: {} });
    });

    it('should pass redirect URL as parameter', async () => {
      mockedApi.get.mockResolvedValue({ data: mockOAuthResponse });

      await getGoogleOAuthUrl('https://app.auvo.com/settings');

      expect(api.get).toHaveBeenCalledWith('/google-business/oauth/url', {
        params: { redirectUrl: 'https://app.auvo.com/settings' },
      });
    });
  });

  describe('getGoogleLocations', () => {
    const mockLocations = [
      {
        locationId: 'loc-1',
        name: 'Oficina Principal',
        address: 'Rua das Flores, 123',
        phoneNumber: '+5511999999999',
      },
      {
        locationId: 'loc-2',
        name: 'Filial Centro',
        address: 'Av. Brasil, 456',
      },
    ];

    it('should return locations list', async () => {
      mockedApi.get.mockResolvedValue({ data: { locations: mockLocations } });

      const result = await getGoogleLocations();

      expect(result).toEqual(mockLocations);
      expect(result).toHaveLength(2);
    });
  });

  describe('selectGoogleLocation', () => {
    it('should select location successfully', async () => {
      mockedApi.post.mockResolvedValue({ data: {} });

      await selectGoogleLocation('loc-1');

      expect(api.post).toHaveBeenCalledWith('/google-business/locations/select', {
        locationId: 'loc-1',
      });
    });

    it('should throw error on failure', async () => {
      mockedApi.post.mockRejectedValue({
        response: { data: { message: 'Location not found' } },
      });

      await expect(selectGoogleLocation('invalid-loc')).rejects.toThrow('Location not found');
    });
  });

  describe('disconnectGoogle', () => {
    it('should disconnect successfully', async () => {
      mockedApi.delete.mockResolvedValue({ data: {} });

      await disconnectGoogle();

      expect(api.delete).toHaveBeenCalledWith('/google-business/disconnect');
    });
  });

  // ==========================================================================
  // Attribution Links Tests
  // ==========================================================================

  describe('getAttributionLinks', () => {
    const mockLinks = [
      {
        id: 'link-1',
        slug: 'whatsapp-main',
        type: 'WHATSAPP' as const,
        targetUrl: 'https://wa.me/5511999999999',
        clickCount: 150,
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
        trackingUrl: 'https://app.auvo.com/t/whatsapp-main',
      },
      {
        id: 'link-2',
        slug: 'website',
        type: 'WEBSITE' as const,
        targetUrl: 'https://meusite.com.br',
        clickCount: 80,
        isActive: true,
        createdAt: '2024-01-02T00:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
        trackingUrl: 'https://app.auvo.com/t/website',
      },
    ];

    it('should return all attribution links', async () => {
      mockedApi.get.mockResolvedValue({ data: mockLinks });

      const result = await getAttributionLinks();

      expect(result).toEqual(mockLinks);
      expect(result).toHaveLength(2);
    });
  });

  describe('getAttributionLink', () => {
    const mockLink = {
      id: 'link-1',
      slug: 'whatsapp-main',
      type: 'WHATSAPP' as const,
      targetUrl: 'https://wa.me/5511999999999',
      clickCount: 150,
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
      trackingUrl: 'https://app.auvo.com/t/whatsapp-main',
    };

    it('should return single attribution link', async () => {
      mockedApi.get.mockResolvedValue({ data: mockLink });

      const result = await getAttributionLink('link-1');

      expect(result).toEqual(mockLink);
      expect(api.get).toHaveBeenCalledWith('/attribution-links/link-1');
    });
  });

  describe('createAttributionLink', () => {
    it('should create WhatsApp link', async () => {
      const newLink = {
        id: 'link-new',
        slug: 'wa-promo',
        type: 'WHATSAPP' as const,
        targetUrl: 'https://wa.me/5511999999999?text=Promo',
        clickCount: 0,
        isActive: true,
        createdAt: '2024-01-20T00:00:00Z',
        updatedAt: '2024-01-20T00:00:00Z',
        trackingUrl: 'https://app.auvo.com/t/wa-promo',
      };

      mockedApi.post.mockResolvedValue({ data: newLink });

      const result = await createAttributionLink({
        type: 'WHATSAPP',
        targetUrl: 'https://wa.me/5511999999999?text=Promo',
        customSlug: 'wa-promo',
      });

      expect(result).toEqual(newLink);
      expect(api.post).toHaveBeenCalledWith('/attribution-links', {
        type: 'WHATSAPP',
        targetUrl: 'https://wa.me/5511999999999?text=Promo',
        customSlug: 'wa-promo',
      });
    });
  });

  describe('updateAttributionLink', () => {
    it('should update attribution link', async () => {
      const updatedLink = {
        id: 'link-1',
        slug: 'whatsapp-main',
        type: 'WHATSAPP' as const,
        targetUrl: 'https://wa.me/5511888888888',
        clickCount: 150,
        isActive: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-20T00:00:00Z',
        trackingUrl: 'https://app.auvo.com/t/whatsapp-main',
      };

      mockedApi.put.mockResolvedValue({ data: updatedLink });

      const result = await updateAttributionLink('link-1', {
        targetUrl: 'https://wa.me/5511888888888',
        isActive: false,
      });

      expect(result).toEqual(updatedLink);
      expect(api.put).toHaveBeenCalledWith('/attribution-links/link-1', {
        targetUrl: 'https://wa.me/5511888888888',
        isActive: false,
      });
    });
  });

  describe('deleteAttributionLink', () => {
    it('should delete attribution link', async () => {
      mockedApi.delete.mockResolvedValue({ data: {} });

      await deleteAttributionLink('link-1');

      expect(api.delete).toHaveBeenCalledWith('/attribution-links/link-1');
    });
  });

  describe('getAttributionLinkStats', () => {
    const mockStats = {
      totalClicks: 150,
      clicksToday: 10,
      clicksThisWeek: 45,
      clicksThisMonth: 120,
      dailyClicks: [
        { date: '2024-01-18', count: 12 },
        { date: '2024-01-19', count: 15 },
        { date: '2024-01-20', count: 10 },
      ],
    };

    it('should return link statistics', async () => {
      mockedApi.get.mockResolvedValue({ data: mockStats });

      const result = await getAttributionLinkStats('link-1');

      expect(result).toEqual(mockStats);
      expect(api.get).toHaveBeenCalledWith('/attribution-links/link-1/stats');
    });
  });

  // ==========================================================================
  // Dashboard Tests
  // ==========================================================================

  describe('getDashboardData', () => {
    const mockDashboard = {
      summary: {
        totalActions: { label: 'Total', value: 150, change: 10, trend: 'up' as const },
        calls: { label: 'Ligações', value: 50, change: 5, trend: 'up' as const },
        routes: { label: 'Rotas', value: 30, change: -2, trend: 'down' as const },
        websiteClicks: { label: 'Site', value: 20, change: 0, trend: 'neutral' as const },
        whatsappClicks: { label: 'WhatsApp', value: 40, change: 15, trend: 'up' as const },
        profileViews: { label: 'Visualizações', value: 500, change: 20, trend: 'up' as const },
        impressions: { label: 'Impressões', value: 2000, change: 100, trend: 'up' as const },
        periodStart: '2024-01-01',
        periodEnd: '2024-01-07',
      },
      timeSeries: {
        data: [],
        periodStart: '2024-01-01',
        periodEnd: '2024-01-07',
      },
      channelBreakdown: [],
      conversionFunnel: {
        stages: [],
        overallConversionRate: 6,
      },
      lastSyncAt: '2024-01-07T10:00:00Z',
      isGoogleConnected: true,
    };

    it('should return dashboard data', async () => {
      mockedApi.get.mockResolvedValue({ data: mockDashboard });

      const result = await getDashboardData();

      expect(result).toEqual(mockDashboard);
      expect(api.get).toHaveBeenCalledWith('/growth-dashboard', { params: undefined });
    });

    it('should pass period parameter', async () => {
      mockedApi.get.mockResolvedValue({ data: mockDashboard });

      await getDashboardData({ period: '30d' });

      expect(api.get).toHaveBeenCalledWith('/growth-dashboard', {
        params: { period: '30d' },
      });
    });

    it('should pass custom date range', async () => {
      mockedApi.get.mockResolvedValue({ data: mockDashboard });

      await getDashboardData({
        period: 'custom',
        startDate: '2024-01-01',
        endDate: '2024-01-15',
      });

      expect(api.get).toHaveBeenCalledWith('/growth-dashboard', {
        params: {
          period: 'custom',
          startDate: '2024-01-01',
          endDate: '2024-01-15',
        },
      });
    });
  });

  describe('getDashboardSummary', () => {
    const mockSummary = {
      totalActions: { label: 'Total', value: 150, change: 10, trend: 'up' as const },
      calls: { label: 'Ligações', value: 50, change: 5, trend: 'up' as const },
      routes: { label: 'Rotas', value: 30, change: -2, trend: 'down' as const },
      websiteClicks: { label: 'Site', value: 20, change: 0, trend: 'neutral' as const },
      whatsappClicks: { label: 'WhatsApp', value: 40, change: 15, trend: 'up' as const },
      profileViews: { label: 'Visualizações', value: 500, change: 20, trend: 'up' as const },
      impressions: { label: 'Impressões', value: 2000, change: 100, trend: 'up' as const },
      periodStart: '2024-01-01',
      periodEnd: '2024-01-07',
    };

    it('should return dashboard summary', async () => {
      mockedApi.get.mockResolvedValue({ data: mockSummary });

      const result = await getDashboardSummary();

      expect(result).toEqual(mockSummary);
      expect(api.get).toHaveBeenCalledWith('/growth-dashboard/summary', { params: undefined });
    });

    it('should pass period parameter', async () => {
      mockedApi.get.mockResolvedValue({ data: mockSummary });

      await getDashboardSummary({ period: '7d' });

      expect(api.get).toHaveBeenCalledWith('/growth-dashboard/summary', {
        params: { period: '7d' },
      });
    });
  });

  describe('triggerMetricsSync', () => {
    it('should trigger sync successfully', async () => {
      mockedApi.post.mockResolvedValue({ data: {} });

      await triggerMetricsSync();

      expect(api.post).toHaveBeenCalledWith('/growth-dashboard/sync');
    });

    it('should throw error on failure', async () => {
      mockedApi.post.mockRejectedValue({
        response: { data: { message: 'Rate limit exceeded' } },
      });

      await expect(triggerMetricsSync()).rejects.toThrow('Rate limit exceeded');
    });
  });

  // ==========================================================================
  // Insights Tests
  // ==========================================================================

  describe('getGrowthInsights', () => {
    const mockInsights = [
      {
        id: 'insight-1',
        type: 'ACTION_SPIKE' as const,
        severity: 'SUCCESS' as const,
        title: 'Aumento de ligações',
        description: 'Suas ligações aumentaram 50% esta semana',
        recommendations: ['Continue investindo em anúncios'],
        metrics: { increase: 50 },
        isRead: false,
        createdAt: '2024-01-07T10:00:00Z',
      },
      {
        id: 'insight-2',
        type: 'LOW_CONVERSION_RATE' as const,
        severity: 'WARNING' as const,
        title: 'Taxa de conversão baixa',
        description: 'Sua taxa de conversão está abaixo da média',
        recommendations: ['Melhore sua descrição'],
        isRead: true,
        createdAt: '2024-01-06T10:00:00Z',
      },
    ];

    it('should return insights list', async () => {
      mockedApi.get.mockResolvedValue({ data: mockInsights });

      const result = await getGrowthInsights();

      expect(result).toEqual(mockInsights);
      expect(result).toHaveLength(2);
    });
  });

  describe('markInsightAsRead', () => {
    it('should mark insight as read', async () => {
      mockedApi.post.mockResolvedValue({ data: {} });

      await markInsightAsRead('insight-1');

      expect(api.post).toHaveBeenCalledWith('/growth-dashboard/insights/insight-1/read');
    });
  });

  describe('dismissInsight', () => {
    it('should dismiss insight', async () => {
      mockedApi.post.mockResolvedValue({ data: {} });

      await dismissInsight('insight-1');

      expect(api.post).toHaveBeenCalledWith('/growth-dashboard/insights/insight-1/dismiss');
    });
  });

  // ==========================================================================
  // Service Export Tests
  // ==========================================================================

  describe('googleBusinessService object', () => {
    it('should have all methods', () => {
      // OAuth
      expect(googleBusinessService.isConfigured).toBe(isGoogleBusinessConfigured);
      expect(googleBusinessService.getStatus).toBe(getGoogleIntegrationStatus);
      expect(googleBusinessService.getOAuthUrl).toBe(getGoogleOAuthUrl);
      expect(googleBusinessService.getLocations).toBe(getGoogleLocations);
      expect(googleBusinessService.selectLocation).toBe(selectGoogleLocation);
      expect(googleBusinessService.disconnect).toBe(disconnectGoogle);

      // Attribution Links
      expect(googleBusinessService.getLinks).toBe(getAttributionLinks);
      expect(googleBusinessService.getLink).toBe(getAttributionLink);
      expect(googleBusinessService.createLink).toBe(createAttributionLink);
      expect(googleBusinessService.updateLink).toBe(updateAttributionLink);
      expect(googleBusinessService.deleteLink).toBe(deleteAttributionLink);
      expect(googleBusinessService.getLinkStats).toBe(getAttributionLinkStats);

      // Dashboard
      expect(googleBusinessService.getDashboard).toBe(getDashboardData);
      expect(googleBusinessService.getSummary).toBe(getDashboardSummary);
      expect(googleBusinessService.triggerSync).toBe(triggerMetricsSync);

      // Insights
      expect(googleBusinessService.getInsights).toBe(getGrowthInsights);
      expect(googleBusinessService.markInsightRead).toBe(markInsightAsRead);
      expect(googleBusinessService.dismissInsight).toBe(dismissInsight);
    });
  });
});

describe('GoogleBusinessService Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle 401 unauthorized', async () => {
    mockedApi.get.mockRejectedValue({
      response: { status: 401, data: { message: 'Unauthorized' } },
    });

    await expect(getGoogleIntegrationStatus()).rejects.toThrow('Unauthorized');
  });

  it('should handle 403 forbidden', async () => {
    mockedApi.get.mockRejectedValue({
      response: { status: 403, data: { message: 'Forbidden' } },
    });

    await expect(getDashboardData()).rejects.toThrow('Forbidden');
  });

  it('should handle 404 not found', async () => {
    mockedApi.get.mockRejectedValue({
      response: { status: 404, data: { message: 'Link not found' } },
    });

    await expect(getAttributionLink('invalid-id')).rejects.toThrow('Link not found');
  });

  it('should handle 500 server error', async () => {
    mockedApi.post.mockRejectedValue({
      response: { status: 500, data: { message: 'Internal Server Error' } },
    });

    await expect(triggerMetricsSync()).rejects.toThrow('Internal Server Error');
  });

  it('should handle network errors', async () => {
    mockedApi.get.mockRejectedValue({
      message: 'Network Error',
    });

    await expect(getGoogleLocations()).rejects.toThrow('Network Error');
  });

  it('should handle timeout errors', async () => {
    mockedApi.get.mockRejectedValue({
      code: 'ECONNABORTED',
      message: 'timeout of 10000ms exceeded',
    });

    await expect(getDashboardSummary()).rejects.toThrow('timeout of 10000ms exceeded');
  });
});
