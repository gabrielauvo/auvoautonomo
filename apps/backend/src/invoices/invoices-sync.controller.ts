import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { InvoicesSyncService } from './invoices-sync.service';
import {
  SyncPullQueryDto,
  SyncInvoicesPullResponseDto,
  SyncInvoicesPushBodyDto,
  SyncInvoicesPushResponseDto,
  SyncScope,
} from './dto/sync-invoices.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Invoices Sync')
@ApiBearerAuth('JWT-auth')
@Controller('sync/invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesSyncController {
  constructor(private readonly invoicesSyncService: InvoicesSyncService) {}

  @Get()
  @ApiOperation({
    summary: 'Pull invoices for sync (delta sync with cursor pagination)',
    description: `
      Fetches invoices for mobile sync with delta sync support.

      Features:
      - Delta sync: Use 'since' parameter to only get records updated after a specific time
      - Cursor pagination: Use 'cursor' for efficient pagination through large datasets
      - Scope filtering: 'all' for full sync, 'recent' for last 90 days

      The response includes 'serverTime' which should be used as 'since' in the next sync.
    `,
  })
  @ApiQuery({
    name: 'since',
    required: false,
    description: 'ISO date string - only return records updated after this date',
    example: '2024-01-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Cursor for pagination (base64 encoded)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of records per page (max 500)',
    example: 100,
  })
  @ApiQuery({
    name: 'scope',
    required: false,
    enum: SyncScope,
    description: 'Scope of invoices to sync',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns invoices with pagination info',
    type: SyncInvoicesPullResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  pull(
    @CurrentUser() user: any,
    @Query() query: SyncPullQueryDto,
  ): Promise<SyncInvoicesPullResponseDto> {
    return this.invoicesSyncService.pull(user.id, query);
  }

  @Post('mutations')
  @ApiOperation({
    summary: 'Push invoice mutations from mobile (create, update, delete)',
    description: `
      Processes mutations from mobile devices with idempotency support.

      Features:
      - Idempotency: Each mutation has a unique mutationId to prevent duplicate processing
      - Conflict resolution: Last-write-wins based on clientUpdatedAt
      - Batch processing: Multiple mutations can be sent in a single request

      Actions:
      - create: Create a new invoice (auto-generates invoice number)
      - update: Update invoice fields
      - delete: Soft delete the invoice
    `,
  })
  @ApiBody({ type: SyncInvoicesPushBodyDto })
  @ApiResponse({
    status: 200,
    description: 'Returns results for each mutation',
    type: SyncInvoicesPushResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  push(
    @CurrentUser() user: any,
    @Body() body: SyncInvoicesPushBodyDto,
  ): Promise<SyncInvoicesPushResponseDto> {
    return this.invoicesSyncService.push(user.id, body);
  }
}
