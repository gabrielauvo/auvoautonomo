/**
 * PowerSync Schema
 *
 * Schema declarativo para sincronização com PowerSync.
 * Mapeia as tabelas do PostgreSQL para o SQLite local.
 */

import { column, Schema, Table } from '@powersync/react-native';

// =============================================================================
// CLIENTS
// =============================================================================

const clients = new Table({
  // Fields synced from server
  name: column.text,
  email: column.text,
  phone: column.text,
  tax_id: column.text, // CPF/CNPJ (document no local antigo)
  address: column.text,
  city: column.text,
  state: column.text,
  zip_code: column.text,
  notes: column.text,
  is_active: column.integer, // boolean as 0/1
  deleted_at: column.text,
  created_at: column.text,
  updated_at: column.text,
  technician_id: column.text,
});

// =============================================================================
// WORK ORDERS
// =============================================================================

const work_orders = new Table({
  client_id: column.text,
  quote_id: column.text,
  title: column.text,
  description: column.text,
  status: column.text, // SCHEDULED | IN_PROGRESS | DONE | CANCELED
  scheduled_date: column.text,
  scheduled_start_time: column.text,
  scheduled_end_time: column.text,
  execution_start: column.text,
  execution_end: column.text,
  address: column.text,
  notes: column.text,
  total_value: column.real,
  is_active: column.integer,
  deleted_at: column.text,
  created_at: column.text,
  updated_at: column.text,
  technician_id: column.text,
  // Denormalized client data
  client_name: column.text,
  client_phone: column.text,
  client_address: column.text,
});

// =============================================================================
// QUOTES
// =============================================================================

const quotes = new Table({
  client_id: column.text,
  status: column.text, // DRAFT | SENT | APPROVED | REJECTED | EXPIRED
  discount_value: column.real,
  total_value: column.real,
  notes: column.text,
  sent_at: column.text,
  visit_scheduled_at: column.text,
  created_at: column.text,
  updated_at: column.text,
  technician_id: column.text,
  // Denormalized
  client_name: column.text,
});

// =============================================================================
// QUOTE ITEMS
// =============================================================================

const quote_items = new Table({
  quote_id: column.text,
  item_id: column.text, // Catalog item reference
  name: column.text,
  type: column.text, // SERVICE | PRODUCT
  unit: column.text,
  quantity: column.real,
  unit_price: column.real,
  discount_value: column.real,
  total_price: column.real,
  created_at: column.text,
  updated_at: column.text,
});

// =============================================================================
// INVOICES
// =============================================================================

const invoices = new Table({
  client_id: column.text,
  work_order_id: column.text,
  invoice_number: column.text,
  status: column.text, // PENDING | PAID | OVERDUE | CANCELLED
  subtotal: column.real,
  tax: column.real,
  discount: column.real,
  total: column.real,
  due_date: column.text,
  paid_date: column.text,
  notes: column.text,
  created_at: column.text,
  updated_at: column.text,
  technician_id: column.text,
  // Denormalized
  client_name: column.text,
});

// =============================================================================
// CHECKLIST TEMPLATES (Global - read-only)
// =============================================================================

const checklist_templates = new Table({
  name: column.text,
  description: column.text,
  version: column.integer,
  is_active: column.integer,
  sections: column.text, // JSON array
  questions: column.text, // JSON array
  created_at: column.text,
  updated_at: column.text,
});

// =============================================================================
// CHECKLIST INSTANCES
// =============================================================================

const checklist_instances = new Table({
  work_order_id: column.text,
  template_id: column.text,
  template_name: column.text,
  template_version_snapshot: column.text, // JSON
  status: column.text, // PENDING | IN_PROGRESS | COMPLETED | CANCELLED
  progress: column.integer, // 0-100
  started_at: column.text,
  completed_at: column.text,
  completed_by: column.text,
  created_at: column.text,
  updated_at: column.text,
  technician_id: column.text,
});

// =============================================================================
// CHECKLIST ANSWERS
// =============================================================================

