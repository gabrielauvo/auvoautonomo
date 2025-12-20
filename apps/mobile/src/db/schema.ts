/**
 * Banquinho - Database Schema
 *
 * Schema do banco de dados local SQLite.
 * Suporta até 100k registros por entidade com performance otimizada.
 */

// =============================================================================
// SCHEMA TYPES
// =============================================================================

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  document?: string;              // CPF/CNPJ (maps to taxId on server)
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  notes?: string;
  isActive: boolean;
  deletedAt?: string;             // Soft delete timestamp (sync)
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;              // Último sync com servidor
  technicianId: string;           // Escopo por técnico
}

// Status alinhado com backend: SCHEDULED | IN_PROGRESS | DONE | CANCELED
export type WorkOrderStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'DONE' | 'CANCELED';

export interface WorkOrder {
  id: string;
  clientId: string;
  quoteId?: string;              // Orçamento de origem
  title: string;
  description?: string;
  status: WorkOrderStatus;
  scheduledDate?: string;        // Data agendada (somente data)
  scheduledStartTime?: string;   // Horário início agendado
  scheduledEndTime?: string;     // Horário fim agendado
  executionStart?: string;       // Início real da execução
  executionEnd?: string;         // Fim real da execução
  address?: string;              // Endereço do serviço
  notes?: string;
  totalValue?: number;
  isActive: boolean;             // Derivado de !deletedAt
  deletedAt?: string;            // Soft delete
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
  technicianId: string;
  // Dados desnormalizados do cliente (para exibição offline)
  clientName?: string;
  clientPhone?: string;
  clientAddress?: string;
}

// Status alinhado com backend: DRAFT | SENT | APPROVED | REJECTED | EXPIRED
export type QuoteStatus = 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export interface Quote {
  id: string;
  clientId: string;
  status: QuoteStatus;
  discountValue: number;
  totalValue: number;
  notes?: string;
  sentAt?: string;
  visitScheduledAt?: string;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
  technicianId: string;
  // Dados desnormalizados do cliente (para exibição offline)
  clientName?: string;
}

export interface QuoteItem {
  id: string;
  quoteId: string;
  itemId?: string;               // ID do item do catálogo (null para itens manuais)
  name: string;
  type: string;                  // SERVICE | PRODUCT
  unit: string;
  quantity: number;
  unitPrice: number;
  discountValue: number;
  totalPrice: number;
  createdAt: string;
  updatedAt: string;
}

// Status alinhado com backend: PENDING | PAID | OVERDUE | CANCELLED
export type InvoiceStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export interface Invoice {
  id: string;
  clientId: string;
  workOrderId?: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  dueDate: string;
  paidDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
  technicianId: string;
  // Dados desnormalizados do cliente (para exibição offline)
  clientName?: string;
}

// =============================================================================
// CHECKLIST TYPES (alinhado com backend ChecklistQuestionType)
// =============================================================================

export type ChecklistQuestionType =
  | 'TEXT_SHORT'
  | 'TEXT_LONG'
  | 'NUMBER'
  | 'DATE'
  | 'TIME'
  | 'DATETIME'
  | 'CHECKBOX'
  | 'SELECT'
  | 'MULTI_SELECT'
  | 'PHOTO_REQUIRED'
  | 'PHOTO_OPTIONAL'
  | 'FILE_UPLOAD'
  | 'SIGNATURE_TECHNICIAN'
  | 'SIGNATURE_CLIENT'
  | 'SECTION_TITLE'
  | 'RATING'
  | 'SCALE';

export type ChecklistInstanceStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type ConditionOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'GREATER_THAN'
  | 'LESS_THAN'
  | 'GREATER_THAN_OR_EQUAL'
  | 'LESS_THAN_OR_EQUAL'
  | 'CONTAINS'
  | 'NOT_CONTAINS'
  | 'IS_EMPTY'
  | 'IS_NOT_EMPTY'
  | 'IN'
  | 'NOT_IN';

export type ConditionAction = 'SHOW' | 'HIDE' | 'REQUIRE' | 'SKIP_TO';

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

export interface QuestionOption {
  value: string;
  label: string;
  order?: number;
}

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

export interface ChecklistQuestion {
  id: string;
  sectionId?: string;
  type: ChecklistQuestionType;
  title: string;
  description?: string;
  placeholder?: string;
  isRequired: boolean;
  order: number;
  options?: QuestionOption[];
  validations?: QuestionValidation;
  conditionalLogic?: ConditionalLogic;
  metadata?: QuestionMetadata;
}

export interface ChecklistSection {
  id: string;
  title: string;
  description?: string;
  order: number;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  description?: string;
  version: number;
  isActive: boolean;
  sections: ChecklistSection[];
  questions: ChecklistQuestion[];
  createdAt: string;
  updatedAt: string;
  technicianId: string;
}

export interface ChecklistInstance {
  id: string;
  workOrderId: string;
  templateId: string;
  templateName?: string;            // Nome do template para exibição
  templateVersionSnapshot?: string; // JSON - Snapshot do template no momento da criação (nullable for offline list caching)
  status: ChecklistInstanceStatus;
  progress: number; // 0-100
  startedAt?: string;
  completedAt?: string;
  completedBy?: string;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
  technicianId: string;
}

export type AnswerSyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';

