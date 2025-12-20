import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExecutionSessionType } from '@prisma/client';
import {
  SyncExecutionSessionsRequestDto,
  SyncExecutionSessionsResponseDto,
  SyncExecutionSessionResultDto,
} from './dto/sync-execution-sessions.dto';

@Injectable()
export class WorkOrderExecutionSessionsService {
  private readonly logger = new Logger(WorkOrderExecutionSessionsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Sincronizar sessões de execução do mobile
   * Usa localId para idempotência - se já existe sessão com mesmo localId, retorna como 'exists'
   */
  async syncSessions(
    userId: string,
    technicianId: string,
    dto: SyncExecutionSessionsRequestDto,
  ): Promise<SyncExecutionSessionsResponseDto> {
    // Validar que a OS pertence ao usuário
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: dto.workOrderId, userId },
    });

    if (!workOrder) {
      throw new NotFoundException(`Work Order ${dto.workOrderId} not found`);
    }

    const results: SyncExecutionSessionResultDto[] = [];

    for (const session of dto.sessions) {
      try {
        // Verificar se já existe e atualizar ou criar
        // Usando transação para evitar race condition
        const existing = await this.prisma.workOrderExecutionSession.findFirst({
          where: {
            workOrderId: dto.workOrderId,
            localId: session.localId,
          },
        });

        if (existing) {
          // Atualizar se houver mudanças (endedAt, duration)
          if (session.endedAt && !existing.endedAt) {
            await this.prisma.workOrderExecutionSession.update({
              where: { id: existing.id },
              data: {
                endedAt: new Date(session.endedAt),
                duration: session.duration,
                notes: session.notes,
              },
            });
            results.push({
              localId: session.localId,
              serverId: existing.id,
              status: 'updated',
            });
          } else {
            results.push({
              localId: session.localId,
              serverId: existing.id,
              status: 'exists',
            });
          }
          continue;
        }

        // Criar nova sessão
        // O findFirst acima já verificou que não existe
        const newSession = await this.prisma.workOrderExecutionSession.create({
          data: {
            workOrderId: dto.workOrderId,
            technicianId,
            sessionType: session.sessionType as ExecutionSessionType,
            startedAt: new Date(session.startedAt),
            endedAt: session.endedAt ? new Date(session.endedAt) : null,
            duration: session.duration,
            pauseReason: session.pauseReason,
            notes: session.notes,
            localId: session.localId,
          },
        });

        this.logger.log(`Session created/updated: ${newSession.id} for WO ${dto.workOrderId}`);

        results.push({
          localId: session.localId,
          serverId: newSession.id,
          status: 'created',
        });
      } catch (error: any) {
        this.logger.error(`Error syncing session ${session.localId}: ${error.message}`);
        results.push({
          localId: session.localId,
          status: 'error',
          error: error.message,
        });
      }
    }

    return {
      results,
      serverTime: new Date().toISOString(),
    };
  }

  /**
   * Buscar sessões de uma OS
   */
  async getByWorkOrder(userId: string, workOrderId: string) {
    // Validar que a OS pertence ao usuário
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, userId },
    });

    if (!workOrder) {
      throw new NotFoundException(`Work Order ${workOrderId} not found`);
    }

    return this.prisma.workOrderExecutionSession.findMany({
      where: { workOrderId },
      orderBy: { startedAt: 'asc' },
    });
  }

  /**
   * Calcular resumo de tempo de uma OS
   */
  async getTimeSummary(userId: string, workOrderId: string) {
    const sessions = await this.getByWorkOrder(userId, workOrderId);

    let totalWorkTime = 0;
    let totalPauseTime = 0;
    let workSessionCount = 0;
    let pauseSessionCount = 0;

    for (const session of sessions) {
      if (session.duration) {
        if (session.sessionType === 'WORK') {
          totalWorkTime += session.duration;
          workSessionCount++;
        } else {
          totalPauseTime += session.duration;
          pauseSessionCount++;
        }
      }
    }

    return {
      totalWorkTime,
      totalPauseTime,
      workSessionCount,
      pauseSessionCount,
      totalSessions: sessions.length,
    };
  }
}
