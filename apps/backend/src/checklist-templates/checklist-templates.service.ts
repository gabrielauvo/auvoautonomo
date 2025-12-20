import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChecklistTemplateDto } from './dto/create-template.dto';
import { UpdateChecklistTemplateDto } from './dto/update-template.dto';
import {
  CreateChecklistSectionDto,
  UpdateChecklistSectionDto,
} from './dto/create-section.dto';
import {
  CreateChecklistQuestionDto,
  UpdateChecklistQuestionDto,
  ReorderQuestionsDto,
} from './dto/create-question.dto';
import { ChecklistQuestionType } from '@prisma/client';

@Injectable()
export class ChecklistTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================
  // TEMPLATE CRUD
  // ============================================

  async create(userId: string, dto: CreateChecklistTemplateDto) {
    // Validate question types if provided
    if (dto.questions) {
      for (const q of dto.questions) {
        this.validateQuestionByType(q.type, q);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // Create template
      const template = await tx.checklistTemplate.create({
        data: {
          userId,
          name: dto.name,
          description: dto.description,
          isActive: dto.isActive ?? true,
        },
      });

      // Create sections if provided
      const sectionMap = new Map<number, string>(); // order -> id
      if (dto.sections && dto.sections.length > 0) {
        for (let i = 0; i < dto.sections.length; i++) {
          const section = await tx.checklistSection.create({
            data: {
              templateId: template.id,
              title: dto.sections[i].title,
              description: dto.sections[i].description,
              order: dto.sections[i].order ?? i,
            },
          });
          sectionMap.set(dto.sections[i].order ?? i, section.id);
        }
      }

      // Create questions if provided
      if (dto.questions && dto.questions.length > 0) {
        for (let i = 0; i < dto.questions.length; i++) {
          const q = dto.questions[i];
          // Resolve sectionId from sectionOrder if provided
          let resolvedSectionId = q.sectionId || null;
          if (!resolvedSectionId && q.sectionOrder !== undefined) {
            resolvedSectionId = sectionMap.get(q.sectionOrder) || null;
          }
          await tx.checklistQuestion.create({
            data: {
              templateId: template.id,
              sectionId: resolvedSectionId,
              type: q.type,
              title: q.title,
              description: q.description,
              placeholder: q.placeholder,
              isRequired: q.isRequired ?? false,
              order: q.order ?? i,
              options: q.options ? JSON.parse(JSON.stringify(q.options)) : null,
              validations: q.validations
                ? JSON.parse(JSON.stringify(q.validations))
                : null,
              conditionalLogic: q.conditionalLogic
                ? JSON.parse(JSON.stringify(q.conditionalLogic))
                : null,
              metadata: q.metadata
                ? JSON.parse(JSON.stringify(q.metadata))
                : null,
            },
          });
        }
      }

      // Return template with sections and questions within the transaction
      const result = await tx.checklistTemplate.findFirst({
        where: { id: template.id, userId },
        include: {
          sections: {
            orderBy: { order: 'asc' },
          },
          questions: {
            orderBy: { order: 'asc' },
          },
          _count: {
            select: { instances: true },
          },
        },
      });

      if (!result) {
        throw new NotFoundException(`Template com ID ${template.id} não encontrado`);
      }

      return result;
    });
  }

  async findAll(userId: string, includeInactive = false, includeDetails = false) {
    const where: any = { userId };
    if (!includeInactive) {
      where.isActive = true;
    }

    // Se includeDetails=true, retorna sections e questions completas (usado pelo mobile para offline)
    if (includeDetails) {
      return this.prisma.checklistTemplate.findMany({
        where,
        include: {
          sections: {
            orderBy: { order: 'asc' },
          },
          questions: {
            orderBy: { order: 'asc' },
          },
          _count: {
            select: {
              instances: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.prisma.checklistTemplate.findMany({
      where,
      include: {
        _count: {
          select: {
            sections: true,
            questions: true,
            instances: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const template = await this.prisma.checklistTemplate.findFirst({
      where: { id, userId },
      include: {
        sections: {
          orderBy: { order: 'asc' },
        },
        questions: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: { instances: true },
        },
      },
    });

    if (!template) {
      throw new NotFoundException(`Template com ID ${id} não encontrado`);
    }

    return template;
  }

  async update(userId: string, id: string, dto: UpdateChecklistTemplateDto) {
    await this.findOne(userId, id);

    // Increment version if structure changes
    const shouldIncrementVersion = dto.name !== undefined;

    return this.prisma.checklistTemplate.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        isActive: dto.isActive,
        ...(shouldIncrementVersion && { version: { increment: 1 } }),
      },
      include: {
        sections: {
          orderBy: { order: 'asc' },
        },
        questions: {
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async remove(userId: string, id: string) {
    const template = await this.findOne(userId, id);

    // Check if has instances
    if (template._count.instances > 0) {
      throw new BadRequestException(
        `Template possui ${template._count.instances} instância(s) vinculada(s). Desative-o ao invés de excluir.`,
      );
    }

    return this.prisma.checklistTemplate.delete({
      where: { id },
    });
  }

  async duplicate(userId: string, id: string, newName?: string) {
    const original = await this.findOne(userId, id);

    return this.prisma.$transaction(async (tx) => {
      // Create new template
      const newTemplate = await tx.checklistTemplate.create({
        data: {
          userId,
          name: newName || `${original.name} (Cópia)`,
          description: original.description,
          isActive: true,
          version: 1,
        },
      });

      // Map old section IDs to new ones
      const sectionIdMap = new Map<string, string>();

      // Duplicate sections
      for (const section of original.sections) {
        const newSection = await tx.checklistSection.create({
          data: {
            templateId: newTemplate.id,
            title: section.title,
            description: section.description,
            order: section.order,
          },
        });
        sectionIdMap.set(section.id, newSection.id);
      }

      // Duplicate questions
      for (const question of original.questions) {
        await tx.checklistQuestion.create({
          data: {
            templateId: newTemplate.id,
            sectionId: question.sectionId
              ? sectionIdMap.get(question.sectionId)
              : null,
            type: question.type,
            title: question.title,
            description: question.description,
            placeholder: question.placeholder,
            isRequired: question.isRequired,
            order: question.order,
            options: question.options ?? undefined,
            validations: question.validations ?? undefined,
            conditionalLogic: question.conditionalLogic ?? undefined,
            metadata: question.metadata ?? undefined,
          },
        });
      }

      return this.findOne(userId, newTemplate.id);
    });
  }

  // ============================================
  // SECTIONS CRUD
  // ============================================

  async createSection(
    userId: string,
    templateId: string,
    dto: CreateChecklistSectionDto,
  ) {
    await this.findOne(userId, templateId);

    // Get max order
    const maxOrder = await this.prisma.checklistSection.aggregate({
      where: { templateId },
      _max: { order: true },
    });

    const section = await this.prisma.checklistSection.create({
      data: {
        templateId,
        title: dto.title,
        description: dto.description,
        order: dto.order ?? (maxOrder._max.order ?? -1) + 1,
      },
    });

    // Increment template version
    await this.prisma.checklistTemplate.update({
      where: { id: templateId },
      data: { version: { increment: 1 } },
    });

    return section;
  }

  async updateSection(
    userId: string,
    templateId: string,
    sectionId: string,
    dto: UpdateChecklistSectionDto,
  ) {
    await this.findOne(userId, templateId);

    const section = await this.prisma.checklistSection.findFirst({
      where: { id: sectionId, templateId },
    });

    if (!section) {
      throw new NotFoundException(`Seção com ID ${sectionId} não encontrada`);
    }

    const updated = await this.prisma.checklistSection.update({
      where: { id: sectionId },
      data: {
        title: dto.title,
        description: dto.description,
        order: dto.order,
      },
    });

    // Increment template version
    await this.prisma.checklistTemplate.update({
      where: { id: templateId },
      data: { version: { increment: 1 } },
    });

    return updated;
  }

  async removeSection(userId: string, templateId: string, sectionId: string) {
    await this.findOne(userId, templateId);

    const section = await this.prisma.checklistSection.findFirst({
      where: { id: sectionId, templateId },
      include: {
        _count: { select: { questions: true } },
      },
    });

    if (!section) {
      throw new NotFoundException(`Seção com ID ${sectionId} não encontrada`);
    }

    // Move questions to no section (null)
    if (section._count.questions > 0) {
      await this.prisma.checklistQuestion.updateMany({
        where: { sectionId },
        data: { sectionId: null },
      });
    }

    await this.prisma.checklistSection.delete({
      where: { id: sectionId },
    });

    // Increment template version
    await this.prisma.checklistTemplate.update({
      where: { id: templateId },
      data: { version: { increment: 1 } },
    });

    return { message: 'Seção removida com sucesso' };
  }

  async reorderSections(
    userId: string,
    templateId: string,
    sectionIds: string[],
  ) {
    await this.findOne(userId, templateId);

    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < sectionIds.length; i++) {
        await tx.checklistSection.update({
          where: { id: sectionIds[i] },
          data: { order: i },
        });
      }

      // Increment template version
      await tx.checklistTemplate.update({
        where: { id: templateId },
        data: { version: { increment: 1 } },
      });
    });

    return this.findOne(userId, templateId);
  }

  // ============================================
  // QUESTIONS CRUD
  // ============================================

  async createQuestion(
    userId: string,
    templateId: string,
    dto: CreateChecklistQuestionDto,
  ) {
    await this.findOne(userId, templateId);
    this.validateQuestionByType(dto.type, dto);

    // Validate section belongs to template
    if (dto.sectionId) {
      const section = await this.prisma.checklistSection.findFirst({
        where: { id: dto.sectionId, templateId },
      });
      if (!section) {
        throw new BadRequestException(
          `Seção ${dto.sectionId} não pertence a este template`,
        );
      }
    }

    // Get max order
    const maxOrder = await this.prisma.checklistQuestion.aggregate({
      where: { templateId },
      _max: { order: true },
    });

    const question = await this.prisma.checklistQuestion.create({
      data: {
        templateId,
        sectionId: dto.sectionId || null,
        type: dto.type,
        title: dto.title,
        description: dto.description,
        placeholder: dto.placeholder,
        isRequired: dto.isRequired ?? false,
        order: dto.order ?? (maxOrder._max.order ?? -1) + 1,
        options: dto.options ? JSON.parse(JSON.stringify(dto.options)) : null,
        validations: dto.validations
          ? JSON.parse(JSON.stringify(dto.validations))
          : null,
        conditionalLogic: dto.conditionalLogic
          ? JSON.parse(JSON.stringify(dto.conditionalLogic))
          : null,
        metadata: dto.metadata
          ? JSON.parse(JSON.stringify(dto.metadata))
          : null,
      },
    });

    // Increment template version
    await this.prisma.checklistTemplate.update({
      where: { id: templateId },
      data: { version: { increment: 1 } },
    });

    return question;
  }

  async updateQuestion(
    userId: string,
    templateId: string,
    questionId: string,
    dto: UpdateChecklistQuestionDto,
  ) {
    await this.findOne(userId, templateId);

    const question = await this.prisma.checklistQuestion.findFirst({
      where: { id: questionId, templateId },
    });

    if (!question) {
      throw new NotFoundException(
        `Pergunta com ID ${questionId} não encontrada`,
      );
    }

    // Validate type/options consistency
    const newType = dto.type || question.type;
    this.validateQuestionByType(newType, {
      ...dto,
      type: newType,
      options: dto.options !== undefined ? dto.options : (question.options as any),
    });

    // Validate section if changing
    if (dto.sectionId && dto.sectionId !== question.sectionId) {
      const section = await this.prisma.checklistSection.findFirst({
        where: { id: dto.sectionId, templateId },
      });
      if (!section) {
        throw new BadRequestException(
          `Seção ${dto.sectionId} não pertence a este template`,
        );
      }
    }

    const updated = await this.prisma.checklistQuestion.update({
      where: { id: questionId },
      data: {
        type: dto.type,
        title: dto.title,
        description: dto.description,
        placeholder: dto.placeholder,
        isRequired: dto.isRequired,
        order: dto.order,
        sectionId: dto.sectionId,
        options:
          dto.options !== undefined
            ? JSON.parse(JSON.stringify(dto.options))
            : undefined,
        validations:
          dto.validations !== undefined
            ? JSON.parse(JSON.stringify(dto.validations))
            : undefined,
        conditionalLogic:
          dto.conditionalLogic !== undefined
            ? JSON.parse(JSON.stringify(dto.conditionalLogic))
            : undefined,
        metadata:
          dto.metadata !== undefined
            ? JSON.parse(JSON.stringify(dto.metadata))
            : undefined,
      },
    });

    // Increment template version
    await this.prisma.checklistTemplate.update({
      where: { id: templateId },
      data: { version: { increment: 1 } },
    });

    return updated;
  }

  async removeQuestion(
    userId: string,
    templateId: string,
    questionId: string,
  ) {
    await this.findOne(userId, templateId);

    const question = await this.prisma.checklistQuestion.findFirst({
      where: { id: questionId, templateId },
    });

    if (!question) {
      throw new NotFoundException(
        `Pergunta com ID ${questionId} não encontrada`,
      );
    }

    await this.prisma.checklistQuestion.delete({
      where: { id: questionId },
    });

    // Increment template version
    await this.prisma.checklistTemplate.update({
      where: { id: templateId },
      data: { version: { increment: 1 } },
    });

    return { message: 'Pergunta removida com sucesso' };
  }

  async reorderQuestions(
    userId: string,
    templateId: string,
    dto: ReorderQuestionsDto,
  ) {
    await this.findOne(userId, templateId);

    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < dto.questionIds.length; i++) {
        await tx.checklistQuestion.update({
          where: { id: dto.questionIds[i] },
          data: { order: i },
        });
      }

      // Increment template version
      await tx.checklistTemplate.update({
        where: { id: templateId },
        data: { version: { increment: 1 } },
      });
    });

    return this.findOne(userId, templateId);
  }

  async moveQuestionToSection(
    userId: string,
    templateId: string,
    questionId: string,
    sectionId: string | null,
  ) {
    await this.findOne(userId, templateId);

    if (sectionId) {
      const section = await this.prisma.checklistSection.findFirst({
        where: { id: sectionId, templateId },
      });
      if (!section) {
        throw new BadRequestException(
          `Seção ${sectionId} não pertence a este template`,
        );
      }
    }

    const updated = await this.prisma.checklistQuestion.update({
      where: { id: questionId },
      data: { sectionId },
    });

    // Increment template version
    await this.prisma.checklistTemplate.update({
      where: { id: templateId },
      data: { version: { increment: 1 } },
    });

    return updated;
  }

  // ============================================
  // TEMPLATE SNAPSHOT (for instances)
  // ============================================

  async getTemplateSnapshot(userId: string, templateId: string) {
    const template = await this.findOne(userId, templateId);

    return {
      id: template.id,
      name: template.name,
      description: template.description,
      version: template.version,
      sections: template.sections.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        order: s.order,
      })),
      questions: template.questions.map((q) => ({
        id: q.id,
        sectionId: q.sectionId,
        type: q.type,
        title: q.title,
        description: q.description,
        placeholder: q.placeholder,
        isRequired: q.isRequired,
        order: q.order,
        options: q.options,
        validations: q.validations,
        conditionalLogic: q.conditionalLogic,
        metadata: q.metadata,
      })),
      snapshotAt: new Date().toISOString(),
    };
  }

  // ============================================
  // VALIDATION HELPERS
  // ============================================

  private validateQuestionByType(
    type: ChecklistQuestionType,
    dto: Partial<CreateChecklistQuestionDto>,
  ): void {
    // Types that require options
    const optionTypes: ChecklistQuestionType[] = [
      ChecklistQuestionType.SELECT,
      ChecklistQuestionType.MULTI_SELECT,
    ];

    if (optionTypes.includes(type)) {
      if (!dto.options || dto.options.length === 0) {
        throw new BadRequestException(
          `Tipo ${type} requer pelo menos uma opção`,
        );
      }
    }

    // Types that should NOT have options
    const noOptionTypes: ChecklistQuestionType[] = [
      ChecklistQuestionType.TEXT_SHORT,
      ChecklistQuestionType.TEXT_LONG,
      ChecklistQuestionType.NUMBER,
      ChecklistQuestionType.DATE,
      ChecklistQuestionType.TIME,
      ChecklistQuestionType.DATETIME,
      ChecklistQuestionType.CHECKBOX,
      ChecklistQuestionType.PHOTO_REQUIRED,
      ChecklistQuestionType.PHOTO_OPTIONAL,
      ChecklistQuestionType.FILE_UPLOAD,
      ChecklistQuestionType.SIGNATURE_TECHNICIAN,
      ChecklistQuestionType.SIGNATURE_CLIENT,
      ChecklistQuestionType.SECTION_TITLE,
    ];

    if (noOptionTypes.includes(type) && dto.options && dto.options.length > 0) {
      throw new BadRequestException(
        `Tipo ${type} não deve ter opções`,
      );
    }

    // RATING validation
    if (type === ChecklistQuestionType.RATING) {
      const meta = dto.metadata;
      if (!meta?.ratingType) {
        // Set default
      }
    }

    // SCALE validation
    if (type === ChecklistQuestionType.SCALE) {
      const meta = dto.metadata;
      if (meta && meta.scaleMin !== undefined && meta.scaleMax !== undefined) {
        if (meta.scaleMin >= meta.scaleMax) {
          throw new BadRequestException(
            'scaleMin deve ser menor que scaleMax',
          );
        }
      }
    }
  }
}