export interface ChecklistAnswer {
  id: string;
  instanceId: string;
  questionId: string;
  type: ChecklistQuestionType;
  valueText?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueDate?: string;
  valueJson?: string; // JSON para SELECT, MULTI_SELECT, RATING, SCALE
  answeredAt: string;
  answeredBy?: string;
  deviceInfo?: string;
  localId?: string; // ID local para idempotência
  syncStatus: AnswerSyncStatus;  // Status do sync
  syncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type ChecklistAttachmentType = 'PHOTO' | 'SIGNATURE' | 'FILE';
export type AttachmentSyncStatus = 'PENDING' | 'UPLOADING' | 'SYNCED' | 'FAILED';

export interface ChecklistAttachment {
  id: string;
  answerId?: string;           // Opcional: pode ser anexo direto da OS
  workOrderId: string;         // Referência direta à OS
  type: ChecklistAttachmentType;
  filePath: string;            // Caminho local do arquivo
  fileName: string;
  mimeType: string;
  fileSize: number;
  thumbnailPath?: string;
  remoteUrl?: string;          // URL no servidor após sync
  base64Data?: string;         // Dados base64 para upload pendente
  syncStatus: AttachmentSyncStatus;  // Status do upload
  uploadAttempts: number;      // Número de tentativas de upload
  lastUploadError?: string;    // Último erro de upload
  localId?: string;
  syncedAt?: string;
  createdAt: string;
  updatedAt: string;
  technicianId: string;
}

// =============================================================================
// EXECUTION SESSIONS (local only - para UI do timer)
// =============================================================================

export type ExecutionSessionType = 'WORK' | 'PAUSE';

export interface ExecutionSession {
  id: string;
  workOrderId: string;
  sessionType: ExecutionSessionType;
  startedAt: string;
  endedAt?: string;
  duration?: number;          // Duração em segundos (calculado)
  pauseReason?: string;       // Motivo da pausa (quando sessionType = 'PAUSE')
  notes?: string;
  createdAt: string;
  updatedAt: string;
  technicianId: string;
  syncedAt?: string;          // Quando foi sincronizado com o servidor
  serverId?: string;          // ID retornado pelo servidor após sync
}

// =============================================================================
// SIGNATURES (alinhado com backend)
// =============================================================================

export interface Signature {
  id: string;
  workOrderId?: string;
  quoteId?: string;
  clientId: string;
  attachmentId?: string; // Referência ao arquivo da assinatura
  signerName: string;
  signerDocument?: string; // CPF/CNPJ do assinante
  signerRole: string; // 'Cliente', 'Técnico', etc
  signedAt: string;
  hash?: string; // Hash SHA256 para integridade
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: string;
  localId?: string;
  syncedAt?: string;
  createdAt: string;
  updatedAt: string;
  technicianId: string;
  // Dados locais da assinatura (antes de upload)
  signatureBase64?: string;
  signatureFilePath?: string;
}

// =============================================================================
// UPLOAD QUEUE (para fotos e assinaturas pendentes)
// =============================================================================

export type UploadStatus = 'pending' | 'uploading' | 'completed' | 'failed';

export interface UploadQueueItem {
  id: number;
  entityType: 'checklist_attachment' | 'signature';
  entityId: string;
  filePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  status: UploadStatus;
  remoteUrl?: string;
  attempts: number;
  lastAttempt?: string;
  errorMessage?: string;
  priority?: number; // Higher priority uploads first
  createdAt: string;
}

// =============================================================================
// CATALOG TYPES (alinhado com backend Item e ProductCategory)
// =============================================================================

export type ItemType = 'PRODUCT' | 'SERVICE' | 'BUNDLE';

export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  color?: string;
  isActive: boolean;
  itemCount?: number;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
  technicianId: string;
}

export interface CatalogItem {
  id: string;
  categoryId?: string;
  categoryName?: string;
  categoryColor?: string;
  name: string;
  description?: string;
  type: ItemType;
  sku?: string;
  unit: string;
  basePrice: number;
  costPrice?: number;
  defaultDurationMinutes?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
  technicianId: string;
}

export interface BundleItem {
  id: string;
  bundleId: string;
  itemId: string;
  itemName?: string;
  itemType?: string;
  itemUnit?: string;
  itemBasePrice?: number;
  quantity: number;
  createdAt: string;
  technicianId: string;
}

// =============================================================================
// SYNC METADATA
// =============================================================================

export interface SyncMeta {
  id: number;
  entity: string;                 // 'clients' | 'workOrders' | 'quotes' | 'invoices' | 'categories' | 'catalogItems'
  lastSyncAt: string;            // Timestamp do último sync
  lastCursor?: string;           // Cursor para paginação delta
  syncStatus: 'idle' | 'syncing' | 'error';
  errorMessage?: string;
}

// =============================================================================
// MUTATIONS QUEUE
// =============================================================================

export interface MutationQueueItem {
  id: number;
  entity: string;
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  payload: string;               // JSON stringified
  createdAt: string;
  attempts: number;
  lastAttempt?: string;
  status: 'pending' | 'processing' | 'failed' | 'completed';
  errorMessage?: string;
}

// =============================================================================
// SQL CREATE STATEMENTS
// =============================================================================

