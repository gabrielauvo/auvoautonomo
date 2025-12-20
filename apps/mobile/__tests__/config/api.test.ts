/**
 * API Config Tests
 *
 * Testes para configuração da API.
 */

import { getApiBaseUrl, buildApiUrl } from '../../src/config/api';

describe('API Configuration', () => {
  describe('getApiBaseUrl', () => {
    it('should return API base URL', () => {
      const url = getApiBaseUrl();

      expect(typeof url).toBe('string');
      expect(url.length).toBeGreaterThan(0);
      expect(url).toMatch(/^https?:\/\//);
    });
  });

  describe('buildApiUrl', () => {
    it('should build URL with path starting with slash', () => {
      const baseUrl = getApiBaseUrl();
      const url = buildApiUrl('/users');

      expect(url).toBe(`${baseUrl}/users`);
    });

    it('should build URL adding slash to path', () => {
      const baseUrl = getApiBaseUrl();
      const url = buildApiUrl('users');

      expect(url).toBe(`${baseUrl}/users`);
    });

    it('should build URL with nested path', () => {
      const baseUrl = getApiBaseUrl();
      const url = buildApiUrl('/api/v1/users');

      expect(url).toBe(`${baseUrl}/api/v1/users`);
    });

    it('should handle empty path', () => {
      const baseUrl = getApiBaseUrl();
      const url = buildApiUrl('');

      expect(url).toBe(`${baseUrl}/`);
    });

    it('should handle path with query string', () => {
      const baseUrl = getApiBaseUrl();
      const url = buildApiUrl('/search?q=test');

      expect(url).toBe(`${baseUrl}/search?q=test`);
    });

    it('should handle multiple path segments', () => {
      const baseUrl = getApiBaseUrl();
      const url = buildApiUrl('/api/v1/clients/123/orders');

      expect(url).toBe(`${baseUrl}/api/v1/clients/123/orders`);
    });

    it('should not add extra slash when path starts with slash', () => {
      const url = buildApiUrl('/test');

      expect(url).not.toContain('//test');
    });
  });
});
