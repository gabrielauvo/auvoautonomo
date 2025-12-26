# Cenários de Teste de Sincronização - App Mobile x Web

Este documento descreve todos os cenários que devem ser testados para garantir a integridade da sincronização entre o aplicativo mobile e a aplicação web.

## Arquitetura de Sincronização

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web (Next.js) │     │ Backend (NestJS)│     │ Mobile (Expo)   │
│   REST API      │────▶│   PostgreSQL    │◀────│   PowerSync     │
│   Real-time     │     │   + Prisma      │     │   SQLite local  │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │ PowerSync Cloud │
                        │ (Real-time sync)│
                        └─────────────────┘
```

**Tipos de Sincronização:**
- **PowerSync (Bidirecional)**: Clients, Work Orders, Quotes, Checklists, Signatures
- **API Only**: Expenses, Payments, Inventory, Suppliers, Analytics

---

## 1. CLIENTES (Clients)

### 1.1 Criação de Cliente
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| CLI-01 | Criar cliente no Web | 1. Criar cliente no Web 2. Aguardar sync 3. Verificar no Mobile | Cliente aparece no Mobile com todos os dados |
| CLI-02 | Criar cliente no Mobile | 1. Criar cliente no Mobile 2. Aguardar sync 3. Verificar no Web | Cliente aparece no Web com todos os dados |
| CLI-03 | Criar cliente offline (Mobile) | 1. Desativar internet 2. Criar cliente no Mobile 3. Ativar internet 4. Verificar no Web | Cliente sincroniza quando online |
| CLI-04 | Criar cliente simultâneo | 1. Criar cliente no Web 2. Criar cliente diferente no Mobile ao mesmo tempo | Ambos clientes existem sem conflito |

### 1.2 Edição de Cliente
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| CLI-05 | Editar no Web, verificar Mobile | 1. Editar nome do cliente no Web 2. Verificar no Mobile | Alteração reflete no Mobile |
| CLI-06 | Editar no Mobile, verificar Web | 1. Editar telefone do cliente no Mobile 2. Verificar no Web | Alteração reflete no Web |
| CLI-07 | Edição simultânea - campos diferentes | 1. Web edita nome 2. Mobile edita telefone simultaneamente | Ambas alterações são mantidas |
| CLI-08 | Edição simultânea - mesmo campo | 1. Web edita nome para "A" 2. Mobile edita nome para "B" simultaneamente | Última edição prevalece (last-write-wins) |
| CLI-09 | Editar cliente offline | 1. Mobile offline 2. Editar cliente 3. Web edita mesmo cliente 4. Mobile online | Verificar qual edição prevalece |

### 1.3 Exclusão de Cliente
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| CLI-10 | Deletar no Web | 1. Deletar cliente no Web 2. Verificar no Mobile | Cliente removido do Mobile |
| CLI-11 | Deletar no Mobile | 1. Deletar cliente no Mobile 2. Verificar no Web | Cliente removido do Web |
| CLI-12 | Deletar cliente com OS vinculada | 1. Tentar deletar cliente com OS | Operação bloqueada ou soft delete |
| CLI-13 | Deletar simultaneamente | 1. Web e Mobile deletam mesmo cliente | Sem erros, cliente removido |

### 1.4 Status de Inadimplência
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| CLI-14 | Marcar inadimplente | 1. Backend marca cliente como inadimplente 2. Verificar no Mobile | Flag isDelinquent = true no Mobile |
| CLI-15 | Remover inadimplência | 1. Cliente paga dívida (webhook) 2. Verificar no Mobile | Flag atualizada no Mobile |

---

## 2. ORDENS DE SERVIÇO (Work Orders)

### 2.1 Criação de OS
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| WO-01 | Criar OS no Web | 1. Criar OS completa no Web 2. Verificar no Mobile | OS aparece na agenda do Mobile |
| WO-02 | Criar OS no Mobile | 1. Criar OS no Mobile 2. Verificar no Web | OS aparece na lista do Web |
| WO-03 | Criar OS offline | 1. Mobile offline 2. Criar OS 3. Online | OS sincroniza corretamente |
| WO-04 | Criar OS com itens | 1. Criar OS com 5 itens no Web 2. Verificar itens no Mobile | Todos os itens aparecem |

### 2.2 Fluxo de Status da OS
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| WO-05 | SCHEDULED → IN_PROGRESS (Mobile) | 1. Técnico inicia OS no Mobile 2. Verificar status no Web | Status atualiza para IN_PROGRESS |
| WO-06 | IN_PROGRESS → DONE (Mobile) | 1. Técnico finaliza OS no Mobile 2. Verificar no Web | Status DONE, tempo de execução registrado |
| WO-07 | Mudança de status simultânea | 1. Mobile muda para IN_PROGRESS 2. Web tenta cancelar ao mesmo tempo | Conflito tratado, última ação prevalece |
| WO-08 | Cancelar OS no Web enquanto Mobile executa | 1. Mobile em IN_PROGRESS 2. Web cancela | Notificar Mobile, impedir continuação |
| WO-09 | Fluxo completo offline | 1. Mobile offline 2. Iniciar → Executar → Finalizar 3. Online | Todo o histórico sincroniza |

### 2.3 Edição de OS
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| WO-10 | Editar OS agendada no Web | 1. Mudar data/hora no Web 2. Verificar no Mobile | Nova data aparece no Mobile |
| WO-11 | Adicionar item via Web | 1. OS existente 2. Web adiciona item 3. Mobile visualiza | Novo item aparece na OS |
| WO-12 | Editar OS em execução | 1. Mobile executando OS 2. Web tenta editar descrição | Verificar se permite ou bloqueia |
| WO-13 | Remover item via Web durante execução | 1. Mobile executando 2. Web remove item | Verificar comportamento |

### 2.4 Timer de Execução
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| WO-14 | Registrar tempo de execução | 1. Mobile inicia timer 2. Pausar 3. Retomar 4. Finalizar | Tempo total correto no Web |
| WO-15 | Timer com perda de conexão | 1. Iniciar timer 2. Perder conexão 3. Reconectar | Tempo registrado corretamente |
| WO-16 | Múltiplas sessões de execução | 1. Iniciar/pausar várias vezes 2. Verificar histórico | Todas as sessões registradas |

### 2.5 Equipamentos na OS
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| WO-17 | Vincular equipamento | 1. Web vincula equipamento à OS 2. Mobile visualiza | Equipamento aparece na OS |
| WO-18 | Adicionar equipamento via Mobile | 1. Mobile adiciona equipamento 2. Verificar no Web | Equipamento sincronizado |

---

## 3. ORÇAMENTOS (Quotes)

### 3.1 Criação e Edição
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| QT-01 | Criar orçamento no Web | 1. Criar orçamento completo 2. Verificar no Mobile | Orçamento visível no Mobile |
| QT-02 | Adicionar itens ao orçamento | 1. Web adiciona 10 itens 2. Mobile visualiza | Todos os itens com preços corretos |
| QT-03 | Editar preço de item | 1. Web altera preço unitário 2. Verificar total no Mobile | Total recalculado corretamente |
| QT-04 | Aplicar desconto | 1. Web aplica desconto % 2. Mobile visualiza | Desconto refletido |

### 3.2 Fluxo de Aprovação
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| QT-05 | Enviar orçamento | 1. Web envia orçamento (DRAFT → SENT) 2. Mobile visualiza | Status SENT no Mobile |
| QT-06 | Aprovar orçamento | 1. Cliente aprova (link) 2. Verificar status | Status APPROVED em ambos |
| QT-07 | Rejeitar orçamento | 1. Cliente rejeita 2. Verificar | Status REJECTED sincronizado |
| QT-08 | Orçamento expirado | 1. Data de validade passa 2. Sistema atualiza | Status EXPIRED em ambos |

### 3.3 Conversão para OS
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| QT-09 | Converter orçamento (Mobile) | 1. Orçamento aprovado 2. Mobile converte para OS | Nova OS criada, orçamento vinculado |
| QT-10 | Converter orçamento (Web) | 1. Web converte orçamento | OS aparece no Mobile |
| QT-11 | Conversão simultânea | 1. Mobile e Web tentam converter ao mesmo tempo | Apenas uma OS criada (idempotência) |
| QT-12 | Editar orçamento durante conversão | 1. Web edita 2. Mobile converte simultaneamente | Verificar integridade dos dados |

### 3.4 Assinatura de Orçamento
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| QT-13 | Coletar assinatura (Mobile) | 1. Cliente assina no Mobile 2. Verificar no Web | Assinatura visível no Web |
| QT-14 | Assinatura offline | 1. Mobile offline 2. Coletar assinatura 3. Online | Assinatura sincroniza |

---

## 4. CHECKLISTS

### 4.1 Templates
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| CK-01 | Criar template no Web | 1. Criar checklist com 10 perguntas 2. Verificar no Mobile | Template disponível para uso |
| CK-02 | Editar template | 1. Web adiciona pergunta 2. Mobile vê nova versão | Pergunta aparece no Mobile |
| CK-03 | Deletar template em uso | 1. Template vinculado a OS 2. Web deleta template | Verificar comportamento |

### 4.2 Execução de Checklist
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| CK-04 | Iniciar checklist | 1. Mobile inicia checklist 2. Web monitora | Status IN_PROGRESS no Web |
| CK-05 | Responder perguntas texto | 1. Mobile responde 5 perguntas 2. Verificar respostas no Web | Respostas sincronizadas |
| CK-06 | Responder com foto | 1. Mobile tira foto obrigatória 2. Verificar no Web | Foto visível no Web |
| CK-07 | Responder com assinatura | 1. Mobile coleta assinatura técnico 2. Verificar | Assinatura no Web |
| CK-08 | Completar checklist | 1. Mobile finaliza todas as perguntas 2. Web visualiza | Status COMPLETED, progresso 100% |

### 4.3 Execução Offline
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| CK-09 | Checklist completo offline | 1. Mobile offline 2. Executar todo checklist 3. Online | Todas respostas sincronizam |
| CK-10 | Fotos offline | 1. Tirar 5 fotos offline 2. Reconectar | Todas as fotos fazem upload |
| CK-11 | Assinatura offline | 1. Coletar assinatura offline 2. Reconectar | Assinatura sincroniza |
| CK-12 | Checklist parcial offline | 1. Responder metade 2. Perder conexão 3. Continuar offline 4. Online | Todo progresso mantido |

### 4.4 Lógica Condicional
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| CK-13 | Pergunta condicional | 1. Template com condição "Se X, mostrar Y" 2. Mobile responde | Lógica funciona corretamente |
| CK-14 | Editar resposta que afeta condição | 1. Responder X = Sim 2. Responder Y 3. Mudar X = Não | Pergunta Y some/fica oculta |

---

## 5. DESPESAS (Expenses)

### 5.1 CRUD de Despesas
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| EX-01 | Criar despesa no Web | 1. Criar despesa 2. Verificar no Mobile | Despesa visível no Mobile |
| EX-02 | Criar despesa no Mobile | 1. Criar despesa no Mobile 2. Verificar no Web | Despesa no Web |
| EX-03 | Editar despesa | 1. Mobile edita valor 2. Web visualiza | Valor atualizado |
| EX-04 | Marcar como paga | 1. Mobile marca paga 2. Web verifica | Status PAID sincronizado |
| EX-05 | Deletar despesa | 1. Web deleta 2. Mobile verifica | Despesa removida |

### 5.2 Vinculação com OS
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| EX-06 | Despesa vinculada a OS | 1. Criar despesa de material para OS 2. Verificar vínculo | Despesa aparece na OS |
| EX-07 | Desvincular despesa | 1. Web desvincula despesa da OS 2. Mobile verifica | Despesa sem vínculo |

### 5.3 Categorias
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| EX-08 | Nova categoria no Web | 1. Criar categoria 2. Mobile usa | Categoria disponível |
| EX-09 | Editar categoria | 1. Web renomeia categoria 2. Mobile vê novo nome | Nome atualizado |

---

## 6. COBRANÇAS E PAGAMENTOS (Client Payments)

### 6.1 Criação de Cobranças
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| PY-01 | Criar cobrança (Web) | 1. Criar boleto/pix no Web 2. Mobile visualiza | Cobrança visível no Mobile |
| PY-02 | Criar cobrança via Asaas | 1. Web gera boleto Asaas 2. Link disponível | QR Code/Link no Mobile |

### 6.2 Status de Pagamento
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| PY-03 | Pagamento confirmado | 1. Webhook Asaas confirma 2. Ambos verificam | Status RECEIVED em ambos |
| PY-04 | Pagamento vencido | 1. Data passa 2. Status atualiza | Status OVERDUE sincronizado |
| PY-05 | Estorno de pagamento | 1. Admin estorna 2. Verificar status | Status REFUNDED em ambos |

---

## 7. CATÁLOGO DE PRODUTOS/SERVIÇOS

### 7.1 Produtos
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| CT-01 | Criar produto (Web) | 1. Criar produto com preço 2. Mobile visualiza | Produto no catálogo Mobile |
| CT-02 | Editar preço | 1. Web altera preço base 2. Mobile vê | Novo preço refletido |
| CT-03 | Desativar produto | 1. Web desativa produto 2. Mobile | Produto não aparece para uso |
| CT-04 | Produto com estoque | 1. Produto com quantidade 2. Mobile visualiza | Quantidade visível |

### 7.2 Categorias
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| CT-05 | Nova categoria | 1. Web cria categoria 2. Mobile usa | Categoria disponível |
| CT-06 | Mover produto de categoria | 1. Web muda categoria 2. Mobile | Produto na nova categoria |

### 7.3 Bundles (Kits)
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| CT-07 | Criar bundle | 1. Web cria kit com 3 produtos 2. Mobile | Bundle disponível |
| CT-08 | Editar itens do bundle | 1. Web adiciona item 2. Mobile | Novo item no bundle |

---

## 8. INVENTÁRIO

### 8.1 Estoque
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| IN-01 | Visualizar estoque | 1. Web mostra quantidade 2. Mobile visualiza | Quantidade igual |
| IN-02 | Entrada de estoque | 1. Web registra entrada +10 2. Mobile | Quantidade atualizada |
| IN-03 | Baixa manual | 1. Web faz baixa -5 2. Mobile | Quantidade reduzida |

### 8.2 Baixa Automática (OS)
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| IN-04 | Baixa ao concluir OS | 1. OS com 2 produtos 2. Mobile finaliza OS 3. Verificar estoque | Estoque reduzido automaticamente |
| IN-05 | Baixa duplicada (proteção) | 1. Finalizar OS 2. Tentar finalizar novamente | Não deduz novamente (idempotência) |
| IN-06 | Baixa simultânea | 1. Duas OS com mesmo produto 2. Ambas finalizam | Estoque correto |
| IN-07 | Estoque insuficiente | 1. Estoque = 1 2. OS precisa de 2 | Alertar ou bloquear |

---

## 9. ASSINATURAS DIGITAIS

### 9.1 Coleta de Assinatura
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| SG-01 | Assinatura em orçamento | 1. Mobile coleta assinatura cliente 2. Web visualiza | Assinatura no PDF |
| SG-02 | Assinatura em OS | 1. Mobile coleta ao finalizar 2. Web | Assinatura registrada |
| SG-03 | Assinatura offline | 1. Offline 2. Coletar assinatura 3. Online | Arquivo sincroniza |
| SG-04 | Múltiplas assinaturas | 1. Técnico + Cliente assinam 2. Web | Ambas visíveis |

### 9.2 Termos de Aceite
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| SG-05 | Aceitar termos | 1. Cliente aceita termos 2. Verificar hash | Hash e versão registrados |

---

## 10. EQUIPAMENTOS

### 10.1 CRUD
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| EQ-01 | Cadastrar equipamento (Web) | 1. Web cadastra equipamento 2. Mobile visualiza | Equipamento no cliente |
| EQ-02 | Vincular a cliente | 1. Equipamento vinculado a cliente 2. Mobile vê | Aparece no perfil do cliente |
| EQ-03 | Editar garantia | 1. Web atualiza data garantia 2. Mobile | Nova data visível |

### 10.2 Vinculação com OS
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| EQ-04 | Equipamento em OS | 1. OS com equipamento 2. Mobile executa | Equipamento visível na OS |

---

## 11. PERFIL E CONFIGURAÇÕES

### 11.1 Dados Pessoais
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| PF-01 | Alterar nome (Mobile) | 1. Mobile altera nome 2. Web | Nome atualizado |
| PF-02 | Alterar foto (Mobile) | 1. Mobile troca avatar 2. Web | Foto sincronizada |
| PF-03 | Alterar senha | 1. Mobile altera senha 2. Login no Web | Nova senha funciona |

### 11.2 Configurações da Empresa
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| PF-04 | Alterar dados empresa (Web) | 1. Web altera razão social 2. Mobile | Dados atualizados |
| PF-05 | Alterar logo | 1. Web troca logo 2. Mobile | Novo logo aparece |

### 11.3 Idioma
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| PF-06 | Trocar idioma | 1. Mobile muda para EN 2. Verificar API | Idioma salvo no perfil |

---

## 12. INDICAÇÕES (Referral)

### 12.1 Código de Indicação
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| RF-01 | Visualizar código | 1. Web mostra código 2. Mobile mostra código | Mesmo código em ambos |
| RF-02 | Criar código personalizado | 1. Web cria código custom 2. Mobile | Código disponível |

### 12.2 Créditos
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| RF-03 | Indicação converte | 1. Indicado assina plano 2. Verificar créditos | Crédito adicionado em ambos |
| RF-04 | Milestone de indicações | 1. 10 indicações 2. Verificar bônus | 12 meses de crédito |

---

## 13. CENÁRIOS DE ESTRESSE E EDGE CASES

### 13.1 Conectividade
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| EC-01 | Conexão instável | 1. Rede 2G intermitente 2. Operações CRUD | Dados consistentes |
| EC-02 | Offline prolongado (24h) | 1. Mobile offline 24h 2. Muitas operações 3. Online | Tudo sincroniza |
| EC-03 | Sync timeout | 1. Servidor lento 2. Mobile tenta sync | Retry automático |
| EC-04 | Sync interrompido | 1. Sync iniciado 2. App fechado 3. Reabrir | Continua de onde parou |

### 13.2 Concorrência
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| EC-05 | Múltiplos dispositivos | 1. Usuário em 2 celulares 2. Editar no mesmo momento | Última edição prevalece |
| EC-06 | Múltiplos usuários (equipe) | 1. 2 técnicos veem mesma OS 2. Ambos editam | Conflito tratado |
| EC-07 | Import em massa | 1. Web importa 500 clientes 2. Mobile sincroniza | Todos importados |

### 13.3 Dados Corrompidos
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| EC-08 | Dados inválidos Mobile | 1. Tentar enviar dados mal formados | Validação no backend |
| EC-09 | Referência órfã | 1. Deletar cliente 2. OS referencia cliente | Integridade mantida |

### 13.4 Volumes
| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|-------------------|
| EC-10 | 1000 clientes | 1. Empresa com 1000 clientes 2. Mobile carrega | Performance aceitável |
| EC-11 | OS com 50 itens | 1. Criar OS grande 2. Mobile visualiza | Todos os itens carregam |
| EC-12 | Checklist com 50 fotos | 1. Tirar 50 fotos 2. Sincronizar | Todas as fotos upload |

---

## 14. MATRIZ DE PRIORIDADE

### Alta Prioridade (Impacto Financeiro/Operacional)
- WO-05 a WO-09 (Fluxo de status da OS)
- QT-09 a QT-12 (Conversão de orçamento)
- IN-04 a IN-07 (Baixa de estoque)
- CK-04 a CK-12 (Execução de checklists)
- PY-03 a PY-05 (Status de pagamentos)

### Média Prioridade (Experiência do Usuário)
- CLI-01 a CLI-09 (CRUD de clientes)
- EX-01 a EX-07 (Despesas)
- CT-01 a CT-08 (Catálogo)
- SG-01 a SG-05 (Assinaturas)

### Baixa Prioridade (Edge Cases)
- EC-01 a EC-12 (Cenários extremos)
- RF-01 a RF-04 (Indicações)

---

## 15. CHECKLIST DE VALIDAÇÃO

Para cada cenário, verificar:

- [ ] Dados sincronizam dentro de 30 segundos (online)
- [ ] Dados sincronizam ao reconectar (offline → online)
- [ ] Timestamps `createdAt` e `updatedAt` corretos
- [ ] Não há duplicação de registros
- [ ] Não há perda de dados
- [ ] IDs são consistentes (localId → serverId)
- [ ] Relacionamentos mantidos (FK constraints)
- [ ] Soft deletes funcionam corretamente
- [ ] Audit log registra todas as ações

---

## 16. FERRAMENTAS DE TESTE RECOMENDADAS

### Mobile
- **Charles Proxy**: Simular latência e falhas de rede
- **Airplane Mode**: Testar offline
- **React Native Debugger**: Inspecionar estado local

### Web
- **DevTools Network**: Throttling
- **React Query DevTools**: Estado das queries

### Backend
- **Logs PowerSync**: Monitorar sync events
- **Prisma Studio**: Visualizar dados diretamente
- **Postman**: Testar endpoints manualmente

---

## 17. COMO EXECUTAR OS TESTES

### 17.1 Testes E2E (Backend + Simulação Web/Mobile)

Estes testes rodam contra um backend real e simulam operações de Web e Mobile.

```bash
# Pré-requisitos: Backend rodando
cd apps/backend
npm run start:dev

