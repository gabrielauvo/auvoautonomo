import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FileStorageService } from '../file-storage/file-storage.service';
import { AttachmentType } from '../file-storage/dto/upload-file.dto';
import { CreateSignatureDto } from './dto/create-signature.dto';
import { createHash } from 'crypto';

@Injectable()
export class SignaturesService {
  private readonly logger = new Logger(SignaturesService.name);

  constructor(
    private prisma: PrismaService,
    private fileStorageService: FileStorageService,
  ) {}

  /**
   * Create signature for a Work Order
   */
  async createWorkOrderSignature(
    userId: string,
    workOrderId: string,
    dto: CreateSignatureDto,
    requestInfo: { ipAddress?: string; userAgent?: string },
  ) {
    // Validate work order exists and belongs to user
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, userId },
      include: {
        signatures: true,
        client: true,
      },
    });

    if (!workOrder) {
      throw new NotFoundException(`Work Order with ID ${workOrderId} not found`);
    }

    // Check if already has a signature
    if (workOrder.signatures.length > 0) {
      // Se temos localId, verificar se é a mesma assinatura (idempotência para sync offline)
      if (dto.localId) {
        const existingSignature = workOrder.signatures.find(s => s.localId === dto.localId);
        if (existingSignature) {
          this.logger.log(`Signature already exists with localId ${dto.localId}, returning existing`);
          return {
            id: existingSignature.id,
            workOrderId: existingSignature.workOrderId,
            signerName: existingSignature.signerName,
            signerDocument: existingSignature.signerDocument,
            signerRole: existingSignature.signerRole,
            signedAt: existingSignature.signedAt,
            attachmentId: existingSignature.attachmentId,
            hash: existingSignature.hash,
            alreadySynced: true,
          };
        }
      }
      throw new BadRequestException('Work Order already has a signature');
    }

    // Upload signature image
    const attachment = await this.fileStorageService.uploadFromBase64(
      userId,
      dto.imageBase64,
      {
        type: AttachmentType.SIGNATURE,
        workOrderId,
        clientId: workOrder.clientId,
        description: `Assinatura de ${dto.signerName}`,
        category: 'WORK_ORDER_SIGNATURE',
      },
    );

    // Create hash of the signature data for integrity
    const signatureData = JSON.stringify({
      workOrderId,
      signerName: dto.signerName,
      signerDocument: dto.signerDocument,
      signedAt: new Date().toISOString(),
      attachmentId: attachment.id,
    });
    const hash = createHash('sha256').update(signatureData).digest('hex');

    // Create signature record
    const signature = await this.prisma.signature.create({
      data: {
        userId,
        clientId: workOrder.clientId,
        workOrderId,
        attachmentId: attachment.id,
        signerName: dto.signerName,
        signerDocument: dto.signerDocument,
        signerRole: dto.signerRole || 'Cliente',
        ipAddress: requestInfo.ipAddress,
        userAgent: requestInfo.userAgent,
        hash,
        localId: dto.localId, // Para idempotência no sync offline
      },
      include: {
        attachment: {
          select: {
            id: true,
            type: true,
            createdAt: true,
            publicUrl: true,
            storagePath: true,
          },
        },
        client: {
          select: { id: true, name: true },
        },
        workOrder: {
          select: { id: true, title: true, status: true },
        },
      },
    });

    this.logger.log(`Signature created for Work Order ${workOrderId}: ${signature.id}`);

    return {
      id: signature.id,
      workOrderId: signature.workOrderId,
      signerName: signature.signerName,
      signerDocument: signature.signerDocument,
      signerRole: signature.signerRole,
      signedAt: signature.signedAt,
      attachmentId: signature.attachmentId,
      hash: signature.hash,
      attachment: signature.attachment,
    };
  }

  /**
   * Create signature for a Quote (acceptance)
   */
  async createQuoteSignature(
    userId: string,
    quoteId: string,
    dto: CreateSignatureDto,
    requestInfo: { ipAddress?: string; userAgent?: string },
  ) {
    // Validate quote exists and belongs to user
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, userId },
      include: {
        signatures: true,
        client: true,
      },
    });

    if (!quote) {
      throw new NotFoundException(`Quote with ID ${quoteId} not found`);
    }

    // Check if already has a signature
    if (quote.signatures.length > 0) {
      throw new BadRequestException('Quote already has a signature');
    }

    // Upload signature image
    const attachment = await this.fileStorageService.uploadFromBase64(
      userId,
      dto.imageBase64,
      {
        type: AttachmentType.SIGNATURE,
        quoteId,
        clientId: quote.clientId,
        description: `Assinatura de aceite - ${dto.signerName}`,
        category: 'QUOTE_SIGNATURE',
      },
    );

    // Create hash of the signature data for integrity
    const signatureData = JSON.stringify({
      quoteId,
      signerName: dto.signerName,
      signerDocument: dto.signerDocument,
      signedAt: new Date().toISOString(),
      attachmentId: attachment.id,
    });
    const hash = createHash('sha256').update(signatureData).digest('hex');

    // Create signature record
    const signature = await this.prisma.signature.create({
      data: {
        userId,
        clientId: quote.clientId,
        quoteId,
        attachmentId: attachment.id,
        signerName: dto.signerName,
        signerDocument: dto.signerDocument,
        signerRole: dto.signerRole || 'Cliente',
        ipAddress: requestInfo.ipAddress,
        userAgent: requestInfo.userAgent,
        hash,
      },
      include: {
        attachment: {
          select: {
            id: true,
            type: true,
            createdAt: true,
          },
        },
        client: {
          select: { id: true, name: true },
        },
        quote: {
          select: { id: true, status: true, totalValue: true },
        },
      },
    });

    // Optionally update quote status to APPROVED
    await this.prisma.quote.update({
      where: { id: quoteId },
      data: { status: 'APPROVED' },
    });

    this.logger.log(`Signature created for Quote ${quoteId}: ${signature.id}`);

    return {
      id: signature.id,
      quoteId: signature.quoteId,
      signerName: signature.signerName,
      signerDocument: signature.signerDocument,
      signerRole: signature.signerRole,
      signedAt: signature.signedAt,
      attachmentId: signature.attachmentId,
      hash: signature.hash,
      quoteStatus: 'APPROVED',
    };
  }

  /**
   * Get signature by ID
   */
  async findOne(userId: string, id: string) {
    const signature = await this.prisma.signature.findFirst({
      where: { id, userId },
      include: {
        attachment: true,
        client: {
          select: { id: true, name: true },
        },
        workOrder: {
          select: { id: true, title: true, status: true },
        },
        quote: {
          select: { id: true, status: true, totalValue: true },
        },
      },
    });

    if (!signature) {
      throw new NotFoundException(`Signature with ID ${id} not found`);
    }

    return signature;
  }

  /**
   * Get signature for a Work Order
   */
  async findByWorkOrder(userId: string, workOrderId: string) {
    // Validate work order
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, userId },
    });

    if (!workOrder) {
      throw new NotFoundException(`Work Order with ID ${workOrderId} not found`);
    }

    return this.prisma.signature.findFirst({
      where: { workOrderId, userId },
      include: {
        attachment: {
          select: { id: true, type: true, createdAt: true, publicUrl: true, storagePath: true },
        },
      },
    });
  }

  /**
   * Get signature for a Quote
   */
  async findByQuote(userId: string, quoteId: string) {
    // Validate quote
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, userId },
    });

    if (!quote) {
      throw new NotFoundException(`Quote with ID ${quoteId} not found`);
    }

    return this.prisma.signature.findFirst({
      where: { quoteId, userId },
      include: {
        attachment: {
          select: { id: true, type: true, createdAt: true, publicUrl: true, storagePath: true },
        },
      },
    });
  }

  /**
   * Verify signature integrity by hash
   */
  async verifySignature(userId: string, id: string): Promise<{
    valid: boolean;
    signature: any;
  }> {
    const signature = await this.findOne(userId, id);

    if (!signature.hash) {
      return { valid: false, signature };
    }

    // Recreate the hash to verify - must match creation format exactly
    // Only include workOrderId OR quoteId (one will be present, the other null)
    let signatureData: string;

    if (signature.workOrderId) {
      signatureData = JSON.stringify({
        workOrderId: signature.workOrderId,
        signerName: signature.signerName,
        signerDocument: signature.signerDocument,
        signedAt: signature.signedAt.toISOString(),
        attachmentId: signature.attachmentId,
      });
    } else {
      signatureData = JSON.stringify({
        quoteId: signature.quoteId,
        signerName: signature.signerName,
        signerDocument: signature.signerDocument,
        signedAt: signature.signedAt.toISOString(),
        attachmentId: signature.attachmentId,
      });
    }

    const recalculatedHash = createHash('sha256').update(signatureData).digest('hex');

    return {
      valid: recalculatedHash === signature.hash,
      signature,
    };
  }
}
