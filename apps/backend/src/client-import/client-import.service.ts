import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExcelParserService, ParsedClientRow, ParseRowError } from './excel-parser.service';
import { ImportJobStatus, Prisma } from '@prisma/client';
import { PlanLimitsService } from '../billing/plan-limits.service';

const BATCH_SIZE = 50;

@Injectable()
export class ClientImportService {
  private readonly logger = new Logger(ClientImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly excelParser: ExcelParserService,
    private readonly planLimits: PlanLimitsService,
  ) {}

  /**
   * Verifica se o usuário tem acesso ao recurso de importação (PRO only)
   */
  async checkProAccess(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { plan: true },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const isPro = user.plan?.type === 'PRO' || user.plan?.type === 'TEAM';
    if (!isPro) {
      throw new ForbiddenException(
        'Importação em massa é um recurso exclusivo do plano PRO. Faça upgrade para usar esta funcionalidade.',
      );
    }
  }

  /**
   * Inicia o processo de importação
   */
  async startImport(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ jobId: string; status: string; totalRows: number; message: string }> {
    // Validar arquivo
    this.excelParser.validateFile(file.buffer, file.originalname, file.mimetype);

    // Parse do Excel
    const parseResult = await this.excelParser.parseExcel(file.buffer);

    if (parseResult.rows.length === 0) {
      throw new BadRequestException(
        'Nenhuma linha válida encontrada no arquivo. Verifique se o formato está correto.',
      );
    }

    // Criar job de importação
    const job = await this.prisma.importJob.create({
      data: {
        userId,
        fileName: file.originalname,
        fileSize: file.size,
        totalRows: parseResult.totalRows,
        status: ImportJobStatus.VALIDATING,
        errorDetails: parseResult.errors.length > 0
          ? JSON.parse(JSON.stringify(parseResult.errors))
          : Prisma.JsonNull,
      },
    });

    // Processar de forma assíncrona (não bloqueante)
    // Usamos setImmediate para liberar o event loop
    setImmediate(() => {
      this.processImport(job.id, userId, parseResult.rows, parseResult.errors).catch(
        (error) => {
          this.logger.error(
            `Erro ao processar importação ${job.id}: ${error.message}`,
            error.stack,
          );
        },
      );
    });

    return {
      jobId: job.id,
      status: job.status,
      totalRows: parseResult.totalRows,
      message:
        parseResult.errors.length > 0
          ? `Importação iniciada. ${parseResult.errors.length} linha(s) com problemas detectadas.`
          : 'Importação iniciada com sucesso.',
    };
  }

