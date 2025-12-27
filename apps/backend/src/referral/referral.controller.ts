import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
  HttpStatus,
  Logger,
  HttpCode,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { ReferralCodeService } from './services/referral-code.service';
import { ReferralClickService } from './services/referral-click.service';
import { ReferralAttributionService } from './services/referral-attribution.service';
import { ReferralRewardsService } from './services/referral-rewards.service';
import {
  AttachReferralDto,
  ResolveDeferredDto,
  SetCustomCodeDto,
  ReferralStatusResponse,
  AttachReferralResponse,
  ResolveDeferredResponse,
  ValidateCodeResponse,
  ReferralCodeResponse,
} from './dto/referral.dto';

@ApiTags('Referral')
@Controller()
export class ReferralController {
  private readonly logger = new Logger(ReferralController.name);

  constructor(
    private prisma: PrismaService,
    private codeService: ReferralCodeService,
    private clickService: ReferralClickService,
    private attributionService: ReferralAttributionService,
    private rewardsService: ReferralRewardsService,
  ) {}

  /**
   * Landing page de redirect do link de referral
   * GET /r/{code}
   */
  @Get('r/:code')
  @Throttle({ default: { limit: 100, ttl: 60000 } }) // 100 req/min por IP
  @ApiOperation({ summary: 'Referral link landing page' })
  async handleReferralLink(
    @Param('code') code: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const ip = this.getClientIp(req);
    const userAgent = req.headers['user-agent'];
    const referer = req.headers['referer'] as string;

    // Registra o clique
    const clickResult = await this.clickService.registerClick(
      code,
      ip,
      userAgent,
      referer,
    );

    if (!clickResult) {
      // Código inválido - redireciona para home
      const baseUrl = process.env.FRONTEND_URL || 'https://auvoautonomo.com';
      return res.redirect(HttpStatus.FOUND, baseUrl);
    }

    // Monta URL da landing page com parâmetros
    const baseUrl = process.env.FRONTEND_URL || 'https://auvoautonomo.com';
    const landingUrl = new URL(`${baseUrl}/r/${code}`);
    landingUrl.searchParams.set('click_id', clickResult.clickId);
    landingUrl.searchParams.set('platform', clickResult.platform);
    landingUrl.searchParams.set('fp', clickResult.fingerprintHash);

    // Se é mobile e pode ter app instalado, tenta deep link primeiro
    if (clickResult.platform === 'IOS' || clickResult.platform === 'ANDROID') {
      // Para iOS: Universal Link
      // Para Android: App Link ou Intent
      const appScheme = 'auvofield://referral';
      const appLink = `${appScheme}?code=${code}&click_id=${clickResult.clickId}`;

      // Retorna HTML que tenta abrir o app primeiro
      return res.send(this.generateSmartRedirectHtml({
        code,
        clickId: clickResult.clickId,
        platform: clickResult.platform,
        referrerName: clickResult.referrerName,
        fingerprintHash: clickResult.fingerprintHash,
        appLink,
        webFallback: landingUrl.toString(),
      }));
    }

    // Desktop - vai direto para landing web
    return res.redirect(HttpStatus.FOUND, landingUrl.toString());
  }

  /**
   * Obtém ou cria código de referral do usuário autenticado
   */
  @Get('api/referral/my-code')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get or create user referral code' })
  @ApiResponse({ status: 200, description: 'Referral code' })
  async getMyCode(@Req() req: Request): Promise<ReferralCodeResponse> {
    const userId = (req.user as any).id;
    return this.codeService.getOrCreateCode(userId);
  }

  /**
   * Define código personalizado
   */
  @Post('api/referral/custom-code')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Set custom referral code' })
  async setCustomCode(
    @Req() req: Request,
    @Body() dto: SetCustomCodeDto,
  ): Promise<ReferralCodeResponse> {
    const userId = (req.user as any).id;
    return this.codeService.setCustomCode(userId, dto.customCode);
  }

  /**
   * Valida se um código existe
   */
  @Get('api/referral/validate/:code')
  @SkipThrottle()
  @ApiOperation({ summary: 'Validate referral code' })
  async validateCode(@Param('code') code: string): Promise<ValidateCodeResponse> {
    const result = await this.codeService.validateCode(code);
    return {
      valid: result.valid,
      referrerFirstName: result.referrerFirstName,
      locale: result.locale,
    };
  }

  /**
   * Registra clique no link de referral (usado pela landing page)
   */
  @Post('api/referral/click')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register referral link click' })
  async registerClick(
    @Body() body: { code: string; userAgent?: string; ipAddress?: string; referrer?: string },
  ) {
    const result = await this.clickService.registerClick(
      body.code,
      body.ipAddress || '',
      body.userAgent,
      body.referrer,
    );

    if (!result) {
      return { success: false, message: 'Invalid referral code' };
    }

    return {
      success: true,
      clickId: result.clickId,
      platform: result.platform,
      referrerName: result.referrerName,
    };
  }

