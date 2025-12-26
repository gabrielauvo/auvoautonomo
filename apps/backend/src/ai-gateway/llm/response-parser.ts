/**
 * LLM Response Parser
 * Robust parsing and validation of LLM responses using Zod
 */

import { z } from 'zod';
import { Logger } from '@nestjs/common';

// Base response types
export const LLMResponseTypeSchema = z.enum([
  'PLAN',
  'CALL_TOOL',
  'ASK_USER',
  'RESPONSE',
]);

export type LLMResponseType = z.infer<typeof LLMResponseTypeSchema>;

// PLAN response schema (without transforms to avoid Zod v4 issues)
export const PlanResponseSchema = z.object({
  type: z.literal('PLAN'),
  action: z.string(),
  collectedFields: z.record(z.string(), z.unknown()).optional(),
  missingFields: z.array(z.string()).optional(),
  suggestedActions: z.array(z.string()).optional(),
  requiresConfirmation: z.boolean().optional(),
  message: z.string().optional(),
});

// PlanResponse type with defaults applied
export interface PlanResponse {
  type: 'PLAN';
  action: string;
  collectedFields: Record<string, unknown>;
  missingFields: string[];
  suggestedActions: string[];
  requiresConfirmation: boolean;
  message?: string;
}

// CALL_TOOL response schema
export const CallToolResponseSchema = z.object({
  type: z.literal('CALL_TOOL'),
  tool: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
});

// CallToolResponse type with defaults
export interface CallToolResponse {
  type: 'CALL_TOOL';
  tool: string;
  params: Record<string, unknown>;
}

// ASK_USER response schema
export const AskUserResponseSchema = z.object({
  type: z.literal('ASK_USER'),
  question: z.string(),
  context: z.string().optional(),
  options: z.array(z.string()).optional(),
});

export type AskUserResponse = z.infer<typeof AskUserResponseSchema>;

// RESPONSE (informative) schema
export const InformativeResponseSchema = z.object({
  type: z.literal('RESPONSE'),
  message: z.string(),
  data: z.unknown().optional(),
});

export type InformativeResponse = z.infer<typeof InformativeResponseSchema>;

// Union type for structured responses
export type LLMStructuredResponse = PlanResponse | CallToolResponse | AskUserResponse | InformativeResponse;

// Helper to format Zod error
function formatZodError(error: z.ZodError): string {
  return error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
}

// Helper to validate by type and apply defaults
function validateByType(json: Record<string, unknown>): { success: boolean; response?: LLMStructuredResponse; error?: string } {
  const type = json.type;

  switch (type) {
    case 'PLAN': {
      const planResult = PlanResponseSchema.safeParse(json);
      if (planResult.success) {
        // Apply defaults for optional fields
        const response: PlanResponse = {
          type: 'PLAN',
          action: planResult.data.action,
          collectedFields: planResult.data.collectedFields ?? {},
          missingFields: planResult.data.missingFields ?? [],
          suggestedActions: planResult.data.suggestedActions ?? [],
          requiresConfirmation: planResult.data.requiresConfirmation ?? true,
          message: planResult.data.message,
        };
        return { success: true, response };
      }
      return { success: false, error: formatZodError(planResult.error) };
    }

    case 'CALL_TOOL': {
      const toolResult = CallToolResponseSchema.safeParse(json);
      if (toolResult.success) {
        // Apply defaults for optional fields
        const response: CallToolResponse = {
          type: 'CALL_TOOL',
          tool: toolResult.data.tool,
          params: toolResult.data.params ?? {},
        };
        return { success: true, response };
      }
      return { success: false, error: formatZodError(toolResult.error) };
    }

    case 'ASK_USER': {
      const askResult = AskUserResponseSchema.safeParse(json);
      if (askResult.success) {
        return { success: true, response: askResult.data };
      }
      return { success: false, error: formatZodError(askResult.error) };
    }

    case 'RESPONSE': {
      const responseResult = InformativeResponseSchema.safeParse(json);
      if (responseResult.success) {
        return { success: true, response: responseResult.data };
      }
      return { success: false, error: formatZodError(responseResult.error) };
    }

    default:
      return { success: false, error: `Unknown response type: ${type}` };
  }
}

/**
 * Result of parsing attempt
 */
export interface ParseResult {
  success: boolean;
  response?: LLMStructuredResponse;
  rawText?: string;
  error?: string;
}

/**
 * LLM Response Parser Service
 */
export class LLMResponseParser {
  private readonly logger = new Logger(LLMResponseParser.name);

