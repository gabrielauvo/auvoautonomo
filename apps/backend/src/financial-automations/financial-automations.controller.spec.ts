import { Test, TestingModule } from '@nestjs/testing';
import { FinancialAutomationsController } from './financial-automations.controller';
import { FinancialAutomationsService } from './financial-automations.service';

describe('FinancialAutomationsController', () => {
  let controller: FinancialAutomationsController;
  let service: FinancialAutomationsService;

  const mockSettings = {
    id: 'settings-1',
    userId: 'user-1',
    isEnabled: true,
    paymentReminderDaysBefore: [3, 1],
    paymentReminderDaysAfter: [3, 7],
    autoMarkOverdueAsDelinquentAfterDays: 30,
    enableQuoteFollowUp: true,
    quoteFollowUpDays: [3, 7],
    autoCancelPaymentAfterDays: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockService = {
    getOrCreateSettings: jest.fn(),
    updateSettings: jest.fn(),
    runDailyAutomations: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinancialAutomationsController],
      providers: [
        { provide: FinancialAutomationsService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<FinancialAutomationsController>(FinancialAutomationsController);
    service = module.get<FinancialAutomationsService>(FinancialAutomationsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getSettings', () => {
    it('should return user settings', async () => {
      mockService.getOrCreateSettings.mockResolvedValue(mockSettings);

      const result = await controller.getSettings('user-1');

      expect(result).toEqual(mockSettings);
      expect(mockService.getOrCreateSettings).toHaveBeenCalledWith('user-1');
    });
  });

  describe('updateSettings', () => {
    it('should update and return settings', async () => {
      const updatedSettings = { ...mockSettings, isEnabled: false };
      mockService.updateSettings.mockResolvedValue(updatedSettings);

      const result = await controller.updateSettings('user-1', { isEnabled: false });

      expect(result).toEqual(updatedSettings);
      expect(mockService.updateSettings).toHaveBeenCalledWith('user-1', { isEnabled: false });
    });

    it('should update multiple fields', async () => {
      const updateDto = {
        paymentReminderDaysBefore: [5, 2, 1],
        enableQuoteFollowUp: false,
      };
      const updatedSettings = {
        ...mockSettings,
        paymentReminderDaysBefore: [5, 2, 1],
        enableQuoteFollowUp: false,
      };
      mockService.updateSettings.mockResolvedValue(updatedSettings);

      const result = await controller.updateSettings('user-1', updateDto);

      expect(result).toEqual(updatedSettings);
      expect(mockService.updateSettings).toHaveBeenCalledWith('user-1', updateDto);
    });
  });

  describe('runAutomations', () => {
    it('should trigger daily automations and return results', async () => {
      const mockResult = {
        runAt: new Date(),
        usersProcessed: 5,
        results: {
          paymentRemindersBeforeDue: { processed: 10, successful: 8, failed: 2 },
          paymentRemindersAfterDue: { processed: 5, successful: 5, failed: 0 },
          delinquentClients: { processed: 2, successful: 2, failed: 0 },
          quoteFollowUps: { processed: 3, successful: 3, failed: 0 },
          autoCancelPayments: { processed: 1, successful: 1, failed: 0 },
        },
        errors: [],
      };
      mockService.runDailyAutomations.mockResolvedValue(mockResult);

      const result = await controller.runAutomations();

      expect(result).toEqual(mockResult);
      expect(mockService.runDailyAutomations).toHaveBeenCalled();
    });
  });
});
