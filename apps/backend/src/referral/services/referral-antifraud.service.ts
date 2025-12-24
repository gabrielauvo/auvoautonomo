import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReferralAuditService } from './referral-audit.service';

export interface FraudCheckResult {
  passed: boolean;
  flags: string[];
  blocked: boolean;
  reason?: string;
}

@Injectable()
export class ReferralAntifraudService {
  private readonly logger = new Logger(ReferralAntifraudService.name);

  constructor(
    private prisma: PrismaService,
    private auditService: ReferralAuditService,
  ) {}

  /**
   * Verifica se há sinais de fraude na atribuição
   */
  async checkAttribution(params: {
    referrerUserId: string;
    refereeUserId: string;
    refereeEmail: string;
    deviceIdHash?: string;
    ipHash?: string;
  }): Promise<FraudCheckResult> {
    const flags: string[] = [];
    let blocked = false;

    // 1. Auto-indicação (mesmo usuário)
    if (params.referrerUserId === params.refereeUserId) {
      flags.push('SELF_REFERRAL');
      blocked = true;
    }

    // 2. Mesmo email (variações)
    const referrer = await this.prisma.user.findUnique({
      where: { id: params.referrerUserId },
      select: { email: true },
    });

    if (referrer) {
      const normalizedReferrerEmail = this.normalizeEmail(referrer.email);
      const normalizedRefereeEmail = this.normalizeEmail(params.refereeEmail);

      if (normalizedReferrerEmail === normalizedRefereeEmail) {
        flags.push('SAME_EMAIL_NORMALIZED');
        blocked = true;
      }
    }

    // 3. Device já usado pelo referrer
    if (params.deviceIdHash) {
      const referrerDevices = await this.prisma.device.findMany({
        where: { userId: params.referrerUserId },
        select: { id: true },
      });

      // Verifica se o device do referee já foi usado pelo referrer
      // (isso requer que guardemos um hash do device nos installs)
      const existingInstall = await this.prisma.referralInstall.findFirst({
        where: { deviceIdHash: params.deviceIdHash },
      });

      if (existingInstall) {
        // Verifica se esse device já foi usado em outra atribuição
        const existingReferral = await this.prisma.referral.findFirst({
          where: {
            refereeUserId: { not: params.refereeUserId },
          },
          include: {
            click: {
              include: {
                install: true,
              },
            },
          },
        });

        if (existingReferral?.click?.install?.deviceIdHash === params.deviceIdHash) {
          flags.push('DEVICE_ALREADY_USED');
        }
      }
    }

    // 4. Velocidade suspeita - muitas indicações em pouco tempo
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const recentConversions = await this.prisma.referral.count({
      where: {
        referrerUserId: params.referrerUserId,
        createdAt: { gte: oneDayAgo },
        status: { in: ['SIGNUP_COMPLETE', 'SUBSCRIPTION_PAID'] },
      },
    });

    if (recentConversions >= 5) {
      flags.push('HIGH_VELOCITY');
    }

    // 5. Mesmo IP recente
    if (params.ipHash) {
      const recentClicksSameIp = await this.prisma.referralClick.count({
        where: {
          ipHash: params.ipHash,
          converted: true,
          createdAt: { gte: oneDayAgo },
        },
      });

      if (recentClicksSameIp >= 3) {
        flags.push('MULTIPLE_CONVERSIONS_SAME_IP');
      }
    }

    // Log de auditoria
    if (flags.length > 0) {
      await this.auditService.log({
        action: 'fraud_check',
        entityType: 'referral',
        entityId: `${params.referrerUserId}-${params.refereeUserId}`,
        userId: params.refereeUserId,
        decision: blocked ? 'BLOCKED' : 'FLAGGED',
        reason: flags.join(', '),
        metadata: { flags, blocked },
      });

      this.logger.warn(
        `Fraud check: ${flags.join(', ')} for referrer ${params.referrerUserId}, referee ${params.refereeUserId}`,
      );
    }

    return {
      passed: flags.length === 0,
      flags,
      blocked,
      reason: blocked ? `Blocked due to: ${flags.join(', ')}` : undefined,
    };
  }

  /**
   * Verifica fraude no momento do pagamento
   */
  async checkPayment(params: {
    referralId: string;
    refereeUserId: string;
    cardLastFour?: string;
    cardFingerprint?: string;
  }): Promise<FraudCheckResult> {
    const flags: string[] = [];
    let blocked = false;

    // 1. Mesmo cartão usado por outro usuário
    if (params.cardLastFour || params.cardFingerprint) {
      // Busca outros pagamentos com mesmo cartão
      const otherPayments = await this.prisma.subscriptionPaymentHistory.findMany({
        where: {
          status: { in: ['CONFIRMED', 'RECEIVED'] },
          subscription: {
            userId: { not: params.refereeUserId },
          },
        },
        include: {
          subscription: true,
        },
        take: 100,
      });

      // Se temos cartão do referrer, verificamos
      const referral = await this.prisma.referral.findUnique({
        where: { id: params.referralId },
        include: {
          referrerUser: {
            include: {
              subscription: true,
            },
          },
        },
      });

      if (referral?.referrerUser?.subscription?.creditCardLastFour === params.cardLastFour) {
        flags.push('SAME_CARD_AS_REFERRER');
        blocked = true;
      }
    }

    // Log de auditoria
    if (flags.length > 0) {
      await this.auditService.log({
        action: 'fraud_check_payment',
        entityType: 'referral',
        entityId: params.referralId,
        userId: params.refereeUserId,
        decision: blocked ? 'BLOCKED' : 'FLAGGED',
        reason: flags.join(', '),
        metadata: { flags, blocked },
      });
    }

    return {
      passed: flags.length === 0,
      flags,
      blocked,
      reason: blocked ? `Blocked due to: ${flags.join(', ')}` : undefined,
    };
  }

  /**
   * Normaliza email (remove dots do gmail, lowercase, etc)
   */
  private normalizeEmail(email: string): string {
    const [local, domain] = email.toLowerCase().split('@');

    // Remove dots e tudo após + no Gmail
    if (domain === 'gmail.com' || domain === 'googlemail.com') {
      const cleanLocal = local.replace(/\./g, '').split('+')[0];
      return `${cleanLocal}@gmail.com`;
    }

    return email.toLowerCase();
  }
}
