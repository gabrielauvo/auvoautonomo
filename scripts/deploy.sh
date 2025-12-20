#!/bin/bash

# ============================================
# Deploy Script - Production Deployment
# ============================================
# Script automatizado para build, tag e deploy
# de aplicações containerizadas
# ============================================

set -e  # Exit on error
set -u  # Exit on undefined variable
set -o pipefail  # Exit on pipe failure

# ============================================
# Configurações
# ============================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VERSION_FILE="${PROJECT_ROOT}/.version"
ENV_FILE="${PROJECT_ROOT}/.env.production"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================
# Funções Helper
# ============================================
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "Comando '$1' não encontrado. Por favor, instale-o."
        exit 1
    fi
}

load_env() {
    if [ -f "$ENV_FILE" ]; then
        log_info "Carregando variáveis de ambiente de $ENV_FILE"
        set -a
        source "$ENV_FILE"
        set +a
    else
        log_warning "Arquivo $ENV_FILE não encontrado. Usando valores padrão."
    fi
}

get_version() {
    if [ -f "$VERSION_FILE" ]; then
        cat "$VERSION_FILE"
    else
        echo "1.0.0"
    fi
}

increment_version() {
    local version=$1
    local type=${2:-patch}  # major, minor, patch

    IFS='.' read -ra VERSION_PARTS <<< "$version"
    local major="${VERSION_PARTS[0]}"
    local minor="${VERSION_PARTS[1]}"
    local patch="${VERSION_PARTS[2]}"

    case $type in
        major)
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        minor)
            minor=$((minor + 1))
            patch=0
            ;;
        patch)
            patch=$((patch + 1))
            ;;
    esac

    echo "${major}.${minor}.${patch}"
}

save_version() {
    echo "$1" > "$VERSION_FILE"
    log_success "Versão atualizada para: $1"
}

# ============================================
# Funções Principais
# ============================================
check_prerequisites() {
    log_info "Verificando pré-requisitos..."
    check_command docker
    check_command docker-compose
    check_command git
    log_success "Todos os pré-requisitos satisfeitos."
}

run_tests() {
    log_info "Executando testes..."

    if [ "${SKIP_TESTS:-false}" == "true" ]; then
        log_warning "Testes ignorados (SKIP_TESTS=true)"
        return 0
    fi

    cd "$PROJECT_ROOT"

    # Executar testes do backend
    log_info "Testando backend..."
    if [ -d "apps/backend" ]; then
        cd apps/backend
        npm run test:coverage || {
            log_error "Testes do backend falharam!"
            exit 1
        }
        cd "$PROJECT_ROOT"
    fi

    # Executar testes do frontend
    log_info "Testando frontend..."
    if [ -d "apps/web" ]; then
        cd apps/web
        npm run test || {
            log_error "Testes do frontend falharam!"
            exit 1
        }
        cd "$PROJECT_ROOT"
    fi

    log_success "Todos os testes passaram!"
}

build_images() {
    local version=$1
    local registry=${DOCKER_REGISTRY:-ghcr.io}
    local namespace=${DOCKER_NAMESPACE:-mycompany}

    log_info "Iniciando build das imagens (versão: $version)..."

    cd "$PROJECT_ROOT"

    # Build backend
    log_info "Building backend..."
    docker build \
        -t "${registry}/${namespace}/backend:${version}" \
        -t "${registry}/${namespace}/backend:latest" \
        -f apps/backend/Dockerfile \
        apps/backend

    # Build frontend
    log_info "Building frontend..."
    docker build \
        -t "${registry}/${namespace}/web:${version}" \
        -t "${registry}/${namespace}/web:latest" \
        -f apps/web/Dockerfile \
        apps/web

    log_success "Imagens construídas com sucesso!"
}

