import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto, UpdateExpenseDto, ExpenseFiltersDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('expenses')
@ApiBearerAuth('JWT-auth')
@Controller('expenses')
@UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @ApiOperation({ summary: 'Criar uma nova despesa' })
  @ApiBody({ type: CreateExpenseDto })
  @ApiResponse({ status: 201, description: 'Despesa criada com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Limite de despesas atingido' })
  create(@CurrentUser() user: any, @Body() createDto: CreateExpenseDto) {
    return this.expensesService.create(user.id, createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas as despesas' })
  @ApiResponse({ status: 200, description: 'Lista de despesas' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  findAll(@CurrentUser() user: any, @Query() filters: ExpenseFiltersDto) {
    return this.expensesService.findAll(user.id, filters);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Obter resumo das despesas' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Data inicial' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Data final' })
  @ApiResponse({ status: 200, description: 'Resumo das despesas' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  getSummary(
    @CurrentUser() user: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.expensesService.getSummary(user.id, { startDate, endDate });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar uma despesa por ID' })
  @ApiParam({ name: 'id', description: 'UUID da despesa' })
  @ApiResponse({ status: 200, description: 'Despesa encontrada' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Despesa não encontrada' })
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.expensesService.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar uma despesa' })
  @ApiParam({ name: 'id', description: 'UUID da despesa' })
  @ApiBody({ type: UpdateExpenseDto })
  @ApiResponse({ status: 200, description: 'Despesa atualizada' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Despesa não encontrada' })
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updateDto: UpdateExpenseDto,
  ) {
    return this.expensesService.update(user.id, id, updateDto);
  }

  @Patch(':id/pay')
  @ApiOperation({ summary: 'Marcar despesa como paga' })
  @ApiParam({ name: 'id', description: 'UUID da despesa' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        paidAt: {
          type: 'string',
          format: 'date',
          description: 'Data do pagamento (opcional, padrão: hoje)',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Despesa marcada como paga' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Despesa não encontrada' })
  markAsPaid(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body('paidAt') paidAt?: string,
  ) {
    return this.expensesService.markAsPaid(user.id, id, paidAt);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Excluir uma despesa (soft delete)' })
  @ApiParam({ name: 'id', description: 'UUID da despesa' })
  @ApiResponse({ status: 200, description: 'Despesa excluída' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Despesa não encontrada' })
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.expensesService.remove(user.id, id);
  }
}
