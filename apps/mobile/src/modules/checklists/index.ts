/**
 * Checklists Module
 *
 * Exports all checklist related components, sync configs, and services.
 */

// Sync Configs
export {
  ChecklistTemplateSyncConfig,
  default as ChecklistTemplateSync,
} from './ChecklistTemplateSyncConfig';

export {
  ChecklistInstanceSyncConfig,
  VALID_INSTANCE_STATUS_TRANSITIONS,
  isValidInstanceStatusTransition,
  getAllowedNextInstanceStatuses,
  canEditInstance,
  isInstanceCompleted,
  default as ChecklistInstanceSync,
} from './ChecklistInstanceSyncConfig';

export {
  ChecklistAnswerSyncConfig,
  getAnswerValue,
  setAnswerValue,
  validateAnswer,
  default as ChecklistAnswerSync,
} from './ChecklistAnswerSyncConfig';

export {
  SignatureSyncConfig,
  SIGNER_ROLES,
  type SignerRole,
  generateSignatureHash,
  verifySignatureIntegrity,
  createSignaturePayload,
  validateSignature,
  default as SignatureSync,
} from './SignatureSyncConfig';

// Components
export {
  ChecklistRenderer,
  type ChecklistRendererProps,
  evaluateQuestionVisibility,
  evaluateAllQuestions,
  getVisibleQuestions,
  areAllRequiredAnswered,
  calculateProgress,
  type QuestionVisibility,
  type EvaluationContext,
  QUESTION_RENDERERS,
  SectionTitleRenderer,
  type QuestionRendererProps,
  VirtualizedChecklistRenderer,
  type VirtualizedChecklistRendererProps,
  QuestionRenderer,
  type NewQuestionRendererProps,
} from './components';

// Services
export {
  ChecklistService,
  checklistService,
  type CreateInstanceInput,
  type SaveAnswerInput,
  type AttachmentInput,
  type ChecklistServiceResult,
  UploadQueueService,
  getUploadQueueService,
  type UploadProgress,
  type UploadResult,
  type UploadQueueOptions,
  type QueueStats,
  type UploadEventListener,
  ChecklistSyncService,
  checklistSyncService,
  AttachmentUploadService,
  attachmentUploadService,
} from './services';

// Hooks
export {
  useChecklistExecution,
  type ChecklistExecutionState,
  type ChecklistExecutionActions,
  type UseChecklistExecutionReturn,
  useChecklistSync,
  type ChecklistSyncStatus,
  type UseChecklistSyncReturn,
  usePhotoCapture,
  type PhotoCaptureOptions,
  type CapturedPhoto,
  type UsePhotoCaptureReturn,
} from './hooks';
