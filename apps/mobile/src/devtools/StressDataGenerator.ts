/**
 * Stress Data Generator
 *
 * Gera dados de teste para stress test.
 * SOMENTE para uso em desenvolvimento.
 */

import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// TYPES
// =============================================================================

export interface GeneratedClient {
  id: string;
  name: string;
  email: string;
  phone: string;
  document: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  notes: string;
  isActive: number;
  createdAt: string;
  updatedAt: string;
  technicianId: string;
}

export interface GeneratedWorkOrder {
  id: string;
  clientId: string;
  title: string;
  description: string;
  status: string;
  scheduledDate: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  address: string;
  notes: string;
  totalValue: number;
  isActive: number;
  createdAt: string;
  updatedAt: string;
  technicianId: string;
  clientName: string;
  clientPhone: string;
  clientAddress: string;
}

export interface GeneratedQuote {
  id: string;
  clientId: string;
  status: string;
  discountValue: number;
  totalValue: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
  technicianId: string;
  clientName: string;
}

export interface GeneratedInvoice {
  id: string;
  clientId: string;
  workOrderId: string | null;
  invoiceNumber: string;
  status: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  dueDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  technicianId: string;
  clientName: string;
}

export interface GeneratedChecklistQuestion {
  id: string;
  type: string;
  title: string;
  description: string;
  isRequired: boolean;
  order: number;
  options?: Array<{ value: string; label: string }>;
}

export interface GeneratedChecklistTemplate {
  id: string;
  name: string;
  description: string;
  version: number;
  isActive: number;
  sections: string;
  questions: string;
  createdAt: string;
  updatedAt: string;
  technicianId: string;
}

// =============================================================================
// DATA POOLS
// =============================================================================

const FIRST_NAMES = [
  'João', 'Maria', 'Pedro', 'Ana', 'Carlos', 'Fernanda', 'Rafael', 'Julia',
  'Lucas', 'Beatriz', 'Gabriel', 'Larissa', 'Matheus', 'Camila', 'Bruno',
  'Amanda', 'Gustavo', 'Leticia', 'Felipe', 'Mariana', 'Rodrigo', 'Patricia',
  'Leonardo', 'Vanessa', 'Thiago', 'Isabela', 'Diego', 'Natalia', 'Andre',
  'Carolina', 'Ricardo', 'Renata', 'Eduardo', 'Aline', 'Marcos', 'Juliana',
];

const LAST_NAMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Costa', 'Pereira', 'Ferreira',
  'Rodrigues', 'Almeida', 'Nascimento', 'Araújo', 'Melo', 'Barbosa', 'Ribeiro',
  'Gomes', 'Martins', 'Carvalho', 'Rocha', 'Correia', 'Dias', 'Nunes', 'Torres',
  'Freitas', 'Moreira', 'Mendes', 'Barros', 'Castro', 'Ramos', 'Pinto',
];

const CITIES = [
  { city: 'São Paulo', state: 'SP' },
  { city: 'Rio de Janeiro', state: 'RJ' },
  { city: 'Belo Horizonte', state: 'MG' },
  { city: 'Curitiba', state: 'PR' },
  { city: 'Porto Alegre', state: 'RS' },
  { city: 'Salvador', state: 'BA' },
  { city: 'Fortaleza', state: 'CE' },
  { city: 'Brasília', state: 'DF' },
  { city: 'Recife', state: 'PE' },
  { city: 'Campinas', state: 'SP' },
];

const STREETS = [
  'Rua das Flores', 'Av. Brasil', 'Rua São Paulo', 'Av. Paulista', 'Rua XV de Novembro',
  'Rua das Palmeiras', 'Av. Rio Branco', 'Rua Santos Dumont', 'Av. Atlântica',
  'Rua Augusta', 'Rua Oscar Freire', 'Av. Rebouças', 'Rua Vergueiro', 'Av. Ipiranga',
];

const WORK_ORDER_TITLES = [
  'Instalação de ar condicionado', 'Manutenção preventiva', 'Reparo elétrico',
  'Troca de peças', 'Limpeza de sistema', 'Instalação de split', 'Manutenção corretiva',
  'Revisão geral', 'Instalação de duto', 'Verificação de vazamento',
  'Carga de gás', 'Troca de filtro', 'Instalação de exaustor', 'Reparo de compressor',
];

const QUESTION_TYPES = [
  'TEXT_SHORT', 'TEXT_LONG', 'NUMBER', 'CHECKBOX', 'SELECT', 'PHOTO_REQUIRED',
  'RATING', 'DATE', 'TIME', 'SIGNATURE_CLIENT',
];

