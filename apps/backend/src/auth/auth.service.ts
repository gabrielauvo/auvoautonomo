import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

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

    // Buscar o plano FREE
    const freePlan = await this.prisma.plan.findUnique({
      where: { type: 'FREE' },
    });

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        companyName: dto.companyName,
        phone: dto.phone,
        planId: freePlan?.id,
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

    this.logger.log(`User registered successfully: ${user.id}`);

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

    // Se não existe, criar novo usuário
    if (!user) {
      this.logger.log(`Creating new user from Google OAuth: ${this.maskEmail(googleUser.email)}`);
      const freePlan = await this.prisma.plan.findUnique({
        where: { type: 'FREE' },
      });

      const fullName = [googleUser.firstName, googleUser.lastName]
        .filter(Boolean)
        .join(' ');

      user = await this.prisma.user.create({
        data: {
          email: googleUser.email,
          name: fullName || googleUser.email.split('@')[0],
          password: '', // Google users don't need password
          googleId: googleUser.email, // Using email as googleId for simplicity
          avatarUrl: googleUser.picture,
          planId: freePlan?.id,
        },
        include: { plan: true },
      });
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
}
