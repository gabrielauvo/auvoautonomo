import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegionalService } from '../regional/regional.service';
import {
  ScheduleActivityDto,
  ScheduleActivityType,
  ScheduleDayResponseDto,
} from './dto';
import {
  getDayBoundsInTimezone,
  getDateStringInTimezone,
} from '../common/utils/timezone.util';

@Injectable()
export class ScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly regionalService: RegionalService,
  ) {}

  /**
   * Busca todas as atividades de um dia específico
   * Inclui Work Orders e visitas de orçamento (Quote visits)
   */
  async getScheduleByDay(
    userId: string,
    date: string,
  ): Promise<ScheduleDayResponseDto> {
    // Obtém o timezone configurado para a empresa do usuário
    const timezone = await this.regionalService.getCompanyTimezone(userId);

    // Converte a data para início e fim do dia no timezone do usuário
    // A data vem como YYYY-MM-DD do frontend no timezone local do usuário
    // Precisamos converter para UTC considerando o offset do timezone configurado
    const { startOfDay, endOfDay } = getDayBoundsInTimezone(date, timezone);

    // Busca Work Orders agendadas para o dia
    const workOrders = await this.prisma.workOrder.findMany({
      where: {
        userId,
        scheduledDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
      orderBy: {
        scheduledStartTime: 'asc',
      },
    });

    // Busca Quotes com visita agendada para o dia
    const quoteVisits = await this.prisma.quote.findMany({
      where: {
        userId,
        visitScheduledAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
            city: true,
            state: true,
          },
        },
      },
      orderBy: {
        visitScheduledAt: 'asc',
      },
    });

    // Transforma Work Orders em atividades
    const workOrderActivities: ScheduleActivityDto[] = workOrders.map((wo) => ({
      id: wo.id,
      type: 'WORK_ORDER' as ScheduleActivityType,
      title: wo.title,
      status: wo.status,
      scheduledStart: wo.scheduledStartTime || wo.scheduledDate!,
      scheduledEnd: wo.scheduledEndTime || undefined,
      client: {
        id: wo.client.id,
        name: wo.client.name,
        phone: wo.client.phone || undefined,
      },
      address: wo.address || undefined,
      totalValue: wo.totalValue ? Number(wo.totalValue) : undefined,
      durationMinutes: this.calculateDuration(
        wo.scheduledStartTime,
        wo.scheduledEndTime,
      ),
    }));

    // Transforma Quote visits em atividades
    const quoteVisitActivities: ScheduleActivityDto[] = quoteVisits.map((q) => {
      // Monta endereço do cliente se não houver endereço específico
      const clientAddress = [q.client.address, q.client.city, q.client.state]
        .filter(Boolean)
        .join(', ');

      return {
        id: q.id,
        type: 'QUOTE_VISIT' as ScheduleActivityType,
        title: `Visita para orçamento - ${q.client.name}`,
        status: q.status,
        scheduledStart: q.visitScheduledAt!,
        scheduledEnd: undefined,
        client: {
          id: q.client.id,
          name: q.client.name,
          phone: q.client.phone || undefined,
        },
        address: clientAddress || undefined,
        totalValue: Number(q.totalValue),
        durationMinutes: 60, // Duração padrão de 1h para visitas
      };
    });

    // Combina e ordena por horário de início
    const allActivities = [...workOrderActivities, ...quoteVisitActivities].sort(
      (a, b) =>
        new Date(a.scheduledStart).getTime() -
        new Date(b.scheduledStart).getTime(),
    );

    return {
      date,
      activities: allActivities,
      totalCount: allActivities.length,
      workOrdersCount: workOrderActivities.length,
      quoteVisitsCount: quoteVisitActivities.length,
    };
  }

  /**
   * Busca atividades em um range de datas (para visão semanal/mensal futura)
   */
  async getScheduleByRange(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<Record<string, ScheduleDayResponseDto>> {
    // Obtém o timezone configurado para a empresa do usuário
    const timezone = await this.regionalService.getCompanyTimezone(userId);

    // Converte para o timezone do usuário
    const { startOfDay: start } = getDayBoundsInTimezone(startDate, timezone);
    const { endOfDay: end } = getDayBoundsInTimezone(endDate, timezone);

    // Busca Work Orders no range
    const workOrders = await this.prisma.workOrder.findMany({
      where: {
        userId,
        scheduledDate: {
          gte: start,
          lte: end,
        },
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
      orderBy: {
        scheduledStartTime: 'asc',
      },
    });

    // Busca Quote visits no range
    const quoteVisits = await this.prisma.quote.findMany({
      where: {
        userId,
        visitScheduledAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
            city: true,
            state: true,
          },
        },
      },
      orderBy: {
        visitScheduledAt: 'asc',
      },
    });

    // Agrupa por dia
    const result: Record<string, ScheduleDayResponseDto> = {};

    // Processa Work Orders
    for (const wo of workOrders) {
      // Converte para timezone do usuário antes de extrair a data
      const dateKey = getDateStringInTimezone(wo.scheduledDate!, timezone);

      if (!result[dateKey]) {
        result[dateKey] = {
          date: dateKey,
          activities: [],
          totalCount: 0,
          workOrdersCount: 0,
          quoteVisitsCount: 0,
        };
      }

      result[dateKey].activities.push({
        id: wo.id,
        type: 'WORK_ORDER',
        title: wo.title,
        status: wo.status,
        scheduledStart: wo.scheduledStartTime || wo.scheduledDate!,
        scheduledEnd: wo.scheduledEndTime || undefined,
        client: {
          id: wo.client.id,
          name: wo.client.name,
          phone: wo.client.phone || undefined,
        },
        address: wo.address || undefined,
        totalValue: wo.totalValue ? Number(wo.totalValue) : undefined,
        durationMinutes: this.calculateDuration(
          wo.scheduledStartTime,
          wo.scheduledEndTime,
        ),
      });

      result[dateKey].workOrdersCount++;
      result[dateKey].totalCount++;
    }

    // Processa Quote visits
    for (const q of quoteVisits) {
      // Converte para timezone do usuário antes de extrair a data
      const dateKey = getDateStringInTimezone(q.visitScheduledAt!, timezone);

      if (!result[dateKey]) {
        result[dateKey] = {
          date: dateKey,
          activities: [],
          totalCount: 0,
          workOrdersCount: 0,
          quoteVisitsCount: 0,
        };
      }

      const clientAddress = [q.client.address, q.client.city, q.client.state]
        .filter(Boolean)
        .join(', ');

      result[dateKey].activities.push({
        id: q.id,
        type: 'QUOTE_VISIT',
        title: `Visita para orçamento - ${q.client.name}`,
        status: q.status,
        scheduledStart: q.visitScheduledAt!,
        scheduledEnd: undefined,
        client: {
          id: q.client.id,
          name: q.client.name,
          phone: q.client.phone || undefined,
        },
        address: clientAddress || undefined,
        totalValue: Number(q.totalValue),
        durationMinutes: 60,
      });

      result[dateKey].quoteVisitsCount++;
      result[dateKey].totalCount++;
    }

    // Ordena as atividades de cada dia por horário
    for (const dateKey of Object.keys(result)) {
      result[dateKey].activities.sort(
        (a, b) =>
          new Date(a.scheduledStart).getTime() -
          new Date(b.scheduledStart).getTime(),
      );
    }

    return result;
  }

  /**
   * Calcula duração em minutos entre dois horários
   */
  private calculateDuration(
    start: Date | null,
    end: Date | null,
  ): number | undefined {
    if (!start || !end) return undefined;
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  }
}
