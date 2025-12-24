import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Body,
  UseGuards,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUserId } from '../auth/decorators/get-user-id.decorator';
import { GoogleOAuthService } from './google-oauth.service';
import {
  InitiateOAuthDto,
  GoogleOAuthCallbackDto,
  SelectLocationDto,
  GoogleIntegrationStatusDto,
  OAuthUrlResponseDto,
  LocationListResponseDto,
} from './dto/google-oauth.dto';

@ApiTags('google-business')
@Controller('google-business')
export class GoogleOAuthController {
  constructor(private readonly oauthService: GoogleOAuthService) {}

  @Get('oauth/url')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get OAuth URL to connect Google Business Profile' })
  @ApiResponse({ status: 200, type: OAuthUrlResponseDto })
  getOAuthUrl(
    @GetUserId() userId: string,
    @Query() dto: InitiateOAuthDto,
  ): OAuthUrlResponseDto {
    return this.oauthService.generateAuthUrl(userId, dto.redirectUrl);
  }

  @Get('oauth/callback')
  @ApiOperation({ summary: 'OAuth callback endpoint (called by Google)' })
  @ApiResponse({ status: 302, description: 'Redirects to frontend' })
  async handleCallback(
    @Query() dto: GoogleOAuthCallbackDto,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const { userId, redirectUrl } = await this.oauthService.handleCallback(
        dto.code,
        dto.state || '',
      );

      // Redirect to frontend with success
      const baseUrl = redirectUrl || process.env.FRONTEND_URL || 'http://localhost:3001';
      const successUrl = `${baseUrl}/settings/integrations?google=success`;
      res.redirect(successUrl);
    } catch (error) {
      // Redirect to frontend with error
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      const errorUrl = `${baseUrl}/settings/integrations?google=error&message=${encodeURIComponent(error.message)}`;
      res.redirect(errorUrl);
    }
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Google Business integration status' })
  @ApiResponse({ status: 200, type: GoogleIntegrationStatusDto })
  getStatus(@GetUserId() userId: string): Promise<GoogleIntegrationStatusDto> {
    return this.oauthService.getStatus(userId);
  }

  @Get('locations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get available Google Business locations' })
  @ApiResponse({ status: 200, type: LocationListResponseDto })
  async getLocations(@GetUserId() userId: string): Promise<LocationListResponseDto> {
    const locations = await this.oauthService.getLocations(userId);
    return { locations };
  }

  @Post('locations/select')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Select a Google Business location to track' })
  @ApiResponse({ status: 204, description: 'Location selected successfully' })
  async selectLocation(
    @GetUserId() userId: string,
    @Body() dto: SelectLocationDto,
  ): Promise<void> {
    await this.oauthService.selectLocation(userId, dto.locationId);
  }

  @Delete('disconnect')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Disconnect Google Business integration' })
  @ApiResponse({ status: 204, description: 'Disconnected successfully' })
  async disconnect(@GetUserId() userId: string): Promise<void> {
    await this.oauthService.disconnect(userId);
  }

  @Get('configured')
  @ApiOperation({ summary: 'Check if Google Business OAuth is configured' })
  @ApiResponse({ status: 200 })
  isConfigured(): { configured: boolean } {
    return { configured: this.oauthService.isConfigured() };
  }
}
