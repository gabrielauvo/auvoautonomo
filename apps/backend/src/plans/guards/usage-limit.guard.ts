import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlansService } from '../plans.service';
import { LIMIT_TYPE_KEY } from '../decorators/check-limit.decorator';

export type LimitType = 'clients' | 'quotes' | 'work-orders' | 'invoices';

@Injectable()
export class UsageLimitGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private plansService: PlansService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const limitType = this.reflector.get<LimitType>(
      LIMIT_TYPE_KEY,
      context.getHandler(),
    );

    if (!limitType) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new ForbiddenException('User not authenticated');
    }

    try {
      switch (limitType) {
        case 'clients':
          await this.plansService.checkClientLimit(user.id);
          break;
        case 'quotes':
          await this.plansService.checkQuoteLimit(user.id);
          break;
        case 'work-orders':
          await this.plansService.checkWorkOrderLimit(user.id);
          break;
        case 'invoices':
          await this.plansService.checkInvoiceLimit(user.id);
          break;
      }
      return true;
    } catch (error) {
      throw error;
    }
  }
}
