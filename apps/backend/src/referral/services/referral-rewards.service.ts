import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ReferralStatus,
  ReferralRewardReason,
  ReferralRewardStatus,
} from '@prisma/client';
import { ReferralAuditService } from './referral-audit.service';
import { ReferralAntifraudService } from './referral-antifraud.service';

const MILESTONE_TARGET = 10;
const MILESTONE_REWARD_MONTHS = 12;
const SINGLE_REFERRAL_MONTHS = 1;

@Injectable()
export class ReferralRewardsService {
  private readonly logger = new Logger(ReferralRewardsService.name);

  constructor(
    private prisma: PrismaService,
    private auditService: ReferralAuditService,
    private antifraudService: ReferralAntifraudService,
  ) {}

  /**
   * Processa o pagamento de um referee e credita recompensa ao referrer
   */
  async processSubscriptionPaid(params: {
    refereeUserId: string;
    paymentId: string;
    cardLastFour?: string;
    cardFingerprint?: string;
  }): Promise<{
    rewarded: boolean;
    monthsCredited?: number;
    milestoneReached?: boolean;
  }> {
    // Busca o referral do usuário
    const referral = await this.prisma.referral.findUnique({
      where: { refereeUserId: params.refereeUserId },
      include: {
        referrerUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!referral) {
      this.logger.debug(`No referral found for user ${params.refereeUserId}`);
      return { rewarded: false };
    }

    // Verifica se já foi creditado
    if (referral.rewardCredited) {
      this.logger.debug(`Referral ${referral.id} already rewarded`);
      return { rewarded: false };
    }

    // Verifica fraude no pagamento
    const fraudCheck = await this.antifraudService.checkPayment({
      referralId: referral.id,
      refereeUserId: params.refereeUserId,
      cardLastFour: params.cardLastFour,
      cardFingerprint: params.cardFingerprint,
    });

    if (fraudCheck.blocked) {
      await this.prisma.referral.update({
        where: { id: referral.id },
        data: {
          status: ReferralStatus.FRAUDULENT,
          fraudFlags: { push: fraudCheck.flags },
        },
      });

      await this.auditService.log({
        action: 'reward_blocked',
        entityType: 'referral',
        entityId: referral.id,
        userId: referral.referrerUserId,
        decision: 'FRAUD_BLOCKED',
        reason: fraudCheck.reason,
        metadata: { flags: fraudCheck.flags },
      });

      return { rewarded: false };
    }

    // Atualiza status do referral
    await this.prisma.referral.update({
      where: { id: referral.id },
      data: {
        status: ReferralStatus.SUBSCRIPTION_PAID,
        subscriptionPaidAt: new Date(),
        rewardCredited: true,
        fraudFlags: fraudCheck.flags.length > 0 ? { push: fraudCheck.flags } : undefined,
      },
    });

    // Credita 1 mês
    await this.creditReward({
      userId: referral.referrerUserId,
      referralId: referral.id,
      months: SINGLE_REFERRAL_MONTHS,
      reason: ReferralRewardReason.SINGLE_REFERRAL,
      idempotencyKey: `single_${referral.id}`,
    });

    // Verifica milestone de 10 indicações
    const milestoneReached = await this.checkAndCreditMilestone(referral.referrerUserId);

    await this.auditService.log({
      action: 'reward_credited',
      entityType: 'referral',
      entityId: referral.id,
      userId: referral.referrerUserId,
      decision: 'SUCCESS',
      metadata: {
        months: SINGLE_REFERRAL_MONTHS,
        milestoneReached,
        paymentId: params.paymentId,
      },
    });

    this.logger.log(
      `Reward credited: ${SINGLE_REFERRAL_MONTHS} month(s) to user ${referral.referrerUserId} ` +
      `for referral ${referral.id}. Milestone: ${milestoneReached}`,
    );

    return {
      rewarded: true,
      monthsCredited: SINGLE_REFERRAL_MONTHS + (milestoneReached ? MILESTONE_REWARD_MONTHS : 0),
      milestoneReached,
    };
  }

  /**
   * Processa chargeback/cancelamento - reverte recompensa
   */
  async processChargeback(params: {
    refereeUserId: string;
    reason: string;
  }): Promise<void> {
    const referral = await this.prisma.referral.findUnique({
      where: { refereeUserId: params.refereeUserId },
    });

    if (!referral || !referral.rewardCredited) {
      return;
    }

    // Marca referral como fraudulento
    await this.prisma.referral.update({
      where: { id: referral.id },
      data: {
        status: ReferralStatus.FRAUDULENT,
        fraudFlags: { push: 'CHARGEBACK' },
      },
    });

    // Reverte recompensas
    await this.prisma.referralReward.updateMany({
      where: {
        referralId: referral.id,
        status: { in: [ReferralRewardStatus.PENDING, ReferralRewardStatus.APPLIED] },
      },
      data: {
        status: ReferralRewardStatus.REVERSED,
        reversedAt: new Date(),
        reversalReason: params.reason,
      },
    });

    // Cria entrada negativa no ledger
    await this.creditReward({
      userId: referral.referrerUserId,
      referralId: referral.id,
      months: -SINGLE_REFERRAL_MONTHS,
      reason: ReferralRewardReason.REVERSAL,
      idempotencyKey: `reversal_${referral.id}_${Date.now()}`,
    });

    await this.auditService.log({
      action: 'reward_reversed',
      entityType: 'referral',
      entityId: referral.id,
      userId: referral.referrerUserId,
      decision: 'CHARGEBACK',
      reason: params.reason,
    });

    this.logger.warn(`Reward reversed for referral ${referral.id} due to chargeback`);
  }

  /**
   * Obtém estatísticas de referral do usuário
   */
  async getStats(userId: string): Promise<{
    totalClicks: number;
    totalSignups: number;
    totalPaid: number;
    monthsEarned: number;
    pendingMonths: number;
    currentMilestoneProgress: number;
  }> {
    // Total de cliques
    const clicksCount = await this.prisma.referralClick.count({
      where: { code: { userId } },
    });

    // Referrals por status
    const referralStats = await this.prisma.referral.groupBy({
      by: ['status'],
      where: { referrerUserId: userId },
      _count: true,
    });

    const signups = referralStats
      .filter((s) =>
        s.status === ReferralStatus.SIGNUP_COMPLETE ||
        s.status === ReferralStatus.SUBSCRIPTION_PAID,
      )
      .reduce((sum, s) => sum + s._count, 0);

    const paid = referralStats
      .filter((s) => s.status === ReferralStatus.SUBSCRIPTION_PAID)
      .reduce((sum, s) => sum + s._count, 0);

    // Recompensas
    const rewards = await this.prisma.referralReward.aggregate({
      where: {
        userId,
        status: { in: [ReferralRewardStatus.APPLIED, ReferralRewardStatus.PENDING] },
      },
      _sum: { monthsCredited: true },
    });

    const pendingRewards = await this.prisma.referralReward.aggregate({
      where: {
        userId,
        status: ReferralRewardStatus.PENDING,
      },
      _sum: { monthsCredited: true },
    });

    return {
      totalClicks: clicksCount,
      totalSignups: signups,
      totalPaid: paid,
      monthsEarned: rewards._sum.monthsCredited || 0,
      pendingMonths: pendingRewards._sum.monthsCredited || 0,
      currentMilestoneProgress: paid % MILESTONE_TARGET,
    };
  }

  /**
   * Obtém histórico de indicações recentes
   */
  async getRecentReferrals(userId: string, limit: number = 10) {
    const referrals = await this.prisma.referral.findMany({
      where: { referrerUserId: userId },
      include: {
        refereeUser: {
          select: {
            name: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return referrals.map((r) => ({
      id: r.id,
      name: this.maskName(r.refereeUser.name),
      status: r.status,
      date: r.createdAt,
    }));
  }

  /**
   * Obtém histórico de recompensas
   */
  async getRewardsHistory(userId: string, limit: number = 20) {
    return this.prisma.referralReward.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        monthsCredited: true,
        reason: true,
        status: true,
        createdAt: true,
        appliedAt: true,
      },
    });
  }

  /**
   * Aplica créditos pendentes à assinatura
   */
  async applyPendingCredits(userId: string): Promise<number> {
    const pendingRewards = await this.prisma.referralReward.findMany({
      where: {
        userId,
        status: ReferralRewardStatus.PENDING,
      },
    });

    if (pendingRewards.length === 0) {
      return 0;
    }

    const totalMonths = pendingRewards.reduce(
      (sum, r) => sum + r.monthsCredited,
      0,
    );

    // Busca a assinatura do usuário
    const subscription = await this.prisma.userSubscription.findUnique({
      where: { userId },
    });

    if (!subscription || !subscription.currentPeriodEnd) {
      this.logger.warn(`No active subscription for user ${userId} to apply credits`);
      return 0;
    }

    // Estende a data de renovação
    const newEndDate = new Date(subscription.currentPeriodEnd);
    newEndDate.setMonth(newEndDate.getMonth() + totalMonths);

    await this.prisma.userSubscription.update({
      where: { userId },
      data: { currentPeriodEnd: newEndDate },
    });

    // Marca recompensas como aplicadas
    await this.prisma.referralReward.updateMany({
      where: {
        id: { in: pendingRewards.map((r) => r.id) },
      },
      data: {
        status: ReferralRewardStatus.APPLIED,
        appliedAt: new Date(),
      },
    });

    await this.auditService.log({
      action: 'credits_applied',
      entityType: 'subscription',
      entityId: subscription.id,
      userId,
      decision: 'SUCCESS',
      metadata: {
        monthsApplied: totalMonths,
        newEndDate,
        rewardIds: pendingRewards.map((r) => r.id),
      },
    });

    this.logger.log(
      `Applied ${totalMonths} credit months to user ${userId}. New end date: ${newEndDate}`,
    );

    return totalMonths;
  }

  // === Private Methods ===

  private async creditReward(params: {
    userId: string;
    referralId: string;
    months: number;
    reason: ReferralRewardReason;
    idempotencyKey: string;
  }): Promise<void> {
    // Verifica idempotência
    const existing = await this.prisma.referralReward.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
    });

    if (existing) {
      this.logger.debug(`Reward already exists for key ${params.idempotencyKey}`);
      return;
    }

    await this.prisma.referralReward.create({
      data: {
        userId: params.userId,
        referralId: params.referralId,
        monthsCredited: params.months,
        reason: params.reason,
        idempotencyKey: params.idempotencyKey,
        status: ReferralRewardStatus.PENDING,
      },
    });
  }

  private async checkAndCreditMilestone(userId: string): Promise<boolean> {
    // Conta quantos referrals pagos o usuário tem
    const paidCount = await this.prisma.referral.count({
      where: {
        referrerUserId: userId,
        status: ReferralStatus.SUBSCRIPTION_PAID,
      },
    });

    // Verifica se atingiu milestone (múltiplo de 10)
    if (paidCount > 0 && paidCount % MILESTONE_TARGET === 0) {
      const milestoneNumber = Math.floor(paidCount / MILESTONE_TARGET);
      const idempotencyKey = `milestone_${userId}_${milestoneNumber}`;

      // Verifica se já creditou este milestone
      const existing = await this.prisma.referralReward.findUnique({
        where: { idempotencyKey },
      });

      if (!existing) {
        await this.prisma.referralReward.create({
          data: {
            userId,
            monthsCredited: MILESTONE_REWARD_MONTHS,
            reason: ReferralRewardReason.MILESTONE_10,
            idempotencyKey,
            status: ReferralRewardStatus.PENDING,
          },
        });

        await this.auditService.log({
          action: 'milestone_reached',
          entityType: 'user',
          entityId: userId,
          userId,
          decision: 'CREDITED',
          metadata: {
            milestone: milestoneNumber,
            paidCount,
            monthsCredited: MILESTONE_REWARD_MONTHS,
          },
        });

        this.logger.log(
          `Milestone ${milestoneNumber} reached for user ${userId}! ` +
          `Credited ${MILESTONE_REWARD_MONTHS} months`,
        );

        return true;
      }
    }

    return false;
  }

  private maskName(name: string | null): string {
    if (!name) return 'Usuário';

    const parts = name.split(' ');
    if (parts.length === 1) {
      return parts[0].charAt(0) + '***';
    }

    return parts[0] + ' ' + parts[parts.length - 1].charAt(0) + '.';
  }
}
