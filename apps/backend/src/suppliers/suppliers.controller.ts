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
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('suppliers')
@ApiBearerAuth('JWT-auth')
@Controller('suppliers')
@UseGuards(JwtAuthGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @ApiOperation({ summary: 'Criar um novo fornecedor' })
  @ApiBody({ type: CreateSupplierDto })
  @ApiResponse({ status: 201, description: 'Fornecedor criado com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Limite de fornecedores atingido' })
  create(@CurrentUser() user: any, @Body() createSupplierDto: CreateSupplierDto) {
    return this.suppliersService.create(user.id, createSupplierDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos os fornecedores' })
  @ApiQuery({ name: 'search', required: false, description: 'Busca por nome, email, documento ou telefone' })
  @ApiResponse({ status: 200, description: 'Lista de fornecedores' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  findAll(@CurrentUser() user: any, @Query('search') search?: string) {
    return this.suppliersService.findAll(user.id, { search });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar um fornecedor por ID' })
  @ApiParam({ name: 'id', description: 'UUID do fornecedor' })
  @ApiResponse({ status: 200, description: 'Fornecedor encontrado' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Fornecedor não encontrado' })
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.suppliersService.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar um fornecedor' })
  @ApiParam({ name: 'id', description: 'UUID do fornecedor' })
  @ApiBody({ type: UpdateSupplierDto })
  @ApiResponse({ status: 200, description: 'Fornecedor atualizado' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Fornecedor não encontrado' })
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updateSupplierDto: UpdateSupplierDto,
  ) {
    return this.suppliersService.update(user.id, id, updateSupplierDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Excluir um fornecedor (soft delete)' })
  @ApiParam({ name: 'id', description: 'UUID do fornecedor' })
  @ApiResponse({ status: 200, description: 'Fornecedor excluído' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Fornecedor não encontrado' })
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.suppliersService.remove(user.id, id);
  }
}