# Em outro terminal, execute os testes E2E
cd apps/backend
npm run test:e2e -- --testPathPattern=sync-scenarios

# Executar todos os testes E2E
npm run test:e2e
```

**Arquivo:** `apps/backend/test/sync-scenarios.e2e-spec.ts`

**O que testa:**
- Sincronização de CRUD entre Web e Mobile
- Conflitos de edição simultânea
- Last-Write-Wins
- Idempotência de operações
- Integridade de dados

---

### 17.2 Testes de Integração (Mobile com Mocks)

Estes testes rodam isoladamente com mocks, sem necessidade de backend.

```bash
cd apps/mobile

# Executar apenas testes de sync
npm test -- --testPathPattern=SyncScenarios

# Executar todos os testes de sync
npm test -- --testPathPattern=sync

# Com coverage
npm test -- --coverage --testPathPattern=sync
```

**Arquivo:** `apps/mobile/__tests__/sync/SyncScenarios.integration.test.ts`

**O que testa:**
- Lógica de sincronização do SyncEngine
- Comportamento offline/online
- Fila de mutações
- Resolução de conflitos
- Idempotência de operações

---

### 17.3 Script de Validação Manual (QA)

Script interativo que guia o QA pelos cenários de teste.

```bash
# Instalar ts-node se necessário
npm install -g ts-node

