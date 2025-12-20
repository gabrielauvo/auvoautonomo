import { SetMetadata } from '@nestjs/common';
import { LimitType } from '../guards/usage-limit.guard';

export const LIMIT_TYPE_KEY = 'limitType';
export const CheckLimit = (limitType: LimitType) =>
  SetMetadata(LIMIT_TYPE_KEY, limitType);