const checklist_answers = new Table({
  instance_id: column.text,
  question_id: column.text,
  type: column.text, // Question type
  value_text: column.text,
  value_number: column.real,
  value_boolean: column.integer,
  value_date: column.text,
  value_json: column.text, // JSON for complex types
  answered_at: column.text,
  answered_by: column.text,
  device_info: column.text,
  created_at: column.text,
  updated_at: column.text,
});

// =============================================================================
// CHECKLIST ATTACHMENTS
// =============================================================================

const checklist_attachments = new Table({
  answer_id: column.text,
  work_order_id: column.text,
  type: column.text, // PHOTO | SIGNATURE | FILE
  file_name: column.text,
  mime_type: column.text,
  file_size: column.integer,
  local_path: column.text,
  remote_url: column.text,
  thumbnail_path: column.text,
  created_at: column.text,
  updated_at: column.text,
  technician_id: column.text,
});

// =============================================================================
// PRODUCT CATEGORIES (Global - read-only)
// =============================================================================

const product_categories = new Table({
  name: column.text,
  description: column.text,
  color: column.text,
  is_active: column.integer,
  item_count: column.integer,
  created_at: column.text,
  updated_at: column.text,
});

// =============================================================================
// CATALOG ITEMS (Global - read-only)
// =============================================================================

const catalog_items = new Table({
  category_id: column.text,
  category_name: column.text,
  name: column.text,
  description: column.text,
  sku: column.text,
  type: column.text, // PRODUCT | SERVICE | BUNDLE
  base_price: column.real,
  cost_price: column.real,
  default_duration_minutes: column.integer,
  is_active: column.integer,
  created_at: column.text,
  updated_at: column.text,
});

// =============================================================================
// BUNDLE ITEMS (for BUNDLE type catalog items)
// =============================================================================

const bundle_items = new Table({
  bundle_id: column.text,
  item_id: column.text,
  item_name: column.text,
  quantity: column.real,
  unit_price: column.real,
});

// =============================================================================
// SIGNATURES
// =============================================================================

const signatures = new Table({
  work_order_id: column.text,
  quote_id: column.text,
  client_id: column.text,
  attachment_id: column.text,
  signer_name: column.text,
  signer_document: column.text,
  signer_role: column.text,
  signed_at: column.text,
  hash: column.text,
  ip_address: column.text,
  user_agent: column.text,
  device_info: column.text,
  signature_base64: column.text,
  signature_file_path: column.text,
  created_at: column.text,
  updated_at: column.text,
  technician_id: column.text,
});

// =============================================================================
// EXECUTION SESSIONS (local timer tracking)
// =============================================================================

const execution_sessions = new Table({
  work_order_id: column.text,
  session_type: column.text, // WORK | PAUSE
  started_at: column.text,
  ended_at: column.text,
  duration: column.integer, // seconds
  pause_reason: column.text,
  notes: column.text,
  created_at: column.text,
  updated_at: column.text,
  technician_id: column.text,
  server_id: column.text,
});

// =============================================================================
// EXPORT SCHEMA
// =============================================================================

export const AppSchema = new Schema({
  clients,
  work_orders,
  quotes,
  quote_items,
  invoices,
  checklist_templates,
  checklist_instances,
  checklist_answers,
  checklist_attachments,
  product_categories,
  catalog_items,
  bundle_items,
  signatures,
  execution_sessions,
});

// =============================================================================
// TYPE EXPORTS (for TypeScript)
// =============================================================================

export type Database = (typeof AppSchema)['types'];
export type ClientRecord = Database['clients'];
export type WorkOrderRecord = Database['work_orders'];
export type QuoteRecord = Database['quotes'];
export type QuoteItemRecord = Database['quote_items'];
export type InvoiceRecord = Database['invoices'];
export type ChecklistTemplateRecord = Database['checklist_templates'];
export type ChecklistInstanceRecord = Database['checklist_instances'];
export type ChecklistAnswerRecord = Database['checklist_answers'];
export type ChecklistAttachmentRecord = Database['checklist_attachments'];
export type ProductCategoryRecord = Database['product_categories'];
export type CatalogItemRecord = Database['catalog_items'];
export type BundleItemRecord = Database['bundle_items'];
export type SignatureRecord = Database['signatures'];
export type ExecutionSessionRecord = Database['execution_sessions'];
