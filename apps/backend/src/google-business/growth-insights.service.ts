import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { GrowthInsightDto } from './dto/growth-insight.dto';
import {
  GrowthInsightType,
  GrowthInsightSeverity,
  DemandActionType,
  GoogleIntegrationStatus,
  QuoteStatus,
  Prisma,
} from '@prisma/client';

interface InsightRule {
  type: GrowthInsightType;
  check: (data: InsightData) => InsightResult | null;
}

interface InsightData {
  userId: string;
  currentWeek: MetricsSummary;
  previousWeek: MetricsSummary;
  currentMonth: MetricsSummary;
  quotesThisMonth: number;
  approvedQuotesThisMonth: number;
}

interface MetricsSummary {
  calls: number;
  routes: number;
  websiteClicks: number;
  whatsappClicks: number;
  profileViews: number;
  impressions: number;
  totalActions: number;
}

interface InsightResult {
  severity: GrowthInsightSeverity;
  title: string;
  description: string;
  recommendations: string[];
  metrics?: Record<string, number>;
  expiresAt?: Date;
}

@Injectable()
export class GrowthInsightsService {
  private readonly logger = new Logger(GrowthInsightsService.name);

  private readonly insightRules: InsightRule[] = [
    // Conversion drop alert
    {
      type: GrowthInsightType.CONVERSION_DROP,
      check: (data) => {
        const currentTotal = data.currentWeek.totalActions;
        const previousTotal = data.previousWeek.totalActions;

        if (previousTotal > 10 && currentTotal < previousTotal * 0.7) {
          const dropPercent = Math.round(((previousTotal - currentTotal) / previousTotal) * 100);
          return {
            severity: GrowthInsightSeverity.WARNING,
            title: 'Queda nas ações da semana',
            description: `Suas ações caíram ${dropPercent}% em relação à semana anterior. Isso pode indicar menor visibilidade no Google.`,
            recommendations: [
              'Verifique se seu perfil do Google Meu Negócio está atualizado',
              'Responda às avaliações pendentes',
              'Adicione fotos recentes do seu negócio',
              'Atualize o horário de funcionamento se necessário',
            ],
            metrics: {
              currentValue: currentTotal,
              previousValue: previousTotal,
              dropPercent,
            },
            expiresAt: this.getWeekEnd(),
          };
        }
        return null;
      },
    },

    // Action spike (positive)
    {
      type: GrowthInsightType.ACTION_SPIKE,
      check: (data) => {
        const currentTotal = data.currentWeek.totalActions;
        const previousTotal = data.previousWeek.totalActions;

        if (previousTotal > 5 && currentTotal > previousTotal * 1.5) {
          const increasePercent = Math.round(((currentTotal - previousTotal) / previousTotal) * 100);
          return {
            severity: GrowthInsightSeverity.SUCCESS,
            title: 'Aumento nas ações!',
            description: `Parabéns! Suas ações aumentaram ${increasePercent}% esta semana. Continue assim!`,
            recommendations: [
              'Mantenha seu perfil atualizado',
              'Continue respondendo às avaliações rapidamente',
              'Considere investir em mais conteúdo visual',
            ],
            metrics: {
              currentValue: currentTotal,
              previousValue: previousTotal,
              increasePercent,
            },
            expiresAt: this.getWeekEnd(),
          };
        }
        return null;
      },
    },

    // Low conversion rate
    {
      type: GrowthInsightType.LOW_CONVERSION_RATE,
      check: (data) => {
        const { impressions, totalActions } = data.currentMonth;
        if (impressions > 100 && totalActions > 0) {
          const conversionRate = (totalActions / impressions) * 100;
          if (conversionRate < 2) {
            return {
              severity: GrowthInsightSeverity.WARNING,
              title: 'Taxa de conversão baixa',
              description: `Apenas ${conversionRate.toFixed(1)}% das pessoas que veem seu perfil tomam uma ação. A média do setor é 5%.`,
              recommendations: [
                'Adicione mais fotos atraentes do seu trabalho',
                'Complete todas as informações do perfil',
                'Adicione ofertas ou promoções especiais',
                'Peça para clientes satisfeitos deixarem avaliações',
              ],
              metrics: {
                impressions,
                actions: totalActions,
                conversionRate: Math.round(conversionRate * 100) / 100,
              },
              expiresAt: this.getMonthEnd(),
            };
          }
        }
        return null;
      },
    },

    // Channel comparison
    {
      type: GrowthInsightType.CHANNEL_COMPARISON,
      check: (data) => {
        const { calls, whatsappClicks, routes } = data.currentMonth;
        const total = calls + whatsappClicks + routes;

        if (total > 20) {
          const dominant = Math.max(calls, whatsappClicks, routes);
          let channel = '';
          let recommendation = '';

          if (dominant === calls) {
            channel = 'Ligações';
            recommendation = 'Considere adicionar um link de WhatsApp para captar mais leads';
          } else if (dominant === whatsappClicks) {
            channel = 'WhatsApp';
            recommendation = 'Seu WhatsApp está performando bem! Mantenha respostas rápidas';
          } else {
            channel = 'Rotas';
            recommendation = 'Muitas pessoas querem ir até você! Garanta que o endereço está correto';
          }

          const percentage = Math.round((dominant / total) * 100);

          return {
            severity: GrowthInsightSeverity.INFO,
            title: `${channel} é seu canal principal`,
            description: `${percentage}% das ações vêm de ${channel.toLowerCase()}. ${recommendation}`,
            recommendations: [recommendation],
            metrics: {
              calls,
              whatsappClicks,
              routes,
              dominantChannel: dominant,
            },
            expiresAt: this.getMonthEnd(),
          };
        }
        return null;
      },
    },

    // Weekly summary
    {
      type: GrowthInsightType.WEEKLY_SUMMARY,
      check: (data) => {
        const { calls, routes, whatsappClicks, websiteClicks, impressions } = data.currentWeek;
        const totalActions = calls + routes + whatsappClicks + websiteClicks;

        if (impressions > 0 || totalActions > 0) {
          return {
            severity: GrowthInsightSeverity.INFO,
            title: 'Resumo da semana',
            description: `Esta semana: ${impressions} impressões, ${totalActions} ações (${calls} ligações, ${whatsappClicks} WhatsApp, ${routes} rotas).`,
            recommendations: [],
            metrics: {
              impressions,
              totalActions,
              calls,
              routes,
              whatsappClicks,
              websiteClicks,
            },
            expiresAt: this.getWeekEnd(),
          };
        }
        return null;
      },
    },
  ];

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cron job to generate insights weekly on Mondays at 8 AM
   */
  @Cron(CronExpression.EVERY_WEEK)
  async generateInsightsForAllUsers(): Promise<void> {
    this.logger.log('Starting weekly insights generation');

    const integrations = await this.prisma.googleIntegration.findMany({
      where: {
        status: GoogleIntegrationStatus.CONNECTED,
      },
      select: { userId: true },
    });

    for (const integration of integrations) {
      try {
        await this.generateInsights(integration.userId);
      } catch (error) {
        this.logger.error(`Failed to generate insights for user ${integration.userId}: ${error.message}`);
      }
    }

    this.logger.log('Finished weekly insights generation');
  }