export const CREATE_TABLES_SQL = `
-- Clients table
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  document TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zipCode TEXT,
  notes TEXT,
  isActive INTEGER DEFAULT 1,
  deletedAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  syncedAt TEXT,
  technicianId TEXT NOT NULL
);

-- Clients indexes for performance
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE INDEX IF NOT EXISTS idx_clients_technicianId ON clients(technicianId);
CREATE INDEX IF NOT EXISTS idx_clients_updatedAt ON clients(updatedAt);
CREATE INDEX IF NOT EXISTS idx_clients_syncedAt ON clients(syncedAt);
CREATE INDEX IF NOT EXISTS idx_clients_deletedAt ON clients(deletedAt);

-- Work Orders table (alinhado com backend WorkOrder)
CREATE TABLE IF NOT EXISTS work_orders (
  id TEXT PRIMARY KEY,
  clientId TEXT NOT NULL,
  quoteId TEXT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'SCHEDULED',
  scheduledDate TEXT,
  scheduledStartTime TEXT,
  scheduledEndTime TEXT,
  executionStart TEXT,
  executionEnd TEXT,
  address TEXT,
  notes TEXT,
  totalValue REAL,
  isActive INTEGER DEFAULT 1,
  deletedAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  syncedAt TEXT,
  technicianId TEXT NOT NULL,
  clientName TEXT,
  clientPhone TEXT,
  clientAddress TEXT,
  FOREIGN KEY (clientId) REFERENCES clients(id)
);

-- Work Orders indexes (otimizados para agenda e consultas)
CREATE INDEX IF NOT EXISTS idx_work_orders_clientId ON work_orders(clientId);
CREATE INDEX IF NOT EXISTS idx_work_orders_technicianId ON work_orders(technicianId);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_scheduledDate ON work_orders(scheduledDate);
CREATE INDEX IF NOT EXISTS idx_work_orders_scheduledStartTime ON work_orders(scheduledStartTime);
CREATE INDEX IF NOT EXISTS idx_work_orders_updatedAt ON work_orders(updatedAt);
CREATE INDEX IF NOT EXISTS idx_work_orders_deletedAt ON work_orders(deletedAt);
CREATE INDEX IF NOT EXISTS idx_work_orders_isActive ON work_orders(isActive);

-- Quotes table
CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  clientId TEXT NOT NULL,
  number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft',
  validUntil TEXT,
  subtotal REAL NOT NULL,
  discount REAL,
  tax REAL,
  total REAL NOT NULL,
  items TEXT,
  notes TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  syncedAt TEXT,
  technicianId TEXT NOT NULL,
  FOREIGN KEY (clientId) REFERENCES clients(id)
);

-- Quotes indexes
CREATE INDEX IF NOT EXISTS idx_quotes_clientId ON quotes(clientId);
CREATE INDEX IF NOT EXISTS idx_quotes_technicianId ON quotes(technicianId);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_number ON quotes(number);
CREATE INDEX IF NOT EXISTS idx_quotes_updatedAt ON quotes(updatedAt);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  clientId TEXT NOT NULL,
  workOrderId TEXT,
  quoteId TEXT,
  number TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  issueDate TEXT NOT NULL,
  dueDate TEXT NOT NULL,
  paidDate TEXT,
  subtotal REAL NOT NULL,
  discount REAL,
  tax REAL,
  total REAL NOT NULL,
  items TEXT,
  paymentMethod TEXT,
  notes TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  syncedAt TEXT,
  technicianId TEXT NOT NULL,
  FOREIGN KEY (clientId) REFERENCES clients(id),
  FOREIGN KEY (workOrderId) REFERENCES work_orders(id),
  FOREIGN KEY (quoteId) REFERENCES quotes(id)
);

-- Invoices indexes
CREATE INDEX IF NOT EXISTS idx_invoices_clientId ON invoices(clientId);
CREATE INDEX IF NOT EXISTS idx_invoices_technicianId ON invoices(technicianId);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(number);
CREATE INDEX IF NOT EXISTS idx_invoices_dueDate ON invoices(dueDate);
CREATE INDEX IF NOT EXISTS idx_invoices_updatedAt ON invoices(updatedAt);

-- Sync Metadata table
CREATE TABLE IF NOT EXISTS sync_meta (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT UNIQUE NOT NULL,
  lastSyncAt TEXT NOT NULL,
  lastCursor TEXT,
  syncStatus TEXT DEFAULT 'idle',
  errorMessage TEXT
);

-- Mutations Queue table
CREATE TABLE IF NOT EXISTS mutations_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT NOT NULL,
  entityId TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  lastAttempt TEXT,
  status TEXT DEFAULT 'pending',
  errorMessage TEXT
);

-- Mutations Queue indexes
CREATE INDEX IF NOT EXISTS idx_mutations_queue_status ON mutations_queue(status);
CREATE INDEX IF NOT EXISTS idx_mutations_queue_entity ON mutations_queue(entity);
CREATE INDEX IF NOT EXISTS idx_mutations_queue_createdAt ON mutations_queue(createdAt);

-- Initialize sync_meta for all entities
INSERT OR IGNORE INTO sync_meta (entity, lastSyncAt, syncStatus) VALUES ('clients', '1970-01-01T00:00:00Z', 'idle');
INSERT OR IGNORE INTO sync_meta (entity, lastSyncAt, syncStatus) VALUES ('workOrders', '1970-01-01T00:00:00Z', 'idle');
INSERT OR IGNORE INTO sync_meta (entity, lastSyncAt, syncStatus) VALUES ('quotes', '1970-01-01T00:00:00Z', 'idle');
INSERT OR IGNORE INTO sync_meta (entity, lastSyncAt, syncStatus) VALUES ('invoices', '1970-01-01T00:00:00Z', 'idle');
`;

// =============================================================================
// SQL CHECKLIST TABLES (v4+)
// =============================================================================

