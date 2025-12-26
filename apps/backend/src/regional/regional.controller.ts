import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RegionalService } from './regional.service';
import { RegionalDataService } from './regional-data.service';
import { UpdateRegionalSettingsDto } from './dto/update-regional-settings.dto';
import {
  RegionalSettingsDto,
  CountryListItemDto,
  CountriesByRegionDto,
  TimezoneListDto,
  CurrencyListItemDto,
} from './dto/regional-settings.dto';

interface AuthRequest extends Request {
  user: { userId: string };
}

@ApiTags('Regional Settings')
@Controller('settings/regional')
export class RegionalController {
  constructor(
    private readonly regionalService: RegionalService,
    private readonly regionalDataService: RegionalDataService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get company regional settings' })
  @ApiResponse({
    status: 200,
    description: 'Regional settings retrieved successfully',
    type: RegionalSettingsDto,
  })
  async getRegionalSettings(
    @Req() req: AuthRequest,
  ): Promise<RegionalSettingsDto> {
    return this.regionalService.getCompanySettings(req.user.userId);
  }

  @Put()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update company regional settings' })
  @ApiResponse({
    status: 200,
    description: 'Regional settings updated successfully',
    type: RegionalSettingsDto,
  })
  async updateRegionalSettings(
    @Req() req: AuthRequest,
    @Body() dto: UpdateRegionalSettingsDto,
  ): Promise<RegionalSettingsDto> {
    return this.regionalService.updateCompanySettings(req.user.userId, dto);
  }

  @Get('countries')
  @ApiOperation({ summary: 'Get all available countries' })
  @ApiResponse({
    status: 200,
    description: 'List of all Americas countries',
    type: [CountryListItemDto],
  })
  getAllCountries(): CountryListItemDto[] {
    return this.regionalDataService.getAllCountries().map((c) => ({
      code: c.code,
      name: c.name,
      localName: c.localName,
      currency: c.currency,
      currencySymbol: c.currencySymbol,
      timezone: c.timezone,
      flag: c.flag,
      region: c.region,
    }));
  }

  @Get('countries/by-region')
  @ApiOperation({ summary: 'Get countries grouped by region' })
  @ApiResponse({
    status: 200,
    description: 'Countries grouped by Americas region',
    type: CountriesByRegionDto,
  })
  getCountriesByRegion(): CountriesByRegionDto {
    const grouped = this.regionalDataService.getCountriesByRegion();
    const mapCountry = (c: any): CountryListItemDto => ({
      code: c.code,
      name: c.name,
      localName: c.localName,
      currency: c.currency,
      currencySymbol: c.currencySymbol,
      timezone: c.timezone,
      flag: c.flag,
      region: c.region,
    });

    return {
      north_america: grouped.north_america.map(mapCountry),
      central_america: grouped.central_america.map(mapCountry),
      caribbean: grouped.caribbean.map(mapCountry),
      south_america: grouped.south_america.map(mapCountry),
    };
  }

  @Get('timezones/:countryCode')
  @ApiOperation({ summary: 'Get timezones for a specific country' })
  @ApiParam({
    name: 'countryCode',
    description: 'ISO 3166-1 alpha-2 country code',
    example: 'BR',
  })
  @ApiResponse({
    status: 200,
    description: 'List of timezones for the country',
    type: TimezoneListDto,
  })
  getTimezonesByCountry(
    @Param('countryCode') countryCode: string,
  ): TimezoneListDto {
    return {
      countryCode: countryCode.toUpperCase(),
      timezones: this.regionalDataService.getTimezonesByCountry(countryCode),
    };
  }

  @Get('currencies')
  @ApiOperation({ summary: 'Get all available currencies' })
  @ApiResponse({
    status: 200,
    description: 'List of all currencies used in the Americas',
    type: [CurrencyListItemDto],
  })
  getAllCurrencies(): CurrencyListItemDto[] {
    return this.regionalDataService.getAllCurrencies();
  }
}
