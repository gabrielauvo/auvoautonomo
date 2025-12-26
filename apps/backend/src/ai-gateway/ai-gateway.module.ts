/**
 * AI Gateway Module
 * Main module for AI Copilot functionality
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiGatewayController } from './ai-gateway.controller';
import { AiGatewayService } from './services/ai-gateway.service';
import { AiConversationService } from './services/ai-conversation.service';
import { AiPlanService } from './services/ai-plan.service';
import { AiAuditService } from './services/ai-audit.service';
import { ToolRegistryService } from './services/tool-registry.service';
import { ToolExecutorService } from './services/tool-executor.service';
import { IdempotencyService } from './services/idempotency.service';
import { ChatOrchestratorService } from './services/chat-orchestrator.service';
import { LLMService } from './llm/llm.service';
import { ConversationStateService } from './state-machine/conversation-state.service';
import { PrismaModule } from '../prisma/prisma.module';
import { KbModule } from '../kb/kb.module';

// Tools
import { ClientsListTool } from './tools/clients/clients-list.tool';
import { ClientsGetTool } from './tools/clients/clients-get.tool';
import { ClientsCreateTool } from './tools/clients/clients-create.tool';
import { ClientsUpdateTool } from './tools/clients/clients-update.tool';
import { QuotesListTool } from './tools/quotes/quotes-list.tool';
import { QuotesGetTool } from './tools/quotes/quotes-get.tool';
import { QuotesCreateTool } from './tools/quotes/quotes-create.tool';
import { WorkOrdersListTool } from './tools/work-orders/work-orders-list.tool';
import { WorkOrdersGetTool } from './tools/work-orders/work-orders-get.tool';
import { WorkOrdersCreateTool } from './tools/work-orders/work-orders-create.tool';
import { WorkOrdersUpdateStatusTool } from './tools/work-orders/work-orders-update-status.tool';
import { PaymentsListTool } from './tools/payments/payments-list.tool';
import { PaymentsPreviewTool } from './tools/payments/payments-preview.tool';
import { PaymentsCreateTool } from './tools/payments/payments-create.tool';

const TOOLS = [
  // Clients
  ClientsListTool,
  ClientsGetTool,
  ClientsCreateTool,
  ClientsUpdateTool,
  // Quotes
  QuotesListTool,
  QuotesGetTool,
  QuotesCreateTool,
  // Work Orders
  WorkOrdersListTool,
  WorkOrdersGetTool,
  WorkOrdersCreateTool,
  WorkOrdersUpdateStatusTool,
  // Payments
  PaymentsListTool,
  PaymentsPreviewTool,
  PaymentsCreateTool,
];

@Module({
  imports: [PrismaModule, ConfigModule, KbModule],
  controllers: [AiGatewayController],
  providers: [
    // Core services
    AiGatewayService,
    AiConversationService,
    AiPlanService,
    AiAuditService,
    ToolRegistryService,
    ToolExecutorService,
    IdempotencyService,
    // LLM and Orchestration
    LLMService,
    ConversationStateService,
    ChatOrchestratorService,
    // Tools
    ...TOOLS,
  ],
  exports: [
    AiGatewayService,
    ToolRegistryService,
    ToolExecutorService,
    IdempotencyService,
    LLMService,
    ChatOrchestratorService,
  ],
})
export class AiGatewayModule {}