export const CREATE_CHECKLIST_TABLES_SQL = `
-- Checklist Templates table (templates sincronizados do servidor)
CREATE TABLE IF NOT EXISTS checklist_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  version INTEGER DEFAULT 1,
  isActive INTEGER DEFAULT 1,
  sections TEXT, -- JSON array de ChecklistSection
  questions TEXT, -- JSON array de ChecklistQuestion
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  syncedAt TEXT,
  technicianId TEXT NOT NULL
);

-- Checklist Templates indexes
CREATE INDEX IF NOT EXISTS idx_checklist_templates_technicianId ON checklist_templates(technicianId);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_isActive ON checklist_templates(isActive);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_updatedAt ON checklist_templates(updatedAt);

-- Checklist Instances table (instâncias criadas a partir de templates)
-- NO FOREIGN KEY constraints - this is a cache table for offline support
-- The related work_orders and checklist_templates may not exist locally
CREATE TABLE IF NOT EXISTS checklist_instances (
  id TEXT PRIMARY KEY,
  workOrderId TEXT NOT NULL,
  templateId TEXT NOT NULL,
  templateVersionSnapshot TEXT, -- JSON snapshot do template (nullable for offline list caching)
  templateName TEXT, -- Nome do template para exibição offline
  status TEXT DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, COMPLETED, CANCELLED
  progress INTEGER DEFAULT 0, -- 0-100
  startedAt TEXT,
  completedAt TEXT,
  completedBy TEXT,
  localId TEXT, -- ID local para idempotência no sync
  deletedAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  syncedAt TEXT,
  technicianId TEXT NOT NULL
);

-- Checklist Instances indexes
CREATE INDEX IF NOT EXISTS idx_checklist_instances_workOrderId ON checklist_instances(workOrderId);
CREATE INDEX IF NOT EXISTS idx_checklist_instances_templateId ON checklist_instances(templateId);
CREATE INDEX IF NOT EXISTS idx_checklist_instances_technicianId ON checklist_instances(technicianId);
CREATE INDEX IF NOT EXISTS idx_checklist_instances_status ON checklist_instances(status);
CREATE INDEX IF NOT EXISTS idx_checklist_instances_updatedAt ON checklist_instances(updatedAt);
CREATE INDEX IF NOT EXISTS idx_checklist_instances_localId ON checklist_instances(localId);

-- Checklist Answers table (respostas das perguntas)
CREATE TABLE IF NOT EXISTS checklist_answers (
  id TEXT PRIMARY KEY,
  instanceId TEXT NOT NULL,
  questionId TEXT NOT NULL,
  type TEXT NOT NULL, -- ChecklistQuestionType
  valueText TEXT,
  valueNumber REAL,
  valueBoolean INTEGER,
  valueDate TEXT,
  valueJson TEXT, -- JSON para SELECT, MULTI_SELECT, RATING, SCALE, etc
  answeredAt TEXT NOT NULL,
  answeredBy TEXT,
  deviceInfo TEXT,
  localId TEXT, -- ID local para idempotência
  deletedAt TEXT,
  syncedAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (instanceId) REFERENCES checklist_instances(id)
);

-- Checklist Answers indexes
CREATE INDEX IF NOT EXISTS idx_checklist_answers_instanceId ON checklist_answers(instanceId);
CREATE INDEX IF NOT EXISTS idx_checklist_answers_questionId ON checklist_answers(questionId);
CREATE INDEX IF NOT EXISTS idx_checklist_answers_localId ON checklist_answers(localId);
CREATE INDEX IF NOT EXISTS idx_checklist_answers_updatedAt ON checklist_answers(updatedAt);

-- Checklist Attachments table (fotos, arquivos, etc)
CREATE TABLE IF NOT EXISTS checklist_attachments (
  id TEXT PRIMARY KEY,
  answerId TEXT NOT NULL,
  type TEXT NOT NULL, -- PHOTO, SIGNATURE, FILE
  filePath TEXT NOT NULL, -- Caminho local do arquivo
  fileName TEXT NOT NULL,
  mimeType TEXT NOT NULL,
  fileSize INTEGER NOT NULL,
  thumbnailPath TEXT,
  remoteUrl TEXT, -- URL no servidor após sync
  localId TEXT, -- ID local para idempotência
  deletedAt TEXT,
  syncedAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (answerId) REFERENCES checklist_answers(id)
);

-- Checklist Attachments indexes
CREATE INDEX IF NOT EXISTS idx_checklist_attachments_answerId ON checklist_attachments(answerId);
CREATE INDEX IF NOT EXISTS idx_checklist_attachments_type ON checklist_attachments(type);
CREATE INDEX IF NOT EXISTS idx_checklist_attachments_localId ON checklist_attachments(localId);
CREATE INDEX IF NOT EXISTS idx_checklist_attachments_syncedAt ON checklist_attachments(syncedAt);

-- Signatures table (assinaturas digitais)
CREATE TABLE IF NOT EXISTS signatures (
  id TEXT PRIMARY KEY,
  workOrderId TEXT,
  quoteId TEXT,
  clientId TEXT NOT NULL,
  attachmentId TEXT, -- Referência ao arquivo da assinatura
  signerName TEXT NOT NULL,
  signerDocument TEXT, -- CPF/CNPJ do assinante
  signerRole TEXT NOT NULL, -- Cliente, Técnico, etc
  signedAt TEXT NOT NULL,
  hash TEXT, -- Hash SHA256 para integridade
  ipAddress TEXT,
  userAgent TEXT,
  deviceInfo TEXT,
  localId TEXT, -- ID local para idempotência
  deletedAt TEXT,
  syncedAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  technicianId TEXT NOT NULL,
  signatureBase64 TEXT, -- Dados da assinatura antes de upload
  signatureFilePath TEXT, -- Caminho local do arquivo
  FOREIGN KEY (workOrderId) REFERENCES work_orders(id),
  FOREIGN KEY (quoteId) REFERENCES quotes(id)
);

-- Signatures indexes
CREATE INDEX IF NOT EXISTS idx_signatures_workOrderId ON signatures(workOrderId);
CREATE INDEX IF NOT EXISTS idx_signatures_quoteId ON signatures(quoteId);
CREATE INDEX IF NOT EXISTS idx_signatures_clientId ON signatures(clientId);
CREATE INDEX IF NOT EXISTS idx_signatures_technicianId ON signatures(technicianId);
CREATE INDEX IF NOT EXISTS idx_signatures_localId ON signatures(localId);
CREATE INDEX IF NOT EXISTS idx_signatures_syncedAt ON signatures(syncedAt);

-- Upload Queue table (fila de uploads de mídia pendentes)
CREATE TABLE IF NOT EXISTS upload_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entityType TEXT NOT NULL, -- checklist_attachment, signature
  entityId TEXT NOT NULL,
  filePath TEXT NOT NULL,
  fileName TEXT NOT NULL,
  mimeType TEXT NOT NULL,
  fileSize INTEGER NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, uploading, completed, failed
  remoteUrl TEXT,
  attempts INTEGER DEFAULT 0,
  lastAttempt TEXT,
  errorMessage TEXT,
  priority INTEGER DEFAULT 0, -- Higher priority uploads first
  createdAt TEXT NOT NULL
);

-- Upload Queue indexes
CREATE INDEX IF NOT EXISTS idx_upload_queue_status ON upload_queue(status);
CREATE INDEX IF NOT EXISTS idx_upload_queue_entityType ON upload_queue(entityType);
CREATE INDEX IF NOT EXISTS idx_upload_queue_entityId ON upload_queue(entityId);
CREATE INDEX IF NOT EXISTS idx_upload_queue_priority ON upload_queue(priority);
CREATE INDEX IF NOT EXISTS idx_upload_queue_createdAt ON upload_queue(createdAt);

-- Initialize sync_meta for checklist entities
INSERT OR IGNORE INTO sync_meta (entity, lastSyncAt, syncStatus) VALUES ('checklistTemplates', '1970-01-01T00:00:00Z', 'idle');
INSERT OR IGNORE INTO sync_meta (entity, lastSyncAt, syncStatus) VALUES ('checklistInstances', '1970-01-01T00:00:00Z', 'idle');
INSERT OR IGNORE INTO sync_meta (entity, lastSyncAt, syncStatus) VALUES ('checklistAnswers', '1970-01-01T00:00:00Z', 'idle');
INSERT OR IGNORE INTO sync_meta (entity, lastSyncAt, syncStatus) VALUES ('signatures', '1970-01-01T00:00:00Z', 'idle');
`;

