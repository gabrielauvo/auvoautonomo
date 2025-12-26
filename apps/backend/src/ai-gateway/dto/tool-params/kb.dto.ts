/**
 * Knowledge Base Tool DTOs
 */

import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

// ============================================================================
// Enums
// ============================================================================

export enum KnowledgeBaseCategory {
  GENERAL = 'general',
  BILLING = 'billing',
  WORK_ORDERS = 'workOrders',
  QUOTES = 'quotes',
  CUSTOMERS = 'customers',
}

// ============================================================================
// kb.search
// ============================================================================

export class KbSearchDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  query: string;

  @IsOptional()
  @IsEnum(KnowledgeBaseCategory)
  category?: KnowledgeBaseCategory;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  limit?: number = 5;
}

export interface KbSearchResult {
  content: string;
  source: string;
  relevanceScore: number;
  category: KnowledgeBaseCategory;
}

export interface KbSearchResponse {
  results: KbSearchResult[];
  totalResults: number;
}
