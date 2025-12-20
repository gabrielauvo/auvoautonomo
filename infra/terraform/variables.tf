# =============================================================================
# TERRAFORM VARIABLES
# =============================================================================

# =============================================================================
# General
# =============================================================================

variable "environment" {
  description = "Environment name (prod, staging, dev)"
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["prod", "staging", "dev"], var.environment)
    error_message = "Environment must be prod, staging, or dev."
  }
}

variable "location" {
  description = "Azure region for resources"
  type        = string
  default     = "brazilsouth"
}

# =============================================================================
# PostgreSQL
# =============================================================================

variable "postgres_sku_name" {
  description = "PostgreSQL SKU name"
  type        = string
  default     = "B_Standard_B2s"  # Burstable, 2 vCores
}

variable "postgres_storage_mb" {
  description = "PostgreSQL storage in MB"
  type        = number
  default     = 32768  # 32 GB
}

variable "postgres_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "16"
}

variable "postgres_admin_user" {
  description = "PostgreSQL admin username"
  type        = string
  default     = "adminuser"
  sensitive   = true
}

variable "postgres_admin_pass" {
  description = "PostgreSQL admin password"
  type        = string
  sensitive   = true
}

variable "database_name" {
  description = "Name of the application database"
  type        = string
  default     = "monorepo_prod"
}

# =============================================================================
# Redis
# =============================================================================

variable "redis_sku_name" {
  description = "Redis SKU name"
  type        = string
  default     = "Basic"
}

variable "redis_family" {
  description = "Redis family (C for Basic/Standard, P for Premium)"
  type        = string
  default     = "C"
}

variable "redis_capacity" {
  description = "Redis capacity (0-6 for Basic/Standard)"
  type        = number
  default     = 0
}

# =============================================================================
# Backend App Service
# =============================================================================

variable "backend_sku_name" {
  description = "App Service Plan SKU for backend"
  type        = string
  default     = "B2"  # Basic tier, 2 cores
}

# =============================================================================
# Application Settings
# =============================================================================

variable "frontend_url" {
  description = "Frontend URL for CORS"
  type        = string
  default     = "https://www.yourdomain.com"
}

variable "jwt_secret" {
  description = "JWT secret key"
  type        = string
  sensitive   = true
}

variable "encryption_key" {
  description = "Encryption key for sensitive data"
  type        = string
  sensitive   = true
}

# =============================================================================
# Domain (Optional)
# =============================================================================

variable "custom_domain" {
  description = "Custom domain for the application"
  type        = string
  default     = ""
}

variable "custom_domain_api" {
  description = "Custom domain for the API"
  type        = string
  default     = ""
}
