#!/usr/bin/env npx ts-node
/**
 * Sync QA Validator CLI
 *
 * Script interativo para guiar QA através dos cenários de teste de sincronização.
 * Executa validações automatizadas onde possível e registra resultados manuais.
 *
 * Uso:
 *   npx ts-node scripts/sync-qa-validator.ts
 *   npx ts-node scripts/sync-qa-validator.ts --module clients
 *   npx ts-node scripts/sync-qa-validator.ts --report-only
 */

import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPES
// ============================================================================
interface TestScenario {
  id: string;
  module: string;
  title: string;
  steps: string[];
  expectedResult: string;
  priority: 'high' | 'medium' | 'low';
  automated: boolean;
}

interface TestResult {
  scenarioId: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending';
  notes: string;
  timestamp: string;
  tester: string;
}

interface TestReport {
  runId: string;
  startTime: string;
  endTime?: string;
  tester: string;
  results: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    pending: number;
  };
}

// ============================================================================
// TEST SCENARIOS (from docs/sync-test-scenarios.md)
// ============================================================================
const TEST_SCENARIOS: TestScenario[] = [
  // CLIENTS
  {
    id: 'CLI-01',
    module: 'clients',
    title: 'Criar cliente no Web, verificar no Mobile',
    steps: [
      '1. Abra o Web e crie um novo cliente',
      '2. Anote o nome do cliente criado',
      '3. Abra o Mobile e aguarde sync (pull-to-refresh)',
      '4. Procure o cliente na lista',
    ],
    expectedResult: 'Cliente aparece no Mobile com todos os dados corretos',
    priority: 'high',
    automated: false,
  },
  {
    id: 'CLI-02',
    module: 'clients',
    title: 'Criar cliente no Mobile, verificar no Web',
    steps: [
      '1. Abra o Mobile e crie um novo cliente',
      '2. Aguarde o sync (indicador de sync deve desaparecer)',
      '3. Abra o Web e procure o cliente',
    ],
    expectedResult: 'Cliente aparece no Web com todos os dados corretos',
    priority: 'high',
    automated: false,
  },
  {
    id: 'CLI-03',
    module: 'clients',
    title: 'Criar cliente offline (Mobile)',
    steps: [
      '1. Ative o modo avião no dispositivo',
      '2. Crie um novo cliente no Mobile',
      '3. Verifique que o cliente aparece localmente',
      '4. Desative o modo avião',
      '5. Aguarde o sync automático',
      '6. Verifique no Web se o cliente aparece',
    ],
    expectedResult: 'Cliente sincroniza quando volta online',
    priority: 'high',
    automated: false,
  },
  {
    id: 'CLI-07',
    module: 'clients',
    title: 'Edição simultânea - campos diferentes',
    steps: [
      '1. Crie um cliente de teste',
      '2. Abra o mesmo cliente no Web e Mobile',
      '3. No Web, edite o NOME do cliente',
      '4. No Mobile, edite o TELEFONE ao mesmo tempo',
      '5. Salve ambos',
      '6. Verifique o resultado final em ambas as plataformas',
    ],
    expectedResult: 'Ambas alterações são mantidas (nome E telefone atualizados)',
    priority: 'medium',
    automated: false,
  },
  {
    id: 'CLI-08',
    module: 'clients',
    title: 'Edição simultânea - mesmo campo (Last-Write-Wins)',
    steps: [
      '1. Crie um cliente de teste',
      '2. Abra o mesmo cliente no Web e Mobile',
      '3. No Web, edite o NOME para "Nome Web"',
      '4. No Mobile, edite o NOME para "Nome Mobile"',
      '5. Salve o Mobile DEPOIS do Web (aguarde 2-3 segundos)',
      '6. Verifique o resultado final',
    ],
    expectedResult: 'Última edição (Mobile) prevalece - nome = "Nome Mobile"',
    priority: 'high',
    automated: false,
  },
  {
    id: 'CLI-10',
    module: 'clients',
    title: 'Deletar cliente no Web, verificar no Mobile',
    steps: [
      '1. Crie um cliente de teste',
      '2. Aguarde sync no Mobile',
      '3. Delete o cliente no Web',
      '4. Force sync no Mobile (pull-to-refresh)',
      '5. Procure o cliente deletado',
    ],
    expectedResult: 'Cliente não aparece mais no Mobile',
    priority: 'high',
    automated: false,
  },

  // WORK ORDERS
  {
    id: 'WO-01',
    module: 'work-orders',
    title: 'Criar OS no Web, verificar no Mobile',
    steps: [
      '1. Crie uma OS no Web com cliente e data agendada',
      '2. Force sync no Mobile',
      '3. Verifique se a OS aparece na agenda/lista',
    ],
    expectedResult: 'OS aparece no Mobile com todos os detalhes',
    priority: 'high',
    automated: false,
  },
  {
    id: 'WO-05',
    module: 'work-orders',
    title: 'Status SCHEDULED -> IN_PROGRESS (Mobile)',
    steps: [
      '1. Crie uma OS agendada',
      '2. No Mobile, abra a OS e inicie a execução',
      '3. Verifique o status no Web',
    ],
    expectedResult: 'Status atualiza para IN_PROGRESS no Web',
    priority: 'high',
    automated: false,
  },
  {
    id: 'WO-06',
    module: 'work-orders',
    title: 'Status IN_PROGRESS -> DONE (Mobile)',
    steps: [
      '1. Com uma OS em execução no Mobile',
      '2. Finalize a OS (colete assinatura se necessário)',
      '3. Verifique o status no Web',
    ],
    expectedResult: 'Status DONE, tempo de execução registrado no Web',
    priority: 'high',
    automated: false,
  },
  {
    id: 'WO-09',
    module: 'work-orders',
    title: 'Fluxo completo offline',
    steps: [
      '1. Crie uma OS e sincronize no Mobile',
      '2. Ative modo avião',
      '3. Inicie -> Execute -> Finalize a OS',
      '4. Desative modo avião',
      '5. Verifique o histórico completo no Web',
    ],
    expectedResult: 'Todo o histórico de execução sincroniza corretamente',
    priority: 'high',
    automated: false,
  },

  // QUOTES
  {
    id: 'QT-01',
    module: 'quotes',
    title: 'Criar orçamento no Web, verificar no Mobile',
    steps: [
      '1. Crie um orçamento completo no Web com itens',
      '2. Force sync no Mobile',
      '3. Verifique se o orçamento aparece com todos os itens',
    ],
    expectedResult: 'Orçamento visível no Mobile com itens e valores corretos',
    priority: 'high',
    automated: false,
  },
  {
    id: 'QT-09',
    module: 'quotes',
    title: 'Converter orçamento para OS (Mobile)',
    steps: [
      '1. Aprove um orçamento existente',
      '2. No Mobile, converta o orçamento para OS',
      '3. Verifique a nova OS no Web',
      '4. Verifique que o orçamento está vinculado à OS',
    ],
    expectedResult: 'Nova OS criada e vinculada ao orçamento',
    priority: 'high',
    automated: false,
  },
  {
    id: 'QT-11',
    module: 'quotes',
    title: 'Conversão simultânea (idempotência)',
    steps: [
      '1. Aprove um orçamento',
      '2. Tente converter simultaneamente no Web e Mobile',
      '3. Verifique quantas OS foram criadas',
    ],
    expectedResult: 'Apenas UMA OS criada (idempotência)',
    priority: 'high',
    automated: false,
  },

  // CHECKLISTS
  {
    id: 'CK-09',
    module: 'checklists',
    title: 'Checklist completo offline',
    steps: [
      '1. Crie uma OS com checklist',
      '2. Sincronize no Mobile',
      '3. Ative modo avião',
      '4. Execute todo o checklist (respostas, fotos, assinatura)',
      '5. Desative modo avião',
      '6. Verifique todas as respostas no Web',
    ],
    expectedResult: 'Todas respostas, fotos e assinaturas sincronizam',
    priority: 'high',
    automated: false,
  },
  {
    id: 'CK-10',
    module: 'checklists',
    title: 'Fotos offline',
    steps: [
      '1. Inicie um checklist offline',
      '2. Tire 5 fotos obrigatórias',
      '3. Reconecte à internet',
      '4. Verifique se todas as fotos aparecem no Web',
    ],
    expectedResult: 'Todas as 5 fotos fazem upload e aparecem no Web',
    priority: 'high',
    automated: false,
  },

  // EXPENSES
  {
    id: 'EX-01',
    module: 'expenses',
    title: 'Criar despesa no Web, verificar no Mobile',
    steps: [
      '1. Crie uma despesa no Web',
      '2. Abra o Mobile e vá para despesas',
      '3. Verifique se a despesa aparece',
    ],
    expectedResult: 'Despesa visível no Mobile com valores corretos',
    priority: 'medium',
    automated: false,
  },
  {
    id: 'EX-04',
    module: 'expenses',
    title: 'Marcar despesa como paga',
    steps: [
      '1. Crie uma despesa pendente',
      '2. No Mobile, marque como paga',
      '3. Verifique o status no Web',
    ],
    expectedResult: 'Status PAID sincronizado no Web',
    priority: 'medium',
    automated: false,
  },

  // INVENTORY
  {
    id: 'IN-04',
    module: 'inventory',
    title: 'Baixa automática ao concluir OS',
    steps: [
      '1. Crie um produto com estoque = 10',
      '2. Crie uma OS com 2 unidades deste produto',
      '3. Finalize a OS no Mobile',
      '4. Verifique o estoque no Web',
    ],
    expectedResult: 'Estoque reduzido para 8 unidades',
    priority: 'high',
    automated: false,
  },
  {
    id: 'IN-05',
    module: 'inventory',
    title: 'Proteção contra baixa duplicada',
    steps: [
      '1. Com uma OS já finalizada',
      '2. Tente finalizar novamente (se possível)',
      '3. Verifique se o estoque foi deduzido apenas uma vez',
    ],
    expectedResult: 'Estoque não é deduzido novamente (idempotência)',
    priority: 'high',
    automated: false,
  },

  // SIGNATURES
  {
    id: 'SG-01',
    module: 'signatures',
    title: 'Assinatura em orçamento',
    steps: [
      '1. Crie um orçamento e envie para o cliente',
      '2. No Mobile, colete a assinatura do cliente',
      '3. Verifique a assinatura no Web (PDF/detalhes)',
    ],
    expectedResult: 'Assinatura visível no Web',
    priority: 'high',
    automated: false,
  },
  {
    id: 'SG-03',
    module: 'signatures',
    title: 'Assinatura offline',
    steps: [
      '1. Inicie a coleta de assinatura',
      '2. Ative modo avião antes de salvar',
      '3. Colete a assinatura e salve',
      '4. Desative modo avião',
      '5. Verifique se a assinatura aparece no Web',
    ],
    expectedResult: 'Assinatura sincroniza ao reconectar',
    priority: 'high',
    automated: false,
  },

  // EDGE CASES
  {
    id: 'EC-01',
    module: 'edge-cases',
    title: 'Conexão instável',
    steps: [
      '1. Conecte em uma rede 2G/lenta',
      '2. Execute operações CRUD no Mobile',
      '3. Verifique consistência dos dados',
    ],
    expectedResult: 'Dados consistentes após sync',
    priority: 'low',
    automated: false,
  },
  {
    id: 'EC-02',
    module: 'edge-cases',
    title: 'Offline prolongado (24h)',
    steps: [
      '1. Ative modo avião',
      '2. Use o app normalmente por várias horas',
      '3. Faça muitas operações (criar, editar, deletar)',
      '4. Reconecte após 24h',
      '5. Verifique se tudo sincroniza',
    ],
    expectedResult: 'Todos os dados sincronizam corretamente',
    priority: 'low',
    automated: false,
  },
  {
    id: 'EC-10',
    module: 'edge-cases',
    title: 'Volume grande (1000 clientes)',
    steps: [
      '1. Importe 1000 clientes via Web',
      '2. Force sync no Mobile',
      '3. Meça o tempo de sync',
      '4. Verifique se todos os clientes aparecem',
    ],
    expectedResult: 'Sync completa em tempo razoável (<30s)',
    priority: 'low',
    automated: false,
  },
];

