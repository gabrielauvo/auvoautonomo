# =============================================================================
# DATABASE MODULE - Variables
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

# PostgreSQL
variable "postgres_sku_name" {
  description = "PostgreSQL SKU"
  type        = string
}

variable "postgres_storage_mb" {
  description = "PostgreSQL storage in MB"
  type        = number
}

variable "postgres_version" {
  description = "PostgreSQL version"
  type        = string
}

variable "postgres_admin_user" {
  description = "PostgreSQL admin username"
  type        = string
  sensitive   = true
}

variable "postgres_admin_pass" {
  description = "PostgreSQL admin password"
  type        = string
  sensitive   = true
}

variable "database_name" {
  description = "Application database name"
  type        = string
}

# Redis
variable "redis_sku_name" {
  description = "Redis SKU"
  type        = string
}

variable "redis_family" {
  description = "Redis family"
  type        = string
}

variable "redis_capacity" {
  description = "Redis capacity"
  type        = number
}

# Key Vault
variable "key_vault_id" {
  description = "Key Vault ID for storing secrets"
  type        = string
}

variable "tags" {
  description = "Tags for resources"
  type        = map(string)
}