# Executar o validador
npx ts-node scripts/sync-qa-validator.ts

# Filtrar por módulo
npx ts-node scripts/sync-qa-validator.ts --module=clients
npx ts-node scripts/sync-qa-validator.ts --module=work-orders
npx ts-node scripts/sync-qa-validator.ts --module=quotes

# Ver relatórios anteriores
npx ts-node scripts/sync-qa-validator.ts --report-only

# Executar verificações automatizadas
npx ts-node scripts/sync-qa-validator.ts --automated
```

**Arquivo:** `scripts/sync-qa-validator.ts`

**Funcionalidades:**
- Guia interativo pelos 95 cenários
- Registra resultados (Passou/Falhou/Pulou)
- Gera relatório JSON e Markdown
- Salva em `test-reports/`

---

### 17.4 Executar Testes Existentes

```bash
# Testes unitários do backend
cd apps/backend
npm test

# Testes do mobile
cd apps/mobile
npm test

# Testes do web
cd apps/web
npm test
```

---

### 17.5 CI/CD Pipeline

Para integração contínua, adicione ao seu workflow:

```yaml
# .github/workflows/sync-tests.yml
name: Sync Tests

on: [push, pull_request]

jobs:
  sync-tests:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Run backend unit tests
        run: cd apps/backend && npm test

      - name: Run mobile sync tests
        run: cd apps/mobile && npm test -- --testPathPattern=sync

      - name: Start backend
        run: cd apps/backend && npm run start:test &
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test

      - name: Wait for backend
        run: npx wait-on http://localhost:3001/health

      - name: Run E2E sync tests
        run: cd apps/backend && npm run test:e2e -- --testPathPattern=sync
