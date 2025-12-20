/**
 * ChecklistService Tests
 *
 * Testes para o serviço de gerenciamento de checklists offline-first.
 */

import {
  ChecklistService,
  checklistService,
} from '../../../src/modules/checklists/services/ChecklistService';
import {
  ChecklistTemplate,
  ChecklistQuestion,
} from '../../../src/db/schema';

// =============================================================================
// MOCK DATA
// =============================================================================

const createMockTemplate = (id: string): ChecklistTemplate => ({
  id,
  name: `Template ${id}`,
  description: 'Test template',
  version: 1,
  isActive: true,
  sections: [
    { id: 'section_1', title: 'Section 1', order: 1 },
  ],
  questions: [
    {
      id: 'q1',
      sectionId: 'section_1',
      type: 'TEXT_SHORT',
      title: 'Question 1',
      isRequired: true,
      order: 1,
    },
    {
      id: 'q2',
      sectionId: 'section_1',
      type: 'NUMBER',
      title: 'Question 2',
      isRequired: false,
      order: 2,
    },
    {
      id: 'q3',
      sectionId: 'section_1',
      type: 'CHECKBOX',
      title: 'Question 3',
      isRequired: true,
      order: 3,
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  technicianId: 'tech_1',
});

// =============================================================================
// TESTS
// =============================================================================

describe('ChecklistService', () => {
  let service: ChecklistService;

  beforeEach(async () => {
    service = new ChecklistService();
    await service.clearAll();
  });

  describe('Template Management', () => {
    it('should save and retrieve a template', async () => {
      const template = createMockTemplate('template_1');
      await service.saveTemplate(template);

      const retrieved = await service.getTemplate('template_1');

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Template template_1');
    });

    it('should return null for non-existent template', async () => {
      const retrieved = await service.getTemplate('non_existent');
      expect(retrieved).toBeNull();
    });

    it('should get active templates for technician', async () => {
      const template1 = createMockTemplate('template_1');
      const template2 = { ...createMockTemplate('template_2'), isActive: false };
      const template3 = createMockTemplate('template_3');

      await service.saveTemplate(template1);
      await service.saveTemplate(template2);
      await service.saveTemplate(template3);

      const activeTemplates = await service.getActiveTemplates('tech_1');

      expect(activeTemplates).toHaveLength(2);
      expect(activeTemplates.map(t => t.id)).toContain('template_1');
      expect(activeTemplates.map(t => t.id)).toContain('template_3');
    });
  });

  describe('Instance Management', () => {
    beforeEach(async () => {
      await service.saveTemplate(createMockTemplate('template_1'));
    });

    it('should create an instance from template', async () => {
      const result = await service.createInstance({
        workOrderId: 'wo_1',
        templateId: 'template_1',
        technicianId: 'tech_1',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.status).toBe('PENDING');
      expect(result.data?.progress).toBe(0);
    });

    it('should fail to create instance with non-existent template', async () => {
      const result = await service.createInstance({
        workOrderId: 'wo_1',
        templateId: 'non_existent',
        technicianId: 'tech_1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Template não encontrado');
    });

    it('should retrieve instance', async () => {
      const createResult = await service.createInstance({
        workOrderId: 'wo_1',
        templateId: 'template_1',
        technicianId: 'tech_1',
      });

      const instance = await service.getInstance(createResult.data!.id);

      expect(instance).toBeDefined();
      expect(instance?.workOrderId).toBe('wo_1');
    });

    it('should get instances for work order', async () => {
      await service.createInstance({
        workOrderId: 'wo_1',
        templateId: 'template_1',
        technicianId: 'tech_1',
      });

      await service.createInstance({
        workOrderId: 'wo_1',
        templateId: 'template_1',
        technicianId: 'tech_1',
      });

      const instances = await service.getInstancesForWorkOrder('wo_1');

      expect(instances).toHaveLength(2);
    });
  });

  describe('Status Transitions', () => {
    let instanceId: string;

    beforeEach(async () => {
      await service.saveTemplate(createMockTemplate('template_1'));
      const result = await service.createInstance({
        workOrderId: 'wo_1',
        templateId: 'template_1',
        technicianId: 'tech_1',
      });
      instanceId = result.data!.id;
    });

    it('should transition from PENDING to IN_PROGRESS', async () => {
      const result = await service.updateInstanceStatus(instanceId, 'IN_PROGRESS');

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('IN_PROGRESS');
      expect(result.data?.startedAt).toBeDefined();
    });

    it('should transition from PENDING to CANCELLED', async () => {
      const result = await service.updateInstanceStatus(instanceId, 'CANCELLED');

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('CANCELLED');
    });

    it('should fail invalid transition from PENDING to COMPLETED', async () => {
      const result = await service.updateInstanceStatus(instanceId, 'COMPLETED');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Transição inválida');
    });

    it('should fail transition from COMPLETED', async () => {
      // First, move to IN_PROGRESS and answer required questions
      await service.updateInstanceStatus(instanceId, 'IN_PROGRESS');
      await service.saveAnswer({
        instanceId,
        questionId: 'q1',
        type: 'TEXT_SHORT',
        value: 'answer',
      });
      await service.saveAnswer({
        instanceId,
        questionId: 'q3',
        type: 'CHECKBOX',
        value: true,
      });
      await service.updateInstanceStatus(instanceId, 'COMPLETED');

      // Now try to transition again
      const result = await service.updateInstanceStatus(instanceId, 'CANCELLED');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Transição inválida');
    });
  });

  describe('Answer Management', () => {
    let instanceId: string;

    beforeEach(async () => {
      await service.saveTemplate(createMockTemplate('template_1'));
      const result = await service.createInstance({
        workOrderId: 'wo_1',
        templateId: 'template_1',
        technicianId: 'tech_1',
      });
      instanceId = result.data!.id;
    });

    it('should save an answer', async () => {
      const result = await service.saveAnswer({
        instanceId,
        questionId: 'q1',
        type: 'TEXT_SHORT',
        value: 'Test answer',
        answeredBy: 'tech_1',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.valueText).toBe('Test answer');
    });

    it('should auto-start instance when saving first answer', async () => {
      await service.saveAnswer({
        instanceId,
        questionId: 'q1',
        type: 'TEXT_SHORT',
        value: 'Test answer',
      });

      const instance = await service.getInstance(instanceId);
      expect(instance?.status).toBe('IN_PROGRESS');
    });

    it('should update existing answer', async () => {
      await service.saveAnswer({
        instanceId,
        questionId: 'q1',
        type: 'TEXT_SHORT',
        value: 'First answer',
      });

      await service.saveAnswer({
        instanceId,
        questionId: 'q1',
        type: 'TEXT_SHORT',
        value: 'Updated answer',
      });

      const answer = await service.getAnswer(instanceId, 'q1');
      expect(answer?.valueText).toBe('Updated answer');
    });

    it('should get all answers for instance', async () => {
      await service.saveAnswer({
        instanceId,
        questionId: 'q1',
        type: 'TEXT_SHORT',
        value: 'Answer 1',
      });

      await service.saveAnswer({
        instanceId,
        questionId: 'q2',
        type: 'NUMBER',
        value: 42,
      });

      const answers = await service.getAnswersForInstance(instanceId);
      expect(answers).toHaveLength(2);
    });

    it('should fail to save answer to completed instance', async () => {
      await service.updateInstanceStatus(instanceId, 'IN_PROGRESS');
      await service.saveAnswer({
        instanceId,
        questionId: 'q1',
        type: 'TEXT_SHORT',
        value: 'answer',
      });
      await service.saveAnswer({
        instanceId,
        questionId: 'q3',
        type: 'CHECKBOX',
        value: true,
      });
      await service.updateInstanceStatus(instanceId, 'COMPLETED');

      const result = await service.saveAnswer({
        instanceId,
        questionId: 'q2',
        type: 'NUMBER',
        value: 42,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Checklist não pode mais ser editado');
    });

    it('should delete answer', async () => {
      const result = await service.saveAnswer({
        instanceId,
        questionId: 'q1',
        type: 'TEXT_SHORT',
        value: 'Test answer',
      });

      const deleted = await service.deleteAnswer(result.data!.id);
      expect(deleted).toBe(true);

      const answer = await service.getAnswer(instanceId, 'q1');
      expect(answer).toBeNull();
    });
  });

  describe('Progress Tracking', () => {
    let instanceId: string;

    beforeEach(async () => {
      await service.saveTemplate(createMockTemplate('template_1'));
      const result = await service.createInstance({
        workOrderId: 'wo_1',
        templateId: 'template_1',
        technicianId: 'tech_1',
      });
      instanceId = result.data!.id;
    });

    it('should update progress when answer is saved', async () => {
      const instanceBefore = await service.getInstance(instanceId);
      expect(instanceBefore?.progress).toBe(0);

      await service.saveAnswer({
        instanceId,
        questionId: 'q1',
        type: 'TEXT_SHORT',
        value: 'Answer 1',
      });

      const instanceAfter = await service.getInstance(instanceId);
      expect(instanceAfter?.progress).toBeGreaterThan(0);
    });

    it('should reach 100% when all questions are answered', async () => {
      await service.saveAnswer({
        instanceId,
        questionId: 'q1',
        type: 'TEXT_SHORT',
        value: 'Answer 1',
      });
      await service.saveAnswer({
        instanceId,
        questionId: 'q2',
        type: 'NUMBER',
        value: 42,
      });
      await service.saveAnswer({
        instanceId,
        questionId: 'q3',
        type: 'CHECKBOX',
        value: true,
      });

      const instance = await service.getInstance(instanceId);
      expect(instance?.progress).toBe(100);
    });
  });

  describe('Attachment Management', () => {
    let instanceId: string;
    let answerId: string;

    beforeEach(async () => {
      await service.saveTemplate(createMockTemplate('template_1'));
      const instanceResult = await service.createInstance({
        workOrderId: 'wo_1',
        templateId: 'template_1',
        technicianId: 'tech_1',
      });
      instanceId = instanceResult.data!.id;

      const answerResult = await service.saveAnswer({
        instanceId,
        questionId: 'q1',
        type: 'TEXT_SHORT',
        value: 'Test',
      });
      answerId = answerResult.data!.id;
    });

    it('should add attachment to answer', async () => {
      const result = await service.addAttachment({
        answerId,
        type: 'PHOTO',
        filePath: '/path/to/photo.jpg',
        fileName: 'photo.jpg',
        mimeType: 'image/jpeg',
        fileSize: 1024,
      });

      expect(result.success).toBe(true);
      expect(result.data?.filePath).toBe('/path/to/photo.jpg');
    });

    it('should get attachments for answer', async () => {
      await service.addAttachment({
        answerId,
        type: 'PHOTO',
        filePath: '/path/to/photo1.jpg',
        fileName: 'photo1.jpg',
        mimeType: 'image/jpeg',
        fileSize: 1024,
      });

      await service.addAttachment({
        answerId,
        type: 'PHOTO',
        filePath: '/path/to/photo2.jpg',
        fileName: 'photo2.jpg',
        mimeType: 'image/jpeg',
        fileSize: 2048,
      });

      const attachments = await service.getAttachmentsForAnswer(answerId);
      expect(attachments).toHaveLength(2);
    });

    it('should delete attachment', async () => {
      const result = await service.addAttachment({
        answerId,
        type: 'PHOTO',
        filePath: '/path/to/photo.jpg',
        fileName: 'photo.jpg',
        mimeType: 'image/jpeg',
        fileSize: 1024,
      });

      const deleted = await service.deleteAttachment(result.data!.id);
      expect(deleted).toBe(true);

      const attachments = await service.getAttachmentsForAnswer(answerId);
      expect(attachments).toHaveLength(0);
    });
  });

  describe('Completion Validation', () => {
    let instanceId: string;

    beforeEach(async () => {
      await service.saveTemplate(createMockTemplate('template_1'));
      const result = await service.createInstance({
        workOrderId: 'wo_1',
        templateId: 'template_1',
        technicianId: 'tech_1',
      });
      instanceId = result.data!.id;
    });

    it('should fail to complete without required answers', async () => {
      await service.updateInstanceStatus(instanceId, 'IN_PROGRESS');

      const result = await service.updateInstanceStatus(instanceId, 'COMPLETED');

      expect(result.success).toBe(false);
      expect(result.error).toContain('pergunta(s) obrigatória(s)');
    });

    it('should complete with all required answers', async () => {
      await service.updateInstanceStatus(instanceId, 'IN_PROGRESS');
      await service.saveAnswer({
        instanceId,
        questionId: 'q1',
        type: 'TEXT_SHORT',
        value: 'Answer for q1',
      });
      await service.saveAnswer({
        instanceId,
        questionId: 'q3',
        type: 'CHECKBOX',
        value: true,
      });

      const result = await service.updateInstanceStatus(instanceId, 'COMPLETED', 'tech_1');

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('COMPLETED');
      expect(result.data?.completedAt).toBeDefined();
      expect(result.data?.completedBy).toBe('tech_1');
    });
  });
});
