# =============================================================================
# TERRAFORM - Azure Infrastructure
# =============================================================================
# Monorepo: Backend + Web + Mobile
# =============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.85"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Backend configuration - uncomment after creating storage account
  # backend "azurerm" {
  #   resource_group_name  = "rg-terraform-state"
  #   storage_account_name = "stterraformstate"
  #   container_name       = "tfstate"
  #   key                  = "monorepo.terraform.tfstate"
  # }
}

provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy    = true
      recover_soft_deleted_key_vaults = true
    }
  }
}

# =============================================================================
# Data Sources
# =============================================================================

data "azurerm_client_config" "current" {}

# =============================================================================
# Local Variables
# =============================================================================

locals {
  project_name = "monorepo"
  environment  = var.environment
  location     = var.location

  common_tags = {
    Project     = local.project_name
    Environment = local.environment
    ManagedBy   = "Terraform"
    CreatedAt   = timestamp()
  }

  # Naming convention
  resource_prefix = "${local.project_name}-${local.environment}"
}

# =============================================================================
# Resource Group
# =============================================================================

resource "azurerm_resource_group" "main" {
  name     = "rg-${local.resource_prefix}"
  location = local.location
  tags     = local.common_tags
}

# =============================================================================
# Key Vault (for secrets)
# =============================================================================

resource "azurerm_key_vault" "main" {
  name                        = "kv-${local.resource_prefix}"
  location                    = azurerm_resource_group.main.location
  resource_group_name         = azurerm_resource_group.main.name
  enabled_for_disk_encryption = true
  tenant_id                   = data.azurerm_client_config.current.tenant_id
  soft_delete_retention_days  = 7
  purge_protection_enabled    = false
  sku_name                    = "standard"

  access_policy {
    tenant_id = data.azurerm_client_config.current.tenant_id
    object_id = data.azurerm_client_config.current.object_id

    secret_permissions = [
      "Get", "List", "Set", "Delete", "Recover", "Backup", "Restore", "Purge"
    ]
  }

  tags = local.common_tags
}

# =============================================================================
# Modules
# =============================================================================

module "database" {
  source = "./modules/database"

  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  resource_prefix     = local.resource_prefix
  environment         = local.environment

  # Database settings
  postgres_sku_name    = var.postgres_sku_name
  postgres_storage_mb  = var.postgres_storage_mb
  postgres_version     = var.postgres_version
  postgres_admin_user  = var.postgres_admin_user
  postgres_admin_pass  = var.postgres_admin_pass
  database_name        = var.database_name

  # Redis settings
  redis_sku_name   = var.redis_sku_name
  redis_family     = var.redis_family
  redis_capacity   = var.redis_capacity

  key_vault_id = azurerm_key_vault.main.id
  tags         = local.common_tags
}

module "storage" {
  source = "./modules/storage"

  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  resource_prefix     = local.resource_prefix
  environment         = local.environment

  tags = local.common_tags
}

module "backend" {
  source = "./modules/backend"

  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  resource_prefix     = local.resource_prefix
  environment         = local.environment

  # App Service settings
  app_service_sku_name = var.backend_sku_name

  # Environment variables
  database_url     = module.database.postgres_connection_string
  redis_url        = module.database.redis_connection_string
  storage_url      = module.storage.primary_blob_endpoint
  key_vault_uri    = azurerm_key_vault.main.vault_uri
  frontend_url     = var.frontend_url
  jwt_secret       = var.jwt_secret
  encryption_key   = var.encryption_key

  # Container Registry
  acr_login_server = module.storage.acr_login_server
  acr_admin_user   = module.storage.acr_admin_username
  acr_admin_pass   = module.storage.acr_admin_password

  tags = local.common_tags
}

module "frontend" {
  source = "./modules/frontend"

  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  resource_prefix     = local.resource_prefix
  environment         = local.environment

  # API URL for frontend
  api_url = module.backend.app_service_url

  tags = local.common_tags
}

# =============================================================================
# Outputs
# =============================================================================

output "resource_group_name" {
  value = azurerm_resource_group.main.name
}

output "backend_url" {
  value = module.backend.app_service_url
}

output "frontend_url" {
  value = module.frontend.static_web_app_url
}

output "database_server" {
  value     = module.database.postgres_server_fqdn
  sensitive = true
}

output "redis_hostname" {
  value     = module.database.redis_hostname
  sensitive = true
}

output "storage_account_name" {
  value = module.storage.storage_account_name
}

output "acr_login_server" {
  value = module.storage.acr_login_server
}

output "key_vault_name" {
  value = azurerm_key_vault.main.name
}
