import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChecklistTemplatesService } from '../checklist-templates/checklist-templates.service';
import {
  CreateChecklistInstanceDto,
  AttachChecklistsToWorkOrderDto,
  UpdateInstanceStatusDto,
  SubmitAnswerDto,
  BatchSubmitAnswersDto,
  SyncOfflineAnswersDto,
  SyncAttachmentDto,
} from './dto';
import { ChecklistInstanceStatus, ChecklistQuestionType, ChecklistAttachmentType } from '@prisma/client';
import {
  StorageProvider,
  STORAGE_PROVIDER,
} from '../file-storage/providers/storage-provider.interface';
import { randomUUID } from 'crypto';

@Injectable()
export class ChecklistInstancesService {
  private readonly logger = new Logger(ChecklistInstancesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly templatesService: ChecklistTemplatesService,
    @Inject(STORAGE_PROVIDER)
    private readonly storageProvider: StorageProvider,
  ) {}

  // ============================================
  // INSTANCE CRUD
  // ============================================

  async create(userId: string, dto: CreateChecklistInstanceDto) {
    // Verify work order belongs to user
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: dto.workOrderId, userId },
    });

    if (!workOrder) {
      throw new NotFoundException(
        `Work Order ${dto.workOrderId} não encontrada`,
      );
    }

    // Get template snapshot
    const snapshot = await this.templatesService.getTemplateSnapshot(
      userId,
      dto.templateId,
    );

    // Check if already has instance of this template
    const existing = await this.prisma.checklistInstance.findFirst({
      where: {
        workOrderId: dto.workOrderId,
        templateId: dto.templateId,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Work Order já possui instância deste template`,
      );
    }

    return this.prisma.checklistInstance.create({
      data: {
        workOrderId: dto.workOrderId,
        templateId: dto.templateId,
        templateVersionSnapshot: JSON.parse(JSON.stringify(snapshot)),
        status: ChecklistInstanceStatus.PENDING,
      },
      include: {
        template: {
          select: { name: true },
        },
      },
    });
  }

  async attachToWorkOrder(
    userId: string,
    workOrderId: string,
    dto: AttachChecklistsToWorkOrderDto,
  ) {
    // Verify work order belongs to user
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, userId },
    });

    if (!workOrder) {
      throw new NotFoundException(`Work Order ${workOrderId} não encontrada`);
    }

    const results: any[] = [];

    for (const templateId of dto.templateIds) {
      try {
        // Validar que o template pertence ao usuário ANTES de criar a instância
        const template = await this.prisma.checklistTemplate.findFirst({
          where: { id: templateId, userId },
        });

        if (!template) {
          throw new ForbiddenException(
            `Template ${templateId} não pertence a você ou não existe`,
          );
        }

        const instance = await this.create(userId, {
          workOrderId,
          templateId,
        });
        results.push({ templateId, success: true, instance });
      } catch (error: any) {
        results.push({
          templateId,
          success: false,
          error: error.message,
        });
      }
    }

    return {
      workOrderId,
      attached: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  async findByWorkOrder(userId: string, workOrderId: string) {
    // Verify work order belongs to user
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, userId },
    });

    if (!workOrder) {
      throw new NotFoundException(`Work Order ${workOrderId} não encontrada`);
    }

    return this.prisma.checklistInstance.findMany({
      where: { workOrderId },
      include: {
        template: {
          select: {
            name: true,
            description: true,
            _count: {
              select: { questions: true, sections: true },
            },
          },
        },
        _count: {
          select: { answers: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(userId: string, instanceId: string) {
    const instance = await this.prisma.checklistInstance.findFirst({
      where: { id: instanceId },
      include: {
        workOrder: {
          select: { userId: true, title: true },
        },
        template: {
          select: { name: true },
        },
        answers: {
          include: {
            attachments: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!instance) {
      throw new NotFoundException(`Instância ${instanceId} não encontrada`);
    }

    if (instance.workOrder.userId !== userId) {
      throw new ForbiddenException('Sem permissão para acessar esta instância');
    }

    return instance;
  }

  async getInstanceWithSnapshot(userId: string, instanceId: string) {
    const instance = await this.findOne(userId, instanceId);

    // Parse the snapshot and merge with answers
    const snapshot = instance.templateVersionSnapshot as any;

    // Create a map of answers by questionId
    const answersMap = new Map(
      instance.answers.map((a) => [a.questionId, a]),
    );

    // Merge questions with answers
    const questionsWithAnswers = snapshot.questions.map((q: any) => ({
      ...q,
      answer: answersMap.get(q.id) || null,
    }));

    return {
      ...instance,
      snapshot: {
        ...snapshot,
        questions: questionsWithAnswers,
      },
    };
  }

  async updateStatus(
    userId: string,
    instanceId: string,
    dto: UpdateInstanceStatusDto,
  ) {
    const instance = await this.findOne(userId, instanceId);

    const updateData: any = {
      status: dto.status,
    };

    if (dto.status === ChecklistInstanceStatus.IN_PROGRESS && !instance.startedAt) {
      updateData.startedAt = new Date();
    }

    if (dto.status === ChecklistInstanceStatus.COMPLETED) {
      updateData.completedAt = new Date();
      updateData.completedBy = userId;
      updateData.progress = 100;
    }

    return this.prisma.checklistInstance.update({
      where: { id: instanceId },
      data: updateData,
    });
  }

  async remove(userId: string, instanceId: string) {
    await this.findOne(userId, instanceId);

    return this.prisma.checklistInstance.delete({
      where: { id: instanceId },
    });
  }

  // ============================================
  // ANSWERS
  // ============================================

  async submitAnswer(
    userId: string,
    instanceId: string,
    dto: SubmitAnswerDto,
  ) {
    const instance = await this.findOne(userId, instanceId);

    if (instance.status === ChecklistInstanceStatus.COMPLETED) {
      throw new BadRequestException('Checklist já foi finalizado');
    }

    if (instance.status === ChecklistInstanceStatus.CANCELLED) {
      throw new BadRequestException('Checklist foi cancelado');
    }

    // Validate question exists in snapshot
    const snapshot = instance.templateVersionSnapshot as any;
    const question = snapshot.questions.find(
      (q: any) => q.id === dto.questionId,
    );

    if (!question) {
      throw new BadRequestException(
        `Pergunta ${dto.questionId} não encontrada no checklist`,
      );
    }

    // Validate answer type matches question type
    if (question.type !== dto.type) {
      throw new BadRequestException(
        `Tipo de resposta ${dto.type} não corresponde ao tipo da pergunta ${question.type}`,
      );
    }

    // Upsert answer
    const answer = await this.prisma.checklistAnswer.upsert({
      where: {
        instanceId_questionId: {
          instanceId,
          questionId: dto.questionId,
        },
      },
      create: {
        instanceId,
        questionId: dto.questionId,
        type: dto.type,
        valueText: dto.valueText,
        valueNumber: dto.valueNumber,
        valueBoolean: dto.valueBoolean,
        valueDate: dto.valueDate ? new Date(dto.valueDate) : null,
        valueJson: dto.valueJson,
        answeredBy: userId,
        deviceInfo: dto.deviceInfo,
        localId: dto.localId,
        syncedAt: new Date(),
      },
      update: {
        valueText: dto.valueText,
        valueNumber: dto.valueNumber,
        valueBoolean: dto.valueBoolean,
        valueDate: dto.valueDate ? new Date(dto.valueDate) : null,
        valueJson: dto.valueJson,
        answeredAt: new Date(),
        answeredBy: userId,
        deviceInfo: dto.deviceInfo,
        syncedAt: new Date(),
      },
    });

    // Process inline attachments if present
    if (dto.attachments && dto.attachments.length > 0) {
      const uploadedUrls = await this.processInlineAttachments(
        userId,
        answer.id,
        instanceId,
        dto.attachments,
      );

      // Update valueJson with remote URLs (replacing local file:// paths)
      if (uploadedUrls.length > 0) {
        const existingJson = dto.valueJson || [];
        const existingUrls = Array.isArray(existingJson) ? existingJson : [];

        // Filter out local file:// paths and add remote URLs
        const remoteUrls = existingUrls.filter(
          (url: string) => typeof url === 'string' && url.startsWith('http'),
        );
        const newValueJson = [...remoteUrls, ...uploadedUrls];

        await this.prisma.checklistAnswer.update({
          where: { id: answer.id },
          data: { valueJson: newValueJson },
        });
      }
    }

    // Update instance status and progress
    if (instance.status === ChecklistInstanceStatus.PENDING) {
      await this.prisma.checklistInstance.update({
        where: { id: instanceId },
        data: {
          status: ChecklistInstanceStatus.IN_PROGRESS,
          startedAt: new Date(),
        },
      });
    }

    await this.updateProgress(instanceId);

    return answer;
  }

  /**
   * Process inline attachments (base64) and upload to storage
   */
  private async processInlineAttachments(
    userId: string,
    answerId: string,
    instanceId: string,
    attachments: SyncAttachmentDto[],
  ): Promise<string[]> {
    const uploadedUrls: string[] = [];

    for (const att of attachments) {
      try {
        // Remove data URL prefix if present
        const base64Clean = att.data.replace(/^data:[\w/+-]+;base64,/, '');
        const buffer = Buffer.from(base64Clean, 'base64');

        // Detect mime type from base64 prefix or default to JPEG
        let mimeType = 'image/jpeg';
        if (att.data.startsWith('data:')) {
          const match = att.data.match(/^data:([^;]+);base64,/);
          if (match) {
            mimeType = match[1];
          }
        }

        // Generate filename
        const fileId = randomUUID();
        const ext = this.getExtFromMime(mimeType);
        const fileName = att.fileName || `${fileId}${ext}`;

        // Build storage path
        const storagePath = `checklists/${userId}/${instanceId}/${answerId}`;

        // Upload to storage
        const uploadResult = await this.storageProvider.upload({
          buffer,
          mimeType,
          path: storagePath,
          fileName: `${fileId}${ext}`,
        });

        // Determine attachment type
        let attachmentType: ChecklistAttachmentType = ChecklistAttachmentType.PHOTO;
        if (att.type === 'SIGNATURE') {
          attachmentType = ChecklistAttachmentType.SIGNATURE;
        } else if (att.type === 'DOCUMENT') {
          attachmentType = ChecklistAttachmentType.DOCUMENT;
        }

        // Create attachment record
        await this.prisma.checklistAttachment.create({
          data: {
            answerId,
            type: attachmentType,
            fileName,
            fileSize: buffer.length,
            mimeType,
            storagePath: uploadResult.storagePath,
            publicUrl: uploadResult.publicUrl,
            uploadedBy: userId,
            syncStatus: 'SYNCED',
          },
        });

        if (uploadResult.publicUrl) {
          uploadedUrls.push(uploadResult.publicUrl);
        }
        this.logger.log(`Inline attachment uploaded for answer ${answerId}: ${uploadResult.publicUrl || uploadResult.storagePath}`);
      } catch (error) {
        this.logger.error(`Failed to process inline attachment: ${error}`);
      }
    }

    return uploadedUrls;
  }

  private getExtFromMime(mimeType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/heic': '.heic',
      'image/heif': '.heif',
      'application/pdf': '.pdf',
    };
    return map[mimeType] || '.jpg';
  }

  async submitBatchAnswers(
    userId: string,
    instanceId: string,
    dto: BatchSubmitAnswersDto,
  ) {
    const instance = await this.findOne(userId, instanceId);

    if (instance.status === ChecklistInstanceStatus.COMPLETED) {
      throw new BadRequestException('Checklist já foi finalizado');
    }

    const results: any[] = [];

    for (const answer of dto.answers) {
      try {
        const result = await this.submitAnswer(userId, instanceId, {
          ...answer,
          deviceInfo: answer.deviceInfo || dto.deviceInfo,
        });
        results.push({ questionId: answer.questionId, success: true, answer: result });
      } catch (error: any) {
        results.push({
          questionId: answer.questionId,
          success: false,
          error: error.message,
        });
      }
    }

    return {
      instanceId,
      submitted: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  async syncOfflineAnswers(userId: string, dto: SyncOfflineAnswersDto) {
    let instance;

    try {
      instance = await this.findOne(userId, dto.instanceId);
    } catch (error) {
      // Instância não existe - tentar criar automaticamente se temos os dados necessários
      if (error instanceof NotFoundException && dto.workOrderId && dto.templateId) {
        this.logger.log(`Instance ${dto.instanceId} not found, creating automatically for offline sync`);

        try {
          // Verificar se OS existe
          const workOrder = await this.prisma.workOrder.findFirst({
            where: { id: dto.workOrderId, userId },
          });

          if (!workOrder) {
            throw new NotFoundException(`Work Order ${dto.workOrderId} não encontrada`);
          }

          // Buscar snapshot do template
          const snapshot = await this.templatesService.getTemplateSnapshot(userId, dto.templateId);

          // Usar upsert para evitar erro de constraint única em requisições concorrentes
          instance = await this.prisma.checklistInstance.upsert({
            where: { id: dto.instanceId },
            update: {}, // Não atualizar nada se já existir
            create: {
              id: dto.instanceId, // Usar o ID do mobile
              workOrderId: dto.workOrderId,
              templateId: dto.templateId,
              status: ChecklistInstanceStatus.IN_PROGRESS,
              templateVersionSnapshot: JSON.parse(JSON.stringify(snapshot)), // Garantir serialização correta para Prisma Json
            },
            include: {
              answers: true,
              template: true,
            },
          });

          this.logger.log(`Instance ${dto.instanceId} created/found successfully for offline sync`);
        } catch (createError: any) {
          this.logger.error(`Failed to create instance for offline sync: ${createError.message}`);
          throw new NotFoundException(`Instância ${dto.instanceId} não encontrada e não foi possível criar automaticamente: ${createError.message}`);
        }
      } else {
        // Não temos dados suficientes para criar - propagar erro original
        throw error;
      }
    }

    if (instance.status === ChecklistInstanceStatus.COMPLETED) {
      // For offline sync, we allow syncing even if completed (but mark as late sync)
    }

    const results: any[] = [];

    for (const answer of dto.answers) {
      try {
        // Check if answer with same localId already exists
        if (answer.localId) {
          const existing = await this.prisma.checklistAnswer.findFirst({
            where: { localId: answer.localId },
          });
          if (existing) {
            results.push({
              questionId: answer.questionId,
              localId: answer.localId,
              success: true,
              skipped: true,
              message: 'Already synced',
            });
            continue;
          }
        }

        const result = await this.submitAnswer(userId, dto.instanceId, {
          ...answer,
          deviceInfo: answer.deviceInfo || dto.deviceInfo,
        });

        results.push({
          questionId: answer.questionId,
          localId: answer.localId,
          success: true,
          answer: result,
        });
      } catch (error: any) {
        results.push({
          questionId: answer.questionId,
          localId: answer.localId,
          success: false,
          error: error.message,
        });
      }
    }

    return {
      instanceId: dto.instanceId,
      synced: results.filter((r) => r.success && !r.skipped).length,
      skipped: results.filter((r) => r.skipped).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  async getAnswers(userId: string, instanceId: string) {
    await this.findOne(userId, instanceId);

    return this.prisma.checklistAnswer.findMany({
      where: { instanceId },
      include: {
        attachments: true,
      },
      orderBy: { answeredAt: 'asc' },
    });
  }

  // ============================================
  // COMPLETION & VALIDATION
  // ============================================

  /**
   * Reopen a completed checklist to allow further editing
   */
  async reopenChecklist(userId: string, instanceId: string) {
    const instance = await this.findOne(userId, instanceId);

    if (instance.status !== ChecklistInstanceStatus.COMPLETED) {
      throw new BadRequestException('Apenas checklists finalizados podem ser reabertos');
    }

    // Verify the work order is in progress (reopened)
    const workOrder = await this.prisma.workOrder.findUnique({
      where: { id: instance.workOrder.userId === userId ? (instance as any).workOrderId : '' },
    });

    // Get workOrderId from instance
    const fullInstance = await this.prisma.checklistInstance.findFirst({
      where: { id: instanceId },
      include: { workOrder: true },
    });

    if (!fullInstance || fullInstance.workOrder.status !== 'IN_PROGRESS') {
      throw new BadRequestException('A ordem de serviço precisa estar em andamento para reabrir o checklist');
    }

    return this.prisma.checklistInstance.update({
      where: { id: instanceId },
      data: {
        status: ChecklistInstanceStatus.IN_PROGRESS,
        completedAt: null,
        completedBy: null,
      },
    });
  }

  async completeChecklist(userId: string, instanceId: string) {
    const instance = await this.getInstanceWithSnapshot(userId, instanceId);

    if (instance.status === ChecklistInstanceStatus.COMPLETED) {
      throw new BadRequestException('Checklist já foi finalizado');
    }

    // Validate all required questions are answered
    const snapshot = instance.snapshot as any;
    const missingRequired: string[] = [];

    for (const question of snapshot.questions) {
      if (question.isRequired && !question.answer) {
        // Check if question should be visible based on conditional logic
        const shouldBeVisible = this.evaluateConditionalLogic(
          question,
          snapshot.questions,
        );
        if (shouldBeVisible) {
          missingRequired.push(question.title);
        }
      }
    }

    if (missingRequired.length > 0) {
      throw new BadRequestException({
        message: 'Perguntas obrigatórias não respondidas',
        missingQuestions: missingRequired,
      });
    }

    return this.prisma.checklistInstance.update({
      where: { id: instanceId },
      data: {
        status: ChecklistInstanceStatus.COMPLETED,
        completedAt: new Date(),
        completedBy: userId,
        progress: 100,
      },
    });
  }

  async validateAnswers(userId: string, instanceId: string) {
    const instance = await this.getInstanceWithSnapshot(userId, instanceId);
    const snapshot = instance.snapshot as any;

    const validationResults: any[] = [];

    for (const question of snapshot.questions) {
      const validation: any = {
        questionId: question.id,
        title: question.title,
        isRequired: question.isRequired,
        hasAnswer: !!question.answer,
      };

      // Check if should be visible
      const shouldBeVisible = this.evaluateConditionalLogic(
        question,
        snapshot.questions,
      );
      validation.isVisible = shouldBeVisible;

      // Validate required
      if (question.isRequired && shouldBeVisible && !question.answer) {
        validation.isValid = false;
        validation.error = 'Resposta obrigatória';
      } else {
        validation.isValid = true;
      }

      // Validate value ranges if defined
      if (question.answer && question.validations) {
        const v = question.validations;
        const answer = question.answer;

        if (question.type === 'NUMBER' && answer.valueNumber !== null) {
          if (v.min !== undefined && answer.valueNumber < v.min) {
            validation.isValid = false;
            validation.error = `Valor mínimo: ${v.min}`;
          }
          if (v.max !== undefined && answer.valueNumber > v.max) {
            validation.isValid = false;
            validation.error = `Valor máximo: ${v.max}`;
          }
        }

        if (
          (question.type === 'TEXT_SHORT' || question.type === 'TEXT_LONG') &&
          answer.valueText
        ) {
          if (v.minLength && answer.valueText.length < v.minLength) {
            validation.isValid = false;
            validation.error = `Mínimo ${v.minLength} caracteres`;
          }
          if (v.maxLength && answer.valueText.length > v.maxLength) {
            validation.isValid = false;
            validation.error = `Máximo ${v.maxLength} caracteres`;
          }
        }
      }

      validationResults.push(validation);
    }

    const isComplete = validationResults.every(
      (v) => !v.isVisible || !v.isRequired || v.hasAnswer,
    );
    const isValid = validationResults.every((v) => v.isValid);

    return {
      instanceId,
      isComplete,
      isValid,
      canComplete: isComplete && isValid,
      totalQuestions: validationResults.length,
      answeredQuestions: validationResults.filter((v) => v.hasAnswer).length,
      requiredQuestions: validationResults.filter(
        (v) => v.isRequired && v.isVisible,
      ).length,
      validationResults,
    };
  }

  // ============================================
  // HELPERS
  // ============================================

  private async updateProgress(instanceId: string) {
    const instance = await this.prisma.checklistInstance.findFirst({
      where: { id: instanceId },
      include: {
        answers: true,
      },
    });

    if (!instance) return;

    const snapshot = instance.templateVersionSnapshot as any;
    const totalQuestions = snapshot.questions.filter(
      (q: any) => q.type !== ChecklistQuestionType.SECTION_TITLE,
    ).length;

    if (totalQuestions === 0) {
      await this.prisma.checklistInstance.update({
        where: { id: instanceId },
        data: { progress: 100 },
      });
      return;
    }

    const progress = Math.round(
      (instance.answers.length / totalQuestions) * 100,
    );

    await this.prisma.checklistInstance.update({
      where: { id: instanceId },
      data: { progress: Math.min(progress, 100) },
    });
  }

  private evaluateConditionalLogic(
    question: any,
    allQuestions: any[],
  ): boolean {
    if (!question.conditionalLogic?.rules?.length) {
      return true; // No conditions = always visible
    }

    const rules = question.conditionalLogic.rules;
    const logic = question.conditionalLogic.logic || 'AND';

    const results = rules.map((rule: any) => {
      const dependentQuestion = allQuestions.find(
        (q) => q.id === rule.questionId,
      );
      if (!dependentQuestion?.answer) {
        return false; // Dependent question not answered
      }

      const answer = dependentQuestion.answer;
      const answerValue = this.getAnswerValue(answer);

      return this.evaluateCondition(rule.operator, answerValue, rule.value);
    });

    if (logic === 'AND') {
      return results.every((r: boolean) => r);
    } else {
      return results.some((r: boolean) => r);
    }
  }

  private getAnswerValue(answer: any): any {
    if (answer.valueText !== null) return answer.valueText;
    if (answer.valueNumber !== null) return Number(answer.valueNumber);
    if (answer.valueBoolean !== null) return answer.valueBoolean;
    if (answer.valueDate !== null) return answer.valueDate;
    if (answer.valueJson !== null) return answer.valueJson;
    return null;
  }

  private evaluateCondition(
    operator: string,
    answerValue: any,
    conditionValue: any,
  ): boolean {
    switch (operator) {
      case 'EQUALS':
        return answerValue === conditionValue;
      case 'NOT_EQUALS':
        return answerValue !== conditionValue;
      case 'GREATER_THAN':
        return answerValue > conditionValue;
      case 'LESS_THAN':
        return answerValue < conditionValue;
      case 'GREATER_THAN_OR_EQUAL':
        return answerValue >= conditionValue;
      case 'LESS_THAN_OR_EQUAL':
        return answerValue <= conditionValue;
      case 'CONTAINS':
        return String(answerValue).includes(String(conditionValue));
      case 'NOT_CONTAINS':
        return !String(answerValue).includes(String(conditionValue));
      case 'IS_EMPTY':
        return answerValue === null || answerValue === '' || answerValue === undefined;
      case 'IS_NOT_EMPTY':
        return answerValue !== null && answerValue !== '' && answerValue !== undefined;
      case 'IN':
        return Array.isArray(conditionValue) && conditionValue.includes(answerValue);
      case 'NOT_IN':
        return Array.isArray(conditionValue) && !conditionValue.includes(answerValue);
      default:
        return true;
    }
  }
}