// ============================================================================
// CLI HELPERS
// ============================================================================
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function clearScreen() {
  console.clear();
}

function printHeader(text: string) {
  console.log('\n' + '='.repeat(60));
  console.log(text);
  console.log('='.repeat(60) + '\n');
}

function printScenario(scenario: TestScenario) {
  console.log(`\n[${'ID: ' + scenario.id}] ${scenario.title}`);
  console.log(`Módulo: ${scenario.module} | Prioridade: ${scenario.priority.toUpperCase()}`);
  console.log('-'.repeat(50));
  console.log('\nPassos:');
  scenario.steps.forEach((step) => console.log(`  ${step}`));
  console.log(`\nResultado esperado: ${scenario.expectedResult}`);
  console.log('-'.repeat(50));
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    passed: '\x1b[32m', // Green
    failed: '\x1b[31m', // Red
    skipped: '\x1b[33m', // Yellow
    pending: '\x1b[90m', // Gray
  };
  return colors[status] || '\x1b[0m';
}

function resetColor(): string {
  return '\x1b[0m';
}

// ============================================================================
// REPORT FUNCTIONS
// ============================================================================
function saveReport(report: TestReport) {
  const reportsDir = path.join(__dirname, '..', 'test-reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const filename = `sync-qa-report-${report.runId}.json`;
  const filepath = path.join(reportsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(report, null, 2));

  // Also save markdown report
  const mdFilename = `sync-qa-report-${report.runId}.md`;
  const mdFilepath = path.join(reportsDir, mdFilename);
  fs.writeFileSync(mdFilepath, generateMarkdownReport(report));

  console.log(`\nRelatório salvo em: ${filepath}`);
  console.log(`Relatório MD salvo em: ${mdFilepath}`);
}

function generateMarkdownReport(report: TestReport): string {
  const { summary } = report;
  const passRate = ((summary.passed / summary.total) * 100).toFixed(1);

  let md = `# Relatório de Testes de Sincronização\n\n`;
  md += `**Run ID:** ${report.runId}\n`;
  md += `**Testador:** ${report.tester}\n`;
  md += `**Início:** ${report.startTime}\n`;
  md += `**Fim:** ${report.endTime || 'Em andamento'}\n\n`;

  md += `## Resumo\n\n`;
  md += `| Métrica | Valor |\n`;
  md += `|---------|-------|\n`;
  md += `| Total | ${summary.total} |\n`;
  md += `| Passou | ${summary.passed} |\n`;
  md += `| Falhou | ${summary.failed} |\n`;
  md += `| Pulado | ${summary.skipped} |\n`;
  md += `| Pendente | ${summary.pending} |\n`;
  md += `| Taxa de Sucesso | ${passRate}% |\n\n`;

  md += `## Resultados Detalhados\n\n`;

  const modules = [...new Set(report.results.map((r) => {
    const scenario = TEST_SCENARIOS.find((s) => s.id === r.scenarioId);
    return scenario?.module || 'unknown';
  }))];

  for (const module of modules) {
    md += `### ${module.toUpperCase()}\n\n`;
    md += `| ID | Status | Notas |\n`;
    md += `|----|--------|-------|\n`;

    const moduleResults = report.results.filter((r) => {
      const scenario = TEST_SCENARIOS.find((s) => s.id === r.scenarioId);
      return scenario?.module === module;
    });

    for (const result of moduleResults) {
      const scenario = TEST_SCENARIOS.find((s) => s.id === result.scenarioId);
      const statusEmoji = {
        passed: '✅',
        failed: '❌',
        skipped: '⏭️',
        pending: '⏳',
      }[result.status];

      md += `| ${result.scenarioId} - ${scenario?.title || ''} | ${statusEmoji} ${result.status} | ${result.notes || '-'} |\n`;
    }
    md += '\n';
  }

  if (summary.failed > 0) {
    md += `## Falhas Detalhadas\n\n`;
    const failures = report.results.filter((r) => r.status === 'failed');
    for (const failure of failures) {
      const scenario = TEST_SCENARIOS.find((s) => s.id === failure.scenarioId);
      md += `### ${failure.scenarioId}: ${scenario?.title}\n`;
      md += `**Notas:** ${failure.notes}\n`;
      md += `**Passos:**\n`;
      scenario?.steps.forEach((step) => md += `- ${step}\n`);
      md += `**Esperado:** ${scenario?.expectedResult}\n\n`;
    }
  }

  return md;
}

function printSummary(report: TestReport) {
  const { summary } = report;

  printHeader('RESUMO DOS TESTES');

  console.log(`Total de cenários: ${summary.total}`);
  console.log(`${getStatusColor('passed')}Passou: ${summary.passed}${resetColor()}`);
  console.log(`${getStatusColor('failed')}Falhou: ${summary.failed}${resetColor()}`);
  console.log(`${getStatusColor('skipped')}Pulado: ${summary.skipped}${resetColor()}`);
  console.log(`${getStatusColor('pending')}Pendente: ${summary.pending}${resetColor()}`);

  const passRate = ((summary.passed / summary.total) * 100).toFixed(1);
  console.log(`\nTaxa de sucesso: ${passRate}%`);

  if (summary.failed > 0) {
    console.log('\n⚠️ ATENÇÃO: Existem cenários que falharam!');
    const failures = report.results.filter((r) => r.status === 'failed');
    console.log('Cenários com falha:');
    failures.forEach((f) => {
      const scenario = TEST_SCENARIOS.find((s) => s.id === f.scenarioId);
      console.log(`  - ${f.scenarioId}: ${scenario?.title}`);
      if (f.notes) console.log(`    Notas: ${f.notes}`);
    });
  }
}

// ============================================================================
// MAIN FLOW
// ============================================================================
async function runQASession() {
  clearScreen();
  printHeader('SYNC QA VALIDATOR');

  console.log('Este script irá guiar você pelos cenários de teste de sincronização.');
  console.log('Para cada cenário, você poderá marcar como: PASSOU, FALHOU, ou PULAR.\n');

  const testerName = await question('Nome do testador: ');

  const report: TestReport = {
    runId: new Date().toISOString().replace(/[:.]/g, '-'),
    startTime: new Date().toISOString(),
    tester: testerName,
    results: [],
    summary: {
      total: TEST_SCENARIOS.length,
      passed: 0,
      failed: 0,
      skipped: 0,
      pending: TEST_SCENARIOS.length,
    },
  };

  // Filter by module if specified
  const args = process.argv.slice(2);
  const moduleArg = args.find((a) => a.startsWith('--module='));
  const module = moduleArg?.split('=')[1];

  const scenarios = module
    ? TEST_SCENARIOS.filter((s) => s.module === module)
    : TEST_SCENARIOS;

  if (module) {
    console.log(`\nFiltrando por módulo: ${module}`);
    report.summary.total = scenarios.length;
    report.summary.pending = scenarios.length;
  }

  // Check for report-only mode
  if (args.includes('--report-only')) {
    // Load existing report and show summary
    const reportsDir = path.join(__dirname, '..', 'test-reports');
    const files = fs.readdirSync(reportsDir).filter((f) => f.endsWith('.json'));
    if (files.length === 0) {
      console.log('Nenhum relatório encontrado.');
      rl.close();
      return;
    }

    console.log('\nRelatórios disponíveis:');
    files.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));

    const choice = await question('\nEscolha um relatório (número): ');
    const chosenFile = files[parseInt(choice) - 1];
    if (!chosenFile) {
      console.log('Escolha inválida.');
      rl.close();
      return;
    }

    const existingReport = JSON.parse(
      fs.readFileSync(path.join(reportsDir, chosenFile), 'utf-8'),
    ) as TestReport;
    printSummary(existingReport);
    rl.close();
    return;
  }

  console.log(`\nTotal de cenários a testar: ${scenarios.length}`);
  await question('\nPressione ENTER para começar...');

  // Run through each scenario
  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];

    clearScreen();
    console.log(`Progresso: ${i + 1}/${scenarios.length}`);
    printScenario(scenario);

    console.log('\nOpções:');
    console.log('  [P] Passou');
    console.log('  [F] Falhou');
    console.log('  [S] Pular');
    console.log('  [Q] Sair e salvar relatório parcial');

    const answer = await question('\nResultado (P/F/S/Q): ');

    let status: TestResult['status'] = 'pending';
    let notes = '';

    switch (answer.toUpperCase()) {
      case 'P':
        status = 'passed';
        report.summary.passed++;
        report.summary.pending--;
        break;
      case 'F':
        status = 'failed';
        notes = await question('Descreva o problema: ');
        report.summary.failed++;
        report.summary.pending--;
        break;
      case 'S':
        status = 'skipped';
        report.summary.skipped++;
        report.summary.pending--;
        break;
      case 'Q':
        report.endTime = new Date().toISOString();
        saveReport(report);
        printSummary(report);
        rl.close();
        return;
      default:
        // Treat as pending, ask again
        i--;
        continue;
    }

    report.results.push({
      scenarioId: scenario.id,
      status,
      notes,
      timestamp: new Date().toISOString(),
      tester: testerName,
    });
  }

  report.endTime = new Date().toISOString();
  saveReport(report);
  printSummary(report);

  rl.close();
}

