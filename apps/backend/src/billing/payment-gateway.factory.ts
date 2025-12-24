/**
 * Payment Gateway Factory
 *
 * Factory para selecionar o gateway de pagamento correto baseado no país do cliente.
 * - Brasil (BR) → Asaas (PIX, Boleto, Cartão em BRL)
 * - Internacional → Stripe (Cartão em USD/EUR/GBP)
 */

import { Injectable, Logger } from '@nestjs/common';
import { AsaasBillingService } from './asaas-billing.service';
import { StripeBillingService } from './stripe-billing.service';
import {
  IPaymentGateway,
  GatewayType,
  getGatewayTypeForCountry,
  getCurrencyForCountry,
  CustomerData,
  CreditCardData,
  CreditCardHolderData,
  SubscriptionResult,
  PaymentCycle,
} from './interfaces/payment-gateway.interface';

// Preços por moeda (em centavos/unidades)
export const PRICING = {
  BRL: {
    MONTHLY: 99.90,
    YEARLY: 89.90 * 12, // ~10% desconto
  },
  USD: {
    MONTHLY: 19.90,
    YEARLY: 16.90 * 12, // ~15% desconto
  },
  EUR: {
    MONTHLY: 18.90,
    YEARLY: 15.90 * 12,
  },
  GBP: {
    MONTHLY: 15.90,
    YEARLY: 13.90 * 12,
  },
};

@Injectable()
export class PaymentGatewayFactory {
  private readonly logger = new Logger(PaymentGatewayFactory.name);

  constructor(
    private asaasBillingService: AsaasBillingService,
    private stripeBillingService: StripeBillingService,
  ) {}

  /**
   * Retorna o gateway apropriado para o país
   */
  getGateway(country: string): IPaymentGateway {
    const gatewayType = getGatewayTypeForCountry(country);

    if (gatewayType === 'asaas') {
      return this.asaasBillingService as unknown as IPaymentGateway;
    }

    return this.stripeBillingService;
  }

  /**
   * Retorna o tipo do gateway para o país
   */
  getGatewayType(country: string): GatewayType {
    return getGatewayTypeForCountry(country);
  }

  /**
   * Retorna a moeda para o país
   */
  getCurrency(country: string): string {
    return getCurrencyForCountry(country);
  }

  /**
   * Retorna o preço baseado na moeda e ciclo
   */
  getPrice(currency: string, cycle: PaymentCycle): number {
    const currencyPricing = PRICING[currency as keyof typeof PRICING] || PRICING.USD;
    return cycle === 'YEARLY' ? currencyPricing.YEARLY : currencyPricing.MONTHLY;
  }

  /**
   * Verifica se PIX está disponível para o país
   */
  isPixAvailable(country: string): boolean {
    return country.toUpperCase() === 'BR';
  }

