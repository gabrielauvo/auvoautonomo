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

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  private readonly logger = new Logger(SettingsController.name);

  constructor(
    private readonly settingsService: SettingsService,
    private readonly prisma: PrismaService,
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
      avatarUrl: user.avatarUrl || null,
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
      avatarUrl: user.avatarUrl || null,
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
        companyLogoUrl: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    this.logger.log(`[GET COMPANY] User found: ${user?.id}, logoUrl: ${user?.companyLogoUrl}`);

    // Return format expected by frontend
    return {
      id: user?.id || '',
      tradeName: user?.companyName || '',
      legalName: null,
      taxId: null,
      stateRegistration: null,
      email: user?.email || '',
      phone: user?.phone || '',
      whatsapp: null,
      address: null,
      logoUrl: user?.companyLogoUrl || null,
      branding: {
        primaryColor: '#7C3AED',
        secondaryColor: '#6D28D9',
        textColor: '#1F2937',
        backgroundColor: '#FFFFFF',
        accentColor: '#10B981',
      },
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
    },
  ) {
    const userId = req.user.userId;

    // Support both tradeName (new) and companyName (old)
    const companyName = dto.tradeName ?? dto.companyName;

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(companyName !== undefined && { companyName }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
      },
      select: {
        id: true,
        companyName: true,
        companyLogoUrl: true,
        phone: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Return format expected by frontend
    return {
      id: user.id,
      tradeName: user.companyName || '',
      legalName: dto.legalName || null,
      taxId: dto.taxId || null,
      stateRegistration: dto.stateRegistration || null,
      email: user.email || '',
      phone: user.phone || '',
      whatsapp: dto.whatsapp || null,
      address: dto.address || null,
      logoUrl: user.companyLogoUrl || null,
      branding: dto.branding || {
        primaryColor: '#7C3AED',
        secondaryColor: '#6D28D9',
        textColor: '#1F2937',
        backgroundColor: '#FFFFFF',
        accentColor: '#10B981',
      },
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
}
