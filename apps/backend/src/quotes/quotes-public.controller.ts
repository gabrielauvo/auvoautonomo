import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  NotFoundException,
  Req,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { QuotesPublicService } from './quotes-public.service';
import { IsString, IsOptional, Length, Matches } from 'class-validator';

// DTO para assinatura e aprovação
class SignAndApproveDto {
  @IsString()
  @Length(100, 500000, { message: 'Signature image must be between 100 and 500000 characters' })
  imageBase64: string;

  @IsString()
  @Length(2, 100, { message: 'Signer name must be between 2 and 100 characters' })
  @Matches(/^[a-zA-ZÀ-ÿ\s'-]+$/, { message: 'Signer name contains invalid characters' })
  signerName: string;

  @IsOptional()
  @IsString()
  @Matches(/^[\d.\-/]+$/, { message: 'Invalid document format' })
  signerDocument?: string;

  @IsOptional()
  @IsString()
  @Length(2, 50, { message: 'Signer role must be between 2 and 50 characters' })
  signerRole?: string;
}

// DTO para rejeição
class RejectQuoteDto {
  @IsOptional()
  @IsString()
  @Length(0, 500, { message: 'Rejection reason must be at most 500 characters' })
  reason?: string;
}

// Validador de shareKey (UUID v4 ou formato customizado)
const SHARE_KEY_REGEX = /^[a-zA-Z0-9-_]{20,50}$/;

/**
 * Controller público para visualização de orçamento via link compartilhável
 * Não requer autenticação - usa shareKey como token de acesso
 *
 * SEGURANÇA:
 * - Rate limiting restritivo para prevenir brute force
 * - Validação de formato de shareKey
 * - Logging de tentativas inválidas
 */
@ApiTags('Quotes (Public)')
@Controller('public/quotes')
@Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 requests por minuto (mais restritivo)
export class QuotesPublicController {
  constructor(
    private readonly quotesPublicService: QuotesPublicService,
  ) {}

  /**
   * Valida formato do shareKey para prevenir ataques de enumeração
   */
  private validateShareKey(shareKey: string): void {
    if (!shareKey || !SHARE_KEY_REGEX.test(shareKey)) {
      throw new BadRequestException('Invalid share key format');
    }
  }

  @Get(':shareKey')
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // Mais restritivo para GET
  @ApiOperation({
    summary: 'Get quote by share key (public access)',
    description: 'Returns quote details for public viewing via shareable link. No authentication required.',
  })
  @ApiParam({ name: 'shareKey', description: 'Unique share key for the quote' })
  @ApiResponse({
    status: 200,
    description: 'Returns quote with company, client, and item details',
  })
  @ApiResponse({ status: 404, description: 'Quote not found or link expired' })
  async getByShareKey(@Param('shareKey') shareKey: string) {
    // Validar formato antes de buscar (previne enumeração)
    this.validateShareKey(shareKey);

    const quote = await this.quotesPublicService.findByShareKey(shareKey);

    if (!quote) {
      throw new NotFoundException('Orçamento não encontrado ou link inválido');
    }

    return quote;
  }

  @Post(':shareKey/sign-and-approve')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // Muito restritivo para ações de escrita
  @ApiOperation({
    summary: 'Sign and approve quote (public access)',
    description: 'Client signs and approves the quote via public link. Collects signature image and signer info.',
  })
  @ApiParam({ name: 'shareKey', description: 'Unique share key for the quote' })
  @ApiBody({ type: SignAndApproveDto })
  @ApiResponse({
    status: 200,
    description: 'Quote signed and approved successfully',
  })
  @ApiResponse({ status: 400, description: 'Quote cannot be signed (wrong status or already signed)' })
  @ApiResponse({ status: 404, description: 'Quote not found or link expired' })
  async signAndApprove(
    @Param('shareKey') shareKey: string,
    @Body() dto: SignAndApproveDto,
    @Req() req: Request,
  ) {
    // Validar formato antes de processar
    this.validateShareKey(shareKey);

    const requestInfo = {
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    };

    return this.quotesPublicService.signAndApproveByShareKey(shareKey, dto, requestInfo);
  }

  @Post(':shareKey/reject')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // Muito restritivo para ações de escrita
  @ApiOperation({
    summary: 'Reject quote (public access)',
    description: 'Client rejects the quote via public link. Optionally provides a reason.',
  })
  @ApiParam({ name: 'shareKey', description: 'Unique share key for the quote' })
  @ApiBody({ type: RejectQuoteDto })
  @ApiResponse({
    status: 200,
    description: 'Quote rejected successfully',
  })
  @ApiResponse({ status: 400, description: 'Quote cannot be rejected (wrong status)' })
  @ApiResponse({ status: 404, description: 'Quote not found or link expired' })
  async reject(
    @Param('shareKey') shareKey: string,
    @Body() dto: RejectQuoteDto,
  ) {
    // Validar formato antes de processar
    this.validateShareKey(shareKey);

    return this.quotesPublicService.rejectByShareKey(shareKey, dto.reason);
  }
}
