import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReferralAttributionMethod, ReferralStatus, ReferralPlatform } from '@prisma/client';
import { ReferralCodeService } from './referral-code.service';
import { ReferralClickService } from './referral-click.service';
import { ReferralAntifraudService } from './referral-antifraud.service';
import { ReferralAuditService } from './referral-audit.service';

export interface AttributionResult {
  success: boolean;
  referralId?: string;
  referrerName?: string;
  attributionMethod?: ReferralAttributionMethod;
  message?: string;
}

@Injectable()
export class ReferralAttributionService {
  private readonly logger = new Logger(ReferralAttributionService.name);

  constructor(
    private prisma: PrismaService,
    private codeService: ReferralCodeService,
    private clickService: ReferralClickService,
    private antifraudService: ReferralAntifraudService,
    private auditService: ReferralAuditService,
  ) {}

  /**
   * Tenta atribuir um referee a um referrer
   * Usa múltiplos métodos em ordem de prioridade
   */
  async attach(params: {
    refereeUserId: string;
    refereeEmail: string;
    code?: string;
    clickId?: string;
    deviceIdHash?: string;
    platform: 'IOS' | 'ANDROID' | 'WEB';
    installReferrer?: Record<string, any>;
    ipHash?: string;
  }): Promise<AttributionResult> {
    // Verifica se já tem um referral
    const existingReferral = await this.prisma.referral.findUnique({
      where: { refereeUserId: params.refereeUserId },
    });

    if (existingReferral) {
      return {
        success: false,
        message: 'User already has a referrer',
      };
    }

    // Tenta atribuição em ordem de prioridade
    let result: AttributionResult | null = null;

    // 1. Código direto (maior prioridade)
    if (params.code) {
      result = await this.tryCodeAttribution({
        refereeUserId: params.refereeUserId,
        refereeEmail: params.refereeEmail,
        code: params.code,
        ipHash: params.ipHash,
      });
      if (result.success) return result;
    }

    // 2. Click ID (link de referral)
    if (params.clickId) {
      result = await this.tryClickIdAttribution({
        refereeUserId: params.refereeUserId,
        refereeEmail: params.refereeEmail,
        clickId: params.clickId,
        ipHash: params.ipHash,
        deviceIdHash: params.deviceIdHash,
      });
      if (result.success) return result;
    }

    // 3. Install Referrer (Android Play Store)
    if (params.installReferrer && params.platform === 'ANDROID') {
      result = await this.tryInstallReferrerAttribution({
        refereeUserId: params.refereeUserId,
        refereeEmail: params.refereeEmail,
        installReferrer: params.installReferrer,
        deviceIdHash: params.deviceIdHash,
        ipHash: params.ipHash,
      });
      if (result.success) return result;
    }

    return {
      success: false,
      message: 'Could not attribute referral',
    };
  }

  /**
   * Tenta resolver deferred deep link (iOS)
   */
  async resolveDeferred(params: {
    fingerprintHash: string;
    deviceIdHash: string;
  }): Promise<{
    matched: boolean;
    code?: string;
    referrerName?: string;
  }> {
    // Busca clique recente com mesmo fingerprint
    const click = await this.clickService.findByFingerprint(params.fingerprintHash);

    if (!click) {
      await this.auditService.log({
        action: 'deferred_resolve_attempt',
        entityType: 'install',
        entityId: params.deviceIdHash,
        decision: 'NO_MATCH',
        metadata: { fingerprintHash: params.fingerprintHash },
      });

      return { matched: false };
    }

    // Registra o install para uso posterior na atribuição
    await this.prisma.referralInstall.create({
      data: {
        clickId: click.clickId,
        deviceIdHash: params.deviceIdHash,
        platform: ReferralPlatform.IOS,
        fingerprintHash: params.fingerprintHash,
        matched: true,
        matchedAt: new Date(),
      },
    });

    await this.auditService.log({
      action: 'deferred_resolve_success',
      entityType: 'click',
      entityId: click.id,
      decision: 'MATCHED',
      metadata: {
        fingerprintHash: params.fingerprintHash,
        deviceIdHash: params.deviceIdHash,
      },
    });

    const referrerName = click.code.user.name?.split(' ')[0] || 'Usuário';
    const code = click.code.customCode || click.code.code;

    this.logger.log(`Deferred deep link matched: click ${click.clickId} -> device ${params.deviceIdHash}`);

    return {
      matched: true,
      code,
      referrerName,
    };
  }

  /**
   * Atualiza status do referral quando o usuário completa cadastro
   */
  async onSignupComplete(refereeUserId: string): Promise<void> {
    const referral = await this.prisma.referral.findUnique({
      where: { refereeUserId },
    });

    if (referral && referral.status === ReferralStatus.PENDING) {
      await this.prisma.referral.update({
        where: { id: referral.id },
        data: { status: ReferralStatus.SIGNUP_COMPLETE },
      });

      await this.auditService.log({
        action: 'status_update',
        entityType: 'referral',
        entityId: referral.id,
        userId: refereeUserId,
        decision: 'SIGNUP_COMPLETE',
      });
    }
  }

  // === Private Methods ===

