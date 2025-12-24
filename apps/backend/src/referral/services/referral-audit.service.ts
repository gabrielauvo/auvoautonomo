import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface AuditLogParams {
  action: string;
  entityType: string;
  entityId: string;
  userId?: string;
  decision: string;
  reason?: string;
  metadata?: Record<string, any>;
  ipHash?: string;
  userAgent?: string;
}

@Injectable()
export class ReferralAuditService {
  private readonly logger = new Logger(ReferralAuditService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Registra uma entrada no audit log
   */
  async log(params: AuditLogParams): Promise<void> {
    try {
      await this.prisma.referralAuditLog.create({
        data: {
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          userId: params.userId,
          decision: params.decision,
          reason: params.reason,
          metadata: params.metadata,
          ipHash: params.ipHash,
          userAgent: params.userAgent?.substring(0, 500),
        },
      });
    } catch (error) {
      // Log silenciosamente - audit não deve bloquear operação principal
      this.logger.error(`Failed to create audit log: ${error.message}`, {
        params,
      });
    }
  }

  /**
   * Busca logs de auditoria por entidade
   */
  async findByEntity(entityType: string, entityId: string, limit: number = 50) {
    return this.prisma.referralAuditLog.findMany({
      where: {
        entityType,
        entityId,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Busca logs de auditoria por usuário
   */
  async findByUser(userId: string, limit: number = 100) {
    return this.prisma.referralAuditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Busca logs de auditoria por ação
   */
  async findByAction(action: string, since?: Date, limit: number = 100) {
    return this.prisma.referralAuditLog.findMany({
      where: {
        action,
        ...(since && { createdAt: { gte: since } }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