const QUESTION_TITLES = [
  'Equipamento está funcionando?', 'Qual a temperatura atual?', 'Observações gerais',
  'Número de série do equipamento', 'Cliente presente durante o serviço?',
  'Foto do equipamento antes', 'Foto do equipamento depois', 'Nível de satisfação',
  'Problemas encontrados', 'Peças substituídas', 'Tempo de garantia',
  'Condições do local', 'Acessibilidade do equipamento', 'Limpeza realizada?',
  'Testes realizados', 'Medições elétricas', 'Pressão do sistema',
  'Assinatura do cliente', 'Data da próxima manutenção', 'Recomendações',
];

// =============================================================================
// GENERATORS
// =============================================================================

function random<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateCPF(): string {
  const n = () => Math.floor(Math.random() * 10);
  return `${n()}${n()}${n()}.${n()}${n()}${n()}.${n()}${n()}${n()}-${n()}${n()}`;
}

function generatePhone(): string {
  const n = () => Math.floor(Math.random() * 10);
  const ddd = randomInt(11, 99);
  return `(${ddd}) 9${n()}${n()}${n()}${n()}-${n()}${n()}${n()}${n()}`;
}

function generateZipCode(): string {
  const n = () => Math.floor(Math.random() * 10);
  return `${n()}${n()}${n()}${n()}${n()}-${n()}${n()}${n()}`;
}

function generateDate(daysOffset: number = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString();
}

function generateDateOnly(daysOffset: number = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split('T')[0];
}

function generateTime(hour: number): string {
  return `${hour.toString().padStart(2, '0')}:00:00`;
}

// =============================================================================
// ENTITY GENERATORS
// =============================================================================

export function generateClient(
  technicianId: string,
  index: number
): GeneratedClient {
  const firstName = random(FIRST_NAMES);
  const lastName = random(LAST_NAMES);
  const name = `${firstName} ${lastName}`;
  const location = random(CITIES);
  const street = random(STREETS);

  return {
    id: `stress-client-${index}-${uuidv4().substring(0, 8)}`,
    name,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@email.com`,
    phone: generatePhone(),
    document: generateCPF(),
    address: `${street}, ${randomInt(1, 9999)}`,
    city: location.city,
    state: location.state,
    zipCode: generateZipCode(),
    notes: `Cliente de teste #${index}`,
    isActive: 1,
    createdAt: generateDate(-randomInt(1, 365)),
    updatedAt: generateDate(-randomInt(0, 30)),
    technicianId,
  };
}

export function generateWorkOrder(
  technicianId: string,
  client: GeneratedClient,
  index: number,
  daysOffset: number = 0
): GeneratedWorkOrder {
  const statuses = ['SCHEDULED', 'IN_PROGRESS', 'DONE', 'CANCELED'];
  const status = random(statuses);
  const hour = randomInt(8, 17);

  return {
    id: `stress-wo-${index}-${uuidv4().substring(0, 8)}`,
    clientId: client.id,
    title: random(WORK_ORDER_TITLES),
    description: `Descrição da ordem de serviço #${index}. ${random(WORK_ORDER_TITLES)} para o cliente.`,
    status,
    scheduledDate: generateDateOnly(daysOffset),
    scheduledStartTime: generateTime(hour),
    scheduledEndTime: generateTime(hour + randomInt(1, 4)),
    address: client.address,
    notes: `Observações da OS #${index}`,
    totalValue: randomInt(100, 5000),
    isActive: 1,
    createdAt: generateDate(-randomInt(1, 365)),
    updatedAt: generateDate(-randomInt(0, 30)),
    technicianId,
    clientName: client.name,
    clientPhone: client.phone,
    clientAddress: client.address,
  };
}

export function generateQuote(
  technicianId: string,
  client: GeneratedClient,
  index: number
): GeneratedQuote {
  const statuses = ['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED'];
  const totalValue = randomInt(500, 20000);
  const discountValue = randomInt(0, Math.floor(totalValue * 0.2));

  return {
    id: `stress-quote-${index}-${uuidv4().substring(0, 8)}`,
    clientId: client.id,
    status: random(statuses),
    discountValue,
    totalValue: totalValue - discountValue,
    notes: `Orçamento de teste #${index}`,
    createdAt: generateDate(-randomInt(1, 180)),
    updatedAt: generateDate(-randomInt(0, 30)),
    technicianId,
    clientName: client.name,
  };
}

