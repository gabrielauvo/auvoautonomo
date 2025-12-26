/**
 * AI Audit Service
 * Handles all audit logging for AI operations
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiAuditCategory } from '../enums';

export interface AuditLogEntry {
  userId: string;
  conversationId?: string;
  planId?: string;
  category: AiAuditCategory;
  tool?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  inputPayload?: Record<string, unknown>;
  outputPayload?: unknown;
  success: boolean;
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  durationMs?: number;
}

@Injectable()
export class AiAuditService {
  private readonly logger = new Logger(AiAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log an audit entry
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      // Sanitize sensitive data from payloads
      const sanitizedInput = this.sanitizePayload(entry.inputPayload);
      const sanitizedOutput = this.sanitizePayload(entry.outputPayload);

      await this.prisma.aiAuditLog.create({
        data: {
          userId: entry.userId,
          conversationId: entry.conversationId,
          planId: entry.planId,
          category: entry.category,
          tool: entry.tool,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          inputPayload: sanitizedInput as any,
          outputPayload: sanitizedOutput as any,
          success: entry.success,
          errorMessage: entry.errorMessage,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          durationMs: entry.durationMs,
        },
      });

      // Log to console for debugging in development
      if (process.env.NODE_ENV !== 'production') {
        this.logger.debug(
          `[AI Audit] ${entry.category} - ${entry.tool ?? 'N/A'}.${entry.action} - ${entry.success ? 'SUCCESS' : 'FAILED'}`,
        );
      }
    } catch (error) {
      // Never let audit logging failures break the main flow
      this.logger.error('Failed to write audit log', error);
    }
  }

  /**
   * Get audit logs for a user
   */
  async getLogsForUser(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      category?: AiAuditCategory;
      startDate?: Date;
      endDate?: Date;
    },
  ) {
    const { limit = 50, offset = 0, category, startDate, endDate } = options ?? {};

    // Build createdAt filter combining startDate and endDate
    const createdAtFilter =
      startDate || endDate
        ? {
            ...(startDate && { gte: startDate }),
            ...(endDate && { lte: endDate }),
          }
        : undefined;

    return this.prisma.aiAuditLog.findMany({
      where: {
        userId,
        ...(category && { category }),
        ...(createdAtFilter && { createdAt: createdAtFilter }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Get audit logs for a specific conversation
   */
  async getLogsForConversation(conversationId: string) {
    return this.prisma.aiAuditLog.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Get audit logs for a specific plan
   */
  async getLogsForPlan(planId: string) {
    return this.prisma.aiAuditLog.findMany({
      where: { planId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Get security-related logs (blocks, rate limits)
   */
  async getSecurityLogs(userId: string, limit = 100) {
    return this.prisma.aiAuditLog.findMany({
      where: {
        userId,
        category: {
          in: [AiAuditCategory.SECURITY_BLOCK, AiAuditCategory.RATE_LIMIT],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Count failed operations for a user in a time window (for rate limiting)
   */
  async countFailedOperations(
    userId: string,
    windowMs: number,
  ): Promise<number> {
    const windowStart = new Date(Date.now() - windowMs);

    const result = await this.prisma.aiAuditLog.count({
      where: {
        userId,
        success: false,
        createdAt: { gte: windowStart },
      },
    });

    return result;
  }

  /**
   * Sanitize sensitive data from payloads before storing
   */
  private sanitizePayload(payload: unknown): Record<string, unknown> | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const sensitiveKeys = [
      'password',
      'token',
      'secret',
      'apiKey',
      'creditCard',
      'cardNumber',
      'cvv',
      'cpf',
      'cnpj',
      'accessToken',
      'refreshToken',
    ];

    const sanitized = { ...payload } as Record<string, unknown>;

    for (const key of Object.keys(sanitized)) {
      const lowerKey = key.toLowerCase();

      // Mask sensitive fields
      if (sensitiveKeys.some((sk) => lowerKey.includes(sk.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      }

      // Recursively sanitize nested objects
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizePayload(sanitized[key]);
      }
    }

    return sanitized;
  }
}
