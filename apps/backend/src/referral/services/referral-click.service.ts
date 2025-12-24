import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReferralPlatform } from '@prisma/client';
import { createHash } from 'crypto';
import { ReferralCodeService } from './referral-code.service';
import { ReferralAuditService } from './referral-audit.service';

@Injectable()
export class ReferralClickService {
  private readonly logger = new Logger(ReferralClickService.name);
  private readonly CLICK_EXPIRY_DAYS = 30;

  constructor(
    private prisma: PrismaService,
    private codeService: ReferralCodeService,
    private auditService: ReferralAuditService,
  ) {}

  /**
   * Registra um clique no link de referral
   */
  async registerClick(
    code: string,
    ip: string,
    userAgent: string | undefined,
    referer: string | undefined,
  ): Promise<{
    clickId: string;
    platform: ReferralPlatform;
    referrerName: string;
    fingerprintHash: string;
  } | null> {
    // Valida o código
    const validation = await this.codeService.validateCode(code);
    if (!validation.valid || !validation.codeId) {
      this.logger.warn(`Invalid referral code attempted: ${code}`);
      return null;
    }

    // Detecta plataforma
    const platform = this.detectPlatform(userAgent);

    // Gera fingerprint para iOS deferred deep link
    const fingerprintHash = this.generateFingerprint(ip, userAgent);

    // Hash do IP para privacidade
    const ipHash = this.hashIp(ip);

    // Data de expiração (30 dias)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.CLICK_EXPIRY_DAYS);

    // Cria o registro de clique
    const click = await this.prisma.referralClick.create({
      data: {
        codeId: validation.codeId,
        ipHash,
        userAgent: userAgent?.substring(0, 500), // Limita tamanho
        platformGuess: platform,
        fingerprintHash,
        referer: referer?.substring(0, 500),
        expiresAt,
      },
    });

    // Audit log
    await this.auditService.log({
      action: 'click_registered',
      entityType: 'click',
      entityId: click.id,
      decision: 'created',
      metadata: { code, platform },
      ipHash,
      userAgent,
    });

    this.logger.log(`Click registered: ${click.clickId} for code ${code} (${platform})`);

    return {
      clickId: click.clickId,
      platform,
      referrerName: validation.referrerFirstName || 'Usuário',
      fingerprintHash,
    };
  }

  /**
   * Busca um clique pelo clickId
   */
  async findByClickId(clickId: string) {
    return this.prisma.referralClick.findUnique({
      where: { clickId },
      include: {
        code: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Busca cliques recentes por fingerprint (para iOS deferred)
   */
  async findByFingerprint(fingerprintHash: string, maxAgeDays: number = 7) {
    const minDate = new Date();
    minDate.setDate(minDate.getDate() - maxAgeDays);

    return this.prisma.referralClick.findFirst({
      where: {
        fingerprintHash,
        converted: false,
        expiresAt: { gt: new Date() },
        createdAt: { gt: minDate },
      },
      include: {
        code: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Marca um clique como convertido
   */
  async markAsConverted(clickId: string) {
    await this.prisma.referralClick.update({
      where: { clickId },
      data: {
        converted: true,
        convertedAt: new Date(),
      },
    });
  }

  /**
   * Detecta a plataforma pelo User-Agent
   */
  private detectPlatform(userAgent?: string): ReferralPlatform {
    if (!userAgent) return ReferralPlatform.UNKNOWN;

    const ua = userAgent.toLowerCase();

    if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) {
      return ReferralPlatform.IOS;
    }

    if (ua.includes('android')) {
      return ReferralPlatform.ANDROID;
    }

    if (
      ua.includes('windows') ||
      ua.includes('macintosh') ||
      ua.includes('linux')
    ) {
      return ReferralPlatform.WEB;
    }

    return ReferralPlatform.UNKNOWN;
  }

  /**
   * Gera fingerprint para matching iOS deferred deep link
   * Usa: prefixo do IP (sem último octeto) + User-Agent + bucket de tempo (6h)
   */
  private generateFingerprint(ip: string, userAgent?: string): string {
    // Remove último octeto do IP para privacidade
    const ipPrefix = ip.split('.').slice(0, 3).join('.');

    // Bucket de tempo de 6 horas
    const timeBucket = Math.floor(Date.now() / (6 * 60 * 60 * 1000));

    const data = `${ipPrefix}|${userAgent || ''}|${timeBucket}`;

    return createHash('sha256').update(data).digest('hex').substring(0, 32);
  }

  /**
   * Hash do IP para armazenamento
   */
  private hashIp(ip: string): string {
    return createHash('sha256').update(ip).digest('hex').substring(0, 32);
  }
}
