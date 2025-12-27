/**
 * Payment Gateway Factory
 *
 * Factory para selecionar o gateway de pagamento correto baseado no pais do cliente.
 * - Brasil (BR) -> Asaas (PIX, Boleto, Cartao em BRL)
 * - America Latina (AR, CL, CO, PE, UY) -> Mercado Pago
 * - Internacional -> Stripe (Cartao em USD/EUR/GBP)
 */

import { Injectable, Logger } from '@nestjs/common';
import { AsaasBillingService } from './asaas-billing.service';
import { StripeBillingService } from './stripe-billing.service';
import { MercadoPagoBillingService } from './mercadopago-billing.service';
import {
  IPaymentGateway,
  GatewayType,
  getGatewayTypeForCountry,
  getCurrencyForCountry,
  getMercadoPagoMethodsForCountry,
  CustomerData,
  CreditCardData,
  CreditCardHolderData,
  SubscriptionResult,
  PaymentCycle,
} from './interfaces/payment-gateway.interface';

// Preços por moeda (valores em unidade da moeda, não centavos)
export const PRICING: Record<string, { MONTHLY: number; YEARLY: number }> = {
  // América do Sul - Brasil (Asaas)
  BRL: {
    MONTHLY: 99.90,
    YEARLY: 89.90 * 12, // ~10% desconto anual
  },
  // América do Sul - LATAM (Mercado Pago)
  ARS: { // Argentina - Peso Argentino
    MONTHLY: 19900,
    YEARLY: 16900 * 12,
  },
  CLP: { // Chile - Peso Chileno
    MONTHLY: 17900,
    YEARLY: 14900 * 12,
  },
  COP: { // Colômbia - Peso Colombiano
    MONTHLY: 79900,
    YEARLY: 67900 * 12,
  },
  PEN: { // Peru - Sol Peruano
    MONTHLY: 69.90,
    YEARLY: 59.90 * 12,
  },
  UYU: { // Uruguai - Peso Uruguaio
    MONTHLY: 799,
    YEARLY: 679 * 12,
  },
  // América do Norte / Internacional (Stripe)
  USD: {
    MONTHLY: 49.90,
    YEARLY: 39.90 * 12, // ~20% desconto anual
  },
  CAD: {
    MONTHLY: 26.90,
    YEARLY: 22.90 * 12,
  },
  MXN: {
    MONTHLY: 349.00,
    YEARLY: 299.00 * 12,
  },
  // Europa
  EUR: {
    MONTHLY: 18.90,
    YEARLY: 15.90 * 12,
  },
  GBP: {
    MONTHLY: 15.90,
    YEARLY: 13.90 * 12,
  },
  CHF: {
    MONTHLY: 19.90,
    YEARLY: 16.90 * 12,
  },
  SEK: {
    MONTHLY: 199.00,
    YEARLY: 169.00 * 12,
  },
  NOK: {
    MONTHLY: 199.00,
    YEARLY: 169.00 * 12,
  },
  DKK: {
    MONTHLY: 139.00,
    YEARLY: 119.00 * 12,
  },
  PLN: {
    MONTHLY: 79.90,
    YEARLY: 67.90 * 12,
  },
  // Ásia-Pacífico
  AUD: {
    MONTHLY: 29.90,
    YEARLY: 25.90 * 12,
  },
  NZD: {
    MONTHLY: 32.90,
    YEARLY: 27.90 * 12,
  },
  JPY: {
    MONTHLY: 2900,
    YEARLY: 2490 * 12,
  },
  SGD: {
    MONTHLY: 26.90,
    YEARLY: 22.90 * 12,
  },
  HKD: {
    MONTHLY: 149.00,
    YEARLY: 129.00 * 12,
  },
};

@Injectable()
export class PaymentGatewayFactory {
  private readonly logger = new Logger(PaymentGatewayFactory.name);

  constructor(
    private asaasBillingService: AsaasBillingService,
    private stripeBillingService: StripeBillingService,
    private mercadoPagoBillingService: MercadoPagoBillingService,
  ) {}