// =============================================================================
// MIGRATIONS
// =============================================================================

export const MIGRATIONS = [
  {
    version: 1,
    sql: CREATE_TABLES_SQL,
  },
  {
    version: 2,
    sql: `
      -- Migration v2: deletedAt column already exists in CREATE_TABLES_SQL
      -- This migration is now a no-op for fresh databases
      -- The column and index are already created in v1
      SELECT 1;
    `,
  },
  {
    version: 3,
    sql: `
      -- Migration v3: work_orders schema already correct in CREATE_TABLES_SQL
      -- This migration was for legacy databases only
      -- For fresh databases, work_orders is already created correctly in v1
      SELECT 1;
    `,
  },
  {
    version: 4,
    sql: CREATE_CHECKLIST_TABLES_SQL,
  },
  {
    version: 5,
    sql: `
      -- Migration v5: Align quotes and invoices tables with backend schema
      -- Drop old quotes table and create new aligned schema
      DROP TABLE IF EXISTS quotes;

      -- New quotes table aligned with backend
      CREATE TABLE IF NOT EXISTS quotes (
        id TEXT PRIMARY KEY,
        clientId TEXT NOT NULL,
        status TEXT DEFAULT 'DRAFT',
        discountValue REAL DEFAULT 0,
        totalValue REAL NOT NULL DEFAULT 0,
        notes TEXT,
        sentAt TEXT,
        visitScheduledAt TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        syncedAt TEXT,
        technicianId TEXT NOT NULL,
        clientName TEXT,
        FOREIGN KEY (clientId) REFERENCES clients(id)
      );

      -- Quotes indexes
      CREATE INDEX IF NOT EXISTS idx_quotes_clientId ON quotes(clientId);
      CREATE INDEX IF NOT EXISTS idx_quotes_technicianId ON quotes(technicianId);
      CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
      CREATE INDEX IF NOT EXISTS idx_quotes_updatedAt ON quotes(updatedAt);
      CREATE INDEX IF NOT EXISTS idx_quotes_syncedAt ON quotes(syncedAt);

      -- New quote_items table
      CREATE TABLE IF NOT EXISTS quote_items (
        id TEXT PRIMARY KEY,
        quoteId TEXT NOT NULL,
        itemId TEXT,
        name TEXT NOT NULL,
        type TEXT DEFAULT 'SERVICE',
        unit TEXT DEFAULT 'un',
        quantity REAL NOT NULL DEFAULT 1,
        unitPrice REAL NOT NULL DEFAULT 0,
        discountValue REAL DEFAULT 0,
        totalPrice REAL NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (quoteId) REFERENCES quotes(id) ON DELETE CASCADE
      );

      -- Quote items indexes
      CREATE INDEX IF NOT EXISTS idx_quote_items_quoteId ON quote_items(quoteId);
      CREATE INDEX IF NOT EXISTS idx_quote_items_itemId ON quote_items(itemId);

      -- Drop old invoices table and create new aligned schema
      DROP TABLE IF EXISTS invoices;

      -- New invoices table aligned with backend
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        clientId TEXT NOT NULL,
        workOrderId TEXT,
        invoiceNumber TEXT NOT NULL,
        status TEXT DEFAULT 'PENDING',
        subtotal REAL NOT NULL DEFAULT 0,
        tax REAL DEFAULT 0,
        discount REAL DEFAULT 0,
        total REAL NOT NULL DEFAULT 0,
        dueDate TEXT NOT NULL,
        paidDate TEXT,
        notes TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        syncedAt TEXT,
        technicianId TEXT NOT NULL,
        clientName TEXT,
        FOREIGN KEY (clientId) REFERENCES clients(id),
        FOREIGN KEY (workOrderId) REFERENCES work_orders(id)
      );

      -- Invoices indexes
      CREATE INDEX IF NOT EXISTS idx_invoices_clientId ON invoices(clientId);
      CREATE INDEX IF NOT EXISTS idx_invoices_workOrderId ON invoices(workOrderId);
      CREATE INDEX IF NOT EXISTS idx_invoices_technicianId ON invoices(technicianId);
      CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
      CREATE INDEX IF NOT EXISTS idx_invoices_invoiceNumber ON invoices(invoiceNumber);
      CREATE INDEX IF NOT EXISTS idx_invoices_dueDate ON invoices(dueDate);
      CREATE INDEX IF NOT EXISTS idx_invoices_updatedAt ON invoices(updatedAt);
      CREATE INDEX IF NOT EXISTS idx_invoices_syncedAt ON invoices(syncedAt);
    `,
  },
  // Migration 6: Fix isActive datatype - convert string 'true'/'false' to INTEGER 1/0
  {
    version: 6,
    sql: `
      -- Fix isActive in clients table
      UPDATE clients SET isActive = 1 WHERE isActive = 'true' OR isActive = '1';
      UPDATE clients SET isActive = 0 WHERE isActive = 'false' OR isActive = '0' OR isActive IS NULL;

      -- Fix isActive in work_orders table
      UPDATE work_orders SET isActive = 1 WHERE isActive = 'true' OR isActive = '1';
      UPDATE work_orders SET isActive = 0 WHERE isActive = 'false' OR isActive = '0' OR isActive IS NULL;

      -- Fix isActive in checklist_templates table
      UPDATE checklist_templates SET isActive = 1 WHERE isActive = 'true' OR isActive = '1';
      UPDATE checklist_templates SET isActive = 0 WHERE isActive = 'false' OR isActive = '0' OR isActive IS NULL;
    `,
  },
  // Migration 7: Add execution sessions and enhance checklist tables for OS execution
  {
    version: 7,
    sql: `
      -- ==========================================================================
      -- EXECUTION SESSIONS (local only - para UI do timer de execução)
      -- O backend usa WorkOrder.executionStart/executionEnd, não precisa sync
      -- ==========================================================================
      CREATE TABLE IF NOT EXISTS work_order_execution_sessions (
        id TEXT PRIMARY KEY,
        workOrderId TEXT NOT NULL,
        sessionType TEXT NOT NULL,  -- 'WORK' | 'PAUSE'
        startedAt TEXT NOT NULL,
        endedAt TEXT,
        duration INTEGER,           -- Duração em segundos
        pauseReason TEXT,           -- Motivo da pausa (quando PAUSE)
        notes TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        technicianId TEXT NOT NULL,
        FOREIGN KEY (workOrderId) REFERENCES work_orders(id)
      );

      -- Indexes para performance
      CREATE INDEX IF NOT EXISTS idx_wo_exec_sessions_workOrderId ON work_order_execution_sessions(workOrderId);
      CREATE INDEX IF NOT EXISTS idx_wo_exec_sessions_sessionType ON work_order_execution_sessions(sessionType);
      CREATE INDEX IF NOT EXISTS idx_wo_exec_sessions_technicianId ON work_order_execution_sessions(technicianId);

      -- ==========================================================================
      -- ENHANCE CHECKLIST_ANSWERS with syncStatus
      -- ==========================================================================
      -- SQLite não suporta ADD COLUMN com DEFAULT em todas as versões
      -- Vamos adicionar a coluna se não existir
      ALTER TABLE checklist_answers ADD COLUMN syncStatus TEXT DEFAULT 'PENDING';

      -- Index para encontrar respostas pendentes de sync
      CREATE INDEX IF NOT EXISTS idx_checklist_answers_syncStatus ON checklist_answers(syncStatus);

      -- ==========================================================================
      -- RECREATE CHECKLIST_ATTACHMENTS with enhanced fields
      -- ==========================================================================
      -- Primeiro, criar tabela temporária
      CREATE TABLE IF NOT EXISTS checklist_attachments_new (
        id TEXT PRIMARY KEY,
        answerId TEXT,              -- Opcional: pode ser anexo direto da OS
        workOrderId TEXT NOT NULL,  -- Referência direta à OS
        type TEXT NOT NULL,         -- PHOTO | SIGNATURE | FILE
        fileName TEXT,
        fileSize INTEGER,
        mimeType TEXT,
        localPath TEXT,             -- Caminho local do arquivo (antigo filePath)
        remotePath TEXT,            -- URL no servidor após sync (antigo remoteUrl)
        thumbnailPath TEXT,
        base64Data TEXT,            -- Dados base64 para upload pendente
        syncStatus TEXT DEFAULT 'PENDING',  -- PENDING | UPLOADING | SYNCED | FAILED
        uploadAttempts INTEGER DEFAULT 0,
        lastUploadError TEXT,
        localId TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        technicianId TEXT NOT NULL,
        FOREIGN KEY (answerId) REFERENCES checklist_answers(id),
        FOREIGN KEY (workOrderId) REFERENCES work_orders(id)
      );

      -- Migrar dados existentes (se houver)
      INSERT OR IGNORE INTO checklist_attachments_new (
        id, answerId, workOrderId, type, fileName, fileSize, mimeType,
        localPath, remotePath, thumbnailPath, localId, createdAt, updatedAt, technicianId, syncStatus
      )
      SELECT
        ca.id,
        ca.answerId,
        COALESCE(ci.workOrderId, 'UNKNOWN'),
        ca.type,
        ca.fileName,
        ca.fileSize,
        ca.mimeType,
        ca.filePath,
        ca.remoteUrl,
        ca.thumbnailPath,
        ca.localId,
        ca.createdAt,
        ca.updatedAt,
        COALESCE(ci.technicianId, 'UNKNOWN'),
        CASE WHEN ca.syncedAt IS NOT NULL THEN 'SYNCED' ELSE 'PENDING' END
      FROM checklist_attachments ca
      LEFT JOIN checklist_answers ans ON ca.answerId = ans.id
      LEFT JOIN checklist_instances ci ON ans.instanceId = ci.id;

      -- Remover tabela antiga e renomear nova
      DROP TABLE IF EXISTS checklist_attachments;
      ALTER TABLE checklist_attachments_new RENAME TO checklist_attachments;

      -- Criar indexes para nova tabela
      CREATE INDEX IF NOT EXISTS idx_checklist_attachments_answerId ON checklist_attachments(answerId);
      CREATE INDEX IF NOT EXISTS idx_checklist_attachments_workOrderId ON checklist_attachments(workOrderId);
      CREATE INDEX IF NOT EXISTS idx_checklist_attachments_syncStatus ON checklist_attachments(syncStatus);
      CREATE INDEX IF NOT EXISTS idx_checklist_attachments_localId ON checklist_attachments(localId);
      CREATE INDEX IF NOT EXISTS idx_checklist_attachments_technicianId ON checklist_attachments(technicianId);

    `,
  },
  // Migration 8: Add syncedAt column to checklist_attachments (was missing in migration 7)
  {
    version: 8,
    sql: `
      -- Add syncedAt column to checklist_attachments if it doesn't exist
      ALTER TABLE checklist_attachments ADD COLUMN syncedAt TEXT;
    `,
  },
  // Migration 9: Add Catalog tables (ProductCategories and CatalogItems)
  {
    version: 9,
    sql: `
      -- ==========================================================================
      -- PRODUCT CATEGORIES (sincronizado do servidor - read-only no mobile)
      -- ==========================================================================
      CREATE TABLE IF NOT EXISTS product_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT,
        isActive INTEGER DEFAULT 1,
        itemCount INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        syncedAt TEXT,
        technicianId TEXT NOT NULL
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_product_categories_technicianId ON product_categories(technicianId);
      CREATE INDEX IF NOT EXISTS idx_product_categories_isActive ON product_categories(isActive);
      CREATE INDEX IF NOT EXISTS idx_product_categories_updatedAt ON product_categories(updatedAt);
      CREATE INDEX IF NOT EXISTS idx_product_categories_name ON product_categories(name);

      -- ==========================================================================
      -- CATALOG ITEMS (sincronizado do servidor - read-only no mobile)
      -- ==========================================================================
      CREATE TABLE IF NOT EXISTS catalog_items (
        id TEXT PRIMARY KEY,
        categoryId TEXT,
        categoryName TEXT,
        categoryColor TEXT,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL DEFAULT 'SERVICE',
        sku TEXT,
        unit TEXT DEFAULT 'UN',
        basePrice REAL NOT NULL,
        costPrice REAL,
        defaultDurationMinutes INTEGER,
        isActive INTEGER DEFAULT 1,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        syncedAt TEXT,
        technicianId TEXT NOT NULL,
        FOREIGN KEY (categoryId) REFERENCES product_categories(id)
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_catalog_items_technicianId ON catalog_items(technicianId);
      CREATE INDEX IF NOT EXISTS idx_catalog_items_categoryId ON catalog_items(categoryId);
      CREATE INDEX IF NOT EXISTS idx_catalog_items_type ON catalog_items(type);
      CREATE INDEX IF NOT EXISTS idx_catalog_items_isActive ON catalog_items(isActive);
      CREATE INDEX IF NOT EXISTS idx_catalog_items_updatedAt ON catalog_items(updatedAt);
      CREATE INDEX IF NOT EXISTS idx_catalog_items_name ON catalog_items(name);
      CREATE INDEX IF NOT EXISTS idx_catalog_items_sku ON catalog_items(sku);

      -- ==========================================================================
      -- BUNDLE ITEMS (componentes de bundles/kits)
      -- ==========================================================================
      CREATE TABLE IF NOT EXISTS bundle_items (
        id TEXT PRIMARY KEY,
        bundleId TEXT NOT NULL,
        itemId TEXT NOT NULL,
        itemName TEXT,
        itemType TEXT,
        itemUnit TEXT,
        itemBasePrice REAL,
        quantity REAL NOT NULL,
        createdAt TEXT NOT NULL,
        technicianId TEXT NOT NULL,
        FOREIGN KEY (bundleId) REFERENCES catalog_items(id),
        FOREIGN KEY (itemId) REFERENCES catalog_items(id),
        UNIQUE(bundleId, itemId)
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_bundle_items_bundleId ON bundle_items(bundleId);
      CREATE INDEX IF NOT EXISTS idx_bundle_items_itemId ON bundle_items(itemId);
      CREATE INDEX IF NOT EXISTS idx_bundle_items_technicianId ON bundle_items(technicianId);

      -- Initialize sync_meta for catalog entities
      INSERT OR IGNORE INTO sync_meta (entity, lastSyncAt, syncStatus) VALUES ('categories', '1970-01-01T00:00:00Z', 'idle');
      INSERT OR IGNORE INTO sync_meta (entity, lastSyncAt, syncStatus) VALUES ('catalogItems', '1970-01-01T00:00:00Z', 'idle');
    `,
  },
  // ==========================================================================
  // Migration v10: Quote Signatures table
  // ==========================================================================
  {
    version: 10,
    sql: `
      -- ==========================================================================
      -- QUOTE SIGNATURES (assinaturas de orçamentos)
      -- ==========================================================================
      CREATE TABLE IF NOT EXISTS quote_signatures (
        id TEXT PRIMARY KEY,
        quoteId TEXT NOT NULL UNIQUE,
        signerName TEXT NOT NULL,
        signerDocument TEXT,
        signerRole TEXT DEFAULT 'Cliente',
        signatureBase64 TEXT NOT NULL,
        localPath TEXT,
        remotePath TEXT,
        syncStatus TEXT DEFAULT 'PENDING',
        uploadAttempts INTEGER DEFAULT 0,
        lastUploadError TEXT,
        signedAt TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        technicianId TEXT NOT NULL,
        FOREIGN KEY (quoteId) REFERENCES quotes(id)
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_quote_signatures_quoteId ON quote_signatures(quoteId);
      CREATE INDEX IF NOT EXISTS idx_quote_signatures_syncStatus ON quote_signatures(syncStatus);
      CREATE INDEX IF NOT EXISTS idx_quote_signatures_technicianId ON quote_signatures(technicianId);

      -- Initialize sync_meta for quote signatures
      INSERT OR IGNORE INTO sync_meta (entity, lastSyncAt, syncStatus) VALUES ('quoteSignatures', '1970-01-01T00:00:00Z', 'idle');
    `,
  },
  // ==========================================================================
  // Migration v11: Make templateVersionSnapshot nullable for offline support
  // The API list endpoint doesn't return the full snapshot, only the full endpoint does
  // ==========================================================================
  {
    version: 11,
    sql: `
      -- SQLite doesn't support ALTER COLUMN, so we need to recreate the table
      -- First, create a new table with nullable templateVersionSnapshot
      CREATE TABLE IF NOT EXISTS checklist_instances_new (
        id TEXT PRIMARY KEY,
        workOrderId TEXT NOT NULL,
        templateId TEXT NOT NULL,
        templateVersionSnapshot TEXT, -- Now nullable for offline list caching
        templateName TEXT,
        status TEXT DEFAULT 'PENDING',
        progress INTEGER DEFAULT 0,
        startedAt TEXT,
        completedAt TEXT,
        completedBy TEXT,
        localId TEXT,
        deletedAt TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        syncedAt TEXT,
        technicianId TEXT NOT NULL,
        FOREIGN KEY (workOrderId) REFERENCES work_orders(id),
        FOREIGN KEY (templateId) REFERENCES checklist_templates(id)
      );

      -- Copy data from old table
      INSERT OR IGNORE INTO checklist_instances_new (
        id, workOrderId, templateId, templateVersionSnapshot, templateName,
        status, progress, startedAt, completedAt, completedBy, localId,
        deletedAt, createdAt, updatedAt, syncedAt, technicianId
      )
      SELECT
        id, workOrderId, templateId, templateVersionSnapshot, templateName,
        status, progress, startedAt, completedAt, completedBy, localId,
        deletedAt, createdAt, updatedAt, syncedAt, technicianId
      FROM checklist_instances;

      -- Drop old table and rename new one
      DROP TABLE IF EXISTS checklist_instances;
      ALTER TABLE checklist_instances_new RENAME TO checklist_instances;

      -- Recreate indexes
      CREATE INDEX IF NOT EXISTS idx_checklist_instances_workOrderId ON checklist_instances(workOrderId);
      CREATE INDEX IF NOT EXISTS idx_checklist_instances_templateId ON checklist_instances(templateId);
      CREATE INDEX IF NOT EXISTS idx_checklist_instances_technicianId ON checklist_instances(technicianId);
      CREATE INDEX IF NOT EXISTS idx_checklist_instances_status ON checklist_instances(status);
      CREATE INDEX IF NOT EXISTS idx_checklist_instances_updatedAt ON checklist_instances(updatedAt);
      CREATE INDEX IF NOT EXISTS idx_checklist_instances_localId ON checklist_instances(localId);
    `,
  },
  // ==========================================================================
  // Migration v12: Remove FOREIGN KEY constraints from checklist_instances
  // These constraints prevent saving checklists when the related work_orders
  // or checklist_templates don't exist locally. For offline caching, we need
  // to store checklists even without the full related data.
  // ==========================================================================
  {
    version: 12,
    sql: `
      -- First drop any leftover temp tables from failed migrations
      DROP TABLE IF EXISTS checklist_instances_v12;
      DROP TABLE IF EXISTS checklist_instances_new;

      -- Recreate checklist_instances without FOREIGN KEY constraints
      CREATE TABLE checklist_instances_v12 (
        id TEXT PRIMARY KEY,
        workOrderId TEXT NOT NULL,
        templateId TEXT NOT NULL,
        templateVersionSnapshot TEXT,
        templateName TEXT,
        status TEXT DEFAULT 'PENDING',
        progress INTEGER DEFAULT 0,
        startedAt TEXT,
        completedAt TEXT,
        completedBy TEXT,
        localId TEXT,
        deletedAt TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        syncedAt TEXT,
        technicianId TEXT NOT NULL
      );

      -- Copy data from old table
      INSERT OR IGNORE INTO checklist_instances_v12 (
        id, workOrderId, templateId, templateVersionSnapshot, templateName,
        status, progress, startedAt, completedAt, completedBy, localId,
        deletedAt, createdAt, updatedAt, syncedAt, technicianId
      )
      SELECT
        id, workOrderId, templateId, templateVersionSnapshot, templateName,
        status, progress, startedAt, completedAt, completedBy, localId,
        deletedAt, createdAt, updatedAt, syncedAt, technicianId
      FROM checklist_instances;

      -- Drop old table and rename new one
      DROP TABLE IF EXISTS checklist_instances;
      ALTER TABLE checklist_instances_v12 RENAME TO checklist_instances;

      -- Recreate indexes
      CREATE INDEX IF NOT EXISTS idx_checklist_instances_workOrderId ON checklist_instances(workOrderId);
      CREATE INDEX IF NOT EXISTS idx_checklist_instances_templateId ON checklist_instances(templateId);
      CREATE INDEX IF NOT EXISTS idx_checklist_instances_technicianId ON checklist_instances(technicianId);
      CREATE INDEX IF NOT EXISTS idx_checklist_instances_status ON checklist_instances(status);
      CREATE INDEX IF NOT EXISTS idx_checklist_instances_updatedAt ON checklist_instances(updatedAt);
      CREATE INDEX IF NOT EXISTS idx_checklist_instances_localId ON checklist_instances(localId);
    `,
  },
  // Migration 13: Add sync fields to execution sessions
  {
    version: 13,
    sql: `
      -- Add syncedAt and serverId columns to execution sessions for sync support
      ALTER TABLE work_order_execution_sessions ADD COLUMN syncedAt TEXT;
      ALTER TABLE work_order_execution_sessions ADD COLUMN serverId TEXT;

      -- Create index for pending sync queries
      CREATE INDEX IF NOT EXISTS idx_wo_exec_sessions_syncedAt ON work_order_execution_sessions(syncedAt);
    `,
  },
  // Migration 14: Remove FOREIGN KEY constraint from checklist_attachments.answerId
  // This allows photos to be saved before the answer is created
  {
    version: 14,
    sql: `
      -- Recreate checklist_attachments without FK constraint on answerId
      CREATE TABLE IF NOT EXISTS checklist_attachments_v14 (
        id TEXT PRIMARY KEY,
        answerId TEXT,              -- No FK constraint - can be questionId before answer exists
        workOrderId TEXT NOT NULL,
        type TEXT NOT NULL,
        fileName TEXT,
        fileSize INTEGER,
        mimeType TEXT,
        localPath TEXT,
        remotePath TEXT,
        thumbnailPath TEXT,
        base64Data TEXT,
        syncStatus TEXT DEFAULT 'PENDING',
        uploadAttempts INTEGER DEFAULT 0,
        lastUploadError TEXT,
        localId TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        technicianId TEXT NOT NULL,
        syncedAt TEXT
      );

      -- Copy existing data
      INSERT OR IGNORE INTO checklist_attachments_v14 (
        id, answerId, workOrderId, type, fileName, fileSize, mimeType,
        localPath, remotePath, thumbnailPath, base64Data, syncStatus,
        uploadAttempts, lastUploadError, localId, createdAt, updatedAt,
        technicianId, syncedAt
      )
      SELECT
        id, answerId, workOrderId, type, fileName, fileSize, mimeType,
        localPath, remotePath, thumbnailPath, base64Data, syncStatus,
        uploadAttempts, lastUploadError, localId, createdAt, updatedAt,
        technicianId, syncedAt
      FROM checklist_attachments;

      -- Drop old table and rename
      DROP TABLE IF EXISTS checklist_attachments;
      ALTER TABLE checklist_attachments_v14 RENAME TO checklist_attachments;

      -- Recreate indexes
      CREATE INDEX IF NOT EXISTS idx_checklist_attachments_answerId ON checklist_attachments(answerId);
      CREATE INDEX IF NOT EXISTS idx_checklist_attachments_workOrderId ON checklist_attachments(workOrderId);
      CREATE INDEX IF NOT EXISTS idx_checklist_attachments_syncStatus ON checklist_attachments(syncStatus);
      CREATE INDEX IF NOT EXISTS idx_checklist_attachments_localId ON checklist_attachments(localId);
      CREATE INDEX IF NOT EXISTS idx_checklist_attachments_technicianId ON checklist_attachments(technicianId);
    `,
  },
];

export const CURRENT_DB_VERSION = 14;
