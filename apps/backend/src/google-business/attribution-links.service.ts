import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAttributionLinkDto,
  UpdateAttributionLinkDto,
  AttributionLinkDto,
  AttributionLinkStatsDto,
} from './dto/attribution-link.dto';
import {
  AttributionLinkType,
  DemandEventSource,
  DemandActionType,
  DemandPeriodType,
  Prisma,
} from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class AttributionLinksService {
  private readonly logger = new Logger(AttributionLinksService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');
  }

  /**
   * Generate a unique slug
   */
  private generateSlug(): string {
    return crypto.randomBytes(4).toString('hex');
  }

  /**
   * Build tracking URL for a link
   */
  private buildTrackingUrl(slug: string): string {
    return `${this.baseUrl}/t/${slug}`;
  }

  /**
   * Create a new attribution link
   */
  async create(userId: string, dto: CreateAttributionLinkDto): Promise<AttributionLinkDto> {
    // Validate URL based on type
    if (dto.type === AttributionLinkType.WHATSAPP) {
      if (!dto.targetUrl.includes('wa.me') && !dto.targetUrl.includes('whatsapp')) {
        throw new BadRequestException('Invalid WhatsApp URL');
      }
    } else if (dto.type === AttributionLinkType.WEBSITE) {
      if (!dto.targetUrl.startsWith('http://') && !dto.targetUrl.startsWith('https://')) {
        throw new BadRequestException('Website URL must start with http:// or https://');
      }
    }

    // Generate or validate slug
    let slug = dto.customSlug?.toLowerCase().replace(/[^a-z0-9-]/g, '-') || this.generateSlug();

    // Check if slug is taken
    const existing = await this.prisma.attributionLink.findUnique({
      where: { slug },
    });

    if (existing) {
      if (dto.customSlug) {
        throw new ConflictException('This slug is already in use');
      }
      // Generate a new random slug
      slug = this.generateSlug();
    }

    const link = await this.prisma.attributionLink.create({
      data: {
        userId,
        slug,
        type: dto.type,
        targetUrl: dto.targetUrl,
      },
    });

    return {
      ...link,
      trackingUrl: this.buildTrackingUrl(link.slug),
    };
  }

  /**
   * Get all attribution links for a user
   */
  async findAll(userId: string): Promise<AttributionLinkDto[]> {
    const links = await this.prisma.attributionLink.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return links.map((link) => ({
      ...link,
      trackingUrl: this.buildTrackingUrl(link.slug),
    }));
  }

  /**
   * Get a single attribution link
   */
  async findOne(userId: string, id: string): Promise<AttributionLinkDto> {
    const link = await this.prisma.attributionLink.findFirst({
      where: { id, userId },
    });

    if (!link) {
      throw new NotFoundException('Attribution link not found');
    }

    return {
      ...link,
      trackingUrl: this.buildTrackingUrl(link.slug),
    };
  }

  /**
   * Update an attribution link
   */
  async update(userId: string, id: string, dto: UpdateAttributionLinkDto): Promise<AttributionLinkDto> {
    const link = await this.prisma.attributionLink.findFirst({
      where: { id, userId },
    });

    if (!link) {
      throw new NotFoundException('Attribution link not found');
    }

    const updated = await this.prisma.attributionLink.update({
      where: { id },
      data: dto,
    });

    return {
      ...updated,
      trackingUrl: this.buildTrackingUrl(updated.slug),
    };
  }

  /**
   * Delete an attribution link
   */
  async delete(userId: string, id: string): Promise<void> {
    const link = await this.prisma.attributionLink.findFirst({
      where: { id, userId },
    });

    if (!link) {
      throw new NotFoundException('Attribution link not found');
    }

    await this.prisma.attributionLink.delete({
      where: { id },
    });
  }

  /**
   * Track a click on an attribution link
   * This is called from the public redirect endpoint
   */
  async trackClick(
    slug: string,
    utmParams?: { source?: string; medium?: string; campaign?: string },
  ): Promise<{ targetUrl: string; type: AttributionLinkType }> {
    const link = await this.prisma.attributionLink.findUnique({
      where: { slug },
    });

    if (!link) {
      throw new NotFoundException('Link not found');
    }

    if (!link.isActive) {
      throw new BadRequestException('This link is no longer active');
    }

    // Increment click count
    await this.prisma.attributionLink.update({
      where: { id: link.id },
      data: {
        clickCount: { increment: 1 },
      },
    });

    // Create demand event for tracking
    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setHours(0, 0, 0, 0);
    const periodEnd = new Date(now);
    periodEnd.setHours(23, 59, 59, 999);

    const actionType =
      link.type === AttributionLinkType.WHATSAPP
        ? DemandActionType.WHATSAPP_CLICK
        : DemandActionType.SITE_CLICK;

    // Upsert demand event (idempotent for the day)
    await this.prisma.demandEvent.upsert({
      where: {
        userId_source_actionType_periodType_periodStart_periodEnd: {
          userId: link.userId,
          source: DemandEventSource.TRACKING_LINK,
          actionType,
          periodType: DemandPeriodType.DAY,
          periodStart,
          periodEnd,
        },
      },
      create: {
        userId: link.userId,
        source: DemandEventSource.TRACKING_LINK,
        actionType,
        occurredAt: now,
        periodType: DemandPeriodType.DAY,
        periodStart,
        periodEnd,
        value: 1,
        dimensions: utmParams ? { utm: utmParams } : Prisma.JsonNull,
        rawRef: slug,
      },
      update: {
        value: { increment: 1 },
      },
    });

    this.logger.log(`Click tracked for link ${slug} (${link.type})`);

    return {
      targetUrl: link.targetUrl,
      type: link.type,
    };
  }

  /**
   * Get click statistics for a link
   */
  async getStats(userId: string, id: string): Promise<AttributionLinkStatsDto> {
    const link = await this.prisma.attributionLink.findFirst({
      where: { id, userId },
    });

    if (!link) {
      throw new NotFoundException('Attribution link not found');
    }

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    const monthStart = new Date(now);
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const actionType =
      link.type === AttributionLinkType.WHATSAPP
        ? DemandActionType.WHATSAPP_CLICK
        : DemandActionType.SITE_CLICK;

    // Get events for this link
    const events = await this.prisma.demandEvent.findMany({
      where: {
        userId: link.userId,
        source: DemandEventSource.TRACKING_LINK,
        actionType,
        rawRef: link.slug,
        occurredAt: { gte: monthStart },
      },
      orderBy: { occurredAt: 'asc' },
    });

    // Calculate stats
    let clicksToday = 0;
    let clicksThisWeek = 0;
    let clicksThisMonth = 0;
    const dailyClicks: Record<string, number> = {};

    for (const event of events) {
      const dateStr = event.occurredAt.toISOString().split('T')[0];
      dailyClicks[dateStr] = (dailyClicks[dateStr] || 0) + event.value;

      clicksThisMonth += event.value;

      if (event.occurredAt >= weekStart) {
        clicksThisWeek += event.value;
      }

      if (event.occurredAt >= todayStart) {
        clicksToday += event.value;
      }
    }

    return {
      totalClicks: link.clickCount,
      clicksToday,
      clicksThisWeek,
      clicksThisMonth,
      dailyClicks: Object.entries(dailyClicks)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  /**
   * Get link by slug (public)
   */
  async findBySlug(slug: string): Promise<{ targetUrl: string; type: AttributionLinkType } | null> {
    const link = await this.prisma.attributionLink.findUnique({
      where: { slug },
      select: { targetUrl: true, type: true, isActive: true },
    });

    if (!link || !link.isActive) {
      return null;
    }

    return { targetUrl: link.targetUrl, type: link.type };
  }
}
