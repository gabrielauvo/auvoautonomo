import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegionalDataService, CountryInfo } from './regional-data.service';
import { UpdateRegionalSettingsDto } from './dto/update-regional-settings.dto';
import { RegionalSettingsDto } from './dto/regional-settings.dto';

/**
 * Service for managing company-level regional settings
 */
@Injectable()
export class RegionalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly regionalData: RegionalDataService,
  ) {}

  /**
   * Get the regional settings for a company (user's subscription)
   */
  async getCompanySettings(userId: string): Promise<RegionalSettingsDto> {
    const subscription = await this.prisma.userSubscription.findUnique({
      where: { userId },
      select: {
        country: true,
        currency: true,
        timezone: true,
      },
    });

    // Default to Brazil if no subscription or settings
    const countryCode = subscription?.country || 'BR';
    const countryInfo = this.regionalData.getCountryByCode(countryCode);

    return {
      country: countryCode,
      currency: subscription?.currency || countryInfo?.currency || 'BRL',
      timezone:
        subscription?.timezone || countryInfo?.timezone || 'America/Sao_Paulo',
      countryInfo,
    };
  }

  /**
   * Update the regional settings for a company
   * When country changes, auto-fills currency and timezone unless explicitly overridden
   */
  async updateCompanySettings(
    userId: string,
    dto: UpdateRegionalSettingsDto,
  ): Promise<RegionalSettingsDto> {
    // Validate country code if provided
    if (dto.country && !this.regionalData.isValidCountryCode(dto.country)) {
      throw new BadRequestException(
        `Invalid country code: ${dto.country}. Must be a valid ISO 3166-1 alpha-2 code.`,
      );
    }

    // Get current settings
    const currentSettings = await this.getCompanySettings(userId);

    // Determine new values
    let newCountry = dto.country || currentSettings.country;
    let newCurrency = dto.currency;
    let newTimezone = dto.timezone;

    // If country is changing and currency/timezone not explicitly provided,
    // auto-fill with country defaults
    if (dto.country && dto.country !== currentSettings.country) {
      const countryDefaults =
        this.regionalData.getDefaultSettingsForCountry(dto.country);
      if (countryDefaults) {
        if (!dto.currency) {
          newCurrency = countryDefaults.currency;
        }
        if (!dto.timezone) {
          newTimezone = countryDefaults.timezone;
        }
      }
    }

    // Validate timezone if provided
    if (newTimezone) {
      // Check if it's a valid IANA timezone (basic validation)
      try {
        Intl.DateTimeFormat(undefined, { timeZone: newTimezone });
      } catch {
        throw new BadRequestException(
          `Invalid timezone: ${newTimezone}. Must be a valid IANA timezone identifier.`,
        );
      }
    }

    // Update subscription
    await this.prisma.userSubscription.update({
      where: { userId },
      data: {
        country: newCountry,
        currency: newCurrency || currentSettings.currency,
        timezone: newTimezone || currentSettings.timezone,
      },
    });

    // Return updated settings
    return this.getCompanySettings(userId);
  }

  /**
   * Get the currency for a user (to be used when creating new records)
   */
  async getCompanyCurrency(userId: string): Promise<string> {
    const settings = await this.getCompanySettings(userId);
    return settings.currency;
  }

  /**
   * Get the timezone for a user (to be used in schedule queries)
   */
  async getCompanyTimezone(userId: string): Promise<string> {
    const settings = await this.getCompanySettings(userId);
    return settings.timezone;
  }

  /**
   * Get country info for a user
   */
  async getCompanyCountryInfo(userId: string): Promise<CountryInfo | undefined> {
    const settings = await this.getCompanySettings(userId);
    return settings.countryInfo;
  }
}