export function generateInvoice(
  technicianId: string,
  client: GeneratedClient,
  workOrderId: string | null,
  index: number
): GeneratedInvoice {
  const statuses = ['PENDING', 'PAID', 'OVERDUE', 'CANCELLED'];
  const subtotal = randomInt(500, 15000);
  const tax = Math.round(subtotal * 0.1);
  const discount = randomInt(0, Math.floor(subtotal * 0.15));

  return {
    id: `stress-invoice-${index}-${uuidv4().substring(0, 8)}`,
    clientId: client.id,
    workOrderId,
    invoiceNumber: `INV-${String(index).padStart(6, '0')}`,
    status: random(statuses),
    subtotal,
    tax,
    discount,
    total: subtotal + tax - discount,
    dueDate: generateDateOnly(randomInt(-30, 60)),
    notes: `Fatura de teste #${index}`,
    createdAt: generateDate(-randomInt(1, 90)),
    updatedAt: generateDate(-randomInt(0, 15)),
    technicianId,
    clientName: client.name,
  };
}

export function generateChecklistTemplate(
  technicianId: string,
  questionCount: number,
  index: number
): GeneratedChecklistTemplate {
  const sections = [
    { id: `section-${index}-1`, title: 'Identificação', description: 'Dados do equipamento', order: 0 },
    { id: `section-${index}-2`, title: 'Inspeção Visual', description: 'Verificação visual', order: 1 },
    { id: `section-${index}-3`, title: 'Testes', description: 'Testes funcionais', order: 2 },
    { id: `section-${index}-4`, title: 'Finalização', description: 'Conclusão do serviço', order: 3 },
  ];

  const questions: GeneratedChecklistQuestion[] = [];

  for (let i = 0; i < questionCount; i++) {
    const type = random(QUESTION_TYPES);
    const question: GeneratedChecklistQuestion = {
      id: `question-${index}-${i}`,
      type,
      title: `${random(QUESTION_TITLES)} (${i + 1})`,
      description: `Descrição da pergunta ${i + 1}`,
      isRequired: Math.random() > 0.3,
      order: i,
    };

    if (type === 'SELECT' || type === 'MULTI_SELECT') {
      question.options = [
        { value: 'opt1', label: 'Opção 1' },
        { value: 'opt2', label: 'Opção 2' },
        { value: 'opt3', label: 'Opção 3' },
        { value: 'opt4', label: 'Opção 4' },
      ];
    }

    questions.push(question);
  }

  return {
    id: `stress-template-${index}-${uuidv4().substring(0, 8)}`,
    name: `Checklist de Teste #${index}`,
    description: `Template de checklist com ${questionCount} perguntas para stress test`,
    version: 1,
    isActive: 1,
    sections: JSON.stringify(sections),
    questions: JSON.stringify(questions),
    createdAt: generateDate(-randomInt(30, 180)),
    updatedAt: generateDate(-randomInt(0, 30)),
    technicianId,
  };
}

// =============================================================================
// BATCH GENERATOR
// =============================================================================

export interface BatchGeneratorOptions {
  clients: number;
  workOrdersPerClient: number;
  quotesPerClient: number;
  invoicesPerClient: number;
  checklistTemplates: number;
  questionsPerChecklist: number;
}

/**
 * Options for generating data with absolute counts (not per-client)
 */
export interface AbsoluteBatchOptions {
  clients: number;
  workOrders: number;
  quotes: number;
  invoices: number;
  checklistTemplates: number;
  questionsPerTemplate?: number;
}

export interface GeneratedBatch {
  clients: GeneratedClient[];
  workOrders: GeneratedWorkOrder[];
  quotes: GeneratedQuote[];
  invoices: GeneratedInvoice[];
  checklistTemplates: GeneratedChecklistTemplate[];
}

