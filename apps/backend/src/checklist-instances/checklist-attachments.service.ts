import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  StorageProvider,
  STORAGE_PROVIDER,
} from '../file-storage/providers/storage-provider.interface';
import { ChecklistAttachmentType, AttachmentSyncStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as path from 'path';

interface MulterFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
  fieldname: string;
  encoding: string;
}

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
];

const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
const MAX_THUMBNAIL_SIZE = 200 * 1024; // 200KB for thumbnail

@Injectable()
export class ChecklistAttachmentsService {
  private readonly logger = new Logger(ChecklistAttachmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER)
    private readonly storageProvider: StorageProvider,
  ) {}

  async uploadAttachment(
    userId: string,
    answerId: string,
    file: MulterFile,
    type: ChecklistAttachmentType,
    localPath?: string,
  ) {
    // Verify answer exists and user has access
    const answer = await this.prisma.checklistAnswer.findFirst({
      where: { id: answerId },
      include: {
        instance: {
          include: {
            workOrder: {
              select: { userId: true },
            },
          },
        },
      },
    });

    if (!answer) {
      throw new NotFoundException(`Answer ${answerId} não encontrada`);
    }

    if (answer.instance.workOrder.userId !== userId) {
      throw new BadRequestException('Sem permissão para este checklist');
    }

    // Validate file
    this.validateFile(file, type);

    // Generate unique filename
    const fileId = randomUUID();
    const ext = path.extname(file.originalname) || this.getExtFromMime(file.mimetype);
    const fileName = `${fileId}${ext}`;

    // Build storage path: checklists/userId/instanceId/answerId/
    const storagePath = `checklists/${userId}/${answer.instanceId}/${answerId}`;

    // Upload main file
    const uploadResult = await this.storageProvider.upload({
      buffer: file.buffer,
      mimeType: file.mimetype,
      path: storagePath,
      fileName,
    });

    // Generate thumbnail for images
    let thumbnailPath: string | null | undefined = null;
    let thumbnailUrl: string | null | undefined = null;

    if (type === ChecklistAttachmentType.PHOTO && ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      try {
        const thumbnail = await this.generateThumbnail(file.buffer);
        if (thumbnail) {
          const thumbFileName = `thumb_${fileName}`;
          const thumbResult = await this.storageProvider.upload({
            buffer: thumbnail,
            mimeType: 'image/jpeg',
            path: storagePath,
            fileName: thumbFileName,
          });
          thumbnailPath = thumbResult.storagePath;
          thumbnailUrl = thumbResult.publicUrl;
        }
      } catch (error) {
        this.logger.warn(`Failed to generate thumbnail for ${fileName}: ${error}`);
      }
    }

    // Create attachment record
    const attachment = await this.prisma.checklistAttachment.create({
      data: {
        answerId,
        type,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        storagePath: uploadResult.storagePath,
        publicUrl: uploadResult.publicUrl,
        thumbnailPath,
        thumbnailUrl,
        metadata: this.extractMetadata(file),
        uploadedBy: userId,
        syncStatus: AttachmentSyncStatus.SYNCED,
        localPath,
      },
    });

    this.logger.log(`Checklist attachment uploaded: ${attachment.id}`);

    return attachment;
  }

  async uploadFromBase64(
    userId: string,
    answerId: string,
    base64Data: string,
    type: ChecklistAttachmentType,
    fileName?: string,
  ) {
    // Remove data URL prefix if present
    const base64Clean = base64Data.replace(/^data:[\w/+-]+;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');

    // Detect mime type from base64 prefix or default to PNG
    let mimeType = 'image/png';
    if (base64Data.startsWith('data:')) {
      const match = base64Data.match(/^data:([^;]+);base64,/);
      if (match) {
        mimeType = match[1];
      }
    }

    const mockFile: MulterFile = {
      buffer,
      mimetype: mimeType,
      originalname: fileName || `${type.toLowerCase()}_${Date.now()}.png`,
      size: buffer.length,
      fieldname: 'file',
      encoding: '7bit',
    };

    return this.uploadAttachment(userId, answerId, mockFile, type);
  }

  async getAttachments(userId: string, answerId: string) {
    // Verify access
    const answer = await this.prisma.checklistAnswer.findFirst({
      where: { id: answerId },
      include: {
        instance: {
          include: {
            workOrder: {
              select: { userId: true },
            },
          },
        },
      },
    });

    if (!answer || answer.instance.workOrder.userId !== userId) {
      throw new NotFoundException(`Answer ${answerId} não encontrada`);
    }

    return this.prisma.checklistAttachment.findMany({
      where: { answerId },
      orderBy: { uploadedAt: 'asc' },
    });
  }

  async getAttachmentsByInstance(userId: string, instanceId: string) {
    // Verify access
    const instance = await this.prisma.checklistInstance.findFirst({
      where: { id: instanceId },
      include: {
        workOrder: {
          select: { userId: true },
        },
      },
    });

    if (!instance || instance.workOrder.userId !== userId) {
      throw new NotFoundException(`Instance ${instanceId} não encontrada`);
    }

    return this.prisma.checklistAttachment.findMany({
      where: {
        answer: {
          instanceId,
        },
      },
      include: {
        answer: {
          select: { questionId: true },
        },
      },
      orderBy: { uploadedAt: 'asc' },
    });
  }

  async getAttachmentBuffer(
    userId: string,
    attachmentId: string,
    thumbnail = false,
  ): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
    const attachment = await this.prisma.checklistAttachment.findFirst({
      where: { id: attachmentId },
      include: {
        answer: {
          include: {
            instance: {
              include: {
                workOrder: {
                  select: { userId: true },
                },
              },
            },
          },
        },
      },
    });

    if (!attachment || attachment.answer.instance.workOrder.userId !== userId) {
      throw new NotFoundException(`Attachment ${attachmentId} não encontrado`);
    }

    const storagePath = thumbnail && attachment.thumbnailPath
      ? attachment.thumbnailPath
      : attachment.storagePath;

    const buffer = await this.storageProvider.getBuffer(storagePath);

    return {
      buffer,
      mimeType: thumbnail ? 'image/jpeg' : attachment.mimeType,
      fileName: attachment.fileName,
    };
  }

  async deleteAttachment(userId: string, attachmentId: string) {
    const attachment = await this.prisma.checklistAttachment.findFirst({
      where: { id: attachmentId },
      include: {
        answer: {
          include: {
            instance: {
              include: {
                workOrder: {
                  select: { userId: true },
                },
              },
            },
          },
        },
      },
    });

    if (!attachment || attachment.answer.instance.workOrder.userId !== userId) {
      throw new NotFoundException(`Attachment ${attachmentId} não encontrado`);
    }

    // Delete from storage
    if (this.storageProvider.delete) {
      await this.storageProvider.delete(attachment.storagePath);
      if (attachment.thumbnailPath) {
        await this.storageProvider.delete(attachment.thumbnailPath);
      }
    }

    // Delete from database
    await this.prisma.checklistAttachment.delete({
      where: { id: attachmentId },
    });

    this.logger.log(`Checklist attachment deleted: ${attachmentId}`);

    return { success: true };
  }

  async syncPendingAttachments(userId: string, instanceId: string) {
    const pendingAttachments = await this.prisma.checklistAttachment.findMany({
      where: {
        syncStatus: AttachmentSyncStatus.PENDING,
        answer: {
          instanceId,
          instance: {
            workOrder: {
              userId,
            },
          },
        },
      },
    });

    return {
      pending: pendingAttachments.length,
      attachments: pendingAttachments,
    };
  }

  async markAsSynced(userId: string, attachmentId: string) {
    const attachment = await this.prisma.checklistAttachment.findFirst({
      where: { id: attachmentId },
      include: {
        answer: {
          include: {
            instance: {
              include: {
                workOrder: {
                  select: { userId: true },
                },
              },
            },
          },
        },
      },
    });

    if (!attachment || attachment.answer.instance.workOrder.userId !== userId) {
      throw new NotFoundException(`Attachment ${attachmentId} não encontrado`);
    }

    return this.prisma.checklistAttachment.update({
      where: { id: attachmentId },
      data: {
        syncStatus: AttachmentSyncStatus.SYNCED,
      },
    });
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private validateFile(file: MulterFile, type: ChecklistAttachmentType): void {
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `Arquivo muito grande. Máximo: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      );
    }

    let allowedTypes: string[];
    switch (type) {
      case ChecklistAttachmentType.PHOTO:
      case ChecklistAttachmentType.SIGNATURE:
        allowedTypes = ALLOWED_IMAGE_TYPES;
        break;
      case ChecklistAttachmentType.DOCUMENT:
        allowedTypes = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES];
        break;
      default:
        allowedTypes = ALLOWED_IMAGE_TYPES;
    }

    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Tipo de arquivo não permitido: ${file.mimetype}`,
      );
    }
  }

  private getExtFromMime(mimeType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/heic': '.heic',
      'image/heif': '.heif',
      'application/pdf': '.pdf',
    };
    return map[mimeType] || '';
  }

  private extractMetadata(file: MulterFile): Record<string, any> {
    return {
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      uploadedAt: new Date().toISOString(),
    };
  }

  private async generateThumbnail(buffer: Buffer): Promise<Buffer | null> {
    // Simple thumbnail generation - in production, use sharp or similar
    // For now, return null to skip thumbnail
    // TODO: Add sharp for proper thumbnail generation
    return null;
  }
}
