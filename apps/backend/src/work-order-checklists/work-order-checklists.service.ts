import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkOrderChecklistDto } from './dto/create-checklist.dto';
import { SubmitAnswersDto, AnswerDto } from './dto/submit-answers.dto';
import { ChecklistItemType } from '../checklist-templates/dto/checklist-item-type.enum';
import { ConditionEvaluator } from './condition-evaluator';
import { Prisma } from '@prisma/client';

// Type for template item from JSON metadata
interface TemplateItem {
  id: string;
  type: ChecklistItemType;
  label: string;
  order: number;
  isRequired?: boolean;
  options?: string[];
  condition?: any;
}

@Injectable()
export class WorkOrderChecklistsService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // CREATE CHECKLIST FROM TEMPLATE
  // ============================================

  async create(userId: string, workOrderId: string, dto: CreateWorkOrderChecklistDto) {
    // Verify work order ownership
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, userId },
    });

    if (!workOrder) {
      throw new ForbiddenException(
        `Work order with ID ${workOrderId} not found or does not belong to you`,
      );
    }

    // Verify template ownership - use new ChecklistTemplate model
    const template = await this.prisma.checklistTemplate.findFirst({
      where: { id: dto.templateId, userId },
    });

    if (!template) {
      throw new ForbiddenException(
        `Template with ID ${dto.templateId} not found or does not belong to you`,
      );
    }

    // Create checklist with title snapshot
    const checklist = await this.prisma.workOrderChecklist.create({
      data: {
        workOrderId,
        templateId: dto.templateId,
        title: template.name, // Use 'name' field from new schema
      },
    });

    // Return checklist with answers
    return this.prisma.workOrderChecklist.findFirst({
      where: { id: checklist.id },
      include: {
        answers: true,
      },
    });
  }

  // ============================================
  // GET CHECKLISTS FOR WORK ORDER
  // ============================================

  async findAll(userId: string, workOrderId: string) {
    // Verify ownership
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, userId },
    });

    if (!workOrder) {
      throw new ForbiddenException(
        `Work order with ID ${workOrderId} not found or does not belong to you`,
      );
    }

    return this.prisma.workOrderChecklist.findMany({
      where: { workOrderId },
      include: {
        _count: {
          select: { answers: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ============================================
  // GET SINGLE CHECKLIST WITH ITEMS AND ANSWERS
  // ============================================

  async findOne(userId: string, workOrderId: string, checklistId: string) {
    // Verify ownership
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, userId },
    });

    if (!workOrder) {
      throw new ForbiddenException(
        `Work order with ID ${workOrderId} not found or does not belong to you`,
      );
    }

    const checklist = await this.prisma.workOrderChecklist.findFirst({
      where: { id: checklistId, workOrderId },
      include: {
        answers: true,
      },
    });

    if (!checklist) {
      throw new NotFoundException(`Checklist with ID ${checklistId} not found`);
    }

    // Fetch template questions separately
    const template = await this.prisma.checklistTemplate.findFirst({
      where: { id: checklist.templateId },
      include: {
        questions: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return {
      ...checklist,
      template,
    };
  }

  // ============================================
  // SUBMIT ANSWERS (WITH CONDITION VALIDATION)
  // ============================================

  async submitAnswers(
    userId: string,
    workOrderId: string,
    checklistId: string,
    dto: SubmitAnswersDto,
  ) {
    // Get checklist with template
    const checklistData = await this.findOne(userId, workOrderId, checklistId);
    const { template, answers: existingAnswers, ...checklist } = checklistData;

    if (!template) {
      throw new NotFoundException('Template not found for this checklist');
    }

    // Build answers map (questionId -> value)
    const answersMap = new Map<string, any>();
    existingAnswers.forEach((answer) => {
      answersMap.set(answer.templateItemId, ConditionEvaluator.extractAnswerValue(answer));
    });

    // Add new answers to map temporarily for validation
    dto.answers.forEach((answer) => {
      const value = this.extractValueFromAnswer(answer);
      answersMap.set(answer.templateItemId, value);
    });

    // Map questions by ID for validation
    const questionsMap = new Map(
      template.questions.map((q) => [q.id, q])
    );

    // Validate each answer
    for (const answer of dto.answers) {
      const question = questionsMap.get(answer.templateItemId);

      if (!question) {
        throw new BadRequestException(
          `Item with ID ${answer.templateItemId} does not exist in this template`,
        );
      }

      // Map old ChecklistItemType to new type for validation
      const expectedOldType = this.mapQuestionTypeToItemType(question.type);

      // Validate type matches
      if (answer.type !== expectedOldType) {
        throw new BadRequestException(
          `Answer type ${answer.type} does not match item type ${expectedOldType} for item "${question.title}"`,
        );
      }

      // Validate value is provided for the correct type
      this.validateAnswerValue(answer, answer.type);

      // Check condition (if using conditional logic)
      if (question.conditionalLogic) {
        const conditionMet = ConditionEvaluator.evaluate(
          question.conditionalLogic as any,
          answersMap
        );

        if (!conditionMet) {
          throw new BadRequestException(
            `Item "${question.title}" is not visible (condition not met) and cannot be answered`,
          );
        }
      }

      // Validate SELECT options
      if (answer.type === ChecklistItemType.SELECT && answer.valueSelect) {
        const options = question.options as any[];
        if (options && Array.isArray(options)) {
          const validOptions = options.map((o: any) =>
            typeof o === 'string' ? o : o.value || o.label
          );
          if (!validOptions.includes(answer.valueSelect)) {
            throw new BadRequestException(
              `Value "${answer.valueSelect}" is not a valid option for item "${question.title}"`,
            );
          }
        }
      }
    }

    // Save answers (upsert)
    const savedAnswers: any[] = [];

    for (const answer of dto.answers) {
      const saved = await this.prisma.workOrderChecklistAnswer.upsert({
        where: {
          workOrderChecklistId_templateItemId: {
            workOrderChecklistId: checklistId,
            templateItemId: answer.templateItemId,
          },
        },
        update: {
          type: answer.type,
          valueText: answer.valueText || null,
          valueNumber: answer.valueNumber || null,
          valueBoolean: answer.valueBoolean !== undefined ? answer.valueBoolean : null,
          valuePhoto: answer.valuePhoto || null,
          valueSelect: answer.valueSelect || null,
        },
        create: {
          workOrderChecklistId: checklistId,
          templateItemId: answer.templateItemId,
          type: answer.type,
          valueText: answer.valueText || null,
          valueNumber: answer.valueNumber || null,
          valueBoolean: answer.valueBoolean !== undefined ? answer.valueBoolean : null,
          valuePhoto: answer.valuePhoto || null,
          valueSelect: answer.valueSelect || null,
        },
      });

      savedAnswers.push(saved);
    }

    return {
      message: 'Answers submitted successfully',
      answersCount: savedAnswers.length,
      answers: savedAnswers,
    };
  }

  // ============================================
  // DELETE CHECKLIST
  // ============================================

  async remove(userId: string, workOrderId: string, checklistId: string) {
    await this.findOne(userId, workOrderId, checklistId);

    return this.prisma.workOrderChecklist.delete({
      where: { id: checklistId },
    });
  }

  // ============================================
  // HELPERS
  // ============================================

  private mapQuestionTypeToItemType(questionType: string): ChecklistItemType {
    // Map new ChecklistQuestionType to legacy ChecklistItemType
    const typeMap: Record<string, ChecklistItemType> = {
      'TEXT_SHORT': ChecklistItemType.TEXT,
      'TEXT_LONG': ChecklistItemType.TEXT,
      'NUMBER': ChecklistItemType.NUMERIC,
      'DATE': ChecklistItemType.TEXT,
      'TIME': ChecklistItemType.TEXT,
      'DATETIME': ChecklistItemType.TEXT,
      'CHECKBOX': ChecklistItemType.BOOLEAN,
      'SELECT': ChecklistItemType.SELECT,
      'MULTI_SELECT': ChecklistItemType.SELECT,
      'PHOTO_REQUIRED': ChecklistItemType.PHOTO,
      'PHOTO_OPTIONAL': ChecklistItemType.PHOTO,
      'SIGNATURE_TECHNICIAN': ChecklistItemType.PHOTO,
      'SIGNATURE_CLIENT': ChecklistItemType.PHOTO,
      'SECTION_TITLE': ChecklistItemType.TEXT,
      'RATING': ChecklistItemType.NUMERIC,
      'SCALE': ChecklistItemType.NUMERIC,
    };
    return typeMap[questionType] || ChecklistItemType.TEXT;
  }

  private validateAnswerValue(answer: AnswerDto, expectedType: ChecklistItemType): void {
    let hasValue = false;

    switch (expectedType) {
      case ChecklistItemType.TEXT:
        hasValue = !!answer.valueText;
        if (!hasValue) {
          throw new BadRequestException('TEXT answer must have valueText');
        }
        break;

      case ChecklistItemType.NUMERIC:
        hasValue = answer.valueNumber !== undefined && answer.valueNumber !== null;
        if (!hasValue) {
          throw new BadRequestException('NUMERIC answer must have valueNumber');
        }
        break;

      case ChecklistItemType.BOOLEAN:
        hasValue = answer.valueBoolean !== undefined && answer.valueBoolean !== null;
        if (!hasValue) {
          throw new BadRequestException('BOOLEAN answer must have valueBoolean');
        }
        break;

      case ChecklistItemType.PHOTO:
        hasValue = !!answer.valuePhoto;
        if (!hasValue) {
          throw new BadRequestException('PHOTO answer must have valuePhoto');
        }
        break;

      case ChecklistItemType.SELECT:
        hasValue = !!answer.valueSelect;
        if (!hasValue) {
          throw new BadRequestException('SELECT answer must have valueSelect');
        }
        break;
    }
  }

  private extractValueFromAnswer(answer: AnswerDto): any {
    if (answer.valueBoolean !== undefined && answer.valueBoolean !== null) {
      return answer.valueBoolean;
    }
    if (answer.valueNumber !== undefined && answer.valueNumber !== null) {
      return answer.valueNumber;
    }
    if (answer.valueText) {
      return answer.valueText;
    }
    if (answer.valueSelect) {
      return answer.valueSelect;
    }
    if (answer.valuePhoto) {
      return answer.valuePhoto;
    }
    return null;
  }
}
