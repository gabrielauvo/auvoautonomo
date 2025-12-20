/**
 * Tests for AuthService
 */

import { AuthService, User, AuthTokens } from '../../src/services/AuthService';
import * as SecureStore from 'expo-secure-store';

// Mock SecureStore
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(() => Promise.resolve()),
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

// Mock fetch
global.fetch = jest.fn();

const mockFetch = global.fetch as jest.Mock;

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveTokens', () => {
    it('should save access and refresh tokens', async () => {
      const tokens: AuthTokens = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
      };

      await AuthService.saveTokens(tokens);

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'auth_access_token',
        'access-token-123'
      );
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'auth_refresh_token',
        'refresh-token-456'
      );
    });
  });

  describe('getAccessToken', () => {
    it('should return stored access token', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('stored-token');

      const token = await AuthService.getAccessToken();

      expect(token).toBe('stored-token');
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith('auth_access_token');
    });

    it('should return null when no token stored', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);

      const token = await AuthService.getAccessToken();

      expect(token).toBeNull();
    });
  });

  describe('getRefreshToken', () => {
    it('should return stored refresh token', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('refresh-token');

      const token = await AuthService.getRefreshToken();

      expect(token).toBe('refresh-token');
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith('auth_refresh_token');
    });
  });

  describe('saveUser', () => {
    it('should save all user fields', async () => {
      const user: User = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        technicianId: 'tech-456',
      };

      await AuthService.saveUser(user);

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('auth_user_id', 'user-123');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('auth_user_email', 'test@example.com');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('auth_user_name', 'Test User');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('auth_technician_id', 'tech-456');
    });
  });

  describe('getUser', () => {
    it('should return user when all fields are stored', async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce('user-123')      // id
        .mockResolvedValueOnce('test@example.com')  // email
        .mockResolvedValueOnce('Test User')     // name
        .mockResolvedValueOnce('tech-456');     // technicianId

      const user = await AuthService.getUser();

      expect(user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        technicianId: 'tech-456',
      });
    });

    it('should return null when any field is missing', async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce('user-123')
        .mockResolvedValueOnce(null)  // email missing
        .mockResolvedValueOnce('Test User')
        .mockResolvedValueOnce('tech-456');

      const user = await AuthService.getUser();

      expect(user).toBeNull();
    });
  });

  describe('clearAll', () => {
    it('should delete all stored keys', async () => {
      await AuthService.clearAll();

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_access_token');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_refresh_token');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_user_id');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_user_email');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_user_name');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_technician_id');
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when access token exists', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('token');

      const result = await AuthService.isAuthenticated();

      expect(result).toBe(true);
    });

    it('should return false when no access token', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);

      const result = await AuthService.isAuthenticated();

      expect(result).toBe(false);
    });
  });

  describe('login', () => {
    it('should login successfully and save credentials', async () => {
      const mockResponse = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        user: {
          id: 'user-id',
          email: 'user@example.com',
          name: 'User Name',
          technicianId: 'tech-id',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await AuthService.login('user@example.com', 'password', 'http://api.com');

      expect(mockFetch).toHaveBeenCalledWith('http://api.com/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', password: 'password' }),
      });

      expect(result.user.email).toBe('user@example.com');
      expect(result.tokens.accessToken).toBe('new-access-token');

      // Should save tokens
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('auth_access_token', 'new-access-token');
    });

    it('should throw error on login failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: 'Invalid credentials' }),
      });

      await expect(
        AuthService.login('user@example.com', 'wrong-password', 'http://api.com')
      ).rejects.toThrow('Invalid credentials');
    });

    it('should handle login failure without message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.reject(new Error('Parse error')),
      });

      await expect(
        AuthService.login('user@example.com', 'password', 'http://api.com')
      ).rejects.toThrow('Falha no login');
    });
  });

  describe('logout', () => {
    it('should clear all stored data', async () => {
      await AuthService.logout();

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(6);
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh token successfully', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('old-refresh-token');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
        }),
      });

      const newToken = await AuthService.refreshAccessToken('http://api.com');

      expect(newToken).toBe('new-access-token');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('auth_access_token', 'new-access-token');
    });

    it('should return null when no refresh token', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);

      const result = await AuthService.refreshAccessToken('http://api.com');

      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should clear credentials on refresh failure', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('old-refresh-token');

      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const result = await AuthService.refreshAccessToken('http://api.com');

      expect(result).toBeNull();
      expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
    });

    it('should return null on network error', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('old-refresh-token');

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await AuthService.refreshAccessToken('http://api.com');

      expect(result).toBeNull();
    });
  });
});
