/**
 * Tool Permission Decorator
 * Used to mark endpoints with required permissions
 */

import { SetMetadata } from '@nestjs/common';
import { ToolPermission } from '../dto/tool-params';

export const TOOL_PERMISSION_KEY = 'tool_permission';

/**
 * Decorator to require a specific permission for a route/handler
 *
 * @example
 * @RequireToolPermission(ToolPermission.BILLING_WRITE)
 * @Post('charge')
 * createCharge(@Body() dto: CreateChargeDto) { ... }
 */
export const RequireToolPermission = (permission: ToolPermission) =>
  SetMetadata(TOOL_PERMISSION_KEY, permission);

/**
 * Shorthand decorators for common permissions
 */
export const RequireCustomersRead = () =>
  RequireToolPermission(ToolPermission.CUSTOMERS_READ);

export const RequireCustomersWrite = () =>
  RequireToolPermission(ToolPermission.CUSTOMERS_WRITE);

export const RequireWorkOrdersRead = () =>
  RequireToolPermission(ToolPermission.WORK_ORDERS_READ);

export const RequireWorkOrdersWrite = () =>
  RequireToolPermission(ToolPermission.WORK_ORDERS_WRITE);

export const RequireQuotesRead = () =>
  RequireToolPermission(ToolPermission.QUOTES_READ);

export const RequireQuotesWrite = () =>
  RequireToolPermission(ToolPermission.QUOTES_WRITE);

export const RequireBillingRead = () =>
  RequireToolPermission(ToolPermission.BILLING_READ);

export const RequireBillingWrite = () =>
  RequireToolPermission(ToolPermission.BILLING_WRITE);

export const RequireKbRead = () =>
  RequireToolPermission(ToolPermission.KB_READ);
