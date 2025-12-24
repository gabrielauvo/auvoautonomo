import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption/encryption.service';
import {
  GoogleLocationDto,
  GoogleIntegrationStatusDto,
} from './dto/google-oauth.dto';
import { GoogleIntegrationStatus } from '@prisma/client';
import * as crypto from 'crypto';

// Google OAuth2 endpoints
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_BUSINESS_API_URL = 'https://mybusinessbusinessinformation.googleapis.com/v1';

// Required scopes for Google Business Profile
const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/business.manage',
];

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface GoogleAccountInfo {
  accounts: Array<{
    name: string;
    accountName: string;
    type: string;
    verificationState: string;
  }>;
}

interface GoogleLocationsResponse {
  locations: Array<{
    name: string;
    title: string;
    storefrontAddress?: {
      addressLines?: string[];
      locality?: string;
      administrativeArea?: string;
    };
    phoneNumbers?: {
      primaryPhone?: string;
    };
  }>;
}

@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {
    this.clientId = this.configService.get<string>('GOOGLE_BUSINESS_CLIENT_ID', '');
    this.clientSecret = this.configService.get<string>('GOOGLE_BUSINESS_CLIENT_SECRET', '');
    this.redirectUri = this.configService.get<string>(
      'GOOGLE_BUSINESS_REDIRECT_URI',
      'http://localhost:3000/api/google-business/callback',
    );

    if (!this.clientId || !this.clientSecret) {
      this.logger.warn(
        'Google Business OAuth not configured. Set GOOGLE_BUSINESS_CLIENT_ID and GOOGLE_BUSINESS_CLIENT_SECRET.',
      );
    }
  }

  /**
   * Check if Google Business OAuth is configured
   */
  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  /**
   * Generate OAuth URL for user consent
   */
  generateAuthUrl(userId: string, redirectUrl?: string): { url: string; state: string } {
    if (!this.isConfigured()) {
      throw new BadRequestException('Google Business OAuth not configured');
    }

    // Generate state parameter with userId and optional redirect
    const stateData = {
      userId,
      redirectUrl,
      nonce: crypto.randomBytes(16).toString('hex'),
    };
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64url');

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: REQUIRED_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return {
      url: `${GOOGLE_AUTH_URL}?${params.toString()}`,
      state,
    };
  }

  /**
   * Handle OAuth callback - exchange code for tokens
   */
  async handleCallback(code: string, state: string): Promise<{ userId: string; redirectUrl?: string }> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Google Business OAuth not configured');
    }

    // Parse state to get userId
    let stateData: { userId: string; redirectUrl?: string };
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    } catch {
      throw new BadRequestException('Invalid state parameter');
    }

    const { userId, redirectUrl } = stateData;

    // Exchange code for tokens
    const tokenResponse = await this.exchangeCodeForTokens(code);

    // Create or update integration
    await this.prisma.$transaction(async (tx) => {
      // Upsert integration
      const integration = await tx.googleIntegration.upsert({
        where: { userId },
        create: {
          userId,
          status: GoogleIntegrationStatus.PENDING,
          scopes: tokenResponse.scope.split(' '),
        },
        update: {
          status: GoogleIntegrationStatus.PENDING,
          scopes: tokenResponse.scope.split(' '),
          lastSyncError: null,
        },
      });

      // Calculate expiration time
      const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

      // Encrypt tokens
      const accessTokenEnc = this.encryptionService.encrypt(tokenResponse.access_token);
      const refreshTokenEnc = tokenResponse.refresh_token
        ? this.encryptionService.encrypt(tokenResponse.refresh_token)
        : null;

      if (!refreshTokenEnc) {
        this.logger.warn(`No refresh token received for user ${userId}`);
      }

      // Upsert token
      await tx.googleToken.upsert({
        where: { integrationId: integration.id },
        create: {
          integrationId: integration.id,
          accessTokenEnc,
          refreshTokenEnc: refreshTokenEnc || accessTokenEnc, // Fallback if no refresh token
          expiresAt,
        },
        update: {
          accessTokenEnc,
          refreshTokenEnc: refreshTokenEnc || undefined,
          expiresAt,
        },
      });
    });

    this.logger.log(`OAuth completed for user ${userId}`);
    return { userId, redirectUrl };
  }

  /**
   * Exchange authorization code for tokens
   */
  private async exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.redirectUri,
    });

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Token exchange failed: ${error}`);
      throw new BadRequestException('Failed to exchange authorization code');
    }

    return response.json();
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(userId: string): Promise<string> {
    const integration = await this.prisma.googleIntegration.findUnique({
      where: { userId },
      include: { token: true },
    });

    if (!integration?.token) {
      throw new NotFoundException('Google integration not found');
    }

    const refreshToken = this.encryptionService.decrypt(integration.token.refreshTokenEnc);

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Token refresh failed for user ${userId}: ${error}`);

      // Mark integration as revoked if refresh fails
      await this.prisma.googleIntegration.update({
        where: { userId },
        data: {
          status: GoogleIntegrationStatus.REVOKED,
          lastSyncError: 'Token refresh failed - re-authentication required',
        },
      });

      throw new UnauthorizedException('Token refresh failed');
    }

    const tokenData: GoogleTokenResponse = await response.json();
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    // Update token in database
    await this.prisma.googleToken.update({
      where: { integrationId: integration.id },
      data: {
        accessTokenEnc: this.encryptionService.encrypt(tokenData.access_token),
        expiresAt,
      },
    });

    return tokenData.access_token;
  }

  /**
   * Get valid access token (refresh if needed)
   */
  async getValidAccessToken(userId: string): Promise<string> {
    const integration = await this.prisma.googleIntegration.findUnique({
      where: { userId },
      include: { token: true },
    });

    if (!integration?.token) {
      throw new NotFoundException('Google integration not found');
    }

    // Check if token is expired or about to expire (5 min buffer)
    const isExpired = integration.token.expiresAt.getTime() < Date.now() + 5 * 60 * 1000;

    if (isExpired) {
      return this.refreshAccessToken(userId);
    }

    return this.encryptionService.decrypt(integration.token.accessTokenEnc);
  }

  /**
   * Get available Google Business locations for user
   */
  async getLocations(userId: string): Promise<GoogleLocationDto[]> {
    const accessToken = await this.getValidAccessToken(userId);

    // First, get accounts
    const accountsResponse = await fetch(
      `${GOOGLE_BUSINESS_API_URL}/accounts`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!accountsResponse.ok) {
      const error = await accountsResponse.text();
      this.logger.error(`Failed to get accounts: ${error}`);
      throw new BadRequestException('Failed to get Google Business accounts');
    }

    const accountsData: GoogleAccountInfo = await accountsResponse.json();

    if (!accountsData.accounts?.length) {
      return [];
    }

    // Get locations from first account (most common case)
    const accountName = accountsData.accounts[0].name;
    const locationsResponse = await fetch(
      `${GOOGLE_BUSINESS_API_URL}/${accountName}/locations`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!locationsResponse.ok) {
      const error = await locationsResponse.text();
      this.logger.error(`Failed to get locations: ${error}`);
      throw new BadRequestException('Failed to get Google Business locations');
    }

    const locationsData: GoogleLocationsResponse = await locationsResponse.json();

    return (locationsData.locations || []).map((loc) => ({
      locationId: loc.name,
      name: loc.title,
      address: this.formatAddress(loc.storefrontAddress),
      phoneNumber: loc.phoneNumbers?.primaryPhone,
    }));
  }

  private formatAddress(address?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
  }): string | undefined {
    if (!address) return undefined;

    const parts = [
      ...(address.addressLines || []),
      address.locality,
      address.administrativeArea,
    ].filter(Boolean);

    return parts.length ? parts.join(', ') : undefined;
  }

  /**
   * Select a location for the integration
   */
  async selectLocation(userId: string, locationId: string): Promise<void> {
    const integration = await this.prisma.googleIntegration.findUnique({
      where: { userId },
    });

    if (!integration) {
      throw new NotFoundException('Google integration not found');
    }

    // Verify location exists and user has access
    const locations = await this.getLocations(userId);
    const location = locations.find((l) => l.locationId === locationId);

    if (!location) {
      throw new BadRequestException('Invalid location ID');
    }

    await this.prisma.googleIntegration.update({
      where: { userId },
      data: {
        googleLocationId: locationId,
        googleLocationName: location.name,
        status: GoogleIntegrationStatus.CONNECTED,
        lastSyncError: null,
      },
    });

    this.logger.log(`Location selected for user ${userId}: ${location.name}`);
  }

  /**
   * Get integration status
   */
  async getStatus(userId: string): Promise<GoogleIntegrationStatusDto> {
    const integration = await this.prisma.googleIntegration.findUnique({
      where: { userId },
    });

    if (!integration) {
      return {
        status: 'DISCONNECTED',
        isConnected: false,
      };
    }

    return {
      status: integration.status,
      googleLocationName: integration.googleLocationName || undefined,
      lastSyncAt: integration.lastSyncAt || undefined,
      lastSyncError: integration.lastSyncError || undefined,
      isConnected: integration.status === GoogleIntegrationStatus.CONNECTED,
    };
  }

  /**
   * Disconnect integration
   */
  async disconnect(userId: string): Promise<void> {
    const integration = await this.prisma.googleIntegration.findUnique({
      where: { userId },
    });

    if (!integration) {
      throw new NotFoundException('Google integration not found');
    }

    await this.prisma.$transaction([
      this.prisma.googleToken.deleteMany({
        where: { integrationId: integration.id },
      }),
      this.prisma.googleIntegration.delete({
        where: { userId },
      }),
    ]);

    this.logger.log(`Integration disconnected for user ${userId}`);
  }

  /**
   * Update integration status after sync
   */
  async updateSyncStatus(
    userId: string,
    success: boolean,
    error?: string,
  ): Promise<void> {
    await this.prisma.googleIntegration.update({
      where: { userId },
      data: {
        lastSyncAt: new Date(),
        lastSyncError: success ? null : error,
        status: success
          ? GoogleIntegrationStatus.CONNECTED
          : GoogleIntegrationStatus.ERROR,
      },
    });
  }
}
