import { Controller, Get, Query, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  ReportsService,
  FinanceReportData,
  ClientsReportData,
  SalesReportData,
  OperationsReportData,
  DashboardOverviewData,
  ProfitLossReportData,
  ServicesReportData,
} from './reports.service';
import { ReportQueryDto } from './dto/report-query.dto';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ReportsController {
  private readonly logger = new Logger(ReportsController.name);

  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard overview' })
  async getDashboardOverview(
    @CurrentUser('id') userId: string,
    @Query() query: ReportQueryDto,
  ): Promise<DashboardOverviewData> {
    this.logger.log(`[Reports] GET /reports/dashboard - userId=${userId}`);
    return this.reportsService.getDashboardOverview(userId, query);
  }

  @Get('finance')
  @ApiOperation({ summary: 'Get finance report' })
  async getFinanceReport(
    @CurrentUser('id') userId: string,
    @Query() query: ReportQueryDto,
  ): Promise<FinanceReportData> {
    this.logger.log(`[Reports] GET /reports/finance - userId=${userId}`);
    return this.reportsService.getFinanceReport(userId, query);
  }

  @Get('sales')
  @ApiOperation({ summary: 'Get sales report (quotes)' })
  async getSalesReport(
    @CurrentUser('id') userId: string,
    @Query() query: ReportQueryDto,
  ): Promise<SalesReportData> {
    this.logger.log(`[Reports] GET /reports/sales - userId=${userId}`);
    return this.reportsService.getSalesReport(userId, query);
  }

  @Get('operations')
  @ApiOperation({ summary: 'Get operations report (work orders)' })
  async getOperationsReport(
    @CurrentUser('id') userId: string,
    @Query() query: ReportQueryDto,
  ): Promise<OperationsReportData> {
    this.logger.log(`[Reports] GET /reports/operations - userId=${userId}`);
    return this.reportsService.getOperationsReport(userId, query);
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

  @Get('profit-loss')
  @ApiOperation({ summary: 'Get profit/loss report (revenue vs expenses)' })
  async getProfitLossReport(
    @CurrentUser('id') userId: string,
    @Query() query: ReportQueryDto,
  ): Promise<ProfitLossReportData> {
    this.logger.log(`[Reports] GET /reports/profit-loss - userId=${userId}`);
    return this.reportsService.getProfitLossReport(userId, query);
  }

  @Get('services')
  @ApiOperation({ summary: 'Get services report (work orders by type)' })
  async getServicesReport(
    @CurrentUser('id') userId: string,
    @Query() query: ReportQueryDto,
  ): Promise<ServicesReportData> {
    this.logger.log(`[Reports] GET /reports/services - userId=${userId}`);
    return this.reportsService.getServicesReport(userId, query);
  }
}
