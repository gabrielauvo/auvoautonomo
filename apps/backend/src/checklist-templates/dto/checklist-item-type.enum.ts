import {
  ChecklistQuestionType,
  ChecklistItemType as PrismaChecklistItemType
} from '@prisma/client';

// Re-export Prisma enums for use in DTOs
export { ChecklistQuestionType };

// Export the old ChecklistItemType for backward compatibility with legacy modules
// Re-export the Prisma enum directly
export const ChecklistItemType = PrismaChecklistItemType;
export type ChecklistItemType = typeof PrismaChecklistItemType[keyof typeof PrismaChecklistItemType];

// Define condition operators locally since they're stored in JSON
export enum ConditionOperator {
  EQUALS = 'EQUALS',
  NOT_EQUALS = 'NOT_EQUALS',
  GREATER_THAN = 'GREATER_THAN',
  LESS_THAN = 'LESS_THAN',
  GREATER_THAN_OR_EQUAL = 'GREATER_THAN_OR_EQUAL',
  LESS_THAN_OR_EQUAL = 'LESS_THAN_OR_EQUAL',
  CONTAINS = 'CONTAINS',
  NOT_CONTAINS = 'NOT_CONTAINS',
  IS_EMPTY = 'IS_EMPTY',
  IS_NOT_EMPTY = 'IS_NOT_EMPTY',
  IN = 'IN',
  NOT_IN = 'NOT_IN',
}

export enum ConditionAction {
  SHOW = 'SHOW',
  HIDE = 'HIDE',
  REQUIRE = 'REQUIRE',
  SKIP_TO = 'SKIP_TO',
}

// Types for conditional logic
export interface ConditionalRule {
  questionId: string;
  operator: ConditionOperator;
  value: any;
  action: ConditionAction;
  targetQuestionId?: string;
  targetSectionId?: string;
}

export interface ConditionalLogic {
  rules: ConditionalRule[];
  logic?: 'AND' | 'OR';
}

// Legacy interface for backward compatibility
export interface ItemCondition {
  dependsOnItemId?: string;
  operator?: ConditionOperator;
  value?: any;
  logic?: 'AND' | 'OR';
  conditions?: ItemCondition[];
}

// Types for question options
export interface QuestionOption {
  value: string;
  label: string;
  order?: number;
}

// Types for validations
export interface QuestionValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  patternMessage?: string;
  minPhotos?: number;
  maxPhotos?: number;
  allowedFileTypes?: string[];
  maxFileSize?: number;
}

// Types for question metadata
export interface QuestionMetadata {
  scaleMin?: number;
  scaleMax?: number;
  scaleLabels?: { min: string; max: string };
  ratingType?: 'stars' | 'numbers' | 'emoji';
  photoInstructions?: string;
  signatureInstructions?: string;
  helpText?: string;
  defaultValue?: any;
}
