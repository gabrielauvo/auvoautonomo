# =============================================================================
# FRONTEND MODULE - Azure Static Web Apps for Next.js
# =============================================================================

# =============================================================================
# Static Web App
# =============================================================================

resource "azurerm_static_web_app" "main" {
  name                = "swa-${var.resource_prefix}"
  resource_group_name = var.resource_group_name
  # Static Web Apps não está disponível em brazilsouth
  # Regiões disponíveis: westus2, centralus, eastus2, westeurope, eastasia
  location            = "eastus2"
  sku_tier            = "Standard"
  sku_size            = "Standard"

  tags = var.tags
}

# =============================================================================
# Custom Domain (optional)
# =============================================================================

# resource "azurerm_static_web_app_custom_domain" "main" {
#   count             = var.custom_domain != "" ? 1 : 0
#   static_web_app_id = azurerm_static_web_app.main.id
#   domain_name       = var.custom_domain
#   validation_type   = "cname-delegation"
# }

# =============================================================================
# Application Settings (via GitHub Actions)
# =============================================================================

# Note: Environment variables for Static Web Apps are configured
# through the GitHub Actions workflow or Azure Portal

# =============================================================================
# Outputs
# =============================================================================

output "static_web_app_url" {
  value = "https://${azurerm_static_web_app.main.default_host_name}"
}

output "static_web_app_id" {
  value = azurerm_static_web_app.main.id
}

output "static_web_app_name" {
  value = azurerm_static_web_app.main.name
}

output "static_web_app_api_key" {
  value     = azurerm_static_web_app.main.api_key
  sensitive = true
}

output "default_host_name" {
  value = azurerm_static_web_app.main.default_host_name
}