export function generateBatch(
  technicianId: string,
  options: BatchGeneratorOptions,
  onProgress?: (current: number, total: number, entity: string) => void
): GeneratedBatch {
  const clients: GeneratedClient[] = [];
  const workOrders: GeneratedWorkOrder[] = [];
  const quotes: GeneratedQuote[] = [];
  const invoices: GeneratedInvoice[] = [];
  const checklistTemplates: GeneratedChecklistTemplate[] = [];

  const total =
    options.clients +
    options.clients * options.workOrdersPerClient +
    options.clients * options.quotesPerClient +
    options.clients * options.invoicesPerClient +
    options.checklistTemplates;

  let current = 0;

  // Generate clients
  for (let i = 0; i < options.clients; i++) {
    clients.push(generateClient(technicianId, i));
    current++;
    if (onProgress && current % 1000 === 0) {
      onProgress(current, total, 'clients');
    }
  }

  // Generate work orders
  let woIndex = 0;
  for (const client of clients) {
    for (let j = 0; j < options.workOrdersPerClient; j++) {
      const daysOffset = randomInt(-30, 60);
      workOrders.push(generateWorkOrder(technicianId, client, woIndex++, daysOffset));
      current++;
      if (onProgress && current % 1000 === 0) {
        onProgress(current, total, 'workOrders');
      }
    }
  }

  // Generate quotes
  let quoteIndex = 0;
  for (const client of clients) {
    for (let j = 0; j < options.quotesPerClient; j++) {
      quotes.push(generateQuote(technicianId, client, quoteIndex++));
      current++;
      if (onProgress && current % 1000 === 0) {
        onProgress(current, total, 'quotes');
      }
    }
  }

  // Generate invoices
  let invoiceIndex = 0;
  for (let i = 0; i < clients.length; i++) {
    const client = clients[i];
    for (let j = 0; j < options.invoicesPerClient; j++) {
      const wo = workOrders.find((w) => w.clientId === client.id);
      invoices.push(generateInvoice(technicianId, client, wo?.id || null, invoiceIndex++));
      current++;
      if (onProgress && current % 1000 === 0) {
        onProgress(current, total, 'invoices');
      }
    }
  }

  // Generate checklist templates
  for (let i = 0; i < options.checklistTemplates; i++) {
    checklistTemplates.push(
      generateChecklistTemplate(technicianId, options.questionsPerChecklist, i)
    );
    current++;
    if (onProgress) {
      onProgress(current, total, 'checklistTemplates');
    }
  }

  return {
    clients,
    workOrders,
    quotes,
    invoices,
    checklistTemplates,
  };
}

/**
 * Generate batch with absolute counts (not per-client)
 * This is useful for stress testing specific entity types independently
 */
export function generateAbsoluteBatch(
  technicianId: string,
  options: AbsoluteBatchOptions
): GeneratedBatch {
  const clients: GeneratedClient[] = [];
  const workOrders: GeneratedWorkOrder[] = [];
  const quotes: GeneratedQuote[] = [];
  const invoices: GeneratedInvoice[] = [];
  const checklistTemplates: GeneratedChecklistTemplate[] = [];

  // Generate clients
  for (let i = 0; i < options.clients; i++) {
    clients.push(generateClient(technicianId, i));
  }

  // Generate work orders (distribute among clients if available)
  for (let i = 0; i < options.workOrders; i++) {
    const client = clients.length > 0
      ? clients[i % clients.length]
      : {
          id: `fake-client-${i}`,
          name: 'Fake Client',
          phone: '11999999999',
          address: 'Fake Address',
        };
    const daysOffset = randomInt(-30, 60);
    workOrders.push(generateWorkOrder(technicianId, client as GeneratedClient, i, daysOffset));
  }

  // Generate quotes (distribute among clients if available)
  for (let i = 0; i < options.quotes; i++) {
    const client = clients.length > 0
      ? clients[i % clients.length]
      : {
          id: `fake-client-${i}`,
          name: 'Fake Client',
        };
    quotes.push(generateQuote(technicianId, client as GeneratedClient, i));
  }

  // Generate invoices (distribute among clients if available)
  for (let i = 0; i < options.invoices; i++) {
    const client = clients.length > 0
      ? clients[i % clients.length]
      : {
          id: `fake-client-${i}`,
          name: 'Fake Client',
        };
    const wo = workOrders.length > 0 ? workOrders[i % workOrders.length] : null;
    invoices.push(generateInvoice(technicianId, client as GeneratedClient, wo?.id || null, i));
  }

  // Generate checklist templates
  const questionsCount = options.questionsPerTemplate ?? 200;
  for (let i = 0; i < options.checklistTemplates; i++) {
    checklistTemplates.push(generateChecklistTemplate(technicianId, questionsCount, i));
  }

  return {
    clients,
    workOrders,
    quotes,
    invoices,
    checklistTemplates,
  };
}

export default {
  generateClient,
  generateWorkOrder,
  generateQuote,
  generateInvoice,
  generateChecklistTemplate,
  generateBatch,
  generateAbsoluteBatch,
};
