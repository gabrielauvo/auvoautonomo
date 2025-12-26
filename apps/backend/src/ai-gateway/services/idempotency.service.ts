/**
 * Idempotency Service
 * Centralized mechanism for ensuring idempotent tool executions
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { createHash } from 'crypto';

export interface IdempotencyCheckResult {
  isIdempotent: boolean;
  existingResponse?: {
    success: boolean;
    data?: unknown;
    error?: string;
    entityIds?: string[];
  };
  idempotencyId?: string;
}

export interface IdempotencyRecord {
  toolName: string;
  idempotencyKey: string;
  params: Record<string, unknown>;
  response: {
    success: boolean;
    data?: unknown;
    error?: string;
  };
  entityIds?: string[];
  status?: 'SUCCESS' | 'FAILED';
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly EXPIRATION_HOURS = 24;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a hash of the request parameters for comparison
   */
  private hashParams(params: Record<string, unknown>): string {
    const { idempotencyKey, ...rest } = params;
    const normalized = JSON.stringify(rest, Object.keys(rest).sort());
    return createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Check if a request has been processed before
   */
  async check(
    userId: string,
    toolName: string,
    idempotencyKey: string,
    params: Record<string, unknown>,
  ): Promise<IdempotencyCheckResult> {
    try {
      const existing = await this.prisma.aiToolIdempotency.findUnique({
        where: {
          userId_toolName_idempotencyKey: {
            userId,
            toolName,
            idempotencyKey,
          },
        },
      });

      if (!existing) {
        return { isIdempotent: false };
      }

      // Check if expired
      if (existing.expiresAt < new Date()) {
        // Clean up expired record
        await this.prisma.aiToolIdempotency.delete({
          where: { id: existing.id },
        });
        return { isIdempotent: false };
      }

      // Verify parameter hash matches
      const currentHash = this.hashParams(params);
      if (existing.requestHash !== currentHash) {
        this.logger.warn(
          `Idempotency key ${idempotencyKey} reused with different params for tool ${toolName}`,
        );
        // Return the existing response anyway to prevent conflicts
      }

      const response = existing.response as IdempotencyCheckResult['existingResponse'];
      const entityIds = existing.entityIds as string[] | null;

      return {
        isIdempotent: true,
        existingResponse: {
          success: response?.success ?? true,
          data: response?.data,
          error: response?.error,
          entityIds: entityIds || undefined,
        },
        idempotencyId: existing.id,
      };
    } catch (error) {
      this.logger.error(`Failed to check idempotency: ${error}`);
      // On error, proceed as non-idempotent to avoid blocking operations
      return { isIdempotent: false };
    }
  }

  /**
   * Record a successful or failed operation for future idempotency checks
   */
  async record(userId: string, record: IdempotencyRecord): Promise<string> {
    try {
      const requestHash = this.hashParams(record.params);
      const expiresAt = new Date(Date.now() + this.EXPIRATION_HOURS * 60 * 60 * 1000);

      const result = await this.prisma.aiToolIdempotency.upsert({
        where: {
          userId_toolName_idempotencyKey: {
            userId,
            toolName: record.toolName,
            idempotencyKey: record.idempotencyKey,
          },
        },
        create: {
          userId,
          toolName: record.toolName,
          idempotencyKey: record.idempotencyKey,
          requestHash,
          response: record.response as any,
          entityIds: record.entityIds as any,
          status: record.status || (record.response.success ? 'SUCCESS' : 'FAILED'),
          expiresAt,
        },
        update: {
          // Don't update if already exists - idempotency means first response wins
        },
      });

      return result.id;
    } catch (error) {
      this.logger.error(`Failed to record idempotency: ${error}`);
      throw error;
    }
  }

  /**
   * Clean up expired idempotency records
   * Should be called periodically (e.g., via cron job)
   */
  async cleanupExpired(): Promise<number> {
    try {
      const result = await this.prisma.aiToolIdempotency.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });

      this.logger.log(`Cleaned up ${result.count} expired idempotency records`);
      return result.count;
    } catch (error) {
      this.logger.error(`Failed to cleanup expired records: ${error}`);
      return 0;
    }
  }

  /**
   * Wrapper to execute a tool with idempotency handling
   */
  async executeWithIdempotency<T>(
    userId: string,
    toolName: string,
    idempotencyKey: string,
    params: Record<string, unknown>,
    executor: () => Promise<{ success: boolean; data?: T; error?: string; entityIds?: string[] }>,
  ): Promise<{ success: boolean; data?: T; error?: string; wasIdempotent?: boolean }> {
    // Check for existing execution
    const checkResult = await this.check(userId, toolName, idempotencyKey, params);

    if (checkResult.isIdempotent && checkResult.existingResponse) {
      this.logger.log(
        `Returning idempotent response for ${toolName} with key ${idempotencyKey}`,
      );
      return {
        ...checkResult.existingResponse,
        data: checkResult.existingResponse.data as T,
        wasIdempotent: true,
      };
    }

    // Execute the operation
    const result = await executor();

    // Record the result
    await this.record(userId, {
      toolName,
      idempotencyKey,
      params,
      response: {
        success: result.success,
        data: result.data,
        error: result.error,
      },
      entityIds: result.entityIds,
      status: result.success ? 'SUCCESS' : 'FAILED',
    });

    return {
      ...result,
      wasIdempotent: false,
    };
  }
}