tag_images() {
    local version=$1
    local registry=${DOCKER_REGISTRY:-ghcr.io}
    local namespace=${DOCKER_NAMESPACE:-mycompany}

    log_info "Criando tags adicionais..."

    # Tag com data
    local date_tag=$(date +%Y%m%d)

    docker tag "${registry}/${namespace}/backend:${version}" \
        "${registry}/${namespace}/backend:${date_tag}"

    docker tag "${registry}/${namespace}/web:${version}" \
        "${registry}/${namespace}/web:${date_tag}"

    # Tag com commit SHA (se disponível)
    if git rev-parse --git-dir > /dev/null 2>&1; then
        local commit_sha=$(git rev-parse --short HEAD)

        docker tag "${registry}/${namespace}/backend:${version}" \
            "${registry}/${namespace}/backend:${commit_sha}"

        docker tag "${registry}/${namespace}/web:${version}" \
            "${registry}/${namespace}/web:${commit_sha}"

        log_success "Imagens tagueadas com commit SHA: ${commit_sha}"
    fi

    log_success "Tags criadas: ${version}, ${date_tag}, latest"
}

push_images() {
    local registry=${DOCKER_REGISTRY:-ghcr.io}
    local namespace=${DOCKER_NAMESPACE:-mycompany}

    log_info "Fazendo push das imagens para o registry..."

    if [ "${DRY_RUN:-false}" == "true" ]; then
        log_warning "DRY RUN: Push das imagens seria executado"
        return 0
    fi

    # Login no registry (se credenciais estiverem disponíveis)
    if [ -n "${DOCKER_USERNAME:-}" ] && [ -n "${DOCKER_PASSWORD:-}" ]; then
        echo "$DOCKER_PASSWORD" | docker login "$registry" -u "$DOCKER_USERNAME" --password-stdin
    fi

    # Push todas as tags
    docker push --all-tags "${registry}/${namespace}/backend"
    docker push --all-tags "${registry}/${namespace}/web"

    log_success "Imagens enviadas para o registry!"
}

deploy_to_production() {
    local version=$1

    log_info "Iniciando deploy para produção (versão: $version)..."

    if [ "${DRY_RUN:-false}" == "true" ]; then
        log_warning "DRY RUN: Deploy seria executado"
        return 0
    fi

    cd "$PROJECT_ROOT"

    # Exportar versão para o docker-compose
    export VERSION=$version

    # Pull das imagens mais recentes
    log_info "Baixando imagens..."
    docker-compose -f docker-compose.prod.yml pull

    # Deploy com zero-downtime
    log_info "Executando deploy..."
    docker-compose -f docker-compose.prod.yml up -d --no-deps --build

    # Aguardar serviços ficarem saudáveis
    log_info "Aguardando serviços ficarem saudáveis..."
    sleep 30

    # Verificar health dos serviços
    if docker-compose -f docker-compose.prod.yml ps | grep -q "unhealthy"; then
        log_error "Alguns serviços não estão saudáveis!"
        log_warning "Executando rollback..."
        docker-compose -f docker-compose.prod.yml down
        exit 1
    fi

    log_success "Deploy concluído com sucesso!"
}

create_backup() {
    log_info "Criando backup do banco de dados..."

    local backup_dir="${PROJECT_ROOT}/backups"
    mkdir -p "$backup_dir"

    local backup_file="${backup_dir}/backup-$(date +%Y%m%d-%H%M%S).sql"

    docker-compose -f docker-compose.prod.yml exec -T postgres \
        pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" > "$backup_file"

    # Comprimir backup
    gzip "$backup_file"

    log_success "Backup criado: ${backup_file}.gz"
}

rollback() {
    local previous_version=$1

    log_warning "Executando rollback para versão: $previous_version"

    export VERSION=$previous_version

    docker-compose -f docker-compose.prod.yml down
    docker-compose -f docker-compose.prod.yml up -d

    save_version "$previous_version"

    log_success "Rollback concluído!"
}

