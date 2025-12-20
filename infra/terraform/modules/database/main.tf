# =============================================================================
# DATABASE MODULE - PostgreSQL + Redis
# =============================================================================

# =============================================================================
# PostgreSQL Flexible Server
# =============================================================================

resource "azurerm_postgresql_flexible_server" "main" {
  name                   = "psql-${var.resource_prefix}"
  resource_group_name    = var.resource_group_name
  location               = var.location
  version                = var.postgres_version
  administrator_login    = var.postgres_admin_user
  administrator_password = var.postgres_admin_pass
  storage_mb             = var.postgres_storage_mb
  sku_name               = var.postgres_sku_name
  zone                   = "1"

  backup_retention_days        = 7
  geo_redundant_backup_enabled = false

  tags = var.tags
}

# Database
resource "azurerm_postgresql_flexible_server_database" "app" {
  name      = var.database_name
  server_id = azurerm_postgresql_flexible_server.main.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

# Firewall rule - Allow Azure Services
resource "azurerm_postgresql_flexible_server_firewall_rule" "azure_services" {
  name             = "AllowAzureServices"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

# PostgreSQL configuration
resource "azurerm_postgresql_flexible_server_configuration" "timezone" {
  name      = "timezone"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "America/Sao_Paulo"
}

# =============================================================================
# Redis Cache
# =============================================================================

resource "azurerm_redis_cache" "main" {
  name                = "redis-${var.resource_prefix}"
  location            = var.location
  resource_group_name = var.resource_group_name
  capacity            = var.redis_capacity
  family              = var.redis_family
  sku_name            = var.redis_sku_name
  enable_non_ssl_port = false
  minimum_tls_version = "1.2"

  redis_configuration {
    maxmemory_policy = "allkeys-lru"
  }

  tags = var.tags
}

# =============================================================================
# Store secrets in Key Vault
# =============================================================================

resource "azurerm_key_vault_secret" "postgres_connection_string" {
  name         = "POSTGRES-CONNECTION-STRING"
  value        = "postgresql://${var.postgres_admin_user}:${var.postgres_admin_pass}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/${var.database_name}?sslmode=require"
  key_vault_id = var.key_vault_id
}

resource "azurerm_key_vault_secret" "redis_connection_string" {
  name         = "REDIS-CONNECTION-STRING"
  value        = "rediss://:${azurerm_redis_cache.main.primary_access_key}@${azurerm_redis_cache.main.hostname}:${azurerm_redis_cache.main.ssl_port}"
  key_vault_id = var.key_vault_id
}

# =============================================================================
# Outputs
# =============================================================================

output "postgres_server_fqdn" {
  value = azurerm_postgresql_flexible_server.main.fqdn
}

output "postgres_connection_string" {
  value     = "postgresql://${var.postgres_admin_user}:${var.postgres_admin_pass}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/${var.database_name}?sslmode=require"
  sensitive = true
}

output "redis_hostname" {
  value = azurerm_redis_cache.main.hostname
}

output "redis_connection_string" {
  value     = "rediss://:${azurerm_redis_cache.main.primary_access_key}@${azurerm_redis_cache.main.hostname}:${azurerm_redis_cache.main.ssl_port}"
  sensitive = true
}

output "redis_primary_key" {
  value     = azurerm_redis_cache.main.primary_access_key
  sensitive = true
}
