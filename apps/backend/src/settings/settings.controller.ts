import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SettingsService } from './settings.service';
import {
  UpdateQuoteTemplateDto,
  UpdateWorkOrderTemplateDto,
  UpdateChargeTemplateDto,
} from './dto/update-template.dto';
import { UpdateProfileDto, ChangePasswordDto } from './dto/update-profile.dto';
import { PrismaService } from '../prisma/prisma.service';
import { PlanLimitsService } from '../billing/plan-limits.service';
import * as bcrypt from 'bcrypt';
import {
  StorageProvider,
  STORAGE_PROVIDER,
} from '../file-storage/providers/storage-provider.interface';
import { randomUUID } from 'crypto';
import * as path from 'path';

interface AuthRequest {
  user: { userId: string; id: string };
}

interface MulterFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
  fieldname: string;
  encoding: string;
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB

/**
 * Convert relative URLs to absolute URLs for external access (mobile apps, etc.)
 */
function toAbsoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  // Already absolute URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Relative URL - prepend BASE_URL
  // Fallback to Railway URL if not set
  let baseUrl = process.env.BASE_URL || process.env.API_URL || '';
  if (!baseUrl && process.env.RAILWAY_PUBLIC_DOMAIN) {
    baseUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  if (!baseUrl) {
    baseUrl = 'https://monorepobackend-production.up.railway.app';
  }

  if (url.startsWith('/')) {
    return `${baseUrl}${url}`;
  }

  return url;
}

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  private readonly logger = new Logger(SettingsController.name);

  constructor(
    private readonly settingsService: SettingsService,
    private readonly prisma: PrismaService,
    private readonly planLimitsService: PlanLimitsService,
    @Inject(STORAGE_PROVIDER)
    private readonly storageProvider: StorageProvider,
  ) {}

  // ==================== PROFILE SETTINGS ====================

  /**
   * GET /settings/profile
   * Get user profile
   */
  @Get('profile')
  async getProfile(@Req() req: AuthRequest) {
    const userId = req.user.userId;
    this.logger.log(`[GET PROFILE] Fetching profile for userId: ${userId}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        language: true,
        timezone: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new BadRequestException('Usuário não encontrado');
    }

    return {
      id: user.id,
      name: user.name || '',
      email: user.email,
      phone: user.phone || '',
      language: user.language || 'pt-BR',
      timezone: user.timezone || 'America/Sao_Paulo',
      avatarUrl: toAbsoluteUrl(user.avatarUrl),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  /**
   * PUT /settings/profile
   * Update user profile
   */
  @Put('profile')
  async updateProfile(
    @Req() req: AuthRequest,
    @Body() dto: UpdateProfileDto,
  ) {
    const userId = req.user.userId;
    this.logger.log(`[UPDATE PROFILE] Updating profile for userId: ${userId}`);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.language !== undefined && { language: dto.language }),
        ...(dto.timezone !== undefined && { timezone: dto.timezone }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        language: true,
        timezone: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      id: user.id,
      name: user.name || '',
      email: user.email,
      phone: user.phone || '',
      language: user.language || 'pt-BR',
      timezone: user.timezone || 'America/Sao_Paulo',
      avatarUrl: toAbsoluteUrl(user.avatarUrl),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  /**
   * POST /settings/change-password
   * Change user password
   */
  @Post('change-password')
  async changePassword(
    @Req() req: AuthRequest,
    @Body() dto: ChangePasswordDto,
  ) {
    const userId = req.user.userId;
    this.logger.log(`[CHANGE PASSWORD] Changing password for userId: ${userId}`);

    // Validate passwords match
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('As senhas não conferem');
    }

    // Get current user with password
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    });

    if (!user) {
      throw new BadRequestException('Usuário não encontrado');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException('Senha atual incorreta');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    // Update password
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { success: true, message: 'Senha alterada com sucesso' };
  }

  /**
   * POST /settings/profile/avatar
   * Upload user avatar
   */
  @Post('profile/avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  async uploadAvatar(
    @Req() req: AuthRequest,
    @UploadedFile() file: MulterFile,
  ) {
    const userId = req.user.userId;
    this.logger.log(`[AVATAR UPLOAD] Starting upload for userId: ${userId}`);

    if (!file) {
      this.logger.warn(`[AVATAR UPLOAD] No file received`);
      throw new BadRequestException('Nenhum arquivo enviado');
    }

    this.logger.log(`[AVATAR UPLOAD] File received: ${file.originalname}, size: ${file.size}, type: ${file.mimetype}`);

    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Tipo de arquivo não permitido. Use PNG, JPG ou WebP.',
      );
    }

    // Validate file size
    if (file.size > MAX_LOGO_SIZE) {
      throw new BadRequestException('Arquivo muito grande. Máximo 2MB.');
    }

    // Delete old avatar if exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    if (user?.avatarUrl && this.storageProvider.delete) {
      try {
        const oldPath = this.extractPathFromUrl(user.avatarUrl);
        if (oldPath) {
          this.logger.log(`[AVATAR UPLOAD] Deleting old avatar: ${oldPath}`);
          await this.storageProvider.delete(oldPath);
        }
      } catch (error) {
        this.logger.warn(`[AVATAR UPLOAD] Error deleting old avatar: ${error}`);
      }
    }

    // Generate unique filename
    const fileId = randomUUID();
    const ext = path.extname(file.originalname) || this.getExtensionFromMime(file.mimetype);
    const fileName = `avatar_${fileId}${ext}`;

    // Build storage path
    const storagePath = `avatars/${userId}`;
    this.logger.log(`[AVATAR UPLOAD] Uploading to path: ${storagePath}/${fileName}`);

    // Upload to storage provider
    const uploadResult = await this.storageProvider.upload({
      buffer: file.buffer,
      mimeType: file.mimetype,
      path: storagePath,
      fileName,
    });

    // Update user with new avatar URL
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: uploadResult.publicUrl },
      select: { id: true, avatarUrl: true },
    });

    return { avatarUrl: uploadResult.publicUrl };
  }

  /**
   * DELETE /settings/profile/avatar
   * Delete user avatar
   */
  @Delete('profile/avatar')
  async deleteAvatar(@Req() req: AuthRequest) {
    const userId = req.user.userId;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    if (user?.avatarUrl && this.storageProvider.delete) {
      try {
        const oldPath = this.extractPathFromUrl(user.avatarUrl);
        if (oldPath) {
          await this.storageProvider.delete(oldPath);
        }
      } catch (error) {
        // Ignore deletion errors
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
    });

    return { success: true, message: 'Avatar removido com sucesso' };
  }

  // ==================== TEMPLATE SETTINGS ====================

  /**
   * GET /settings/templates
   * Get all template settings
   */
  @Get('templates')
  async getTemplateSettings(@Req() req: AuthRequest) {
    const userId = req.user.userId;
    return this.settingsService.getTemplateSettings(userId);
  }

  /**
   * PUT /settings/templates/quote
   * Update quote template
   */
  @Put('templates/quote')
  async updateQuoteTemplate(
    @Req() req: AuthRequest,
    @Body() dto: UpdateQuoteTemplateDto,
  ) {
    const userId = req.user.userId;
    return this.settingsService.updateQuoteTemplate(userId, dto);
  }

  /**
   * PUT /settings/templates/work-order
   * Update work order template
   */
  @Put('templates/work-order')
  async updateWorkOrderTemplate(
    @Req() req: AuthRequest,
    @Body() dto: UpdateWorkOrderTemplateDto,
  ) {
    const userId = req.user.userId;
    return this.settingsService.updateWorkOrderTemplate(userId, dto);
  }

  /**
   * PUT /settings/templates/charge
   * Update charge template
   */
  @Put('templates/charge')
  async updateChargeTemplate(
    @Req() req: AuthRequest,
    @Body() dto: UpdateChargeTemplateDto,
  ) {
    const userId = req.user.userId;
    return this.settingsService.updateChargeTemplate(userId, dto);
  }

  /**
   * POST /settings/templates/:type/reset
   * Reset template to default
   */
  @Post('templates/:type/reset')
  async resetTemplate(
    @Req() req: AuthRequest,
    @Param('type') type: 'quote' | 'workOrder' | 'charge',
  ) {
    const userId = req.user.userId;
    await this.settingsService.resetTemplate(userId, type);
    return { success: true, message: 'Template resetado com sucesso' };
  }

  // ==================== ACCEPTANCE TERMS ====================

  /**
   * GET /settings/acceptance-terms
   * Get acceptance terms configuration
   * Returns feature availability based on plan
   */
  @Get('acceptance-terms')
  async getAcceptanceTerms(@Req() req: AuthRequest) {
    const userId = req.user.userId;
    this.logger.log(`[GET ACCEPTANCE TERMS] Fetching for userId: ${userId}`);

    // Check if feature is available for this plan
    const featureCheck = await this.planLimitsService.checkFeature({
      userId,
      feature: 'ACCEPTANCE_TERMS',
    });

    // Get current settings
    const terms = await this.settingsService.getAcceptanceTerms(userId);

    return {
      ...terms,
      featureAvailable: featureCheck.available,
      planMessage: featureCheck.available ? null : featureCheck.message,
    };
  }

  /**
   * PUT /settings/acceptance-terms
   * Update acceptance terms configuration
   * Requires ACCEPTANCE_TERMS feature (paid plans only)
   */
  @Put('acceptance-terms')
  async updateAcceptanceTerms(
    @Req() req: AuthRequest,
    @Body() dto: { enabled?: boolean; termsContent?: string | null },
  ) {
    const userId = req.user.userId;
    this.logger.log(`[UPDATE ACCEPTANCE TERMS] Updating for userId: ${userId}`);

    // Check if feature is available (throws if not)
    await this.planLimitsService.checkFeatureOrThrow({
      userId,
      feature: 'ACCEPTANCE_TERMS',
    });

    // Update settings
    const terms = await this.settingsService.updateAcceptanceTerms(userId, dto);

    return {
      ...terms,
      featureAvailable: true,
    };
  }

  // ==================== COMPANY SETTINGS ====================

  /**
   * GET /settings/company
   * Get company settings
   * Returns format expected by frontend CompanySettings interface
   */
  @Get('company')
  async getCompanySettings(@Req() req: AuthRequest) {
    const userId = req.user.userId;
    this.logger.log(`[GET COMPANY] Fetching settings for userId: ${userId}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        companyName: true,
        companyLegalName: true,
        companyTaxId: true,
        companyStateRegistration: true,
        companyWhatsapp: true,
        companyAddress: true,
        companyBranding: true,
        companyLogoUrl: true,
        // Pix fields
        pixKey: true,
        pixKeyType: true,
        pixKeyOwnerName: true,
        pixKeyEnabled: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
        // Plan feature flag
        plan: {
          select: {
            usageLimits: {
              select: {
                enablePixKey: true,
              },
            },
          },
        },
      },
    });

    this.logger.log(`[GET COMPANY] User found: ${user?.id}, logoUrl: ${user?.companyLogoUrl}`);

    const defaultBranding = {
      primaryColor: '#7C3AED',
      secondaryColor: '#6D28D9',
      textColor: '#1F2937',
      backgroundColor: '#FFFFFF',
      accentColor: '#10B981',
    };

    // Check if Pix feature is enabled by plan (default true if no plan/limits)
    const planEnablesPixKey = user?.plan?.usageLimits?.enablePixKey ?? true;

    // Return format expected by frontend
    return {
      id: user?.id || '',
      tradeName: user?.companyName || '',
      legalName: user?.companyLegalName || null,
      taxId: user?.companyTaxId || null,
      stateRegistration: user?.companyStateRegistration || null,
      email: user?.email || '',
      phone: user?.phone || '',
      whatsapp: user?.companyWhatsapp || null,
      address: user?.companyAddress || null,
      logoUrl: toAbsoluteUrl(user?.companyLogoUrl),
      branding: user?.companyBranding || defaultBranding,
      // Pix settings
      pixKey: user?.pixKey || null,
      pixKeyType: user?.pixKeyType || null,
      pixKeyOwnerName: user?.pixKeyOwnerName || null,
      pixKeyEnabled: user?.pixKeyEnabled || false,
      // Feature flag from plan (controls UI visibility)
      pixKeyFeatureEnabled: planEnablesPixKey,
      createdAt: user?.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: user?.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }

  /**
   * PUT /settings/company
   * Update company settings
   * Accepts format from frontend UpdateCompanyDto
   */
  @Put('company')
  async updateCompanySettings(
    @Req() req: AuthRequest,
    @Body() dto: {
      tradeName?: string;
      companyName?: string; // Backwards compat
      phone?: string;
      legalName?: string;
      taxId?: string;
      stateRegistration?: string;
      email?: string;
      whatsapp?: string;
      address?: any;
      branding?: any;
      // Pix fields (optional)
      pixKey?: string | null;
      pixKeyType?: string | null;
      pixKeyOwnerName?: string | null;
      pixKeyEnabled?: boolean;
    },
  ) {
    const userId = req.user.userId;

    // Support both tradeName (new) and companyName (old)
    const companyName = dto.tradeName ?? dto.companyName;

    // Normalize Pix key if provided
    const normalizedPixKey = dto.pixKey !== undefined
      ? this.normalizePixKey(dto.pixKey, dto.pixKeyType)
      : undefined;

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(companyName !== undefined && { companyName }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.legalName !== undefined && { companyLegalName: dto.legalName }),
        ...(dto.taxId !== undefined && { companyTaxId: dto.taxId }),
        ...(dto.stateRegistration !== undefined && { companyStateRegistration: dto.stateRegistration }),
        ...(dto.whatsapp !== undefined && { companyWhatsapp: dto.whatsapp }),
        ...(dto.address !== undefined && { companyAddress: dto.address }),
        ...(dto.branding !== undefined && { companyBranding: dto.branding }),
        // Pix fields
        ...(normalizedPixKey !== undefined && { pixKey: normalizedPixKey }),
        ...(dto.pixKeyType !== undefined && { pixKeyType: dto.pixKeyType }),
        ...(dto.pixKeyOwnerName !== undefined && { pixKeyOwnerName: dto.pixKeyOwnerName }),
        ...(dto.pixKeyEnabled !== undefined && { pixKeyEnabled: dto.pixKeyEnabled }),
      },
      select: {
        id: true,
        companyName: true,
        companyLegalName: true,
        companyTaxId: true,
        companyStateRegistration: true,
        companyWhatsapp: true,
        companyAddress: true,
        companyBranding: true,
        companyLogoUrl: true,
        // Pix fields
        pixKey: true,
        pixKeyType: true,
        pixKeyOwnerName: true,
        pixKeyEnabled: true,
        phone: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        // Plan feature flag
        plan: {
          select: {
            usageLimits: {
              select: {
                enablePixKey: true,
              },
            },
          },
        },
      },
    });

    const defaultBranding = {
      primaryColor: '#7C3AED',
      secondaryColor: '#6D28D9',
      textColor: '#1F2937',
      backgroundColor: '#FFFFFF',
      accentColor: '#10B981',
    };

    // Check if Pix feature is enabled by plan (default true if no plan/limits)
    const planEnablesPixKey = user.plan?.usageLimits?.enablePixKey ?? true;

    // Return format expected by frontend
    return {
      id: user.id,
      tradeName: user.companyName || '',
      legalName: user.companyLegalName || null,
      taxId: user.companyTaxId || null,
      stateRegistration: user.companyStateRegistration || null,
      email: user.email || '',
      phone: user.phone || '',
      whatsapp: user.companyWhatsapp || null,
      address: user.companyAddress || null,
      logoUrl: toAbsoluteUrl(user.companyLogoUrl),
      branding: user.companyBranding || defaultBranding,
      // Pix settings
      pixKey: user.pixKey || null,
      pixKeyType: user.pixKeyType || null,
      pixKeyOwnerName: user.pixKeyOwnerName || null,
      pixKeyEnabled: user.pixKeyEnabled || false,
      // Feature flag from plan (controls UI visibility)
      pixKeyFeatureEnabled: planEnablesPixKey,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  /**
   * POST /settings/company/logo
   * Upload company logo
   */
  @Post('company/logo')
  @UseInterceptors(FileInterceptor('logo'))
  async uploadCompanyLogo(
    @Req() req: AuthRequest,
    @UploadedFile() file: MulterFile,
  ) {
    const userId = req.user.userId;
    this.logger.log(`[LOGO UPLOAD] Starting upload for userId: ${userId}`);

    if (!file) {
      this.logger.warn(`[LOGO UPLOAD] No file received`);
      throw new BadRequestException('Nenhum arquivo enviado');
    }

    this.logger.log(`[LOGO UPLOAD] File received: ${file.originalname}, size: ${file.size}, type: ${file.mimetype}`);

    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Tipo de arquivo não permitido. Use PNG, JPG ou WebP.',
      );
    }

    // Validate file size
    if (file.size > MAX_LOGO_SIZE) {
      throw new BadRequestException('Arquivo muito grande. Máximo 2MB.');
    }

    // Delete old logo if exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { companyLogoUrl: true },
    });
    this.logger.log(`[LOGO UPLOAD] Current user logo: ${user?.companyLogoUrl}`);

    if (user?.companyLogoUrl && this.storageProvider.delete) {
      try {
        // Extract storage path from URL
        const oldPath = this.extractPathFromUrl(user.companyLogoUrl);
        if (oldPath) {
          this.logger.log(`[LOGO UPLOAD] Deleting old logo: ${oldPath}`);
          await this.storageProvider.delete(oldPath);
        }
      } catch (error) {
        this.logger.warn(`[LOGO UPLOAD] Error deleting old logo: ${error}`);
        // Ignore deletion errors
      }
    }

    // Generate unique filename
    const fileId = randomUUID();
    const ext = path.extname(file.originalname) || this.getExtensionFromMime(file.mimetype);
    const fileName = `logo_${fileId}${ext}`;

    // Build storage path
    const storagePath = `logos/${userId}`;
    this.logger.log(`[LOGO UPLOAD] Uploading to path: ${storagePath}/${fileName}`);

    // Upload to storage provider
    const uploadResult = await this.storageProvider.upload({
      buffer: file.buffer,
      mimeType: file.mimetype,
      path: storagePath,
      fileName,
    });
    this.logger.log(`[LOGO UPLOAD] Upload result: storagePath=${uploadResult.storagePath}, publicUrl=${uploadResult.publicUrl}`);

    // Update user with new logo URL
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { companyLogoUrl: uploadResult.publicUrl },
      select: { id: true, companyLogoUrl: true },
    });
    this.logger.log(`[LOGO UPLOAD] Updated user ${updatedUser.id}, new logoUrl: ${updatedUser.companyLogoUrl}`);

    return { logoUrl: uploadResult.publicUrl };
  }

  /**
   * DELETE /settings/company/logo
   * Delete company logo
   */
  @Delete('company/logo')
  async deleteCompanyLogo(@Req() req: AuthRequest) {
    const userId = req.user.userId;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { companyLogoUrl: true },
    });

    if (user?.companyLogoUrl && this.storageProvider.delete) {
      try {
        const oldPath = this.extractPathFromUrl(user.companyLogoUrl);
        if (oldPath) {
          await this.storageProvider.delete(oldPath);
        }
      } catch (error) {
        // Ignore deletion errors
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { companyLogoUrl: null },
    });

    return { success: true, message: 'Logo removida com sucesso' };
  }

  // ==================== HELPERS ====================

  private getExtensionFromMime(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
    };
    return mimeToExt[mimeType] || '.png';
  }

  private extractPathFromUrl(url: string): string | null {
    // For local storage, extract path from URL
    // URL format: /uploads/logos/userId/filename
    const match = url.match(/\/uploads\/(.+)/);
    return match ? match[1] : null;
  }

  /**
   * Normalize Pix key based on type
   * - CPF/CNPJ: remove non-digits
   * - PHONE: normalize to E.164 format (+55...)
   * - EMAIL: lowercase and trim
   * - RANDOM: keep as-is (UUID format)
   * - null/empty: return null
   */
  private normalizePixKey(key: string | null | undefined, keyType?: string | null): string | null {
    if (!key || key.trim() === '') {
      return null;
    }

    const trimmedKey = key.trim();

    switch (keyType) {
      case 'CPF':
      case 'CNPJ':
        // Remove all non-digit characters
        return trimmedKey.replace(/\D/g, '');

      case 'PHONE':
        // Normalize phone to E.164 format
        let phone = trimmedKey.replace(/\D/g, '');
        // If doesn't start with country code, add Brazil's
        if (phone.length <= 11) {
          phone = '55' + phone;
        }
        return '+' + phone;

      case 'EMAIL':
        // Lowercase and trim
        return trimmedKey.toLowerCase();

      case 'RANDOM':
      default:
        // Keep as-is for random keys or unknown types
        return trimmedKey;
    }
  }
}
