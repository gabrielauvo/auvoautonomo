/**
 * AI Conversation Service
 * Manages AI conversation lifecycle and message history
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiConversationStatus } from '../enums';

const CONVERSATION_EXPIRY_HOURS = 24;

@Injectable()
export class AiConversationService {
  private readonly logger = new Logger(AiConversationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new conversation
   */
  async createConversation(userId: string, title?: string) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + CONVERSATION_EXPIRY_HOURS);

    const conversation = await this.prisma.aiConversation.create({
      data: {
        userId,
        title,
        status: AiConversationStatus.ACTIVE,
        expiresAt,
      },
    });

    this.logger.log(`Created conversation ${conversation.id} for user ${userId}`);
    return conversation;
  }

  /**
   * Get an active conversation by ID (with ownership check)
   */
  async getConversation(conversationId: string, userId: string) {
    const conversation = await this.prisma.aiConversation.findFirst({
      where: {
        id: conversationId,
        userId, // CRITICAL: Multi-tenant filter
        status: AiConversationStatus.ACTIVE,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  /**
   * Get or create an active conversation for a user
   */
  async getOrCreateActiveConversation(userId: string) {
    // Look for an existing active conversation
    const existing = await this.prisma.aiConversation.findFirst({
      where: {
        userId,
        status: AiConversationStatus.ACTIVE,
        expiresAt: { gt: new Date() },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (existing) {
      return existing;
    }

    // Create new conversation
    return this.createConversation(userId);
  }

  /**
   * Add a message to a conversation
   */
  async addMessage(
    conversationId: string,
    userId: string,
    data: {
      role: 'user' | 'assistant' | 'system';
      content: string;
      toolCalls?: unknown;
      toolResults?: unknown;
      tokenCount?: number;
      latencyMs?: number;
    },
  ) {
    // Verify ownership first
    const conversation = await this.prisma.aiConversation.findFirst({
      where: {
        id: conversationId,
        userId, // CRITICAL: Multi-tenant filter
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Create message and update conversation in a transaction
    const [message] = await this.prisma.$transaction([
      this.prisma.aiMessage.create({
        data: {
          conversationId,
          role: data.role,
          content: data.content,
          toolCalls: data.toolCalls as object,
          toolResults: data.toolResults as object,
          tokenCount: data.tokenCount,
          latencyMs: data.latencyMs,
        },
      }),
      this.prisma.aiConversation.update({
        where: { id: conversationId },
        data: {
          messageCount: { increment: 1 },
          lastMessageAt: new Date(),
          // Extend expiration on activity
          expiresAt: new Date(Date.now() + CONVERSATION_EXPIRY_HOURS * 60 * 60 * 1000),
        },
      }),
    ]);

    return message;
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(conversationId: string, userId: string) {
    // Verify ownership first
    const conversation = await this.prisma.aiConversation.findFirst({
      where: {
        id: conversationId,
        userId, // CRITICAL: Multi-tenant filter
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return this.prisma.aiMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Complete a conversation
   */
  async completeConversation(conversationId: string, userId: string) {
    const result = await this.prisma.aiConversation.updateMany({
      where: {
        id: conversationId,
        userId, // CRITICAL: Multi-tenant filter
      },
      data: {
        status: AiConversationStatus.COMPLETED,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Conversation not found');
    }

    this.logger.log(`Completed conversation ${conversationId}`);
  }

  /**
   * Get recent conversations for a user
   */
  async getRecentConversations(userId: string, limit = 10) {
    return this.prisma.aiConversation.findMany({
      where: {
        userId, // CRITICAL: Multi-tenant filter
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        title: true,
        status: true,
        messageCount: true,
        lastMessageAt: true,
        createdAt: true,
      },
    });
  }

  /**
   * Update conversation title
   */
  async updateTitle(conversationId: string, userId: string, title: string) {
    const result = await this.prisma.aiConversation.updateMany({
      where: {
        id: conversationId,
        userId, // CRITICAL: Multi-tenant filter
      },
      data: { title },
    });

    if (result.count === 0) {
      throw new NotFoundException('Conversation not found');
    }
  }

  /**
   * Cleanup expired conversations (run via cron)
   */
  async cleanupExpiredConversations(): Promise<number> {
    const result = await this.prisma.aiConversation.updateMany({
      where: {
        status: AiConversationStatus.ACTIVE,
        expiresAt: { lt: new Date() },
      },
      data: {
        status: AiConversationStatus.EXPIRED,
      },
    });

    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} conversations`);
    }

    return result.count;
  }
}
