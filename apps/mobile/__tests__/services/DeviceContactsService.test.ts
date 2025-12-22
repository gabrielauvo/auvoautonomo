/**
 * DeviceContactsService Tests
 *
 * Testes para o serviço de criação de contatos na agenda do dispositivo.
 *
 * Testes críticos:
 * - normalizePhone funciona corretamente
 * - Não chama Contacts API se phone vazio
 * - Falha na agenda não impede criação do cliente
 * - Feature flag controla o comportamento
 */

import {
  DeviceContactsService,
  normalizePhone,
  areNamesSimilar,
} from '../../src/services/DeviceContactsService';

// =============================================================================
// MOCKS
// =============================================================================

// Mock expo-contacts
jest.mock('expo-contacts', () => ({
  requestPermissionsAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  getContactsAsync: jest.fn(),
  addContactAsync: jest.fn(),
  Fields: {
    Name: 'name',
    PhoneNumbers: 'phoneNumbers',
  },
  ContactTypes: {
    Person: 'person',
  },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock Logger
jest.mock('../../src/observability/Logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock SYNC_FLAGS - default OFF
jest.mock('../../src/config/syncFlags', () => ({
  SYNC_FLAGS: {
    CREATE_CONTACT_ON_CLIENT_CREATE: false,
    CONTACT_ADD_APP_NOTE: true,
    CONTACT_ADD_COMPANY_NAME: true,
  },
}));

import * as Contacts from 'expo-contacts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../src/observability/Logger';
import { SYNC_FLAGS } from '../../src/config/syncFlags';

// =============================================================================
// TESTS: normalizePhone
// =============================================================================

describe('normalizePhone', () => {
  it('should remove spaces', () => {
    expect(normalizePhone('11 99999 9999')).toBe('11999999999');
  });

  it('should remove parentheses', () => {
    expect(normalizePhone('(11) 99999-9999')).toBe('11999999999');
  });

  it('should remove hyphens', () => {
    expect(normalizePhone('11999-999-999')).toBe('11999999999');
  });

  it('should remove dots', () => {
    expect(normalizePhone('11.99999.9999')).toBe('11999999999');
  });

  it('should keep + sign', () => {
    expect(normalizePhone('+55 11 99999-9999')).toBe('+5511999999999');
  });

  it('should convert 00 to +', () => {
    expect(normalizePhone('0055 11 99999-9999')).toBe('+5511999999999');
  });

  it('should handle empty string', () => {
    expect(normalizePhone('')).toBe('');
  });

  it('should handle null/undefined', () => {
    expect(normalizePhone(null as any)).toBe('');
    expect(normalizePhone(undefined as any)).toBe('');
  });

  it('should handle complex Brazilian number', () => {
    expect(normalizePhone('+55 (11) 99999-9999')).toBe('+5511999999999');
  });

  it('should handle number with extension', () => {
    // Extensions with text are stripped
    expect(normalizePhone('11 99999-9999 ramal 123')).toBe('11999999999123');
  });
});

// =============================================================================
// TESTS: areNamesSimilar
// =============================================================================

describe('areNamesSimilar', () => {
  it('should match exact names (case insensitive)', () => {
    expect(areNamesSimilar('João Silva', 'João Silva')).toBe(true);
    expect(areNamesSimilar('João Silva', 'JOÃO SILVA')).toBe(true);
    expect(areNamesSimilar('João Silva', 'joão silva')).toBe(true);
  });

  it('should match names ignoring accents', () => {
    expect(areNamesSimilar('João Silva', 'Joao Silva')).toBe(true);
    expect(areNamesSimilar('José María', 'Jose Maria')).toBe(true);
  });

  it('should match if one name contains the other', () => {
    expect(areNamesSimilar('João Silva Santos', 'João Silva')).toBe(true);
    expect(areNamesSimilar('João', 'João Silva')).toBe(true);
  });

  it('should not match different names', () => {
    expect(areNamesSimilar('João Silva', 'Maria Santos')).toBe(false);
    expect(areNamesSimilar('Pedro', 'Paulo')).toBe(false);
  });

  it('should handle empty strings', () => {
    expect(areNamesSimilar('', 'João')).toBe(false);
    expect(areNamesSimilar('João', '')).toBe(false);
    expect(areNamesSimilar('', '')).toBe(false);
  });

  it('should handle null/undefined', () => {
    expect(areNamesSimilar(null as any, 'João')).toBe(false);
    expect(areNamesSimilar('João', undefined as any)).toBe(false);
  });
});

// =============================================================================
// TESTS: DeviceContactsService
// =============================================================================

describe('DeviceContactsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mocks to default state
    (Contacts.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined' });
    (Contacts.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (Contacts.getContactsAsync as jest.Mock).mockResolvedValue({ data: [] });
    (Contacts.addContactAsync as jest.Mock).mockResolvedValue('new-contact-id');
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
  });

  // ===========================================================================
  // hasPermission
  // ===========================================================================

  describe('hasPermission', () => {
    it('should return true when permission is granted', async () => {
      (Contacts.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });

      const result = await DeviceContactsService.hasPermission();

      expect(result).toBe(true);
      expect(Contacts.getPermissionsAsync).toHaveBeenCalled();
    });

    it('should return false when permission is denied', async () => {
      (Contacts.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });

      const result = await DeviceContactsService.hasPermission();

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      (Contacts.getPermissionsAsync as jest.Mock).mockRejectedValue(new Error('Test error'));

      const result = await DeviceContactsService.hasPermission();

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // requestPermission
  // ===========================================================================

  describe('requestPermission', () => {
    it('should return true if already has permission', async () => {
      (Contacts.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });

      const result = await DeviceContactsService.requestPermission();

      expect(result).toBe(true);
      expect(Contacts.requestPermissionsAsync).not.toHaveBeenCalled();
    });

    it('should not ask again if already denied', async () => {
      (Contacts.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('denied');

      const result = await DeviceContactsService.requestPermission();

      expect(result).toBe(false);
      expect(Contacts.requestPermissionsAsync).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        'Contacts permission already denied, not asking again',
        expect.any(Object)
      );
    });

    it('should request permission if not asked before', async () => {
      (Contacts.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined' });
      (Contacts.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await DeviceContactsService.requestPermission();

      expect(result).toBe(true);
      expect(Contacts.requestPermissionsAsync).toHaveBeenCalled();
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@auvo:contacts_permission_asked',
        'granted'
      );
    });

    it('should save denied status when permission is denied', async () => {
      (Contacts.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined' });
      (Contacts.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await DeviceContactsService.requestPermission();

      expect(result).toBe(false);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@auvo:contacts_permission_asked',
        'denied'
      );
    });
  });

  // ===========================================================================
  // isFeatureEnabled / setFeatureEnabled
  // ===========================================================================

  describe('isFeatureEnabled', () => {
    it('should return false when global flag is OFF', async () => {
      // SYNC_FLAGS.CREATE_CONTACT_ON_CLIENT_CREATE is already false in mock

      const result = await DeviceContactsService.isFeatureEnabled();

      expect(result).toBe(false);
    });

    it('should check user preference when global flag is ON', async () => {
      // Temporarily change the mock
      (SYNC_FLAGS as any).CREATE_CONTACT_ON_CLIENT_CREATE = true;
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('true');

      const result = await DeviceContactsService.isFeatureEnabled();

      expect(result).toBe(true);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('@auvo:contact_sync_enabled');

      // Reset
      (SYNC_FLAGS as any).CREATE_CONTACT_ON_CLIENT_CREATE = false;
    });

    it('should return false when user preference is not set', async () => {
      (SYNC_FLAGS as any).CREATE_CONTACT_ON_CLIENT_CREATE = true;
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await DeviceContactsService.isFeatureEnabled();

      expect(result).toBe(false);

      // Reset
      (SYNC_FLAGS as any).CREATE_CONTACT_ON_CLIENT_CREATE = false;
    });
  });

  describe('setFeatureEnabled', () => {
    it('should save setting to AsyncStorage', async () => {
      await DeviceContactsService.setFeatureEnabled(true);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@auvo:contact_sync_enabled',
        'true'
      );
    });

    it('should reset permission flag when enabling', async () => {
      await DeviceContactsService.setFeatureEnabled(true);

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@auvo:contacts_permission_asked');
    });

    it('should not reset permission flag when disabling', async () => {
      await DeviceContactsService.setFeatureEnabled(false);

      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // contactExists
  // ===========================================================================

  describe('contactExists', () => {
    it('should return false when no permission', async () => {
      (Contacts.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });

      const result = await DeviceContactsService.contactExists('11999999999', 'João');

      expect(result).toEqual({ exists: false });
      expect(Contacts.getContactsAsync).not.toHaveBeenCalled();
    });

    it('should find duplicate by phone number', async () => {
      (Contacts.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (Contacts.getContactsAsync as jest.Mock).mockResolvedValue({
        data: [
          {
            id: 'contact-1',
            name: 'João Silva',
            phoneNumbers: [{ number: '(11) 99999-9999' }],
          },
        ],
      });

      const result = await DeviceContactsService.contactExists('11999999999', 'João');

      expect(result).toEqual({ exists: true, contactId: 'contact-1' });
    });

    it('should not find duplicate when phone differs', async () => {
      (Contacts.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (Contacts.getContactsAsync as jest.Mock).mockResolvedValue({
        data: [
          {
            id: 'contact-1',
            name: 'João Silva',
            phoneNumbers: [{ number: '(11) 88888-8888' }],
          },
        ],
      });

      const result = await DeviceContactsService.contactExists('11999999999', 'João');

      expect(result).toEqual({ exists: false });
    });

    it('should return false on error', async () => {
      (Contacts.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (Contacts.getContactsAsync as jest.Mock).mockRejectedValue(new Error('Test error'));

      const result = await DeviceContactsService.contactExists('11999999999', 'João');

      expect(result).toEqual({ exists: false });
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // createContact
  // ===========================================================================

  describe('createContact', () => {
    it('should skip when feature is disabled', async () => {
      // Feature flag is OFF by default in mock

      const result = await DeviceContactsService.createContact({
        name: 'João Silva',
        phone: '11999999999',
      });

      expect(result).toEqual({
        success: false,
        skipped: true,
        skipReason: 'feature_disabled',
      });
      expect(Contacts.addContactAsync).not.toHaveBeenCalled();
    });

    it('should skip when phone is empty', async () => {
      (SYNC_FLAGS as any).CREATE_CONTACT_ON_CLIENT_CREATE = true;
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('true');

      const result = await DeviceContactsService.createContact({
        name: 'João Silva',
        phone: '',
      });

      expect(result).toEqual({
        success: false,
        skipped: true,
        skipReason: 'empty_phone',
      });
      expect(Contacts.addContactAsync).not.toHaveBeenCalled();

      // Reset
      (SYNC_FLAGS as any).CREATE_CONTACT_ON_CLIENT_CREATE = false;
    });

    it('should skip when no permission', async () => {
      (SYNC_FLAGS as any).CREATE_CONTACT_ON_CLIENT_CREATE = true;
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === '@auvo:contact_sync_enabled') return Promise.resolve('true');
        if (key === '@auvo:contacts_permission_asked') return Promise.resolve('denied');
        return Promise.resolve(null);
      });
      (Contacts.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });

      const result = await DeviceContactsService.createContact({
        name: 'João Silva',
        phone: '11999999999',
      });

      expect(result).toEqual({
        success: false,
        skipped: true,
        skipReason: 'no_permission',
      });
      expect(Contacts.addContactAsync).not.toHaveBeenCalled();

      // Reset
      (SYNC_FLAGS as any).CREATE_CONTACT_ON_CLIENT_CREATE = false;
    });

    it('should skip when duplicate exists', async () => {
      (SYNC_FLAGS as any).CREATE_CONTACT_ON_CLIENT_CREATE = true;
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === '@auvo:contact_sync_enabled') return Promise.resolve('true');
        return Promise.resolve(null);
      });
      (Contacts.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (Contacts.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (Contacts.getContactsAsync as jest.Mock).mockResolvedValue({
        data: [
          {
            id: 'existing-contact',
            name: 'João Silva',
            phoneNumbers: [{ number: '11999999999' }],
          },
        ],
      });

      const result = await DeviceContactsService.createContact({
        name: 'João Silva',
        phone: '11999999999',
      });

      expect(result).toEqual({
        success: false,
        skipped: true,
        skipReason: 'duplicate',
        contactId: 'existing-contact',
      });
      expect(Contacts.addContactAsync).not.toHaveBeenCalled();

      // Reset
      (SYNC_FLAGS as any).CREATE_CONTACT_ON_CLIENT_CREATE = false;
    });

    it('should create contact successfully', async () => {
      (SYNC_FLAGS as any).CREATE_CONTACT_ON_CLIENT_CREATE = true;
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === '@auvo:contact_sync_enabled') return Promise.resolve('true');
        return Promise.resolve(null);
      });
      (Contacts.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (Contacts.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (Contacts.getContactsAsync as jest.Mock).mockResolvedValue({ data: [] });
      (Contacts.addContactAsync as jest.Mock).mockResolvedValue('new-contact-123');

      const result = await DeviceContactsService.createContact({
        name: 'João Silva',
        phone: '(11) 99999-9999',
        companyName: 'Empresa ABC',
      });

      expect(result).toEqual({
        success: true,
        contactId: 'new-contact-123',
      });
      expect(Contacts.addContactAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'João Silva',
          firstName: 'João',
          lastName: 'Silva',
          phoneNumbers: [{ number: '(11) 99999-9999', label: 'mobile' }],
          company: 'Empresa ABC',
          note: 'Criado pelo Auvo Autônomos',
        })
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Contact created successfully',
        expect.any(Object)
      );

      // Reset
      (SYNC_FLAGS as any).CREATE_CONTACT_ON_CLIENT_CREATE = false;
    });

    it('should handle errors gracefully (not throw)', async () => {
      (SYNC_FLAGS as any).CREATE_CONTACT_ON_CLIENT_CREATE = true;
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === '@auvo:contact_sync_enabled') return Promise.resolve('true');
        return Promise.resolve(null);
      });
      (Contacts.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (Contacts.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (Contacts.getContactsAsync as jest.Mock).mockResolvedValue({ data: [] });
      (Contacts.addContactAsync as jest.Mock).mockRejectedValue(new Error('Device error'));

      const result = await DeviceContactsService.createContact({
        name: 'João Silva',
        phone: '11999999999',
      });

      expect(result).toEqual({
        success: false,
        error: 'Device error',
      });
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to create contact',
        expect.any(Error),
        expect.any(Object)
      );

      // Reset
      (SYNC_FLAGS as any).CREATE_CONTACT_ON_CLIENT_CREATE = false;
    });
  });

  // ===========================================================================
  // onClientCreated (integration point)
  // ===========================================================================

  describe('onClientCreated', () => {
    it('should not do anything when phone is null', async () => {
      await DeviceContactsService.onClientCreated({ name: 'João', phone: null });

      expect(Contacts.addContactAsync).not.toHaveBeenCalled();
    });

    it('should not do anything when phone is undefined', async () => {
      await DeviceContactsService.onClientCreated({ name: 'João', phone: undefined });

      expect(Contacts.addContactAsync).not.toHaveBeenCalled();
    });

    it('should not do anything when phone is empty string', async () => {
      await DeviceContactsService.onClientCreated({ name: 'João', phone: '' });

      // Even if it calls createContact internally, it will skip due to empty phone
      // The onClientCreated itself returns early for falsy phones
      expect(Contacts.addContactAsync).not.toHaveBeenCalled();
    });

    it('should not throw even if createContact throws', async () => {
      (SYNC_FLAGS as any).CREATE_CONTACT_ON_CLIENT_CREATE = true;
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      // Should not throw
      await expect(
        DeviceContactsService.onClientCreated({ name: 'João', phone: '11999999999' })
      ).resolves.not.toThrow();

      // Reset
      (SYNC_FLAGS as any).CREATE_CONTACT_ON_CLIENT_CREATE = false;
    });
  });
});

// =============================================================================
// TESTS: Integration with ClientService (critical requirement)
// =============================================================================

describe('ClientService + DeviceContactsService Integration', () => {
  it('should not break client creation when contacts fail', async () => {
    // This test verifies the critical requirement:
    // "Falha na agenda não impede criação do cliente"

    // The DeviceContactsService.onClientCreated is called with .catch()
    // in ClientService, so even if it throws, the client creation continues.

    // We mock createContact to throw
    const originalCreateContact = DeviceContactsService.createContact;
    DeviceContactsService.createContact = jest.fn().mockRejectedValue(
      new Error('Catastrophic failure')
    );

    // onClientCreated should not propagate the error
    await expect(
      DeviceContactsService.onClientCreated(
        { name: 'João', phone: '11999999999' },
        'Company'
      )
    ).resolves.not.toThrow();

    // Restore
    DeviceContactsService.createContact = originalCreateContact;
  });
});
