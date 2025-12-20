import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SignaturesService } from './signatures.service';
import { CreateSignatureDto } from './dto/create-signature.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class SignaturesController {
  constructor(private readonly signaturesService: SignaturesService) {}

  /**
   * Create signature for a Work Order
   * POST /work-orders/:workOrderId/signature
   */
  @Post('work-orders/:workOrderId/signature')
  createWorkOrderSignature(
    @CurrentUser('id') userId: string,
    @Param('workOrderId', ParseUUIDPipe) workOrderId: string,
    @Body() dto: CreateSignatureDto,
    @Req() req: Request,
  ) {
    const requestInfo = {
      ipAddress: req.ip || req.headers['x-forwarded-for']?.toString(),
      userAgent: req.headers['user-agent'],
    };

    return this.signaturesService.createWorkOrderSignature(
      userId,
      workOrderId,
      dto,
      requestInfo,
    );
  }

  /**
   * Create signature for a Quote (acceptance)
   * POST /quotes/:quoteId/signature
   */
  @Post('quotes/:quoteId/signature')
  createQuoteSignature(
    @CurrentUser('id') userId: string,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Body() dto: CreateSignatureDto,
    @Req() req: Request,
  ) {
    const requestInfo = {
      ipAddress: req.ip || req.headers['x-forwarded-for']?.toString(),
      userAgent: req.headers['user-agent'],
    };

    return this.signaturesService.createQuoteSignature(
      userId,
      quoteId,
      dto,
      requestInfo,
    );
  }

  /**
   * Get signature by ID
   * GET /signatures/:id
   */
  @Get('signatures/:id')
  findOne(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.signaturesService.findOne(userId, id);
  }

  /**
   * Get signature for a Work Order
   * GET /work-orders/:workOrderId/signature
   */
  @Get('work-orders/:workOrderId/signature')
  findByWorkOrder(
    @CurrentUser('id') userId: string,
    @Param('workOrderId', ParseUUIDPipe) workOrderId: string,
  ) {
    return this.signaturesService.findByWorkOrder(userId, workOrderId);
  }

  /**
   * Get signature for a Quote
   * GET /quotes/:quoteId/signature
   */
  @Get('quotes/:quoteId/signature')
  findByQuote(
    @CurrentUser('id') userId: string,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
  ) {
    return this.signaturesService.findByQuote(userId, quoteId);
  }

  /**
   * Verify signature integrity
   * GET /signatures/:id/verify
   */
  @Get('signatures/:id/verify')
  verifySignature(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.signaturesService.verifySignature(userId, id);
  }
}