  /**
   * Parse LLM response content into structured format
   */
  parse(content: string): ParseResult {
    if (!content || typeof content !== 'string') {
      return {
        success: false,
        error: 'Empty or invalid content',
      };
    }

    // Try to extract JSON from the content
    const jsonResult = this.extractJSON(content);

    if (jsonResult.success && jsonResult.json) {
      // Validate against schema
      const validationResult = this.validateResponse(jsonResult.json);

      if (validationResult.success) {
        return {
          success: true,
          response: validationResult.response,
        };
      }

      // Check if this is an unknown type (should be treated as plain text)
      const errorStr = validationResult.error || '';
      if (errorStr.includes('Unknown response type')) {
        this.logger.warn(`Invalid JSON structure: ${validationResult.error}`);
        // Treat unknown types as plain text response
        return {
          success: true,
          response: {
            type: 'RESPONSE',
            message: content.trim(),
          },
        };
      }

      // JSON found with known type but invalid structure
      this.logger.warn(`Invalid JSON structure: ${validationResult.error}`);
      return {
        success: false,
        rawText: content,
        error: `Invalid response structure: ${validationResult.error}`,
      };
    }

    // No valid JSON found, treat as plain text response
    return {
      success: true,
      response: {
        type: 'RESPONSE',
        message: content.trim(),
      },
    };
  }

  /**
   * Extract JSON from content (handles markdown code blocks)
   */
  private extractJSON(content: string): { success: boolean; json?: unknown } {
    const trimmed = content.trim();

    // Try direct JSON parse first
    try {
      const parsed = JSON.parse(trimmed);
      return { success: true, json: parsed };
    } catch {
      // Not direct JSON, continue
    }

    // Try to extract from markdown code blocks
    const codeBlockPatterns = [
      /```json\s*([\s\S]*?)```/g,
      /```\s*([\s\S]*?)```/g,
    ];

    for (const pattern of codeBlockPatterns) {
      const matches = [...content.matchAll(pattern)];
      for (const match of matches) {
        try {
          const jsonContent = match[1].trim();
          const parsed = JSON.parse(jsonContent);
          return { success: true, json: parsed };
        } catch {
          // Continue to next match
        }
      }
    }

    // Try to find JSON-like object in content
    const jsonObjectPattern = /\{[\s\S]*"type"\s*:\s*"[A-Z_]+"/;
    const objectMatch = content.match(jsonObjectPattern);

    if (objectMatch) {
      // Find the complete JSON object
      const startIndex = content.indexOf(objectMatch[0]);
      let braceCount = 0;
      let endIndex = startIndex;

      for (let i = startIndex; i < content.length; i++) {
        if (content[i] === '{') braceCount++;
        if (content[i] === '}') braceCount--;
        if (braceCount === 0) {
          endIndex = i + 1;
          break;
        }
      }

      try {
        const jsonStr = content.substring(startIndex, endIndex);
        const parsed = JSON.parse(jsonStr);
        return { success: true, json: parsed };
      } catch {
        // Continue
      }
    }

    return { success: false };
  }

  /**
   * Validate parsed JSON against response schemas
   */
  private validateResponse(json: unknown): { success: boolean; response?: LLMStructuredResponse; error?: string } {
    if (typeof json !== 'object' || json === null || !('type' in json)) {
      return { success: false, error: 'Invalid JSON structure: missing type field' };
    }
    return validateByType(json as Record<string, unknown>);
  }

  /**
   * Check if response is a plan requiring confirmation
   */
  isPlanResponse(response: LLMStructuredResponse): response is PlanResponse {
    return response.type === 'PLAN';
  }

  /**
   * Check if response is a tool call
   */
  isToolCall(response: LLMStructuredResponse): response is CallToolResponse {
    return response.type === 'CALL_TOOL';
  }

  /**
   * Check if response requires user input
   */
  isAskUser(response: LLMStructuredResponse): response is AskUserResponse {
    return response.type === 'ASK_USER';
  }

  /**
   * Check if response is informative
   */
  isInformativeResponse(response: LLMStructuredResponse): response is InformativeResponse {
    return response.type === 'RESPONSE';
  }

  /**
   * Check if plan has missing required fields
   */
  planHasMissingFields(plan: PlanResponse): boolean {
    return plan.missingFields.length > 0;
  }

  /**
   * Check if plan is ready for confirmation
   */
  planIsReadyForConfirmation(plan: PlanResponse): boolean {
    return plan.missingFields.length === 0 && plan.requiresConfirmation;
  }

  /**
   * Check if tool is a billing tool requiring preview
   */
  isBillingCreateTool(toolName: string): boolean {
    return toolName === 'billing.createCharge';
  }

  /**
   * Check if tool is a write operation
   */
  isWriteTool(toolName: string): boolean {
    const writeTools = [
      'customers.create',
      'workOrders.create',
      'quotes.create',
      'billing.createCharge',
    ];
    return writeTools.includes(toolName);
  }
}

// Export singleton instance
export const responseParser = new LLMResponseParser();