  /**
   * Vincula usuário a um referrer
   */
  @Post('api/referral/attach')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Attach current user to a referrer' })
  async attachReferral(
    @Req() req: Request,
    @Body() dto: AttachReferralDto,
  ): Promise<AttachReferralResponse> {
    const user = req.user as any;
    const ip = this.getClientIp(req);

    const result = await this.attributionService.attach({
      refereeUserId: user.id,
      refereeEmail: user.email,
      code: dto.code,
      clickId: dto.clickId,
      deviceIdHash: dto.deviceIdHash,
      platform: dto.platform,
      installReferrer: dto.installReferrer,
      ipHash: this.hashIp(ip),
    });

    return {
      success: result.success,
      referrerName: result.referrerName,
      attributionMethod: result.attributionMethod,
      message: result.message,
    };
  }

  /**
   * Resolve deferred deep link (iOS)
   */
  @Post('api/referral/resolve-deferred')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve iOS deferred deep link' })
  async resolveDeferred(
    @Body() dto: ResolveDeferredDto,
  ): Promise<ResolveDeferredResponse> {
    return this.attributionService.resolveDeferred({
      fingerprintHash: dto.fingerprintHash,
      deviceIdHash: dto.deviceIdHash,
    });
  }

  /**
   * Dashboard completo do programa de indicação (usado pelo frontend web)
   */
  @Get('api/referral/dashboard')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get referral dashboard with all data' })
  async getDashboard(@Req() req: Request) {
    const userId = (req.user as any).id;

    const [codeInfo, stats, referrals, rewards] = await Promise.all([
      this.codeService.getOrCreateCode(userId),
      this.rewardsService.getStats(userId),
      this.rewardsService.getRecentReferrals(userId),
      this.rewardsService.getRewardsHistory(userId),
    ]);

    // Get full referral code record for additional data
    const codeRecord = await this.prisma.referralCode.findUnique({
      where: { userId },
    });

    return {
      code: {
        id: codeRecord?.id || '',
        code: codeInfo.code,
        customCode: codeInfo.customCode,
        status: codeRecord?.status || 'ACTIVE',
        totalClicks: stats.totalClicks,
        totalSignups: stats.totalSignups,
        totalPaidConversions: stats.totalPaid,
        createdAt: codeRecord?.createdAt?.toISOString() || new Date().toISOString(),
      },
      stats: {
        totalClicks: stats.totalClicks,
        totalSignups: stats.totalSignups,
        totalPaidConversions: stats.totalPaid,
        totalDaysEarned: stats.monthsEarned * 30,
        pendingRewards: stats.pendingMonths,
      },
      referrals: referrals.map((r) => ({
        id: r.id,
        status: r.status,
        attributionMethod: 'LINK_DIRECT',
        platform: 'WEB',
        referee: {
          id: r.id,
          name: r.name,
          email: '',
        },
        createdAt: r.date.toISOString(),
        convertedAt: r.status === 'SUBSCRIPTION_PAID' ? r.date.toISOString() : null,
      })),
      rewards: rewards.map((r) => ({
        id: r.id,
        daysAwarded: r.monthsCredited * 30,
        reason: r.reason,
        status: r.status,
        referral: undefined,
        createdAt: r.createdAt.toISOString(),
        appliedAt: r.status === 'APPLIED' ? r.createdAt.toISOString() : null,
      })),
      shareUrl: codeInfo.link,
    };
  }

