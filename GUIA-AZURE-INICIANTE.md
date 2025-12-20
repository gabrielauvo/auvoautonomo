# Guia Azure para Iniciantes

## O que vamos fazer?

Vamos colocar sua aplicação para rodar na internet usando a Azure (nuvem da Microsoft).
Ao final, você terá:
- Um site funcionando (ex: www.suaempresa.com)
- Uma API funcionando (ex: api.suaempresa.com)
- Um app mobile conectando nessa API

---

## PARTE 1: Criando sua Conta Azure

### Passo 1.1 - Criar conta na Azure

1. Abra o navegador e acesse: **https://azure.microsoft.com/free**
2. Clique em **"Iniciar gratuitamente"**
3. Faça login com sua conta Microsoft (Hotmail/Outlook) ou crie uma nova
4. Preencha seus dados pessoais
5. Será pedido um cartão de crédito (não será cobrado nos primeiros 30 dias)
6. Você ganhará **$200 de crédito grátis** para testar

> **Importante:** Depois dos 30 dias, você só paga pelo que usar (~$125/mês para essa aplicação)

---

## PARTE 2: Instalando as Ferramentas

Você precisa instalar 2 programas no seu computador.

### Passo 2.1 - Instalar Azure CLI

1. Abra o navegador e acesse: **https://aka.ms/installazurecliwindows**
2. O download vai começar automaticamente
3. Execute o arquivo baixado (azure-cli-xxx.msi)
4. Clique em **Next → Next → Install → Finish**

### Passo 2.2 - Instalar Terraform

1. Acesse: **https://developer.hashicorp.com/terraform/downloads**
2. Clique em **Windows** → **AMD64**
3. Vai baixar um arquivo .zip
4. Extraia o arquivo para: `C:\terraform`
5. Agora precisamos adicionar ao PATH:
   - Aperte `Windows + R`
   - Digite `sysdm.cpl` e aperte Enter
   - Clique na aba **Avançado**
   - Clique em **Variáveis de Ambiente**
   - Em "Variáveis do sistema", encontre **Path** e clique em **Editar**
   - Clique em **Novo**
   - Digite: `C:\terraform`
   - Clique **OK** em todas as janelas

### Passo 2.3 - Verificar se funcionou

1. Abra o **Prompt de Comando** (aperte Windows, digite "cmd", Enter)
2. Digite estes comandos e aperte Enter em cada um:

```
az --version
```
Deve aparecer algo como: "azure-cli 2.xx.x"

```
terraform --version
```
Deve aparecer algo como: "Terraform v1.x.x"

Se aparecer "não reconhecido", reinicie o computador e tente novamente.

---

## PARTE 3: Conectando na Azure

### Passo 3.1 - Fazer login

1. Abra o **Prompt de Comando**
2. Digite:

```
az login
```

3. Vai abrir o navegador automaticamente
4. Faça login com a mesma conta que você criou na Azure
5. Quando aparecer "You have logged in", pode fechar o navegador
6. Volte ao Prompt - deve mostrar suas informações

---

## PARTE 4: Criando os Recursos na Azure

Agora vamos criar tudo que sua aplicação precisa.

### Passo 4.1 - Navegar até a pasta do projeto

No Prompt de Comando, digite:

```
cd "c:\Users\Auvo\Nova pasta\infra\terraform"
```

### Passo 4.2 - Preparar o Terraform

Digite:

```
terraform init
```

Espere até aparecer: "Terraform has been successfully initialized!"

### Passo 4.3 - Criar as senhas

Você precisa definir 3 senhas. Digite cada comando abaixo, substituindo pelas suas senhas:

