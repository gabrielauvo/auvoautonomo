import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ServiceFlowService } from './service-flow.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConvertToWorkOrderDto } from './dto/convert-to-work-order.dto';
import { CompleteWorkOrderDto } from './dto/complete-work-order.dto';
import { GeneratePaymentDto } from './dto/generate-payment.dto';

@Controller('service-flow')
@UseGuards(JwtAuthGuard)
export class ServiceFlowController {
  constructor(private readonly serviceFlowService: ServiceFlowService) {}

  /**
   * Convert an approved quote to a work order
   * POST /service-flow/quote/:quoteId/convert-to-work-order
   */
  @Post('quote/:quoteId/convert-to-work-order')
  async convertToWorkOrder(
    @Request() req,
    @Param('quoteId') quoteId: string,
    @Body() dto: ConvertToWorkOrderDto,
  ) {
    return this.serviceFlowService.convertQuoteToWorkOrder(
      req.user.sub,
      quoteId,
      dto,
    );
  }

  /**
   * Complete a work order (validates checklists)
   * POST /service-flow/work-order/:workOrderId/complete
   */
  @Post('work-order/:workOrderId/complete')
  async completeWorkOrder(
    @Request() req,
    @Param('workOrderId') workOrderId: string,
    @Body() dto: CompleteWorkOrderDto,
  ) {
    return this.serviceFlowService.completeWorkOrder(
      req.user.sub,
      workOrderId,
      dto,
    );
  }

  /**
   * Generate payment from a completed work order
   * POST /service-flow/work-order/:workOrderId/generate-payment
   */
  @Post('work-order/:workOrderId/generate-payment')
  async generatePayment(
    @Request() req,
    @Param('workOrderId') workOrderId: string,
    @Body() dto: GeneratePaymentDto,
  ) {
    return this.serviceFlowService.generatePayment(
      req.user.sub,
      workOrderId,
      dto,
    );
  }

  /**
   * Get client timeline with all events
   * GET /service-flow/client/:clientId/timeline
   */
  @Get('client/:clientId/timeline')
  async getClientTimeline(
    @Request() req,
    @Param('clientId') clientId: string,
  ) {
    return this.serviceFlowService.getClientTimeline(req.user.sub, clientId);
  }

  /**
   * Get work order extract (financial summary)
   * GET /service-flow/work-order/:workOrderId/extract
   */
  @Get('work-order/:workOrderId/extract')
  async getWorkOrderExtract(
    @Request() req,
    @Param('workOrderId') workOrderId: string,
  ) {
    return this.serviceFlowService.getWorkOrderExtract(req.user.sub, workOrderId);
  }
}