```

---

## 18. ESTRUTURA DE ARQUIVOS DE TESTE

```
/
├── apps/
│   ├── backend/
│   │   └── test/
│   │       ├── sync-scenarios.e2e-spec.ts    # E2E completos
│   │       ├── clients.e2e-spec.ts           # E2E de clientes
│   │       ├── work-orders.e2e-spec.ts       # E2E de OS
│   │       └── quotes.e2e-spec.ts            # E2E de orçamentos
│   │
│   └── mobile/
│       └── __tests__/
│           └── sync/
│               ├── SyncEngine.test.ts         # Unitários do engine
│               ├── ConflictResolution.test.ts # Resolução de conflitos
│               ├── SyncScenarios.integration.test.ts  # Integração
│               └── SyncEngine.clients.test.ts # Sync de clientes
│
├── scripts/
│   └── sync-qa-validator.ts                   # CLI de validação
│
├── test-reports/                              # Relatórios gerados
│   ├── sync-qa-report-*.json
│   └── sync-qa-report-*.md
│
└── docs/
    └── sync-test-scenarios.md                 # Este documento
```

---

## Legenda

| Status | Descrição |
|--------|-----------|
| ✅ | Testado e aprovado |
| ❌ | Testado com falha |
| ⏳ | Pendente de teste |
| 🔄 | Em reteste |
