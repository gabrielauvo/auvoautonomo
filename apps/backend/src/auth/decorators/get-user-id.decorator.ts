import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator to get the user ID from the JWT payload
 * Usage: @GetUserId() userId: string
 */
export const GetUserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.id || request.user?.sub;
  },
);
