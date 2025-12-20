import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TemplateSettings } from '@prisma/client';

// Default template values
const DEFAULT_QUOTE_TEMPLATE = {
  quoteShowLogo: true,
  quoteLogoPosition: 'left',
  quotePrimaryColor: '#7C3AED',
  quoteSecondaryColor: '#6D28D9',
  quoteHeaderText: null,
  quoteFooterText: 'Obrigado pela preferência!',
  quoteDefaultMessage: 'Segue nosso orçamento conforme solicitado.',
  quoteTermsConditions: null,
  quoteShowSignature: false,
};

const DEFAULT_WORK_ORDER_TEMPLATE = {
  workOrderShowLogo: true,
  workOrderLogoPosition: 'left',
  workOrderPrimaryColor: '#7C3AED',
  workOrderLayout: 'detailed',
  workOrderShowChecklist: true,
  workOrderFooterText: null,
  workOrderShowSignatureField: true,
  workOrderSignatureLabel: 'Assinatura do Cliente',
};

const DEFAULT_CHARGE_TEMPLATE = {
  chargeWhatsappMessage: `Olá {nome_cliente}! 👋\n\nSegue sua cobrança:\n\n💰 *Valor:* {valor}\n📅 *Vencimento:* {data}\n\n🔗 *Link para pagamento:*\n{link_pagamento}\n\nQualquer dúvida, estou à disposição! 😊`,
  chargeEmailSubject: 'Cobrança - {valor}',
  chargeEmailBody: null,
  chargeReminderMessage: `Olá {nome_cliente}, lembramos que seu pagamento no valor de {valor} vence em {data}.\nSe já pagou, desconsidere esta mensagem.`,
};

// Interfaces for API responses
export interface QuoteTemplateResponse {
  showLogo: boolean;
  logoPosition: string;
  primaryColor: string;
  secondaryColor: string;
  headerText: string | null;
  footerText: string;
  defaultMessage: string;
  termsAndConditions: string | null;
  showSignature: boolean;
}

export interface WorkOrderTemplateResponse {
  showLogo: boolean;
  logoPosition: string;
  primaryColor: string;
  layout: string;
  showChecklist: boolean;
  footerText: string | null;
  showSignatureField: boolean;
  signatureLabel: string;
}

export interface ChargeTemplateResponse {
  whatsappMessage: string;
  emailSubject: string;
  emailBody: string | null;
  reminderMessage: string;
}

