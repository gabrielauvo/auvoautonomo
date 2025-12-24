import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SubscriptionStatus } from '@prisma/client';

// Trial duration in days
const TRIAL_DURATION_DAYS = 14;

export interface GoogleUser {
  email: string;
  firstName?: string;
  lastName?: string;
  picture?: string;
  accessToken: string;
}

/**
 * Convert relative URLs to absolute URLs for external access (mobile apps, etc.)
 */
function toAbsoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  // Already absolute URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Relative URL - prepend BASE_URL
  // Fallback to Railway URL if not set
  let baseUrl = process.env.BASE_URL || process.env.API_URL || '';
  if (!baseUrl && process.env.RAILWAY_PUBLIC_DOMAIN) {
    baseUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  if (!baseUrl) {
    baseUrl = 'https://monorepobackend-production.up.railway.app';
  }

  if (url.startsWith('/')) {
    return `${baseUrl}${url}`;
  }

  return url;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  async register(dto: RegisterDto) {
    // Log registration attempt WITHOUT sensitive data
    this.logger.log(`Registration attempt for email: ${this.maskEmail(dto.email)}`);

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      // Log failed attempt without exposing if email exists (prevents user enumeration)
      this.logger.warn(`Registration failed: duplicate email attempt`);
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12); // Increased from 10 to 12 rounds for better security

    // Buscar o plano PRO (todos os novos usuários começam com trial do PRO)
    const proPlan = await this.prisma.plan.findUnique({
      where: { type: 'PRO' },
    });

    // Calcular data de fim do trial (14 dias)
    const trialEndAt = new Date();
    trialEndAt.setDate(trialEndAt.getDate() + TRIAL_DURATION_DAYS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        companyName: dto.companyName,
        phone: dto.phone,
        planId: proPlan?.id,
        // Criar subscription de trial junto com o usuário
        subscription: proPlan ? {
          create: {
            planId: proPlan.id,
            status: SubscriptionStatus.TRIALING,
            trialEndAt,
            currentPeriodStart: new Date(),
            currentPeriodEnd: trialEndAt,
          },
        } : undefined,
      },
      select: {
        id: true,
        email: true,
        name: true,
        companyName: true,
        phone: true,
        role: true,
        planId: true,
        createdAt: true,
      },
    });

    const token = this.generateToken(user.id, user.email);

    this.logger.log(`User registered successfully with ${TRIAL_DURATION_DAYS}-day trial: ${user.id}`);

    return {
      user,
      token,
    };
  }

  async login(dto: LoginDto) {
    // Log login attempt WITHOUT sensitive data
    this.logger.log(`Login attempt for email: ${this.maskEmail(dto.email)}`);

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { plan: true },
    });

    if (!user) {
      // Use generic message to prevent user enumeration
      this.logger.warn(`Login failed: invalid credentials (user not found)`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      // Log failed attempt without exposing which part failed
      this.logger.warn(`Login failed: invalid credentials for user ${user.id}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.generateToken(user.id, user.email);

    // Remove password from response to prevent exposure
    const { password: _, ...userWithoutPassword } = user;

    this.logger.log(`User logged in successfully: ${user.id}`);

    return {
      user: {
        ...userWithoutPassword,
        avatarUrl: toAbsoluteUrl(user.avatarUrl),
        companyLogoUrl: toAbsoluteUrl(user.companyLogoUrl),
      },
      token,
    };
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { plan: true },
    });

    if (!user) {
      this.logger.warn(`User validation failed: user ${userId} not found`);
      throw new UnauthorizedException('User not found');
    }

    // Transform relative URLs to absolute for external access
    return {
      ...user,
      avatarUrl: toAbsoluteUrl(user.avatarUrl),
      companyLogoUrl: toAbsoluteUrl(user.companyLogoUrl),
    };
  }

  private generateToken(userId: string, email: string): string {
    const payload = { sub: userId, email };
    return this.jwtService.sign(payload);
  }

  /**
   * Mask email for logging to prevent exposing full email addresses in logs
   * Example: john.doe@example.com -> j***e@e***e.com
   */
  private maskEmail(email: string): string {
    if (!email || !email.includes('@')) {
      return '***';
    }

    const [localPart, domain] = email.split('@');
    const maskedLocal = localPart.length > 2
      ? `${localPart[0]}***${localPart[localPart.length - 1]}`
      : `${localPart[0]}***`;

    const [domainName, tld] = domain.split('.');
    const maskedDomain = domainName.length > 2
      ? `${domainName[0]}***${domainName[domainName.length - 1]}`
      : `${domainName[0]}***`;

    return `${maskedLocal}@${maskedDomain}.${tld || '***'}`;
  }

  /**
   * Login ou registro via Google OAuth
   */
  async googleLogin(googleUser: GoogleUser) {
    if (!googleUser || !googleUser.email) {
      this.logger.warn('Google authentication failed: missing user data');
      throw new UnauthorizedException('Google authentication failed');
    }

    this.logger.log(`Google login attempt for email: ${this.maskEmail(googleUser.email)}`);

    // Buscar usuário existente
    let user = await this.prisma.user.findUnique({
      where: { email: googleUser.email },
      include: { plan: true },
    });

    // Se não existe, criar novo usuário com trial
    if (!user) {
      this.logger.log(`Creating new user from Google OAuth: ${this.maskEmail(googleUser.email)}`);
      const proPlan = await this.prisma.plan.findUnique({
        where: { type: 'PRO' },
      });

      const fullName = [googleUser.firstName, googleUser.lastName]
        .filter(Boolean)
        .join(' ');

      // Calcular data de fim do trial (14 dias)
      const trialEndAt = new Date();
      trialEndAt.setDate(trialEndAt.getDate() + TRIAL_DURATION_DAYS);

      user = await this.prisma.user.create({
        data: {
          email: googleUser.email,
          name: fullName || googleUser.email.split('@')[0],
          password: '', // Google users don't need password
          googleId: googleUser.email, // Using email as googleId for simplicity
          avatarUrl: googleUser.picture,
          planId: proPlan?.id,
          // Criar subscription de trial junto com o usuário
          subscription: proPlan ? {
            create: {
              planId: proPlan.id,
              status: SubscriptionStatus.TRIALING,
              trialEndAt,
              currentPeriodStart: new Date(),
              currentPeriodEnd: trialEndAt,
            },
          } : undefined,
        },
        include: { plan: true },
      });

      this.logger.log(`Google OAuth user created with ${TRIAL_DURATION_DAYS}-day trial: ${user.id}`);
    } else {
      // Atualizar avatarUrl se não tiver
      if (!user.avatarUrl && googleUser.picture) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { avatarUrl: googleUser.picture },
          include: { plan: true },
        });
      }
    }

    const token = this.generateToken(user.id, user.email);

    // Remove password from response to prevent exposure
    const { password: _, ...userWithoutPassword } = user;

    this.logger.log(`Google OAuth successful for user: ${user.id}`);

    return {
      user: userWithoutPassword,
      token,
    };
  }

  /**
   * Solicita redefinição de senha
   * Por segurança, sempre retorna sucesso mesmo se o email não existir
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ success: boolean }> {
    this.logger.log(`Password reset requested for: ${this.maskEmail(dto.email)}`);

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Se usuário não existe, retorna sucesso silenciosamente (segurança)
    if (!user) {
      this.logger.warn(`Password reset: email not found (silent success)`);
      return { success: true };
    }

    // Se usuário foi criado via Google, não pode resetar senha
    if (user.googleId && !user.password) {
      this.logger.warn(`Password reset: Google OAuth user (silent success)`);
      return { success: true };
    }

    // Gerar token seguro
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Token expira em 1 hora
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    // Salvar token hasheado no banco
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashedToken,
        passwordResetExpires: expires,
      },
    });

    // Enviar email
    const emailSent = await this.emailService.sendPasswordResetEmail(
      user.email,
      resetToken, // Enviamos o token original, não o hasheado
    );

    if (!emailSent) {
      this.logger.error(`Failed to send password reset email to ${this.maskEmail(dto.email)}`);
    } else {
      this.logger.log(`Password reset email sent to ${this.maskEmail(dto.email)}`);
    }

    return { success: true };
  }

  /**
   * Redefine a senha usando o token
   */
  async resetPassword(dto: ResetPasswordDto): Promise<{ success: boolean }> {
    // Hash do token recebido para comparar com o banco
    const hashedToken = crypto
      .createHash('sha256')
      .update(dto.token)
      .digest('hex');

    // Buscar usuário com token válido e não expirado
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      this.logger.warn('Password reset: invalid or expired token');
      throw new BadRequestException('Token inválido ou expirado');
    }

    // Hash da nova senha
    const hashedPassword = await bcrypt.hash(dto.password, 12);

    // Atualizar senha e limpar tokens
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    this.logger.log(`Password reset successful for user: ${user.id}`);

    return { success: true };
  }
}