cleanup_old_images() {
    log_info "Limpando imagens antigas..."

    # Remover imagens dangling
    docker image prune -f

    # Remover imagens antigas (manter últimas 5 versões)
    # Adicione lógica customizada aqui se necessário

    log_success "Limpeza concluída!"
}

# ============================================
# Menu de Ajuda
# ============================================
show_help() {
    cat << EOF
Deploy Script - Automação de Deploy para Produção

USO:
    $0 [OPÇÕES] [COMANDO]

COMANDOS:
    build       - Build das imagens Docker
    push        - Push das imagens para o registry
    deploy      - Deploy completo (build + push + deploy)
    rollback    - Rollback para versão anterior
    backup      - Criar backup do banco de dados
    cleanup     - Limpar imagens antigas

OPÇÕES:
    -v VERSION      Versão a ser deployada (padrão: auto-increment)
    -t TYPE         Tipo de incremento de versão: major|minor|patch (padrão: patch)
    -e ENV_FILE     Arquivo de ambiente (padrão: .env.production)
    --dry-run       Simular execução sem fazer mudanças
    --skip-tests    Pular execução de testes
    -h, --help      Mostrar esta ajuda

EXEMPLOS:
    # Deploy completo com versão automática
    $0 deploy

    # Build e push com versão específica
    $0 -v 2.0.0 build push

    # Deploy com incremento minor
    $0 -t minor deploy

    # Rollback para versão anterior
    $0 rollback 1.5.0

    # Dry run
    $0 --dry-run deploy

VARIÁVEIS DE AMBIENTE:
    DOCKER_REGISTRY     - Registry Docker (padrão: ghcr.io)
    DOCKER_NAMESPACE    - Namespace/organização
    DOCKER_USERNAME     - Usuário do registry
    DOCKER_PASSWORD     - Senha do registry
    SKIP_TESTS          - Pular testes (true/false)
    DRY_RUN            - Simular execução (true/false)

EOF
}

# ============================================
# Main
# ============================================
main() {
    local command=""
    local version=""
    local version_type="patch"

    # Parse argumentos
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -v)
                version="$2"
                shift 2
                ;;
            -t)
                version_type="$2"
                shift 2
                ;;
            -e)
                ENV_FILE="$2"
                shift 2
                ;;
            --dry-run)
                export DRY_RUN=true
                shift
                ;;
            --skip-tests)
                export SKIP_TESTS=true
                shift
                ;;
            build|push|deploy|rollback|backup|cleanup)
                command="$1"
                shift
                ;;
            *)
                log_error "Argumento desconhecido: $1"
                show_help
                exit 1
                ;;
        esac
    done

    # Verificar se comando foi fornecido
    if [ -z "$command" ]; then
        log_error "Nenhum comando especificado"
        show_help
        exit 1
    fi

    # Banner
    echo "============================================"
    echo "  Deploy Script - Production Deployment"
    echo "============================================"
    echo ""

    # Executar
    check_prerequisites
    load_env

    # Determinar versão
    if [ -z "$version" ] && [ "$command" != "rollback" ]; then
        local current_version=$(get_version)
        version=$(increment_version "$current_version" "$version_type")
        log_info "Versão calculada: $version (anterior: $current_version)"
    fi

    case $command in
        build)
            run_tests
            build_images "$version"
            tag_images "$version"
            save_version "$version"
            ;;
        push)
            push_images
            ;;
        deploy)
            create_backup
            run_tests
            build_images "$version"
            tag_images "$version"
            push_images
            deploy_to_production "$version"
            save_version "$version"
            cleanup_old_images
            ;;
        rollback)
            if [ -z "$version" ]; then
                log_error "Versão é obrigatória para rollback"
                exit 1
            fi
            create_backup
            rollback "$version"
            ;;
        backup)
            create_backup
            ;;
        cleanup)
            cleanup_old_images
            ;;
    esac

    echo ""
    log_success "Operação '$command' concluída com sucesso!"
    echo "============================================"
}

# Executar main
main "$@"