  /**
   * Status completo do programa de indicação
   */
  @Get('api/referral/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get referral program status and stats' })
  async getStatus(@Req() req: Request): Promise<ReferralStatusResponse> {
    const userId = (req.user as any).id;

    const [codeInfo, stats, recentReferrals, rewardsHistory] = await Promise.all([
      this.codeService.getOrCreateCode(userId),
      this.rewardsService.getStats(userId),
      this.rewardsService.getRecentReferrals(userId),
      this.rewardsService.getRewardsHistory(userId),
    ]);

    const progress = {
      current: stats.currentMilestoneProgress,
      target: 10,
      reward: '12 meses grátis',
      percentComplete: (stats.currentMilestoneProgress / 10) * 100,
    };

    return {
      code: codeInfo.code,
      customCode: codeInfo.customCode || undefined,
      link: codeInfo.link,
      stats: {
        totalClicks: stats.totalClicks,
        totalSignups: stats.totalSignups,
        totalPaid: stats.totalPaid,
        monthsEarned: stats.monthsEarned,
        pendingMonths: stats.pendingMonths,
      },
      progress,
      recentReferrals: recentReferrals.map((r) => ({
        id: r.id,
        name: r.name,
        status: this.translateStatus(r.status),
        date: r.date,
      })),
      rewardsHistory: rewardsHistory.map((r) => ({
        id: r.id,
        months: r.monthsCredited,
        reason: this.translateReason(r.reason),
        date: r.createdAt,
        status: r.status,
      })),
    };
  }

  /**
   * Aplica créditos pendentes à assinatura
   */
  @Post('api/referral/apply-credits')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Apply pending referral credits to subscription' })
  async applyCredits(@Req() req: Request): Promise<{ applied: number }> {
    const userId = (req.user as any).id;
    const applied = await this.rewardsService.applyPendingCredits(userId);
    return { applied };
  }

  // === Private Methods ===

  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'] as string;
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket.remoteAddress || '0.0.0.0';
  }

  private hashIp(ip: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 32);
  }

  private translateStatus(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'Clicou no link',
      SIGNUP_COMPLETE: 'Cadastrou',
      SUBSCRIPTION_PAID: 'Assinou',
      CHURNED: 'Cancelou',
      FRAUDULENT: 'Inválido',
    };
    return map[status] || status;
  }

  private translateReason(reason: string): string {
    const map: Record<string, string> = {
      SINGLE_REFERRAL: 'Indicação',
      MILESTONE_10: 'Meta de 10 indicações',
      BONUS: 'Bônus',
      REVERSAL: 'Estorno',
    };
    return map[reason] || reason;
  }

  private generateSmartRedirectHtml(params: {
    code: string;
    clickId: string;
    platform: string;
    referrerName: string;
    fingerprintHash: string;
    appLink: string;
    webFallback: string;
  }): string {
    const isIOS = params.platform === 'IOS';
    const storeUrl = isIOS
      ? 'https://apps.apple.com/app/auvo-field/id123456789' // TODO: ID real
      : `https://play.google.com/store/apps/details?id=com.auvo.field.preview&referrer=utm_source%3Dreferral%26utm_campaign%3D${params.code}%26click_id%3D${params.clickId}`;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Auvo Field - Convite de ${params.referrerName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 24px;
      padding: 40px 30px;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .logo {
      width: 80px;
      height: 80px;
      background: #7C3AED;
      border-radius: 20px;
      margin: 0 auto 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 32px;
      font-weight: bold;
    }
    h1 {
      color: #1F2937;
      font-size: 24px;
      margin-bottom: 12px;
    }
    p {
      color: #6B7280;
      font-size: 16px;
      line-height: 1.5;
      margin-bottom: 24px;
    }
    .highlight {
      color: #7C3AED;
      font-weight: 600;
    }
    .btn {
      display: block;
      width: 100%;
      padding: 16px 24px;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      text-decoration: none;
      margin-bottom: 12px;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .btn:active { transform: scale(0.98); }
    .btn-primary {
      background: #7C3AED;
      color: white;
      box-shadow: 0 4px 14px rgba(124, 58, 237, 0.4);
    }
    .btn-secondary {
      background: #F3F4F6;
      color: #374151;
    }
    .divider {
      color: #9CA3AF;
      font-size: 14px;
      margin: 16px 0;
    }
    .footer {
      margin-top: 24px;
      font-size: 12px;
      color: #9CA3AF;
    }
    .spinner {
      display: none;
      width: 24px;
      height: 24px;
      border: 3px solid #E5E7EB;
      border-top-color: #7C3AED;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .loading .spinner { display: block; }
    .loading .btn { opacity: 0.5; pointer-events: none; }
  </style>
</head>
<body>
  <div class="container" id="container">
    <div class="spinner" id="spinner"></div>
    <div class="logo">A</div>
    <h1>Você foi convidado!</h1>
    <p>
      <span class="highlight">${params.referrerName}</span> te convidou para usar o
      <strong>Auvo Field</strong> - o app que ajuda autônomos a gerenciar clientes,
      orçamentos e serviços.
    </p>

    <a href="${storeUrl}" class="btn btn-primary" id="storeBtn">
      📱 Baixar o App Grátis
    </a>

    <p class="divider">ou</p>

    <a href="${params.webFallback}" class="btn btn-secondary">
      💻 Continuar no Navegador
    </a>

    <p class="footer">
      Ao se cadastrar pelo convite, você e ${params.referrerName} ganham benefícios!
    </p>
  </div>

  <script>
    // Tenta abrir o app primeiro
    var appLink = "${params.appLink}";
    var storeUrl = "${storeUrl}";
    var webFallback = "${params.webFallback}";
    var timeout;

    // Salva dados no localStorage para recuperar depois
    try {
      localStorage.setItem('referral_code', '${params.code}');
      localStorage.setItem('referral_click_id', '${params.clickId}');
      localStorage.setItem('referral_fingerprint', '${params.fingerprintHash}');
      localStorage.setItem('referral_timestamp', Date.now().toString());
    } catch(e) {}

    function tryOpenApp() {
      document.getElementById('container').classList.add('loading');

      // Tenta abrir o app
      var start = Date.now();

      // Se o app abrir, essa página será ocultada
      // Se não abrir em 2.5s, redireciona para store
      timeout = setTimeout(function() {
        if (Date.now() - start < 3000) {
          // App não abriu, vai para store
          // window.location.href = storeUrl;
          document.getElementById('container').classList.remove('loading');
        }
      }, 2500);

      // Tenta Universal Link / App Link
      window.location.href = appLink;
    }

    // Detecta se voltou para a página (app não estava instalado)
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'visible') {
        clearTimeout(timeout);
        document.getElementById('container').classList.remove('loading');
      }
    });

    // Auto-tenta abrir o app após 500ms
    // setTimeout(tryOpenApp, 500);
  </script>
</body>
</html>
    `.trim();
  }
}
