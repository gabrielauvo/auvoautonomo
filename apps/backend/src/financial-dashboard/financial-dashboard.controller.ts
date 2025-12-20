import { Controller, Get, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FinancialDashboardService } from './financial-dashboard.service';
import { OverviewQueryDto, PaymentsQueryDto, RevenueByDayQueryDto, RevenueByClientQueryDto } from './dto';

@Controller('financial/dashboard')
@UseGuards(JwtAuthGuard)
export class FinancialDashboardController {
  constructor(private readonly financialDashboardService: FinancialDashboardService) {}

  /**
   * GET /financial/dashboard/overview
   * Returns aggregated financial metrics for the specified period
   *
   * @query period - 'current_month' | 'last_month' | 'current_year' | 'custom'
   * @query startDate - Start date for custom period (ISO format)
   * @query endDate - End date for custom period (ISO format)
   */
  @Get('overview')
  async getOverview(@Request() req, @Query() query: OverviewQueryDto) {
    return this.financialDashboardService.getOverview(req.user.userId, query);
  }

  /**
   * GET /financial/dashboard/revenue-by-day
   * Returns daily revenue breakdown for the specified date range
   *
   * @query startDate - Start date (ISO format, defaults to start of current month)
   * @query endDate - End date (ISO format, defaults to end of current month)
   */
  @Get('revenue-by-day')
  async getRevenueByDay(@Request() req, @Query() query: RevenueByDayQueryDto) {
    return this.financialDashboardService.getRevenueByDay(req.user.userId, query);
  }

  /**
   * GET /financial/dashboard/revenue-by-client
   * Returns revenue grouped by client
   *
   * @query period - 'current_month' | 'last_month' | 'current_year' | 'all_time'
   * @query startDate - Start date for custom range (ISO format)
   * @query endDate - End date for custom range (ISO format)
   */
  @Get('revenue-by-client')
  async getRevenueByClient(@Request() req, @Query() query: RevenueByClientQueryDto) {
    return this.financialDashboardService.getRevenueByClient(req.user.userId, query);
  }

  /**
   * GET /financial/dashboard/payments
   * Returns filtered list of payments
   *
   * @query status - Filter by payment status
   * @query billingType - Filter by billing type (PIX, BOLETO, CREDIT_CARD)
   * @query startDate - Filter by date range start
   * @query endDate - Filter by date range end
   * @query dateField - Which date field to filter ('paidAt' | 'dueDate')
   * @query clientId - Filter by client
   * @query workOrderId - Filter by work order
   * @query quoteId - Filter by quote
   * @query sortBy - Sort field ('createdAt' | 'dueDate' | 'paidAt' | 'value')
   * @query sortOrder - Sort order ('asc' | 'desc')
   */
  @Get('payments')
  async getPayments(@Request() req, @Query() query: PaymentsQueryDto) {
    return this.financialDashboardService.getPayments(req.user.userId, query);
  }

  /**
   * GET /financial/dashboard/client/:clientId
   * Returns financial extract for a specific client
   *
   * @param clientId - Client UUID
   */
  @Get('client/:clientId')
  async getClientExtract(@Request() req, @Param('clientId') clientId: string) {
    return this.financialDashboardService.getClientExtract(req.user.userId, clientId);
  }

  /**
   * GET /financial/dashboard/work-order/:workOrderId
   * Returns financial extract for a specific work order
   *
   * @param workOrderId - Work order UUID
   */
  @Get('work-order/:workOrderId')
  async getWorkOrderExtract(@Request() req, @Param('workOrderId') workOrderId: string) {
    return this.financialDashboardService.getWorkOrderExtract(req.user.userId, workOrderId);
  }
}
