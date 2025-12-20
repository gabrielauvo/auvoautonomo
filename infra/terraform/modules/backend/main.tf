# =============================================================================
# BACKEND MODULE - App Service for NestJS API
# =============================================================================

# =============================================================================
# App Service Plan
# =============================================================================

resource "azurerm_service_plan" "main" {
  name                = "asp-${var.resource_prefix}"
  resource_group_name = var.resource_group_name
  location            = var.location
  os_type             = "Linux"
  sku_name            = var.app_service_sku_name

  tags = var.tags
}

# =============================================================================
# Backend Web App
# =============================================================================

resource "azurerm_linux_web_app" "backend" {
  name                = "api-${var.resource_prefix}"
  resource_group_name = var.resource_group_name
  location            = var.location
  service_plan_id     = azurerm_service_plan.main.id
  https_only          = true

  site_config {
    always_on                = var.app_service_sku_name != "F1" && var.app_service_sku_name != "D1"
    ftps_state               = "Disabled"
    minimum_tls_version      = "1.2"
    health_check_path        = "/health"
    health_check_eviction_time_in_min = 5

    application_stack {
      docker_image_name        = "backend:latest"
      docker_registry_url      = "https://${var.acr_login_server}"
      docker_registry_username = var.acr_admin_user
      docker_registry_password = var.acr_admin_pass
    }

    cors {
      allowed_origins = [var.frontend_url]
      support_credentials = true
    }
  }

  app_settings = {
    # Runtime
    NODE_ENV                          = var.environment == "prod" ? "production" : "development"
    PORT                              = "8080"
    WEBSITES_PORT                     = "8080"
    WEBSITE_NODE_DEFAULT_VERSION      = "~20"

    # Database
    DATABASE_URL = var.database_url

    # Redis
    REDIS_URL = var.redis_url

    # Storage
    AZURE_STORAGE_CONNECTION_STRING = var.storage_url

    # Security
    JWT_SECRET     = var.jwt_secret
    ENCRYPTION_KEY = var.encryption_key
    JWT_EXPIRES_IN = "7d"

    # CORS
    FRONTEND_URL = var.frontend_url
    CORS_ORIGIN  = var.frontend_url

    # Docker
    DOCKER_REGISTRY_SERVER_URL      = "https://${var.acr_login_server}"
    DOCKER_REGISTRY_SERVER_USERNAME = var.acr_admin_user
    DOCKER_REGISTRY_SERVER_PASSWORD = var.acr_admin_pass

    # Monitoring
    APPLICATIONINSIGHTS_CONNECTION_STRING = azurerm_application_insights.backend.connection_string
  }

  identity {
    type = "SystemAssigned"
  }

  tags = var.tags
}

# =============================================================================
# Application Insights
# =============================================================================

resource "azurerm_log_analytics_workspace" "main" {
  name                = "log-${var.resource_prefix}"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "PerGB2018"
  retention_in_days   = 30

  tags = var.tags
}

resource "azurerm_application_insights" "backend" {
  name                = "ai-${var.resource_prefix}-backend"
  location            = var.location
  resource_group_name = var.resource_group_name
  workspace_id        = azurerm_log_analytics_workspace.main.id
  application_type    = "web"

  tags = var.tags
}

# =============================================================================
# Autoscale (optional - for production)
# =============================================================================

resource "azurerm_monitor_autoscale_setting" "backend" {
  count               = var.environment == "prod" ? 1 : 0
  name                = "autoscale-${var.resource_prefix}"
  resource_group_name = var.resource_group_name
  location            = var.location
  target_resource_id  = azurerm_service_plan.main.id

  profile {
    name = "default"

    capacity {
      default = 1
      minimum = 1
      maximum = 3
    }

    rule {
      metric_trigger {
        metric_name        = "CpuPercentage"
        metric_resource_id = azurerm_service_plan.main.id
        time_grain         = "PT1M"
        statistic          = "Average"
        time_window        = "PT5M"
        time_aggregation   = "Average"
        operator           = "GreaterThan"
        threshold          = 75
      }

      scale_action {
        direction = "Increase"
        type      = "ChangeCount"
        value     = "1"
        cooldown  = "PT5M"
      }
    }

    rule {
      metric_trigger {
        metric_name        = "CpuPercentage"
        metric_resource_id = azurerm_service_plan.main.id
        time_grain         = "PT1M"
        statistic          = "Average"
        time_window        = "PT5M"
        time_aggregation   = "Average"
        operator           = "LessThan"
        threshold          = 25
      }

      scale_action {
        direction = "Decrease"
        type      = "ChangeCount"
        value     = "1"
        cooldown  = "PT5M"
      }
    }
  }
}

# =============================================================================
# Outputs
# =============================================================================

output "app_service_url" {
  value = "https://${azurerm_linux_web_app.backend.default_hostname}"
}

output "app_service_name" {
  value = azurerm_linux_web_app.backend.name
}

output "app_service_id" {
  value = azurerm_linux_web_app.backend.id
}

output "app_service_principal_id" {
  value = azurerm_linux_web_app.backend.identity[0].principal_id
}

output "app_insights_connection_string" {
  value     = azurerm_application_insights.backend.connection_string
  sensitive = true
}

output "app_insights_instrumentation_key" {
  value     = azurerm_application_insights.backend.instrumentation_key
  sensitive = true
}