export interface TemplateSettingsResponse {
  quote: QuoteTemplateResponse;
  workOrder: WorkOrderTemplateResponse;
  charge: ChargeTemplateResponse;
}

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get template settings for a user (create default if not exists)
   */
  async getTemplateSettings(userId: string): Promise<TemplateSettingsResponse> {
    let settings = await this.prisma.templateSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await this.prisma.templateSettings.create({
        data: {
          userId,
          ...DEFAULT_QUOTE_TEMPLATE,
          ...DEFAULT_WORK_ORDER_TEMPLATE,
          ...DEFAULT_CHARGE_TEMPLATE,
        },
      });
    }

    return this.mapToResponse(settings);
  }

  /**
   * Get raw template settings for internal use (e.g., PDF generation)
   */
  async getRawTemplateSettings(userId: string): Promise<TemplateSettings | null> {
    let settings = await this.prisma.templateSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await this.prisma.templateSettings.create({
        data: {
          userId,
          ...DEFAULT_QUOTE_TEMPLATE,
          ...DEFAULT_WORK_ORDER_TEMPLATE,
          ...DEFAULT_CHARGE_TEMPLATE,
        },
      });
    }

    return settings;
  }

  /**
   * Update quote template
   */
  async updateQuoteTemplate(
    userId: string,
    data: Partial<QuoteTemplateResponse>,
  ): Promise<QuoteTemplateResponse> {
    const settings = await this.prisma.templateSettings.upsert({
      where: { userId },
      create: {
        userId,
        ...DEFAULT_QUOTE_TEMPLATE,
        ...DEFAULT_WORK_ORDER_TEMPLATE,
        ...DEFAULT_CHARGE_TEMPLATE,
        ...(data.showLogo !== undefined && { quoteShowLogo: data.showLogo }),
        ...(data.logoPosition && { quoteLogoPosition: data.logoPosition }),
        ...(data.primaryColor && { quotePrimaryColor: data.primaryColor }),
        ...(data.secondaryColor && { quoteSecondaryColor: data.secondaryColor }),
        ...(data.headerText !== undefined && { quoteHeaderText: data.headerText }),
        ...(data.footerText !== undefined && { quoteFooterText: data.footerText }),
        ...(data.defaultMessage !== undefined && { quoteDefaultMessage: data.defaultMessage }),
        ...(data.termsAndConditions !== undefined && { quoteTermsConditions: data.termsAndConditions }),
        ...(data.showSignature !== undefined && { quoteShowSignature: data.showSignature }),
      },
      update: {
        ...(data.showLogo !== undefined && { quoteShowLogo: data.showLogo }),
        ...(data.logoPosition && { quoteLogoPosition: data.logoPosition }),
        ...(data.primaryColor && { quotePrimaryColor: data.primaryColor }),
        ...(data.secondaryColor && { quoteSecondaryColor: data.secondaryColor }),
        ...(data.headerText !== undefined && { quoteHeaderText: data.headerText }),
        ...(data.footerText !== undefined && { quoteFooterText: data.footerText }),
        ...(data.defaultMessage !== undefined && { quoteDefaultMessage: data.defaultMessage }),
        ...(data.termsAndConditions !== undefined && { quoteTermsConditions: data.termsAndConditions }),
        ...(data.showSignature !== undefined && { quoteShowSignature: data.showSignature }),
      },
    });

    return this.mapQuoteTemplate(settings);
  }

  /**
   * Update work order template
   */
  async updateWorkOrderTemplate(
    userId: string,
    data: Partial<WorkOrderTemplateResponse>,
  ): Promise<WorkOrderTemplateResponse> {
    const settings = await this.prisma.templateSettings.upsert({
      where: { userId },
      create: {
        userId,
        ...DEFAULT_QUOTE_TEMPLATE,
        ...DEFAULT_WORK_ORDER_TEMPLATE,
        ...DEFAULT_CHARGE_TEMPLATE,
        ...(data.showLogo !== undefined && { workOrderShowLogo: data.showLogo }),
        ...(data.logoPosition && { workOrderLogoPosition: data.logoPosition }),
        ...(data.primaryColor && { workOrderPrimaryColor: data.primaryColor }),
        ...(data.layout && { workOrderLayout: data.layout }),
        ...(data.showChecklist !== undefined && { workOrderShowChecklist: data.showChecklist }),
        ...(data.footerText !== undefined && { workOrderFooterText: data.footerText }),
        ...(data.showSignatureField !== undefined && { workOrderShowSignatureField: data.showSignatureField }),
        ...(data.signatureLabel !== undefined && { workOrderSignatureLabel: data.signatureLabel }),
      },
      update: {
        ...(data.showLogo !== undefined && { workOrderShowLogo: data.showLogo }),
        ...(data.logoPosition && { workOrderLogoPosition: data.logoPosition }),
        ...(data.primaryColor && { workOrderPrimaryColor: data.primaryColor }),
        ...(data.layout && { workOrderLayout: data.layout }),
        ...(data.showChecklist !== undefined && { workOrderShowChecklist: data.showChecklist }),
        ...(data.footerText !== undefined && { workOrderFooterText: data.footerText }),
        ...(data.showSignatureField !== undefined && { workOrderShowSignatureField: data.showSignatureField }),
        ...(data.signatureLabel !== undefined && { workOrderSignatureLabel: data.signatureLabel }),
      },
    });

    return this.mapWorkOrderTemplate(settings);
  }

  /**
   * Update charge template
   */
  async updateChargeTemplate(
    userId: string,
    data: Partial<ChargeTemplateResponse>,
  ): Promise<ChargeTemplateResponse> {
    const settings = await this.prisma.templateSettings.upsert({
      where: { userId },
      create: {
        userId,
        ...DEFAULT_QUOTE_TEMPLATE,
        ...DEFAULT_WORK_ORDER_TEMPLATE,
        ...DEFAULT_CHARGE_TEMPLATE,
        ...(data.whatsappMessage && { chargeWhatsappMessage: data.whatsappMessage }),
        ...(data.emailSubject !== undefined && { chargeEmailSubject: data.emailSubject }),
        ...(data.emailBody !== undefined && { chargeEmailBody: data.emailBody }),
        ...(data.reminderMessage !== undefined && { chargeReminderMessage: data.reminderMessage }),
      },
      update: {
        ...(data.whatsappMessage && { chargeWhatsappMessage: data.whatsappMessage }),
        ...(data.emailSubject !== undefined && { chargeEmailSubject: data.emailSubject }),
        ...(data.emailBody !== undefined && { chargeEmailBody: data.emailBody }),
        ...(data.reminderMessage !== undefined && { chargeReminderMessage: data.reminderMessage }),
      },
    });

    return this.mapChargeTemplate(settings);
  }

  /**
   * Reset a template to default values
   */
  async resetTemplate(userId: string, type: 'quote' | 'workOrder' | 'charge'): Promise<void> {
    const updateData: any = {};

    switch (type) {
      case 'quote':
        Object.assign(updateData, DEFAULT_QUOTE_TEMPLATE);
        break;
      case 'workOrder':
        Object.assign(updateData, DEFAULT_WORK_ORDER_TEMPLATE);
        break;
      case 'charge':
        Object.assign(updateData, DEFAULT_CHARGE_TEMPLATE);
        break;
    }

    await this.prisma.templateSettings.upsert({
      where: { userId },
      create: {
        userId,
        ...DEFAULT_QUOTE_TEMPLATE,
        ...DEFAULT_WORK_ORDER_TEMPLATE,
        ...DEFAULT_CHARGE_TEMPLATE,
      },
      update: updateData,
    });
  }

  // ==================== MAPPING HELPERS ====================

  private mapToResponse(settings: TemplateSettings): TemplateSettingsResponse {
    return {
      quote: this.mapQuoteTemplate(settings),
      workOrder: this.mapWorkOrderTemplate(settings),
      charge: this.mapChargeTemplate(settings),
    };
  }

  private mapQuoteTemplate(settings: TemplateSettings): QuoteTemplateResponse {
    return {
      showLogo: settings.quoteShowLogo,
      logoPosition: settings.quoteLogoPosition,
      primaryColor: settings.quotePrimaryColor,
      secondaryColor: settings.quoteSecondaryColor,
      headerText: settings.quoteHeaderText,
      footerText: settings.quoteFooterText,
      defaultMessage: settings.quoteDefaultMessage,
      termsAndConditions: settings.quoteTermsConditions,
      showSignature: settings.quoteShowSignature,
    };
  }

  private mapWorkOrderTemplate(settings: TemplateSettings): WorkOrderTemplateResponse {
    return {
      showLogo: settings.workOrderShowLogo,
      logoPosition: settings.workOrderLogoPosition,
      primaryColor: settings.workOrderPrimaryColor,
      layout: settings.workOrderLayout,
      showChecklist: settings.workOrderShowChecklist,
      footerText: settings.workOrderFooterText,
      showSignatureField: settings.workOrderShowSignatureField,
      signatureLabel: settings.workOrderSignatureLabel,
    };
  }

  private mapChargeTemplate(settings: TemplateSettings): ChargeTemplateResponse {
    return {
      whatsappMessage: settings.chargeWhatsappMessage,
      emailSubject: settings.chargeEmailSubject,
      emailBody: settings.chargeEmailBody,
      reminderMessage: settings.chargeReminderMessage,
    };
  }
}
