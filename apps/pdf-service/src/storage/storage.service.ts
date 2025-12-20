import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AttachmentType } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

interface SavePdfOptions {
  quoteId?: string;
  workOrderId?: string;
  invoiceId?: string;
  clientId?: string;
  kind: 'QUOTE_PDF' | 'WORK_ORDER_PDF' | 'INVOICE_PDF';
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly storagePath: string;
  private readonly appUrl: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.storagePath = this.configService.get('STORAGE_PATH', './storage');
    this.appUrl = this.configService.get('APP_URL', 'http://localhost:3001');
  }

  async savePdf(
    userId: string,
    buffer: Buffer,
    fileName: string,
    options: SavePdfOptions,
  ) {
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const fileId = crypto.randomUUID();
    const extension = path.extname(fileName) || '.pdf';
    const storagePath = `${userId}/${year}/${month}/${fileId}${extension}`;
    const fullPath = path.join(this.storagePath, storagePath);

    // Create directory
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    // Write file
    await fs.writeFile(fullPath, buffer);

    // Create attachment record
    const attachment = await this.prisma.attachment.create({
      data: {
        userId,
        clientId: options.clientId,
        quoteId: options.quoteId,
        workOrderId: options.workOrderId,
        type: AttachmentType.DOCUMENT,
        mimeType: 'application/pdf',
        fileNameOriginal: fileName,
        fileSize: buffer.length,
        storagePath,
        createdByUserId: userId,
        metadata: {
          kind: options.kind,
          version: 1,
          generatedAt: now.toISOString(),
        },
      },
    });

    // Create public link automatically
    const publicLink = await this.createPublicLink(attachment.id);

    this.logger.log(`PDF salvo: ${attachment.id} (${buffer.length} bytes)`);

    return {
      attachmentId: attachment.id,
      fileSize: buffer.length,
      storagePath,
      publicLinkToken: publicLink.token,
      publicLinkUrl: publicLink.url,
    };
  }

  private async createPublicLink(attachmentId: string, expiresInDays: number = 30) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const publicLink = await this.prisma.publicLink.create({
      data: {
        attachmentId,
        token,
        expiresAt,
      },
    });

    return {
      id: publicLink.id,
      token: publicLink.token,
      url: `${this.appUrl}/api/public/files/${token}`,
      expiresAt: publicLink.expiresAt,
    };
  }

  async getBuffer(storagePath: string): Promise<Buffer> {
    const fullPath = path.join(this.storagePath, storagePath);
    return fs.readFile(fullPath);
  }
}
