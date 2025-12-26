/**
 * FAQ Seeds
 * Initial FAQ entries for the knowledge base
 */

export interface FaqSeed {
  question: string;
  answer: string;
  category: string;
  keywords: string[];
  priority: number;
}

export const FAQ_SEEDS: FaqSeed[] = [
  // ===========================================
  // Clientes
  // ===========================================
  {
    question: 'Como cadastrar um novo cliente?',
    answer: `Para cadastrar um novo cliente:
1. Acesse o menu "Clientes" na barra lateral
2. Clique no botão "Novo Cliente" (ou use o atalho Ctrl+N)
3. Preencha os dados obrigatórios: Nome e pelo menos um contato (email ou telefone)
4. Opcionalmente, adicione endereço, CPF/CNPJ e observações
5. Clique em "Salvar"

Você também pode cadastrar clientes diretamente pelo AI Copilot dizendo "Criar cliente [nome]".`,
    category: 'Clientes',
    keywords: ['cliente', 'cadastrar', 'novo', 'criar', 'adicionar'],
    priority: 10,
  },
  {
    question: 'Como editar ou atualizar dados de um cliente?',
    answer: `Para editar um cliente existente:
1. Acesse o menu "Clientes"
2. Encontre o cliente na lista (use a busca se necessário)
3. Clique no nome do cliente para abrir os detalhes
4. Clique em "Editar" ou no ícone de lápis
5. Faça as alterações necessárias
6. Clique em "Salvar"

As alterações são salvas automaticamente no histórico do cliente.`,
    category: 'Clientes',
    keywords: ['cliente', 'editar', 'atualizar', 'alterar', 'modificar'],
    priority: 8,
  },
  {
    question: 'Como excluir um cliente?',
    answer: `Para excluir um cliente:
1. Acesse os detalhes do cliente
2. Clique no menu de ações (três pontos)
3. Selecione "Excluir cliente"
4. Confirme a exclusão

**Importante:** A exclusão é reversível por 30 dias (soft delete). Clientes com orçamentos ou ordens de serviço ativas não podem ser excluídos - você precisa primeiro concluir ou cancelar essas pendências.`,
    category: 'Clientes',
    keywords: ['cliente', 'excluir', 'deletar', 'remover', 'apagar'],
    priority: 7,
  },

  // ===========================================
  // Orçamentos
  // ===========================================
  {
    question: 'Como criar um orçamento?',
    answer: `Para criar um orçamento:
1. Acesse "Orçamentos" no menu lateral
2. Clique em "Novo Orçamento"
3. Selecione o cliente (ou crie um novo)
4. Adicione os itens/serviços do catálogo ou itens personalizados
5. Configure desconto (se aplicável) e validade
6. Clique em "Salvar" para rascunho ou "Enviar" para enviar ao cliente

**Dica:** Use o AI Copilot: "Criar orçamento de R$500 para [cliente]"`,
    category: 'Orçamentos',
    keywords: ['orçamento', 'criar', 'novo', 'proposta', 'cotação'],
    priority: 10,
  },
  {
    question: 'Como enviar um orçamento para o cliente?',
    answer: `Para enviar um orçamento:
1. Abra o orçamento que deseja enviar
2. Verifique se todos os dados estão corretos
3. Clique em "Enviar Orçamento"
4. Escolha o canal de envio:
   - **WhatsApp**: Envia link do orçamento via WhatsApp
   - **Email**: Envia PDF anexado por email
5. Confirme o envio

O cliente receberá um link para visualizar e aprovar o orçamento online.`,
    category: 'Orçamentos',
    keywords: ['orçamento', 'enviar', 'email', 'whatsapp', 'compartilhar'],
    priority: 9,
  },
  {
    question: 'Como configurar a validade do orçamento?',
    answer: `A validade do orçamento pode ser configurada de duas formas:

**No orçamento individual:**
1. Ao criar/editar o orçamento
2. Campo "Validade" - escolha a data de expiração

**Configuração padrão (para todos os novos orçamentos):**
1. Vá em Configurações > Orçamentos
2. Defina a "Validade padrão" (ex: 7, 15, 30 dias)

Orçamentos expirados são automaticamente marcados como "Expirado" e não podem mais ser aprovados pelo cliente.`,
    category: 'Orçamentos',
    keywords: ['orçamento', 'validade', 'expirar', 'prazo', 'configurar'],
    priority: 6,
  },

  // ===========================================
  // Ordens de Serviço
  // ===========================================
  {
    question: 'Como criar uma ordem de serviço (OS)?',
    answer: `Para criar uma ordem de serviço:
1. Acesse "Ordens de Serviço" no menu
2. Clique em "Nova OS"
3. Selecione o cliente
4. Preencha: título, descrição, data agendada
5. (Opcional) Vincule a um orçamento aprovado
6. (Opcional) Adicione checklist de tarefas
7. Salve a OS

A OS criada aparecerá na agenda e pode ser atribuída a um técnico (se aplicável).`,
    category: 'Ordens de Serviço',
    keywords: ['ordem de serviço', 'os', 'criar', 'agendar', 'serviço'],
    priority: 10,
  },
  {
    question: 'Como marcar uma ordem de serviço como concluída?',
    answer: `Para concluir uma OS:

**Pelo sistema web:**
1. Abra a OS
2. Clique em "Alterar Status"
3. Selecione "Concluída"
4. Opcionalmente, adicione observações finais

**Pelo app mobile:**
1. Abra a OS no app
2. Complete o checklist (se houver)
3. Colete assinatura do cliente (se configurado)
4. Toque em "Finalizar OS"

Ao concluir, você pode gerar uma cobrança automaticamente.`,
    category: 'Ordens de Serviço',
    keywords: ['ordem de serviço', 'os', 'concluir', 'finalizar', 'completar'],
    priority: 9,
  },

  // ===========================================
  // Cobranças e Pagamentos
  // ===========================================
  {
    question: 'Como criar uma cobrança PIX?',
    answer: `Para criar uma cobrança PIX:
1. Acesse "Cobranças" no menu
2. Clique em "Nova Cobrança"
3. Selecione o cliente
4. Escolha "PIX" como forma de pagamento
5. Informe o valor e data de vencimento
6. Clique em "Gerar Cobrança"

O sistema gerará automaticamente:
- QR Code para pagamento
- Link de pagamento compartilhável
- Notificação automática para o cliente

**Via AI Copilot:** "Cobrar R$200 via PIX do cliente [nome]"`,
    category: 'Cobranças',
    keywords: ['cobrança', 'pix', 'pagamento', 'gerar', 'criar'],
    priority: 10,
  },
  {
    question: 'Como gerar um boleto?',
    answer: `Para gerar um boleto:
1. Acesse "Cobranças" > "Nova Cobrança"
2. Selecione o cliente
3. Escolha "Boleto" como forma de pagamento
4. Informe valor e vencimento
5. (Opcional) Configure multa e juros por atraso
6. Clique em "Gerar Boleto"

**Pré-requisito:** Você precisa ter a integração Asaas configurada em Configurações > Integrações > Asaas.

O boleto será enviado automaticamente ao cliente por email.`,
    category: 'Cobranças',
    keywords: ['boleto', 'gerar', 'cobrança', 'pagamento', 'asaas'],
    priority: 9,
  },
  {
    question: 'Como configurar a integração com Asaas?',
    answer: `Para configurar a integração Asaas:
1. Crie uma conta em asaas.com (se ainda não tiver)
2. No Asaas, vá em Configurações > Integrações > API
3. Gere uma nova chave de API
4. No Auvo Autônomo, vá em Configurações > Integrações
5. Clique em "Conectar Asaas"
6. Cole a chave de API
7. Escolha o ambiente (Sandbox para testes, Produção para cobranças reais)
8. Salve

Após configurar, você poderá gerar boletos e cobranças PIX automaticamente.`,
    category: 'Integrações',
    keywords: ['asaas', 'integração', 'configurar', 'api', 'pagamento'],
    priority: 10,
  },

  // ===========================================
  // Catálogo de Itens
  // ===========================================
  {
    question: 'Como adicionar itens ao catálogo?',
    answer: `Para adicionar itens ao catálogo:
1. Acesse "Catálogo" no menu lateral
2. Clique em "Novo Item"
3. Preencha:
   - Nome do item/serviço
   - Tipo (Produto ou Serviço)
   - Preço unitário
   - Unidade de medida (un, hr, m², etc.)
   - (Opcional) Código SKU, descrição, categoria
4. Salve o item

Itens do catálogo podem ser usados em orçamentos e ordens de serviço.`,
    category: 'Catálogo',
    keywords: ['catálogo', 'item', 'produto', 'serviço', 'adicionar', 'cadastrar'],
    priority: 8,
  },

  // ===========================================
  // AI Copilot
  // ===========================================
  {
    question: 'O que é o AI Copilot e como usar?',
    answer: `O AI Copilot é um assistente inteligente que ajuda você a realizar tarefas no sistema usando linguagem natural.

**Como usar:**
1. Clique no ícone de chat no canto inferior direito
2. Digite sua solicitação em português natural
3. O AI irá entender e executar a ação

**Exemplos de comandos:**
- "Listar meus clientes"
- "Criar cliente João Silva"
- "Fazer orçamento de R$500 para Maria"
- "Cobrar R$200 via PIX do cliente Pedro"
- "Qual o resumo do meu faturamento?"

**Importante:** Para ações que envolvem dinheiro (cobranças), o AI sempre pedirá confirmação antes de executar.`,
    category: 'AI Copilot',
    keywords: ['ai', 'copilot', 'assistente', 'chat', 'comandos', 'ajuda'],
    priority: 10,
  },
  {
    question: 'O AI Copilot pode acessar meus dados bancários?',
    answer: `**Não.** O AI Copilot foi projetado com segurança em mente:

1. **Sem acesso a dados sensíveis:** O AI não tem acesso direto ao banco de dados ou APIs externas
2. **Todas as ações passam por validação:** Cada comando é validado pelo sistema antes de executar
3. **Confirmação obrigatória:** Ações financeiras (cobranças) sempre requerem sua confirmação explícita
4. **Auditoria completa:** Todas as ações são registradas em log de auditoria
5. **Isolamento de dados:** O AI só pode acessar dados da sua conta

Seus dados financeiros e de clientes são protegidos por múltiplas camadas de segurança.`,
    category: 'AI Copilot',
    keywords: ['ai', 'segurança', 'dados', 'privacidade', 'banco'],
    priority: 9,
  },

  // ===========================================
  // Configurações
  // ===========================================
  {
    question: 'Como alterar meus dados de empresa?',
    answer: `Para alterar dados da empresa:
1. Acesse Configurações (ícone de engrenagem)
2. Vá em "Perfil da Empresa"
3. Edite os campos desejados:
   - Razão social / Nome fantasia
   - CNPJ
   - Endereço
   - Logo da empresa
   - Cores do tema (para personalizar orçamentos/OS)
4. Salve as alterações

Esses dados aparecem em orçamentos, ordens de serviço e cobranças enviados aos clientes.`,
    category: 'Configurações',
    keywords: ['empresa', 'perfil', 'dados', 'configurar', 'alterar', 'logo'],
    priority: 7,
  },
  {
    question: 'Como configurar notificações automáticas?',
    answer: `Para configurar notificações automáticas:
1. Vá em Configurações > Notificações
2. Configure os gatilhos desejados:

**Para Orçamentos:**
- Envio de orçamento
- Lembrete de orçamento pendente
- Orçamento aprovado

**Para Cobranças:**
- Cobrança criada
- Lembrete antes do vencimento
- Cobrança paga
- Cobrança vencida

**Para OS:**
- OS agendada
- OS concluída

3. Escolha os canais (Email e/ou WhatsApp)
4. Salve as configurações`,
    category: 'Configurações',
    keywords: ['notificação', 'automática', 'email', 'whatsapp', 'lembrete', 'configurar'],
    priority: 8,
  },

  // ===========================================
  // Problemas Comuns
  // ===========================================
  {
    question: 'O que fazer se o sistema está lento?',
    answer: `Se o sistema está lento, tente estas soluções:

1. **Limpe o cache do navegador:**
   - Chrome: Ctrl+Shift+Delete > Limpar dados

2. **Verifique sua conexão de internet:**
   - Teste em speed-test.net

3. **Tente outro navegador:**
   - Recomendamos Chrome, Firefox ou Edge atualizados

4. **Desative extensões do navegador:**
   - Algumas extensões podem interferir

5. **Se usar VPN, desative temporariamente**

Se o problema persistir, entre em contato com o suporte com as informações:
- Qual navegador está usando
- Qual ação estava tentando fazer
- Horário aproximado do problema`,
    category: 'Problemas',
    keywords: ['lento', 'travando', 'demora', 'carregando', 'problema', 'performance'],
    priority: 9,
  },
  {
    question: 'Esqueci minha senha, como recuperar?',
    answer: `Para recuperar sua senha:

1. Na tela de login, clique em "Esqueci minha senha"
2. Digite o email cadastrado
3. Clique em "Enviar link de recuperação"
4. Acesse seu email (verifique a pasta de spam)
5. Clique no link recebido
6. Crie uma nova senha

**O link expira em 1 hora.** Se expirar, solicite um novo.

**Não recebeu o email?**
- Verifique se digitou o email correto
- Olhe na pasta de spam/lixo eletrônico
- Aguarde alguns minutos e tente novamente`,
    category: 'Conta',
    keywords: ['senha', 'esqueci', 'recuperar', 'login', 'acesso', 'reset'],
    priority: 10,
  },
];

export default FAQ_SEEDS;
