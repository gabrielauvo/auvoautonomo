import { GrowthService } from '../../src/services/GrowthService';
import { AuthService } from '../../src/services/AuthService';
import { fetchWithTimeout } from '../../src/utils/fetch-with-timeout';

// Mock modules
jest.mock('../../src/services/AuthService', () => ({
  AuthService: {
    getAccessToken: jest.fn(),
  },
}));

jest.mock('../../src/utils/fetch-with-timeout', () => ({
  fetchWithTimeout: jest.fn(),
}));

jest.mock('../../src/config/api', () => ({
  getApiBaseUrl: jest.fn(() => 'https://api.auvo.com'),
}));

const mockedAuthService = AuthService as jest.Mocked<typeof AuthService>;
const mockedFetch = fetchWithTimeout as jest.MockedFunction<typeof fetchWithTimeout>;

describe('GrowthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAuthService.getAccessToken.mockResolvedValue('fake-token');
  });

  describe('isGoogleConfigured', () => {
    it('should return true when Google is configured', async () => {
      mockedFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ configured: true }),
      } as Response);

      const result = await GrowthService.isGoogleConfigured();

      expect(result).toBe(true);
      expect(mockedFetch).toHaveBeenCalledWith(
        'https://api.auvo.com/google-business/configured',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer fake-token',
          }),
        })
      );
    });

    it('should return false when Google is not configured', async () => {
      mockedFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ configured: false }),
      } as Response);

      const result = await GrowthService.isGoogleConfigured();

      expect(result).toBe(false);
    });

    it('should return false when no auth token', async () => {
      mockedAuthService.getAccessToken.mockResolvedValue(null);

      const result = await GrowthService.isGoogleConfigured();

      expect(result).toBe(false);
      expect(mockedFetch).not.toHaveBeenCalled();
    });

    it('should return false on API error', async () => {
      mockedFetch.mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      const result = await GrowthService.isGoogleConfigured();

      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      mockedFetch.mockRejectedValue(new Error('Network error'));

      const result = await GrowthService.isGoogleConfigured();

      expect(result).toBe(false);
    });
  });

  describe('getGoogleStatus', () => {
    const mockStatus = {
      status: 'CONNECTED' as const,
      googleLocationName: 'Oficina do João',
      lastSyncAt: '2024-01-15T10:00:00Z',
      lastSyncError: null,
      isConnected: true,
    };

    it('should return Google status when connected', async () => {
      mockedFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockStatus),
      } as Response);

      const result = await GrowthService.getGoogleStatus();

      expect(result).toEqual(mockStatus);
      expect(result?.isConnected).toBe(true);
    });

    it('should return disconnected status', async () => {
      const disconnectedStatus = {
        status: 'DISCONNECTED' as const,
        isConnected: false,
      };

      mockedFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(disconnectedStatus),
      } as Response);

      const result = await GrowthService.getGoogleStatus();

      expect(result?.status).toBe('DISCONNECTED');
      expect(result?.isConnected).toBe(false);
    });

    it('should return null when no auth token', async () => {
      mockedAuthService.getAccessToken.mockResolvedValue(null);

      const result = await GrowthService.getGoogleStatus();

      expect(result).toBeNull();
    });

    it('should return null on API error', async () => {
      mockedFetch.mockResolvedValue({
        ok: false,
        status: 401,
      } as Response);

      const result = await GrowthService.getGoogleStatus();

      expect(result).toBeNull();
    });
  });

  describe('getDashboardData', () => {
    const mockDashboardData = {
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
        data: [
          { date: '2024-01-01', calls: 10, routes: 5, websiteClicks: 3, whatsappClicks: 8, profileViews: 100, impressions: 400, totalActions: 26 },
        ],
        periodStart: '2024-01-01',
        periodEnd: '2024-01-07',
      },
      channelBreakdown: [
        { channel: 'Google', icon: 'google', clicks: 80, percentage: 53.3, color: '#4285F4' },
        { channel: 'Indicação', icon: 'users', clicks: 50, percentage: 33.3, color: '#34A853' },
        { channel: 'Direto', icon: 'link', clicks: 20, percentage: 13.4, color: '#EA4335' },
      ],
      conversionFunnel: {
        stages: [
          { stage: 'Visualizações', value: 500, percentage: 100, dropoff: 0 },
          { stage: 'Ações', value: 150, percentage: 30, dropoff: 70 },
          { stage: 'Conversões', value: 30, percentage: 6, dropoff: 80 },
        ],
        overallConversionRate: 6,
      },
      lastSyncAt: '2024-01-07T10:00:00Z',
      isGoogleConnected: true,
    };

    it('should fetch dashboard data successfully', async () => {
      mockedFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockDashboardData),
      } as Response);

      const result = await GrowthService.getDashboardData();

      expect(result).toEqual(mockDashboardData);
      expect(mockedFetch).toHaveBeenCalledWith(
        'https://api.auvo.com/growth-dashboard',
        expect.objectContaining({
          method: 'GET',
          timeout: 15000,
        })
      );
    });

    it('should pass period parameter', async () => {
      mockedFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockDashboardData),
      } as Response);

      await GrowthService.getDashboardData({ period: '30d' });

      expect(mockedFetch).toHaveBeenCalledWith(
        'https://api.auvo.com/growth-dashboard?period=30d',
        expect.any(Object)
      );
    });

    it('should pass custom date range', async () => {
      mockedFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockDashboardData),
      } as Response);

      await GrowthService.getDashboardData({
        period: 'custom',
        startDate: '2024-01-01',
        endDate: '2024-01-15',
      });

      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('startDate=2024-01-01'),
        expect.any(Object)
      );
      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('endDate=2024-01-15'),
        expect.any(Object)
      );
    });

    it('should return null when no auth token', async () => {
      mockedAuthService.getAccessToken.mockResolvedValue(null);

      const result = await GrowthService.getDashboardData();

      expect(result).toBeNull();
    });

    it('should return null on API error', async () => {
      mockedFetch.mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      const result = await GrowthService.getDashboardData();

      expect(result).toBeNull();
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

    it('should fetch summary data successfully', async () => {
      mockedFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSummary),
      } as Response);

      const result = await GrowthService.getDashboardSummary();

      expect(result).toEqual(mockSummary);
      expect(mockedFetch).toHaveBeenCalledWith(
        'https://api.auvo.com/growth-dashboard/summary',
        expect.any(Object)
      );
    });

    it('should pass period parameter', async () => {
      mockedFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSummary),
      } as Response);

      await GrowthService.getDashboardSummary({ period: '7d' });

      expect(mockedFetch).toHaveBeenCalledWith(
        'https://api.auvo.com/growth-dashboard/summary?period=7d',
        expect.any(Object)
      );
    });

    it('should return null when no auth token', async () => {
      mockedAuthService.getAccessToken.mockResolvedValue(null);

      const result = await GrowthService.getDashboardSummary();

      expect(result).toBeNull();
    });
  });

  describe('getInsights', () => {
    const mockInsights = [
      {
        id: 'insight-1',
        type: 'ACTION_SPIKE' as const,
        severity: 'SUCCESS' as const,
        title: 'Aumento de ligações',
        description: 'Suas ligações aumentaram 50% esta semana',
        recommendations: ['Continue investindo em anúncios', 'Responda rapidamente'],
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
        recommendations: ['Melhore sua descrição', 'Adicione mais fotos'],
        isRead: true,
        createdAt: '2024-01-06T10:00:00Z',
      },
    ];

    it('should fetch insights successfully', async () => {
      mockedFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockInsights),
      } as Response);

      const result = await GrowthService.getInsights();

      expect(result).toEqual(mockInsights);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no auth token', async () => {
      mockedAuthService.getAccessToken.mockResolvedValue(null);

      const result = await GrowthService.getInsights();

      expect(result).toEqual([]);
    });

    it('should return empty array on API error', async () => {
      mockedFetch.mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      const result = await GrowthService.getInsights();

      expect(result).toEqual([]);
    });
  });

  describe('markInsightRead', () => {
    it('should mark insight as read successfully', async () => {
      mockedFetch.mockResolvedValue({
        ok: true,
      } as Response);

      const result = await GrowthService.markInsightRead('insight-1');

      expect(result).toBe(true);
      expect(mockedFetch).toHaveBeenCalledWith(
        'https://api.auvo.com/growth-dashboard/insights/insight-1/read',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should return false when no auth token', async () => {
      mockedAuthService.getAccessToken.mockResolvedValue(null);

      const result = await GrowthService.markInsightRead('insight-1');

      expect(result).toBe(false);
    });

    it('should return false on API error', async () => {
      mockedFetch.mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      const result = await GrowthService.markInsightRead('invalid-id');

      expect(result).toBe(false);
    });
  });

  describe('dismissInsight', () => {
    it('should dismiss insight successfully', async () => {
      mockedFetch.mockResolvedValue({
        ok: true,
      } as Response);

      const result = await GrowthService.dismissInsight('insight-1');

      expect(result).toBe(true);
      expect(mockedFetch).toHaveBeenCalledWith(
        'https://api.auvo.com/growth-dashboard/insights/insight-1/dismiss',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should return false when no auth token', async () => {
      mockedAuthService.getAccessToken.mockResolvedValue(null);

      const result = await GrowthService.dismissInsight('insight-1');

      expect(result).toBe(false);
    });
  });

  describe('triggerSync', () => {
    it('should trigger sync successfully', async () => {
      mockedFetch.mockResolvedValue({
        ok: true,
      } as Response);

      const result = await GrowthService.triggerSync();

      expect(result).toBe(true);
      expect(mockedFetch).toHaveBeenCalledWith(
        'https://api.auvo.com/growth-dashboard/sync',
        expect.objectContaining({
          method: 'POST',
          timeout: 30000, // Longer timeout for sync
        })
      );
    });

    it('should return false when no auth token', async () => {
      mockedAuthService.getAccessToken.mockResolvedValue(null);

      const result = await GrowthService.triggerSync();

      expect(result).toBe(false);
    });

    it('should return false on API error', async () => {
      mockedFetch.mockResolvedValue({
        ok: false,
        status: 429,
      } as Response);

      const result = await GrowthService.triggerSync();

      expect(result).toBe(false);
    });

    it('should return false on network timeout', async () => {
      mockedFetch.mockRejectedValue(new Error('Timeout exceeded'));

      const result = await GrowthService.triggerSync();

      expect(result).toBe(false);
    });
  });

  describe('isGoogleConnected', () => {
    it('should return true when status is CONNECTED', async () => {
      mockedFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'CONNECTED',
          isConnected: true,
        }),
      } as Response);

      const result = await GrowthService.isGoogleConnected();

      expect(result).toBe(true);
    });

    it('should return false when status is DISCONNECTED', async () => {
      mockedFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'DISCONNECTED',
          isConnected: false,
        }),
      } as Response);

      const result = await GrowthService.isGoogleConnected();

      expect(result).toBe(false);
    });

    it('should return false when status is PENDING', async () => {
      mockedFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'PENDING',
          isConnected: false,
        }),
      } as Response);

      const result = await GrowthService.isGoogleConnected();

      expect(result).toBe(false);
    });

    it('should return false when status is ERROR', async () => {
      mockedFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'ERROR',
          lastSyncError: 'Token expired',
          isConnected: false,
        }),
      } as Response);

      const result = await GrowthService.isGoogleConnected();

      expect(result).toBe(false);
    });

    it('should return false when getGoogleStatus returns null', async () => {
      mockedAuthService.getAccessToken.mockResolvedValue(null);

      const result = await GrowthService.isGoogleConnected();

      expect(result).toBe(false);
    });
  });
});

describe('GrowthService Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AuthService.getAccessToken as jest.Mock).mockResolvedValue('token');
  });

  it('should handle network errors gracefully in getDashboardData', async () => {
    mockedFetch.mockRejectedValue(new Error('Network unavailable'));

    const result = await GrowthService.getDashboardData();

    expect(result).toBeNull();
  });

  it('should handle JSON parse errors', async () => {
    mockedFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new Error('Invalid JSON')),
    } as Response);

    const result = await GrowthService.getDashboardSummary();

    expect(result).toBeNull();
  });

  it('should handle 401 unauthorized', async () => {
    mockedFetch.mockResolvedValue({
      ok: false,
      status: 401,
    } as Response);

    const result = await GrowthService.getGoogleStatus();

    expect(result).toBeNull();
  });

  it('should handle 403 forbidden', async () => {
    mockedFetch.mockResolvedValue({
      ok: false,
      status: 403,
    } as Response);

    const result = await GrowthService.getDashboardData();

    expect(result).toBeNull();
  });

  it('should handle 500 server error', async () => {
    mockedFetch.mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    const result = await GrowthService.getInsights();

    expect(result).toEqual([]);
  });
});