  /**
   * Processa a importação em background
   */
  private async processImport(
    jobId: string,
    userId: string,
    rows: ParsedClientRow[],
    initialErrors: ParseRowError[],
  ): Promise<void> {
    const allErrors: ParseRowError[] = [...initialErrors];
    let successCount = 0;
    let processedRows = 0;

    try {
      // Atualizar status para PROCESSING
      await this.prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: ImportJobStatus.PROCESSING,
          startedAt: new Date(),
        },
      });

      // Buscar clientes existentes do usuário (para verificar duplicatas)
      const existingClients = await this.prisma.client.findMany({
        where: { userId },
        select: { id: true, taxId: true },
      });

      const existingTaxIds = new Map<string, string>(
        existingClients
          .filter((c) => c.taxId !== null)
          .map((c) => [c.taxId as string, c.id]),
      );

      // Processar em batches
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const batchResults = await this.processBatch(
          userId,
          batch,
          existingTaxIds,
        );

        successCount += batchResults.success;
        allErrors.push(...batchResults.errors);
        processedRows += batch.length;

        // Atualizar progresso
        await this.prisma.importJob.update({
          where: { id: jobId },
          data: {
            processedRows,
            successCount,
            errorCount: allErrors.length,
            errorDetails: allErrors.length > 0
              ? JSON.parse(JSON.stringify(allErrors))
              : Prisma.JsonNull,
          },
        });
      }

      // Finalizar com sucesso
      await this.prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: ImportJobStatus.COMPLETED,
          completedAt: new Date(),
          processedRows: rows.length,
          successCount,
          errorCount: allErrors.length,
          errorDetails: allErrors.length > 0
            ? JSON.parse(JSON.stringify(allErrors))
            : Prisma.JsonNull,
        },
      });

      this.logger.log(
        `Importação ${jobId} concluída: ${successCount} sucesso, ${allErrors.length} erros`,
      );
    } catch (error) {
      this.logger.error(
        `Falha na importação ${jobId}: ${error.message}`,
        error.stack,
      );

      // Marcar como falha
      await this.prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: ImportJobStatus.FAILED,
          completedAt: new Date(),
          errorDetails: JSON.parse(JSON.stringify([
            ...allErrors,
            {
              row: 0,
              field: 'geral',
              value: '',
              message: `Erro interno: ${error.message}`,
            },
          ])),
        },
      });
    }
  }

  /**
   * Processa um batch de linhas
   */
  private async processBatch(
    userId: string,
    rows: ParsedClientRow[],
    existingTaxIds: Map<string, string>,
  ): Promise<{ success: number; errors: ParseRowError[] }> {
    const errors: ParseRowError[] = [];
    let success = 0;

    for (const row of rows) {
      try {
        const existingClientId = existingTaxIds.get(row.taxId);

        if (existingClientId) {
          // Atualizar cliente existente
          await this.prisma.client.update({
            where: { id: existingClientId },
            data: {
              name: row.name,
              phone: row.phone,
              email: row.email || null,
              address: row.address || null,
              city: row.city || null,
              state: row.state || null,
              zipCode: row.zipCode || null,
              notes: row.notes || null,
            },
          });
        } else {
          // Criar novo cliente
          const newClient = await this.prisma.client.create({
            data: {
              userId,
              name: row.name,
              taxId: row.taxId,
              phone: row.phone,
              email: row.email || null,
              address: row.address || null,
              city: row.city || null,
              state: row.state || null,
              zipCode: row.zipCode || null,
              notes: row.notes || null,
            },
          });

          // Adicionar ao mapa para evitar duplicatas dentro do mesmo batch
          existingTaxIds.set(row.taxId, newClient.id);
        }

        success++;
      } catch (error) {
        // Tratar erro de unique constraint (duplicata em outra importação paralela)
        if (error.code === 'P2002') {
          errors.push({
            row: row.rowNumber,
            field: 'taxId',
            value: row.taxId,
            message: 'CPF/CNPJ já cadastrado por outro processo',
          });
        } else {
          errors.push({
            row: row.rowNumber,
            field: 'geral',
            value: '',
            message: `Erro ao salvar: ${error.message}`,
          });
        }
      }
    }

    return { success, errors };
  }

  /**
   * Lista jobs de importação do usuário
   */
  async listJobs(
    userId: string,
    page = 1,
    limit = 10,
  ): Promise<{ data: any[]; total: number }> {
    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      this.prisma.importJob.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.importJob.count({ where: { userId } }),
    ]);

    return {
      data: jobs.map((job) => ({
        id: job.id,
        status: job.status,
        fileName: job.fileName,
        fileSize: job.fileSize,
        totalRows: job.totalRows,
        processedRows: job.processedRows,
        successCount: job.successCount,
        errorCount: job.errorCount,
        errorDetails: job.errorDetails,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
      })),
      total,
    };
  }

  /**
   * Obtém detalhes de um job específico
   */
  async getJob(userId: string, jobId: string): Promise<any> {
    const job = await this.prisma.importJob.findFirst({
      where: {
        id: jobId,
        userId,
      },
    });

    if (!job) {
      throw new NotFoundException('Job de importação não encontrado');
    }

    return {
      id: job.id,
      status: job.status,
      fileName: job.fileName,
      fileSize: job.fileSize,
      totalRows: job.totalRows,
      processedRows: job.processedRows,
      successCount: job.successCount,
      errorCount: job.errorCount,
      errorDetails: job.errorDetails,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    };
  }

  /**
   * Cancela um job pendente
   */
  async cancelJob(userId: string, jobId: string): Promise<void> {
    const job = await this.prisma.importJob.findFirst({
      where: {
        id: jobId,
        userId,
      },
    });

    if (!job) {
      throw new NotFoundException('Job de importação não encontrado');
    }

    if (job.status !== ImportJobStatus.PENDING) {
      throw new BadRequestException(
        'Apenas jobs pendentes podem ser cancelados',
      );
    }

    await this.prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: ImportJobStatus.FAILED,
        completedAt: new Date(),
        errorDetails: JSON.parse(JSON.stringify([
          {
            row: 0,
            field: 'geral',
            value: '',
            message: 'Cancelado pelo usuário',
          },
        ])),
      },
    });
  }

  /**
   * Gera o template Excel
   */
  async getTemplate(): Promise<Buffer> {
    return this.excelParser.generateTemplate();
  }
}
