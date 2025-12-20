import { Controller, Get, Query, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ReportsService, FinanceReportData, ClientsReportData } from './reports.service';
import { ReportQueryDto } from './dto/report-query.dto';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ReportsController {
  private readonly logger = new Logger(ReportsController.name);

  constructor(private readonly reportsService: ReportsService) {}

  @Get('finance')
  @ApiOperation({ summary: 'Get finance report' })
  async getFinanceReport(
    @CurrentUser('id') userId: string,
    @Query() query: ReportQueryDto,
  ): Promise<FinanceReportData> {
    this.logger.log(`[Reports] GET /reports/finance - userId=${userId}`);
    return this.reportsService.getFinanceReport(userId, query);
  }

  @Get('clients')
  @ApiOperation({ summary: 'Get clients report' })
  async getClientsReport(
    @CurrentUser('id') userId: string,
    @Query() query: ReportQueryDto,
  ): Promise<ClientsReportData> {
    this.logger.log(`[Reports] GET /reports/clients - userId=${userId}`);
    return this.reportsService.getClientsReport(userId, query);
  }
}