  private async tryCodeAttribution(params: {
    refereeUserId: string;
    refereeEmail: string;
    code: string;
    ipHash?: string;
  }): Promise<AttributionResult> {
    const validation = await this.codeService.validateCode(params.code);

    if (!validation.valid || !validation.referrerUserId) {
      return { success: false, message: 'Invalid code' };
    }

    // Verifica fraude
    const fraudCheck = await this.antifraudService.checkAttribution({
      referrerUserId: validation.referrerUserId,
      refereeUserId: params.refereeUserId,
      refereeEmail: params.refereeEmail,
      ipHash: params.ipHash,
    });

    if (fraudCheck.blocked) {
      return { success: false, message: fraudCheck.reason };
    }

    // Cria o referral
    const referral = await this.prisma.referral.create({
      data: {
        referrerUserId: validation.referrerUserId,
        refereeUserId: params.refereeUserId,
        attributionMethod: ReferralAttributionMethod.MANUAL_CODE,
        status: ReferralStatus.SIGNUP_COMPLETE,
        fraudFlags: fraudCheck.flags,
      },
    });

    await this.auditService.log({
      action: 'attribution_success',
      entityType: 'referral',
      entityId: referral.id,
      userId: params.refereeUserId,
      decision: 'MANUAL_CODE',
      metadata: { code: params.code, fraudFlags: fraudCheck.flags },
    });

    this.logger.log(`Referral created via code: ${params.code} -> user ${params.refereeUserId}`);

    return {
      success: true,
      referralId: referral.id,
      referrerName: validation.referrerFirstName,
      attributionMethod: ReferralAttributionMethod.MANUAL_CODE,
    };
  }

  private async tryClickIdAttribution(params: {
    refereeUserId: string;
    refereeEmail: string;
    clickId: string;
    ipHash?: string;
    deviceIdHash?: string;
  }): Promise<AttributionResult> {
    const click = await this.clickService.findByClickId(params.clickId);

    if (!click || click.converted || click.expiresAt < new Date()) {
      return { success: false, message: 'Invalid or expired click' };
    }

    const referrerUserId = click.code.userId;

    // Verifica fraude
    const fraudCheck = await this.antifraudService.checkAttribution({
      referrerUserId,
      refereeUserId: params.refereeUserId,
      refereeEmail: params.refereeEmail,
      deviceIdHash: params.deviceIdHash,
      ipHash: params.ipHash,
    });

    if (fraudCheck.blocked) {
      return { success: false, message: fraudCheck.reason };
    }

    // Marca click como convertido
    await this.clickService.markAsConverted(params.clickId);

    // Cria o referral
    const referral = await this.prisma.referral.create({
      data: {
        referrerUserId,
        refereeUserId: params.refereeUserId,
        clickId: params.clickId,
        attributionMethod: ReferralAttributionMethod.LINK_DIRECT,
        status: ReferralStatus.SIGNUP_COMPLETE,
        fraudFlags: fraudCheck.flags,
      },
    });

    await this.auditService.log({
      action: 'attribution_success',
      entityType: 'referral',
      entityId: referral.id,
      userId: params.refereeUserId,
      decision: 'LINK_DIRECT',
      metadata: { clickId: params.clickId, fraudFlags: fraudCheck.flags },
    });

    const referrerName = click.code.user.name?.split(' ')[0] || 'Usuário';

    this.logger.log(`Referral created via click: ${params.clickId} -> user ${params.refereeUserId}`);

    return {
      success: true,
      referralId: referral.id,
      referrerName,
      attributionMethod: ReferralAttributionMethod.LINK_DIRECT,
    };
  }

  private async tryInstallReferrerAttribution(params: {
    refereeUserId: string;
    refereeEmail: string;
    deviceIdHash?: string;
    installReferrer: Record<string, any>;
    ipHash?: string;
  }): Promise<AttributionResult> {
    // Parse do install referrer do Play Store
    // Formato esperado: utm_source=referral&utm_campaign=CODE&click_id=xxx
    const referrerString = params.installReferrer.installReferrer || '';
    const parsedParams = new URLSearchParams(referrerString);

    const utmSource = parsedParams.get('utm_source');
    const code = parsedParams.get('utm_campaign');
    const clickId = parsedParams.get('click_id');

    if (utmSource !== 'referral' || !code) {
      return { success: false, message: 'Not a referral install' };
    }

    // Registra o install
    await this.prisma.referralInstall.create({
      data: {
        clickId: clickId || undefined,
        deviceIdHash: params.deviceIdHash || 'unknown',
        platform: ReferralPlatform.ANDROID,
        installReferrerPayload: params.installReferrer,
        matched: true,
        matchedAt: new Date(),
      },
    });

    // Valida o código
    const validation = await this.codeService.validateCode(code);

    if (!validation.valid || !validation.referrerUserId) {
      return { success: false, message: 'Invalid referral code in install referrer' };
    }

    // Verifica fraude
    const fraudCheck = await this.antifraudService.checkAttribution({
      referrerUserId: validation.referrerUserId,
      refereeUserId: params.refereeUserId,
      refereeEmail: params.refereeEmail,
      deviceIdHash: params.deviceIdHash,
      ipHash: params.ipHash,
    });

    if (fraudCheck.blocked) {
      return { success: false, message: fraudCheck.reason };
    }

    // Marca click como convertido se temos clickId
    if (clickId) {
      await this.clickService.markAsConverted(clickId);
    }

    // Cria o referral
    const referral = await this.prisma.referral.create({
      data: {
        referrerUserId: validation.referrerUserId,
        refereeUserId: params.refereeUserId,
        clickId: clickId || undefined,
        attributionMethod: ReferralAttributionMethod.INSTALL_REFERRER,
        status: ReferralStatus.SIGNUP_COMPLETE,
        fraudFlags: fraudCheck.flags,
      },
    });

    await this.auditService.log({
      action: 'attribution_success',
      entityType: 'referral',
      entityId: referral.id,
      userId: params.refereeUserId,
      decision: 'INSTALL_REFERRER',
      metadata: { code, clickId, fraudFlags: fraudCheck.flags },
    });

    this.logger.log(`Referral created via install referrer: ${code} -> user ${params.refereeUserId}`);

    return {
      success: true,
      referralId: referral.id,
      referrerName: validation.referrerFirstName,
      attributionMethod: ReferralAttributionMethod.INSTALL_REFERRER,
    };
  }
}
