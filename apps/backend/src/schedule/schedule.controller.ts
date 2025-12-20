import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScheduleService } from './schedule.service';
import {
  ScheduleDayQueryDto,
  ScheduleRangeQueryDto,
  ScheduleDayResponseDto,
} from './dto';

@ApiTags('Schedule')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('schedule')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get('day')
  @ApiOperation({
    summary: 'Busca atividades do dia',
    description:
      'Retorna todas as atividades (Work Orders e visitas de orçamento) agendadas para um dia específico',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de atividades do dia',
    type: ScheduleDayResponseDto,
  })
  async getScheduleByDay(
    @Request() req: any,
    @Query() query: ScheduleDayQueryDto,
  ): Promise<ScheduleDayResponseDto> {
    return this.scheduleService.getScheduleByDay(req.user.id, query.date);
  }

  @Get('range')
  @ApiOperation({
    summary: 'Busca atividades em um range de datas',
    description:
      'Retorna todas as atividades agrupadas por dia para um período específico',
  })
  @ApiResponse({
    status: 200,
    description: 'Mapa de atividades por dia',
  })
  async getScheduleByRange(
    @Request() req: any,
    @Query() query: ScheduleRangeQueryDto,
  ): Promise<Record<string, ScheduleDayResponseDto>> {
    return this.scheduleService.getScheduleByRange(
      req.user.id,
      query.startDate,
      query.endDate,
    );
  }
}