  /**
   * Retorna o gateway apropriado para o pais
   */
  getGateway(country: string): IPaymentGateway {
    const gatewayType = getGatewayTypeForCountry(country);

    if (gatewayType === 'asaas') {
      return this.asaasBillingService as unknown as IPaymentGateway;
    }

    if (gatewayType === 'mercadopago') {
      return this.mercadoPagoBillingService;
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

      // Cartao de credito
      if (!creditCard || !holderInfo) {
        return {
          success: false,
          errorMessage: 'Dados do cartao sao obrigatorios',
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

    // America Latina - Mercado Pago
    if (gatewayType === 'mercadopago') {
      // Criar/atualizar cliente no Mercado Pago
      const customerResult = await this.mercadoPagoBillingService.createOrUpdateCustomer(customerData);
      if (!customerResult.success || !customerResult.customerId) {
        return {
          success: false,
          errorMessage: customerResult.errorMessage || 'Erro ao criar cliente',
          gateway: 'mercadopago',
          currency,
        };
      }

      // PIX nao disponivel fora do Brasil
      if (paymentMethod === 'PIX') {
        return {
          success: false,
          errorMessage: 'PIX esta disponivel apenas para clientes no Brasil. Use cartao de credito ou Mercado Pago Checkout.',
          gateway: 'mercadopago',
          currency,
        };
      }

      // Para Mercado Pago, recomendamos usar Checkout Pro
      // Retornar indicacao para usar o checkout
      return {
        success: false,
        errorMessage: 'Para pagamentos com Mercado Pago, use o Checkout Pro. Chame createMercadoPagoCheckoutSession().',
        gateway: 'mercadopago',
        currency,
      };
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
   * Suporta métodos de pagamento locais: OXXO (México), SEPA (Europa), iDEAL (Holanda), etc.
   */
  async createStripeCheckoutSession(
    userId: string,
    customerData: CustomerData,
    cycle: PaymentCycle,
    successUrl: string,
    cancelUrl: string,
  ): Promise<SubscriptionResult & { gateway: GatewayType; currency: string }> {
    const country = customerData.country || 'US';
    const currency = this.getCurrency(country);
    const amount = this.getPrice(currency, cycle);

    this.logger.log(
      `Creating Stripe checkout: user=${userId}, country=${country}, currency=${currency}, amount=${amount}`,
    );

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

    // Criar sessão de checkout com métodos de pagamento locais
    const result = await this.stripeBillingService.createCheckoutSession(
      userId,
      customerResult.customerId,
      priceId,
      successUrl,
      cancelUrl,
      country, // Passa o país para determinar métodos de pagamento locais
    );

    return { ...result, gateway: 'stripe', currency };
  }

  /**
   * Cria sessao de checkout do Mercado Pago (para clientes da America Latina)
   * Suporta metodos de pagamento locais por pais
   */
  async createMercadoPagoCheckoutSession(
    userId: string,
    customerData: CustomerData,
    cycle: PaymentCycle,
    successUrl: string,
    cancelUrl: string,
  ): Promise<SubscriptionResult & { gateway: GatewayType; currency: string }> {
    const country = customerData.country || 'AR';
    const currency = this.getCurrency(country);
    const amount = this.getPrice(currency, cycle);

    this.logger.log(
      `Creating Mercado Pago checkout: user=${userId}, country=${country}, currency=${currency}, amount=${amount}`,
    );

    // Criar cliente no Mercado Pago
    const customerResult = await this.mercadoPagoBillingService.createOrUpdateCustomer(customerData);
    if (!customerResult.success || !customerResult.customerId) {
      return {
        success: false,
        errorMessage: customerResult.errorMessage || 'Erro ao criar cliente',
        gateway: 'mercadopago',
        currency,
      };
    }

    // Criar sessao de checkout
    const result = await this.mercadoPagoBillingService.createCheckoutSession(
      userId,
      customerResult.customerId,
      `pro_${cycle.toLowerCase()}`, // priceId
      successUrl,
      cancelUrl,
      country,
    );

    return { ...result, gateway: 'mercadopago', currency };
  }

  /**
   * Retorna informacoes sobre metodos de pagamento disponiveis para o pais
   */
  getPaymentMethodsInfo(country: string): {
    gateway: GatewayType;
    currency: string;
    methods: string[];
    monthlyPrice: number;
    yearlyPrice: number;
  } {
    const gateway = this.getGatewayType(country);
    const currency = this.getCurrency(country);

    let methods: string[] = [];

    if (gateway === 'asaas') {
      methods = ['PIX', 'BOLETO', 'CREDIT_CARD'];
    } else if (gateway === 'mercadopago') {
      // Mercado Pago - metodos variam por pais
      const countryUpper = country.toUpperCase();
      const mpMethods = getMercadoPagoMethodsForCountry(countryUpper);

      methods = ['CREDIT_CARD', 'MERCADO_PAGO'];

      // Argentina
      if (mpMethods.rapipago) methods.push('RAPIPAGO');
      if (mpMethods.pagoFacil) methods.push('PAGO_FACIL');

      // Chile
      if (mpMethods.servipag) methods.push('SERVIPAG');
      if (mpMethods.webpay) methods.push('WEBPAY');

      // Colombia
      if (mpMethods.pse) methods.push('PSE');
      if (mpMethods.efecty) methods.push('EFECTY');

      // Peru
      if (mpMethods.pagoEfectivo) methods.push('PAGO_EFECTIVO');

      // Uruguay
      if (mpMethods.abitab) methods.push('ABITAB');
      if (mpMethods.redpagos) methods.push('REDPAGOS');
    } else {
      // Stripe - metodos variam por pais
      const countryUpper = country.toUpperCase();
      methods = ['CREDIT_CARD'];

      if (countryUpper === 'MX') {
        methods.push('OXXO');
      }
      if (['DE', 'FR', 'ES', 'IT', 'PT', 'NL', 'BE', 'AT'].includes(countryUpper)) {
        methods.push('SEPA_DEBIT');
      }
      if (countryUpper === 'NL') {
        methods.push('IDEAL');
      }
      if (countryUpper === 'BE') {
        methods.push('BANCONTACT');
      }
    }

    return {
      gateway,
      currency,
      methods,
      monthlyPrice: this.getPrice(currency, 'MONTHLY'),
      yearlyPrice: this.getPrice(currency, 'YEARLY'),
    };
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

    // Para Mercado Pago, verificar se temos mercadoPagoSubscriptionId
    const mpSubId = (subscription as any)?.mercadoPagoSubscriptionId;
    if (mpSubId) {
      return this.mercadoPagoBillingService.cancelSubscription(mpSubId);
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
