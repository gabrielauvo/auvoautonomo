/**
 * Conversation State Service
 * Persists and manages conversation state in database
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ConversationState,
  ConversationStateData,
  PendingPlan,
  getDefaultStateData,
  isValidTransition,
} from './conversation-state';

@Injectable()
export class ConversationStateService {
  private readonly logger = new Logger(ConversationStateService.name);
  private readonly PLAN_EXPIRY_MINUTES = 5;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get current state for a conversation
   */
  async getState(conversationId: string): Promise<ConversationStateData> {
    try {
      const conversation = await this.prisma.aiConversation.findUnique({
        where: { id: conversationId },
        select: { metadata: true },
      });

      if (!conversation?.metadata) {
        return getDefaultStateData();
      }

      const metadata = conversation.metadata as Record<string, unknown>;
      const stateData = metadata.stateData as ConversationStateData | undefined;

      if (!stateData) {
        return getDefaultStateData();
      }

      // Check if pending plan has expired
      if (stateData.pendingPlan) {
        const expiresAt = new Date(stateData.pendingPlan.expiresAt);
        if (expiresAt < new Date()) {
          this.logger.log(`Pending plan expired for conversation ${conversationId}`);
          return {
            ...stateData,
            state: ConversationState.IDLE,
            pendingPlan: undefined,
          };
        }
      }

      return stateData;
    } catch (error) {
      this.logger.error(`Failed to get state: ${error}`);
      return getDefaultStateData();
    }
  }

  /**
   * Update conversation state
   */
  async setState(
    conversationId: string,
    newState: ConversationState,
    updates?: Partial<ConversationStateData>,
  ): Promise<ConversationStateData> {
    try {
      const currentStateData = await this.getState(conversationId);

      // Validate transition
      if (!isValidTransition(currentStateData.state, newState)) {
        this.logger.warn(
          `Invalid state transition from ${currentStateData.state} to ${newState}`,
        );
        // Allow it anyway for flexibility, but log warning
      }

      const newStateData: ConversationStateData = {
        ...currentStateData,
        ...updates,
        state: newState,
      };

      // Get current metadata
      const conversation = await this.prisma.aiConversation.findUnique({
        where: { id: conversationId },
        select: { metadata: true },
      });

      const currentMetadata = (conversation?.metadata as Record<string, unknown>) || {};

      // Update metadata with new state data
      await this.prisma.aiConversation.update({
        where: { id: conversationId },
        data: {
          metadata: {
            ...currentMetadata,
            stateData: newStateData,
          } as any,
        },
      });

      this.logger.log(
        `State transition: ${currentStateData.state} -> ${newState} for conversation ${conversationId}`,
      );

      return newStateData;
    } catch (error) {
      this.logger.error(`Failed to set state: ${error}`);
      throw error;
    }
  }

  /**
   * Create a pending plan
   */
  async createPendingPlan(
    conversationId: string,
    plan: Omit<PendingPlan, 'id' | 'createdAt' | 'expiresAt'>,
  ): Promise<PendingPlan> {
    const pendingPlan: PendingPlan = {
      ...plan,
      id: `plan_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.PLAN_EXPIRY_MINUTES * 60 * 1000),
    };

    await this.setState(conversationId, ConversationState.PLANNING, {
      pendingPlan,
    });

    return pendingPlan;
  }

  /**
   * Update pending plan with new fields
   */
  async updatePendingPlan(
    conversationId: string,
    updates: Partial<Pick<PendingPlan, 'collectedFields' | 'missingFields' | 'params'>>,
  ): Promise<PendingPlan | null> {
    const stateData = await this.getState(conversationId);

    if (!stateData.pendingPlan) {
      return null;
    }

    const updatedPlan: PendingPlan = {
      ...stateData.pendingPlan,
      ...updates,
      // Extend expiration when updating
      expiresAt: new Date(Date.now() + this.PLAN_EXPIRY_MINUTES * 60 * 1000),
    };

    // Determine new state based on missing fields
    const newState =
      updatedPlan.missingFields.length === 0
        ? ConversationState.AWAITING_CONFIRMATION
        : ConversationState.PLANNING;

    await this.setState(conversationId, newState, {
      pendingPlan: updatedPlan,
    });

    return updatedPlan;
  }

  /**
   * Clear pending plan and return to idle
   */
  async clearPendingPlan(conversationId: string): Promise<void> {
    await this.setState(conversationId, ConversationState.IDLE, {
      pendingPlan: undefined,
    });
  }

  /**
   * Move to executing state
   */
  async startExecution(conversationId: string): Promise<void> {
    await this.setState(conversationId, ConversationState.EXECUTING);
  }

  /**
   * Complete execution and return to idle
   */
  async completeExecution(
    conversationId: string,
    result: {
      tool: string;
      success: boolean;
      data?: unknown;
      error?: string;
    },
  ): Promise<void> {
    await this.setState(conversationId, ConversationState.IDLE, {
      pendingPlan: undefined,
      lastToolResult: result,
    });
  }

  /**
   * Store billing preview ID for later use
   */
  async storeBillingPreview(
    conversationId: string,
    previewId: string,
  ): Promise<void> {
    const stateData = await this.getState(conversationId);
    await this.setState(conversationId, stateData.state, {
      billingPreviewId: previewId,
    });
  }

  /**
   * Get and clear billing preview ID
   */
  async getBillingPreviewId(conversationId: string): Promise<string | undefined> {
    const stateData = await this.getState(conversationId);
    return stateData.billingPreviewId;
  }
}