// ============================================================================
// AUTOMATED CHECKS (for CI/CD)
// ============================================================================
async function runAutomatedChecks() {
  console.log('Executando verificações automatizadas...\n');

  const results: Array<{ name: string; passed: boolean; error?: string }> = [];

  // Check 1: Verify backend is running
  try {
    const response = await fetch('http://localhost:3001/health');
    results.push({
      name: 'Backend health check',
      passed: response.ok,
    });
  } catch (error) {
    results.push({
      name: 'Backend health check',
      passed: false,
      error: 'Backend não está rodando',
    });
  }

  // Check 2: Verify database connectivity
  // (would need prisma client, simplified here)

  // Print results
  console.log('Resultados das verificações automatizadas:\n');
  results.forEach((r) => {
    const status = r.passed ? '✅' : '❌';
    console.log(`${status} ${r.name}${r.error ? `: ${r.error}` : ''}`);
  });

  return results.every((r) => r.passed);
}

// ============================================================================
// ENTRY POINT
// ============================================================================
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    console.log(`
Sync QA Validator - Script de validação de sincronização

Uso:
  npx ts-node scripts/sync-qa-validator.ts [opções]

Opções:
  --help          Mostra esta ajuda
  --module=X      Filtra por módulo (clients, work-orders, quotes, etc.)
  --report-only   Mostra relatórios anteriores
  --automated     Executa apenas verificações automatizadas

Exemplos:
  npx ts-node scripts/sync-qa-validator.ts
  npx ts-node scripts/sync-qa-validator.ts --module=clients
  npx ts-node scripts/sync-qa-validator.ts --report-only
    `);
    process.exit(0);
  }

  if (args.includes('--automated')) {
    const passed = await runAutomatedChecks();
    process.exit(passed ? 0 : 1);
  }

  await runQASession();
}

main().catch(console.error);