  /**
   * Generate insights for a specific user
   */
  async generateInsights(userId: string): Promise<void> {
    const data = await this.gatherInsightData(userId);

    for (const rule of this.insightRules) {
      const result = rule.check(data);
      if (result) {
        // Check if similar insight already exists (not dismissed)
        const existing = await this.prisma.growthInsight.findFirst({
          where: {
            userId,
            type: rule.type,
            isDismissed: false,
            createdAt: {
              gte: this.getWeekStart(),
            },
          },
        });

        if (!existing) {
          await this.prisma.growthInsight.create({
            data: {
              userId,
              type: rule.type,
              severity: result.severity,
              title: result.title,
              description: result.description,
              recommendations: result.recommendations,
              metrics: result.metrics || Prisma.JsonNull,
              expiresAt: result.expiresAt,
            },
          });

          this.logger.log(`Created ${rule.type} insight for user ${userId}`);
        }
      }
    }
  }

  /**
   * Gather data needed for insight rules
   */
  private async gatherInsightData(userId: string): Promise<InsightData> {
    const now = new Date();
    const weekStart = this.getWeekStart();
    const previousWeekStart = new Date(weekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [currentWeekEvents, previousWeekEvents, monthEvents, quotes] = await Promise.all([
      this.getMetricsSummary(userId, weekStart, now),
      this.getMetricsSummary(userId, previousWeekStart, weekStart),
      this.getMetricsSummary(userId, monthStart, now),
      this.prisma.quote.findMany({
        where: {
          userId,
          createdAt: { gte: monthStart },
        },
        select: { status: true },
      }),
    ]);

    return {
      userId,
      currentWeek: currentWeekEvents,
      previousWeek: previousWeekEvents,
      currentMonth: monthEvents,
      quotesThisMonth: quotes.length,
      approvedQuotesThisMonth: quotes.filter((q) => q.status === QuoteStatus.APPROVED).length,
    };
  }

  /**
   * Get metrics summary for a period
   */
  private async getMetricsSummary(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<MetricsSummary> {
    const result = await this.prisma.demandEvent.groupBy({
      by: ['actionType'],
      where: {
        userId,
        occurredAt: { gte: startDate, lte: endDate },
      },
      _sum: { value: true },
    });

    const metrics: Record<string, number> = {};
    for (const row of result) {
      metrics[row.actionType] = row._sum.value || 0;
    }

    const calls = metrics[DemandActionType.CALL] || 0;
    const routes = metrics[DemandActionType.ROUTE] || 0;
    const websiteClicks = (metrics[DemandActionType.WEBSITE_CLICK] || 0) + (metrics[DemandActionType.SITE_CLICK] || 0);
    const whatsappClicks = metrics[DemandActionType.WHATSAPP_CLICK] || 0;

    return {
      calls,
      routes,
      websiteClicks,
      whatsappClicks,
      profileViews: metrics[DemandActionType.PROFILE_VIEW] || 0,
      impressions: (metrics[DemandActionType.SEARCH_IMPRESSION] || 0) + (metrics[DemandActionType.MAPS_IMPRESSION] || 0),
      totalActions: calls + routes + websiteClicks + whatsappClicks,
    };
  }

  /**
   * Get active (non-expired, non-dismissed) insights for a user
   */
  async getActiveInsights(userId: string): Promise<GrowthInsightDto[]> {
    const insights = await this.prisma.growthInsight.findMany({
      where: {
        userId,
        isDismissed: false,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: [
        { isRead: 'asc' },
        { severity: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 10,
    });

    return insights.map((insight) => ({
      id: insight.id,
      type: insight.type,
      severity: insight.severity,
      title: insight.title,
      description: insight.description,
      recommendations: insight.recommendations as string[],
      metrics: insight.metrics as Record<string, number> | undefined,
      isRead: insight.isRead,
      createdAt: insight.createdAt,
      expiresAt: insight.expiresAt || undefined,
    }));
  }

  /**
   * Mark an insight as read
   */
  async markAsRead(userId: string, insightId: string): Promise<void> {
    const insight = await this.prisma.growthInsight.findFirst({
      where: { id: insightId, userId },
    });

    if (!insight) {
      throw new NotFoundException('Insight not found');
    }

    await this.prisma.growthInsight.update({
      where: { id: insightId },
      data: { isRead: true },
    });
  }

  /**
   * Dismiss an insight
   */
  async dismiss(userId: string, insightId: string): Promise<void> {
    const insight = await this.prisma.growthInsight.findFirst({
      where: { id: insightId, userId },
    });

    if (!insight) {
      throw new NotFoundException('Insight not found');
    }

    await this.prisma.growthInsight.update({
      where: { id: insightId },
      data: { isDismissed: true },
    });
  }

  /**
   * Get count of unread insights
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.growthInsight.count({
      where: {
        userId,
        isRead: false,
        isDismissed: false,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });
  }

  // Utility functions
  private getWeekStart(): Date {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const weekStart = new Date(now.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  }

  private getWeekEnd(): Date {
    const weekStart = this.getWeekStart();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    return weekEnd;
  }

  private getMonthEnd(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }
}