  /**
   * Cria assinatura usando o gateway apropriado
   */
  async createSubscription(
    userId: string,
    customerData: CustomerData,
    cycle: PaymentCycle,
    paymentMethod: 'PIX' | 'CREDIT_CARD',
    creditCard?: CreditCardData,
    holderInfo?: CreditCardHolderData,
    remoteIp?: string,
  ): Promise<SubscriptionResult & { gateway: GatewayType; currency: string }> {
    const country = customerData.country || 'BR';
    const gatewayType = this.getGatewayType(country);
    const currency = this.getCurrency(country);
    const amount = this.getPrice(currency, cycle);

    this.logger.log(
      `Creating subscription: user=${userId}, country=${country}, gateway=${gatewayType}, currency=${currency}, amount=${amount}`,
    );

    // Brasil - Asaas
    if (gatewayType === 'asaas') {
      // Criar/atualizar cliente no Asaas
      const customer = await this.asaasBillingService.createOrUpdateCustomer(userId, {
        name: customerData.name,
        email: customerData.email,
        cpfCnpj: customerData.taxId || '',
        phone: customerData.phone,
        postalCode: customerData.postalCode,
        addressNumber: customerData.addressNumber,
      });

      if (paymentMethod === 'PIX') {
        const result = await this.asaasBillingService.createPixSubscription(
          userId,
          customer.id,
          amount,
          `Assinatura PRO (${cycle === 'YEARLY' ? 'Anual' : 'Mensal'})`,
          cycle,
        );
        return { ...result, gateway: 'asaas', currency };
      }

      // Cartão de crédito
      if (!creditCard || !holderInfo) {
        return {
          success: false,
          errorMessage: 'Dados do cartão são obrigatórios',
          gateway: 'asaas',
          currency,
        };
      }

      const result = await this.asaasBillingService.createCreditCardSubscription(
        userId,
        customer.id,
        amount,
        `Assinatura PRO (${cycle === 'YEARLY' ? 'Anual' : 'Mensal'})`,
        {
          holderName: creditCard.holderName,
          number: creditCard.number,
          expiryMonth: creditCard.expiryMonth,
          expiryYear: creditCard.expiryYear,
          ccv: creditCard.cvv,
        },
        {
          name: holderInfo.name,
          email: holderInfo.email,
          cpfCnpj: holderInfo.taxId,
          postalCode: holderInfo.postalCode,
          addressNumber: holderInfo.addressNumber,
          phone: holderInfo.phone,
        },
        remoteIp || '127.0.0.1',
        cycle,
      );
      return { ...result, gateway: 'asaas', currency };
    }

    // Internacional - Stripe
    // Criar/atualizar cliente no Stripe
    const customerResult = await this.stripeBillingService.createOrUpdateCustomer(customerData);
    if (!customerResult.success || !customerResult.customerId) {
      return {
        success: false,
        errorMessage: customerResult.errorMessage || 'Erro ao criar cliente',
        gateway: 'stripe',
        currency,
      };
    }

    // PIX não disponível fora do Brasil
    if (paymentMethod === 'PIX') {
      return {
        success: false,
        errorMessage: 'PIX está disponível apenas para clientes no Brasil. Use cartão de crédito.',
        gateway: 'stripe',
        currency,
      };
    }

    // Para Stripe, recomendamos usar Checkout Session
    // Mas se tiver dados do cartão, podemos tentar criar subscription diretamente
    if (creditCard && holderInfo) {
      const result = await this.stripeBillingService.createCreditCardSubscription(
        userId,
        customerResult.customerId,
        amount,
        `Pro Subscription (${cycle === 'YEARLY' ? 'Yearly' : 'Monthly'})`,
        creditCard,
        holderInfo,
        remoteIp || '127.0.0.1',
        cycle,
      );
      return { ...result, gateway: 'stripe', currency };
    }

    // Retornar indicação para usar Checkout Session
    return {
      success: false,
      errorMessage: 'Para pagamentos internacionais, use o Stripe Checkout.',
      gateway: 'stripe',
      currency,
    };
  }

  /**
   * Cria sessão de checkout do Stripe (para clientes internacionais)
   */
  async createStripeCheckoutSession(
    userId: string,
    customerData: CustomerData,
    cycle: PaymentCycle,
    successUrl: string,
    cancelUrl: string,
  ): Promise<SubscriptionResult & { gateway: GatewayType; currency: string }> {
    const currency = this.getCurrency(customerData.country);
    const amount = this.getPrice(currency, cycle);

    // Criar cliente no Stripe
    const customerResult = await this.stripeBillingService.createOrUpdateCustomer(customerData);
    if (!customerResult.success || !customerResult.customerId) {
      return {
        success: false,
        errorMessage: customerResult.errorMessage || 'Erro ao criar cliente',
        gateway: 'stripe',
        currency,
      };
    }

    // Obter ou criar Price ID
    const priceId = await this.stripeBillingService.getOrCreatePriceId(
      'Auvo Pro',
      amount,
      currency,
      cycle,
    );

    if (!priceId) {
      return {
        success: false,
        errorMessage: 'Erro ao configurar preço',
        gateway: 'stripe',
        currency,
      };
    }

    // Criar sessão de checkout
    const result = await this.stripeBillingService.createCheckoutSession(
      userId,
      customerResult.customerId,
      priceId,
      successUrl,
      cancelUrl,
    );

    return { ...result, gateway: 'stripe', currency };
  }

  /**
   * Cancela assinatura no gateway apropriado
   */
  async cancelSubscription(userId: string): Promise<{ success: boolean; message?: string }> {
    const subscription = await this.getSubscriptionInfo(userId);

    if (subscription?.asaasSubscriptionId) {
      await this.asaasBillingService.cancelSubscription(userId);
      return { success: true, message: 'Assinatura cancelada com sucesso' };
    }

    // Para Stripe, verificar se temos stripeSubscriptionId
    const stripeSubId = (subscription as any)?.stripeSubscriptionId;
    if (stripeSubId) {
      return this.stripeBillingService.cancelSubscription(stripeSubId);
    }

    return { success: false, message: 'Nenhuma assinatura encontrada' };
  }

  private async getSubscriptionInfo(userId: string) {
    // Usar o prisma do asaasBillingService
    return (this.asaasBillingService as any).prisma.userSubscription.findUnique({
      where: { userId },
    });
  }
}