```
set TF_VAR_postgres_admin_pass=SuaSenhaDoB4nc0!
set TF_VAR_jwt_secret=UmaFraseLongaQualquer123456789012345678901234567890
set TF_VAR_encryption_key=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

> **Dica:** A senha do banco precisa ter letra maiúscula, minúscula, número e símbolo.

### Passo 4.4 - Ver o que será criado

Digite:

```
terraform plan -var-file=environments/prod/terraform.tfvars
```

Vai aparecer uma lista de tudo que será criado. Confira se não há erros.

### Passo 4.5 - Criar os recursos

**ATENÇÃO:** Este passo vai criar recursos que custam dinheiro!

Digite:

```
terraform apply -var-file=environments/prod/terraform.tfvars
```

Quando perguntar "Do you want to perform these actions?", digite:

```
yes
```

**Aguarde de 10 a 20 minutos.** O banco de dados demora para criar.

Quando terminar, vai aparecer:
- O endereço do seu site (frontend_url)
- O endereço da sua API (backend_url)

**ANOTE ESSES ENDEREÇOS!**

---

## PARTE 5: Enviando o Código

### Passo 5.1 - Criar conta no GitHub (se não tiver)

1. Acesse: **https://github.com**
2. Clique em **Sign up**
3. Crie sua conta

### Passo 5.2 - Configurar o repositório

1. No GitHub, clique no **+** no canto superior direito
2. Clique em **New repository**
3. Nome: `minha-aplicacao`
4. Clique em **Create repository**

### Passo 5.3 - Enviar seu código

Abra o **Prompt de Comando** na pasta do projeto:

```
cd "c:\Users\Auvo\Nova pasta"
```

Digite estes comandos (um por vez):

```
git init
git add .
git commit -m "Primeiro envio"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/minha-aplicacao.git
git push -u origin main
```

Vai pedir seu usuário e senha do GitHub.

### Passo 5.4 - Configurar os Secrets no GitHub

1. No GitHub, vá no seu repositório
2. Clique em **Settings** (engrenagem)
3. No menu lateral, clique em **Secrets and variables** → **Actions**
4. Clique em **New repository secret**

Adicione cada um destes secrets:

| Nome | Onde encontrar |
|------|----------------|
| `AZURE_CREDENTIALS` | Veja passo 5.5 abaixo |
| `POSTGRES_ADMIN_PASS` | A senha que você criou no passo 4.3 |
| `JWT_SECRET` | A frase longa que você criou no passo 4.3 |
| `ENCRYPTION_KEY` | A chave que você criou no passo 4.3 |
| `NEXT_PUBLIC_API_URL` | O backend_url que você anotou |

### Passo 5.5 - Obter o AZURE_CREDENTIALS

No Prompt de Comando, digite:

```
az ad sp create-for-rbac --name "github-deploy" --role contributor --scopes /subscriptions/SUA_SUBSCRIPTION_ID --sdk-auth
```

Para descobrir sua SUBSCRIPTION_ID, digite:
```
az account show --query id -o tsv
```

Copie todo o JSON que aparecer (começa com `{` e termina com `}`) e cole no secret AZURE_CREDENTIALS.

---

## PARTE 6: Deploy Automático

Agora, toda vez que você alterar o código e enviar para o GitHub, a aplicação será atualizada automaticamente!

### Testando o deploy

1. No GitHub, vá no seu repositório
2. Clique na aba **Actions**
3. Você verá os workflows rodando

Se tiver um ✅ verde, funcionou!
Se tiver um ❌ vermelho, clique para ver o erro.

---

## PARTE 7: Acessando sua Aplicação

### Seu site (frontend)
Acesse: O endereço que apareceu como `frontend_url`

### Sua API (backend)
Acesse: O endereço que apareceu como `backend_url`
Adicione `/health` no final para testar: `https://sua-api.azurewebsites.net/health`

### Seu app mobile
1. Abra o arquivo `apps/mobile/.env`
2. Altere a linha `EXPO_PUBLIC_API_URL` para o endereço da sua API
3. Publique o app nas lojas (Google Play / App Store)

---

## PARTE 8: Quanto vou pagar?

| O que | Custo por mês |
|-------|---------------|
| Servidor da API | ~$55 |
| Banco de dados | ~$35 |
| Cache (Redis) | ~$16 |
| Site | ~$9 |
| Armazenamento | ~$10 |
| **TOTAL** | **~$125/mês** |

### Como economizar:

1. **Desligue quando não usar:**
   - Acesse portal.azure.com
   - Vá em "App Services"
   - Clique no seu app
   - Clique em "Stop"

2. **Use recursos menores em desenvolvimento:**
   - Mude `backend_sku_name = "B1"` no arquivo terraform.tfvars

---

## Problemas Comuns

### "Não consigo fazer login na Azure"
- Verifique se sua conta está ativa em portal.azure.com
- Tente fazer login no navegador primeiro

### "Terraform diz que não encontrou o arquivo"
- Verifique se você está na pasta correta: `c:\Users\Auvo\Nova pasta\infra\terraform`

### "O site não abre"
- Espere 5-10 minutos após o deploy
- Verifique na aba Actions do GitHub se o deploy terminou

### "Erro de senha no banco de dados"
- A senha precisa ter no mínimo 8 caracteres
- Precisa ter: letra maiúscula, minúscula, número e símbolo
- Exemplo válido: `MinhaS3nh@Forte!`

### "Crédito Azure acabou"
- Acesse portal.azure.com
- Vá em "Cost Management"
- Adicione um método de pagamento

---

## Precisa de Ajuda?

1. **Documentação Azure:** https://docs.microsoft.com/azure
2. **Suporte Azure:** No portal, clique em "Help + support"
3. **Comunidade:** https://stackoverflow.com (pesquise em inglês)

---

## Resumo dos Comandos

```bash
# Instalar (só uma vez)
winget install Microsoft.AzureCLI
# Terraform: baixar de https://terraform.io e extrair para C:\terraform

# Login
az login

# Criar infraestrutura
cd "c:\Users\Auvo\Nova pasta\infra\terraform"
terraform init
set TF_VAR_postgres_admin_pass=SuaSenha123!
set TF_VAR_jwt_secret=FraseLongaAqui123456789012345678901234567890
set TF_VAR_encryption_key=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
terraform apply -var-file=environments/prod/terraform.tfvars

# Enviar código
cd "c:\Users\Auvo\Nova pasta"
git add .
git commit -m "Atualização"
git push
```
