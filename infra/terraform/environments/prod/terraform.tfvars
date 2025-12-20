# =============================================================================
# PRODUCTION ENVIRONMENT - Variables
# =============================================================================
# IMPORTANTE: Este arquivo contém valores de exemplo.
# Para valores sensíveis, use variáveis de ambiente ou Azure Key Vault.
# =============================================================================

environment = "prod"
location    = "brazilsouth"

# PostgreSQL
postgres_sku_name    = "B_Standard_B2s"
postgres_storage_mb  = 32768
postgres_version     = "16"
postgres_admin_user  = "adminuser"
# postgres_admin_pass  = "SET_VIA_ENV_VAR"  # TF_VAR_postgres_admin_pass
database_name        = "monorepo_prod"

# Redis
redis_sku_name = "Basic"
redis_family   = "C"
redis_capacity = 0

# Backend
backend_sku_name = "B2"

# URLs
frontend_url = "https://www.yourdomain.com"

# Secrets - SET VIA ENVIRONMENT VARIABLES:
# export TF_VAR_postgres_admin_pass="your-password"
# export TF_VAR_jwt_secret="your-jwt-secret"
# export TF_VAR_encryption_key="your-encryption-key"

# Domain (optional)
custom_domain     = ""
custom_domain_api = ""
