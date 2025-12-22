/**
 * Charges Module
 *
 * Módulo de cobranças para o app mobile.
 * Inclui listagem, criação, detalhes e conversão de orçamento.
 */

// Service
export { ChargeService } from './ChargeService';

// Screens
export { ChargesListScreen } from './ChargesListScreen';
export { ChargeDetailScreen } from './ChargeDetailScreen';
export { ChargeFormScreen } from './ChargeFormScreen';

// Types
export type {
  Charge,
  ChargeStatus,
  BillingType,
  ChargeListResponse,
  ChargeSearchParams,
  ChargeStats,
  CreateChargeDto,
  ManualPaymentDto,
  CancelChargeDto,
  ChargeSummaryClient,
  PaymentUrls,
  ChargeDiscount,
  ChargeFine,
  ChargeInterest,
} from './types';

// Helpers
export {
  chargeStatusLabels,
  billingTypeLabels,
  canEditCharge,
  canCancelCharge,
  canRegisterManualPayment,
  isChargePaid,
  isChargeFinalized,
} from './types';
