import { Injectable, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReferralCodeStatus } from '@prisma/client';
import { customAlphabet } from 'nanoid';

// Alfabeto sem caracteres ambíguos (0,O,I,l,1)
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const generateCode = customAlphabet(ALPHABET, 8);

@Injectable()
export class ReferralCodeService {
  private readonly logger = new Logger(ReferralCodeService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Obtém ou cria o código de referral do usuário
   */
  async getOrCreateCode(userId: string): Promise<{
    code: string;
    customCode: string | null;
    link: string;
  }> {
    // Tenta buscar código existente
    let referralCode = await this.prisma.referralCode.findUnique({
      where: { userId },
    });

    // Se não existe, cria um novo
    if (!referralCode) {
      const code = await this.generateUniqueCode();

      referralCode = await this.prisma.referralCode.create({
        data: {
          userId,
          code,
          status: ReferralCodeStatus.ACTIVE,
        },
      });

      this.logger.log(`Created referral code ${code} for user ${userId}`);
    }

    const baseUrl = process.env.FRONTEND_URL || 'https://auvoautonomo.com';
    const effectiveCode = referralCode.customCode || referralCode.code;

    return {
      code: referralCode.code,
      customCode: referralCode.customCode,
      link: `${baseUrl}/r/${effectiveCode}`,
    };
  }

  /**
   * Define um código personalizado para o usuário
   */
  async setCustomCode(userId: string, customCode: string): Promise<{
    code: string;
    customCode: string;
    link: string;
  }> {
    // Normaliza o código (uppercase, sem espaços)
    const normalizedCode = customCode.toUpperCase().trim();

    // Verifica se já existe
    const existing = await this.prisma.referralCode.findFirst({
      where: {
        OR: [
          { code: normalizedCode },
          { customCode: normalizedCode },
        ],
        NOT: { userId },
      },
    });

    if (existing) {
      throw new ConflictException('Este código já está em uso');
    }

    // Garante que o usuário tem um código base
    await this.getOrCreateCode(userId);

    // Atualiza com o código personalizado
    const updated = await this.prisma.referralCode.update({
      where: { userId },
      data: { customCode: normalizedCode },
    });

    const baseUrl = process.env.FRONTEND_URL || 'https://auvoautonomo.com';

    this.logger.log(`User ${userId} set custom code: ${normalizedCode}`);

    return {
      code: updated.code,
      customCode: updated.customCode!,
      link: `${baseUrl}/r/${normalizedCode}`,
    };
  }

  /**
   * Valida se um código existe e está ativo
   */
  async validateCode(code: string): Promise<{
    valid: boolean;
    referrerFirstName?: string;
    referrerUserId?: string;
    codeId?: string;
  }> {
    const normalizedCode = code.toUpperCase().trim();

    const referralCode = await this.prisma.referralCode.findFirst({
      where: {
        OR: [
          { code: normalizedCode },
          { customCode: normalizedCode },
        ],
        status: ReferralCodeStatus.ACTIVE,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!referralCode) {
      return { valid: false };
    }

    const firstName = referralCode.user.name?.split(' ')[0] || 'Usuário';

    return {
      valid: true,
      referrerFirstName: firstName,
      referrerUserId: referralCode.userId,
      codeId: referralCode.id,
    };
  }

  /**
   * Busca código por ID
   */
  async findById(codeId: string) {
    return this.prisma.referralCode.findUnique({
      where: { id: codeId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Gera um código único
   */
  private async generateUniqueCode(): Promise<string> {
    let code: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      code = generateCode();
      const exists = await this.prisma.referralCode.findFirst({
        where: {
          OR: [{ code }, { customCode: code }],
        },
      });

      if (!exists) {
        return code;
      }

      attempts++;
    } while (attempts < maxAttempts);

    // Fallback: adiciona timestamp
    return `${generateCode()}${Date.now().toString(36).slice(-2).toUpperCase()}`;
  }
}
