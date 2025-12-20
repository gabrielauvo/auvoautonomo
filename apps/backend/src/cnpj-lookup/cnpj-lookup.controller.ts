import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CnpjLookupService, CnpjLookupResponse } from './cnpj-lookup.service';

@ApiTags('CNPJ Lookup')
@Controller('cnpj')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CnpjLookupController {
  constructor(private readonly cnpjLookupService: CnpjLookupService) {}

  @Get(':cnpj')
  @ApiOperation({
    summary: 'Consultar dados de empresa pelo CNPJ',
    description: 'Retorna dados da empresa consultando a API da Receita Federal via CNPJá',
  })
  @ApiParam({
    name: 'cnpj',
    description: 'CNPJ da empresa (com ou sem formatação)',
    example: '33000167000101',
  })
  @ApiResponse({
    status: 200,
    description: 'Dados da empresa encontrados',
    schema: {
      type: 'object',
      properties: {
        taxId: { type: 'string', example: '33000167000101' },
        name: { type: 'string', example: 'PETROLEO BRASILEIRO S A PETROBRAS' },
        alias: { type: 'string', example: 'Petrobras - Edise' },
        email: { type: 'string', example: 'contato@empresa.com.br' },
        phone: { type: 'string', example: '(21) 21660000' },
        address: { type: 'string', example: 'Avenida República do Chile, 65, Centro' },
        city: { type: 'string', example: 'Rio de Janeiro' },
        state: { type: 'string', example: 'RJ' },
        zipCode: { type: 'string', example: '20031-170' },
        status: { type: 'string', example: 'Ativa' },
        foundedAt: { type: 'string', example: '1966-09-28' },
        activities: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              code: { type: 'string', example: '0600001' },
              description: { type: 'string', example: 'Extração de petróleo e gás natural' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'CNPJ inválido ou não encontrado',
  })
  @ApiResponse({
    status: 429,
    description: 'Limite de consultas excedido',
  })
  async lookup(@Param('cnpj') cnpj: string): Promise<CnpjLookupResponse> {
    return this.cnpjLookupService.lookup(cnpj);
  }
}
