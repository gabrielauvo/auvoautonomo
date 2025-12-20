import {
  Controller,
  Get,
  Param,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { WorkOrdersPublicService } from './work-orders-public.service';

/**
 * Controller público para visualização de OS via link compartilhável
 * Não requer autenticação - usa shareKey como token de acesso
 */
@ApiTags('Work Orders (Public)')
@Controller('public/work-orders')
export class WorkOrdersPublicController {
  constructor(
    private readonly workOrdersPublicService: WorkOrdersPublicService,
  ) {}

  @Get(':shareKey')
  @ApiOperation({
    summary: 'Get work order by share key (public access)',
    description: 'Returns work order details for public viewing via shareable link. No authentication required.',
  })
  @ApiParam({ name: 'shareKey', description: 'Unique share key for the work order' })
  @ApiResponse({
    status: 200,
    description: 'Returns work order with company, client, and service details',
  })
  @ApiResponse({ status: 404, description: 'Work order not found or link expired' })
  async getByShareKey(@Param('shareKey') shareKey: string) {
    const workOrder = await this.workOrdersPublicService.findByShareKey(shareKey);

    if (!workOrder) {
      throw new NotFoundException('Ordem de serviço não encontrada ou link inválido');
    }

    return workOrder;
  }
}
