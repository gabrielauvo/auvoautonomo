# =============================================================================
# BACKEND MODULE - Variables
# =============================================================================

variable "resource_group_name" {
  description = "Resource group name"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
}

variable "resource_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "app_service_sku_name" {
  description = "App Service Plan SKU"
  type        = string
}

# Environment variables
variable "database_url" {
  description = "PostgreSQL connection string"
  type        = string
  sensitive   = true
}

variable "redis_url" {
  description = "Redis connection string"
  type        = string
  sensitive   = true
}

variable "storage_url" {
  description = "Azure Storage URL"
  type        = string
}

variable "key_vault_uri" {
  description = "Key Vault URI"
  type        = string
}

variable "frontend_url" {
  description = "Frontend URL for CORS"
  type        = string
}

variable "jwt_secret" {
  description = "JWT secret"
  type        = string
  sensitive   = true
}

variable "encryption_key" {
  description = "Encryption key"
  type        = string
  sensitive   = true
}

# Container Registry
variable "acr_login_server" {
  description = "ACR login server"
  type        = string
}

variable "acr_admin_user" {
  description = "ACR admin username"
  type        = string
  sensitive   = true
}

variable "acr_admin_pass" {
  description = "ACR admin password"
  type        = string
  sensitive   = true
}

variable "tags" {
  description = "Tags for resources"
  type        = map(string)
}
