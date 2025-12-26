/**
 * Common DTOs and Validators for AI Gateway Tools
 */

import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsUUID,
  MinLength,
  MaxLength,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Base pagination parameters
 */
export class PaginationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset?: number = 0;
}

/**
 * Base search parameters with pagination
 */
export class SearchDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  query?: string;
}

/**
 * Base write operation parameters (requires idempotency key)
 */
export class WriteOperationDto {
  @IsString()
  @MinLength(10)
  @MaxLength(64)
  idempotencyKey: string;
}

/**
 * Base entity get parameters
 */
export class GetByIdDto {
  @IsUUID('4')
  id: string;
}

/**
 * Paginated response interface
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}

/**
 * Tool result interface
 */
export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  affectedEntities?: AffectedEntity[];
}

/**
 * Affected entity from tool execution
 */
export interface AffectedEntity {
  type: 'customer' | 'workOrder' | 'quote' | 'charge' | 'payment';
  id: string;
  action: 'created' | 'updated' | 'deleted' | 'read';
}

/**
 * Tool execution context
 */
export interface ToolContext {
  userId: string;
  conversationId?: string;
  planId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Error codes for tool operations
 */
export enum ToolErrorCode {
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  ENTITY_NOT_FOUND = 'ENTITY_NOT_FOUND',
  ENTITY_NOT_OWNED = 'ENTITY_NOT_OWNED',
  PLAN_LIMIT_EXCEEDED = 'PLAN_LIMIT_EXCEEDED',
  IDEMPOTENCY_CONFLICT = 'IDEMPOTENCY_CONFLICT',
  PREVIEW_EXPIRED = 'PREVIEW_EXPIRED',
  PREVIEW_REQUIRED = 'PREVIEW_REQUIRED',
  GATEWAY_ERROR = 'GATEWAY_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/**
 * Tool permission types
 */
export enum ToolPermission {
  CUSTOMERS_READ = 'customers:read',
  CUSTOMERS_WRITE = 'customers:write',
  WORK_ORDERS_READ = 'workOrders:read',
  WORK_ORDERS_WRITE = 'workOrders:write',
  QUOTES_READ = 'quotes:read',
  QUOTES_WRITE = 'quotes:write',
  BILLING_READ = 'billing:read',
  BILLING_WRITE = 'billing:write',
  KB_READ = 'kb:read',
}
