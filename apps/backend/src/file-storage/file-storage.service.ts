import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { AttachmentType, UploadFileDto, CreatePublicLinkDto } from './dto/upload-file.dto';
import {
  StorageProvider,
  STORAGE_PROVIDER,
} from './providers/storage-provider.interface';
import { randomBytes, randomUUID } from 'crypto';
import * as path from 'path';

// Type for multipart file
interface MulterFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
  fieldname: string;
  encoding: string;
}

// Allowed MIME types
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(STORAGE_PROVIDER)
    private storageProvider: StorageProvider,
  ) {}

  /**
   * Upload a file and create an Attachment record
   */
  async upload(
    userId: string,
    file: MulterFile,
    dto: UploadFileDto,
  ) {
    this.logger.log(`[UPLOAD] Starting upload: userId=${userId}, type=${dto.type}, mimeType=${file.mimetype}`);
    this.logger.log(`[UPLOAD] DTO: clientId=${dto.clientId}, quoteId=${dto.quoteId}, workOrderId=${dto.workOrderId}`);

    // Validate file
    this.logger.log(`[UPLOAD] Validating file...`);
    this.validateFile(file, dto.type);
    this.logger.log(`[UPLOAD] File validation passed`);

    // Validate relationships if provided
    if (dto.clientId) {
      this.logger.log(`[UPLOAD] Validating clientId=${dto.clientId} for userId=${userId}`);
      await this.validateClient(userId, dto.clientId);
      this.logger.log(`[UPLOAD] Client validation passed`);
    }
    if (dto.quoteId) {
      this.logger.log(`[UPLOAD] Validating quoteId=${dto.quoteId} for userId=${userId}`);
      await this.validateQuote(userId, dto.quoteId);
      this.logger.log(`[UPLOAD] Quote validation passed`);
    }
    if (dto.workOrderId) {
      this.logger.log(`[UPLOAD] Validating workOrderId=${dto.workOrderId} for userId=${userId}`);
      await this.validateWorkOrder(userId, dto.workOrderId);
      this.logger.log(`[UPLOAD] WorkOrder validation passed`);
    }

    // Generate unique filename
    const fileId = randomUUID();
    const ext = path.extname(file.originalname) || this.getExtensionFromMime(file.mimetype);
    const fileName = `${fileId}${ext}`;

    // Build storage path: userId/year/month/
    const now = new Date();
    const storagePath = `${userId}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Upload to storage provider
    const uploadResult = await this.storageProvider.upload({
      buffer: file.buffer,
      mimeType: file.mimetype,
      path: storagePath,
      fileName,
    });

    // Build metadata
    const metadata: Record<string, any> = {};
    if (dto.description) metadata.description = dto.description;
    if (dto.category) metadata.category = dto.category;

    // Create attachment record
    const attachment = await this.prisma.attachment.create({
      data: {
        userId,
        clientId: dto.clientId,
        quoteId: dto.quoteId,
        workOrderId: dto.workOrderId,
        type: dto.type,
        mimeType: file.mimetype,
        fileNameOriginal: file.originalname,
        fileSize: file.size,
        storagePath: uploadResult.storagePath,
        publicUrl: uploadResult.publicUrl,
        metadata: Object.keys(metadata).length > 0 ? metadata as Prisma.JsonObject : Prisma.JsonNull,
        createdByUserId: userId,
      },
    });

    this.logger.log(`Attachment created: ${attachment.id} by user ${userId}`);

    return {
      id: attachment.id,
      type: attachment.type,
      mimeType: attachment.mimeType,
      fileNameOriginal: attachment.fileNameOriginal,
      fileSize: attachment.fileSize,
      storagePath: attachment.storagePath,
      publicUrl: attachment.publicUrl,
      metadata: attachment.metadata,
      createdAt: attachment.createdAt,
    };
  }

  /**
   * Upload a file from base64 data (used for signatures)
   */
  async uploadFromBase64(
    userId: string,
    base64Data: string,
    dto: UploadFileDto,
  ) {
    // Remove data URL prefix if present
    const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');

    // Detect mime type from base64 prefix or default to PNG
    let mimeType = 'image/png';
    if (base64Data.startsWith('data:')) {
      const match = base64Data.match(/^data:([^;]+);base64,/);
      if (match) {
        mimeType = match[1];
      }
    }

    // Create a mock file object
    const mockFile: MulterFile = {
      buffer,
      mimetype: mimeType,
      originalname: `signature_${Date.now()}.png`,
      size: buffer.length,
      fieldname: 'file',
      encoding: '7bit',
    };

    return this.upload(userId, mockFile, dto);
  }

  /**
   * Get attachment by ID
   */
  async findOne(userId: string, id: string) {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id, userId },
      include: {
        client: {
          select: { id: true, name: true },
        },
        quote: {
          select: { id: true, status: true, totalValue: true },
        },
        workOrder: {
          select: { id: true, title: true, status: true },
        },
        publicLinks: {
          select: { id: true, token: true, expiresAt: true, accessCount: true },
          where: {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } },
            ],
          },
        },
      },
    });

    if (!attachment) {
      throw new NotFoundException(`Attachment with ID ${id} not found`);
    }

    return attachment;
  }

  /**
   * List attachments by quote
   */
  async findByQuote(userId: string, quoteId: string) {
    await this.validateQuote(userId, quoteId);

    return this.prisma.attachment.findMany({
      where: { userId, quoteId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * List attachments by work order
   */
  async findByWorkOrder(userId: string, workOrderId: string) {
    await this.validateWorkOrder(userId, workOrderId);

    return this.prisma.attachment.findMany({
      where: { userId, workOrderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * List attachments by client
   */
  async findByClient(userId: string, clientId: string) {
    await this.validateClient(userId, clientId);

    return this.prisma.attachment.findMany({
      where: { userId, clientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Delete an attachment
   */
  async remove(userId: string, id: string) {
    const attachment = await this.findOne(userId, id);

    // Delete from storage
    if (this.storageProvider.delete) {
      await this.storageProvider.delete(attachment.storagePath);
    }

    // Delete from database (cascades to public links)
    await this.prisma.attachment.delete({
      where: { id },
    });

    this.logger.log(`Attachment deleted: ${id} by user ${userId}`);

    return { success: true };
  }

  /**
   * Get file buffer for download
   */
  async getFileBuffer(userId: string, id: string): Promise<{
    buffer: Buffer;
    mimeType: string;
    fileName: string;
  }> {
    const attachment = await this.findOne(userId, id);

    const buffer = await this.storageProvider.getBuffer(attachment.storagePath);

    return {
      buffer,
      mimeType: attachment.mimeType,
      fileName: attachment.fileNameOriginal,
    };
  }

  /**
   * Create a public link for an attachment
   */
  async createPublicLink(userId: string, attachmentId: string, dto: CreatePublicLinkDto) {
    const attachment = await this.findOne(userId, attachmentId);

    // Generate secure random token
    const token = randomBytes(32).toString('hex');

    // Calculate expiration
    const expiresInDays = dto.expiresInDays ?? 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const publicLink = await this.prisma.publicLink.create({
      data: {
        attachmentId: attachment.id,
        token,
        expiresAt,
      },
    });

    // Build public URL
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const publicUrl = `${baseUrl}/api/public/files/${token}`;

    this.logger.log(`Public link created for attachment ${attachmentId}`);

    return {
      id: publicLink.id,
      token: publicLink.token,
      url: publicUrl,
      expiresAt: publicLink.expiresAt,
    };
  }

  /**
   * Access a file via public token
   */
  async getFileByToken(token: string): Promise<{
    buffer: Buffer;
    mimeType: string;
    fileName: string;
  }> {
    const publicLink = await this.prisma.publicLink.findUnique({
      where: { token },
      include: {
        attachment: true,
      },
    });

    if (!publicLink) {
      throw new NotFoundException('Link not found');
    }

    // Check expiration
    if (publicLink.expiresAt && publicLink.expiresAt < new Date()) {
      throw new BadRequestException('Link has expired');
    }

    // Update access count
    await this.prisma.publicLink.update({
      where: { id: publicLink.id },
      data: {
        accessCount: { increment: 1 },
        lastAccessAt: new Date(),
      },
    });

    const buffer = await this.storageProvider.getBuffer(publicLink.attachment.storagePath);

    return {
      buffer,
      mimeType: publicLink.attachment.mimeType,
      fileName: publicLink.attachment.fileNameOriginal,
    };
  }

  /**
   * Revoke a public link
   */
  async revokePublicLink(userId: string, linkId: string) {
    const link = await this.prisma.publicLink.findFirst({
      where: { id: linkId },
      include: {
        attachment: true,
      },
    });

    if (!link || link.attachment.userId !== userId) {
      throw new NotFoundException('Public link not found');
    }

    await this.prisma.publicLink.delete({
      where: { id: linkId },
    });

    return { success: true };
  }

  // ==================== PRIVATE HELPERS ====================

  private validateFile(file: MulterFile, type: AttachmentType) {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File size exceeds maximum allowed (${MAX_FILE_SIZE / 1024 / 1024}MB)`,
      );
    }

    // Check MIME type based on attachment type
    const allowedTypes =
      type === AttachmentType.DOCUMENT
        ? [...ALLOWED_DOCUMENT_TYPES, ...ALLOWED_IMAGE_TYPES]
        : ALLOWED_IMAGE_TYPES;

    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed for ${type}`,
      );
    }
  }

  private getExtensionFromMime(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
      'text/plain': '.txt',
    };
    return mimeToExt[mimeType] || '';
  }

  private async validateClient(userId: string, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, userId },
    });
    if (!client) {
      throw new BadRequestException(`Client with ID ${clientId} not found`);
    }
  }

  private async validateQuote(userId: string, quoteId: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, userId },
    });
    if (!quote) {
      throw new BadRequestException(`Quote with ID ${quoteId} not found`);
    }
  }

  private async validateWorkOrder(userId: string, workOrderId: string) {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, userId },
    });
    if (!workOrder) {
      throw new BadRequestException(`WorkOrder with ID ${workOrderId} not found`);
    }
  }
}
