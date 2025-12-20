import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional({
    description: 'Notify when quote is sent to client',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  notifyOnQuoteSent?: boolean;

  @ApiPropertyOptional({
    description: 'Notify when quote is approved by client',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  notifyOnQuoteApproved?: boolean;

  @ApiPropertyOptional({
    description: 'Notify when work order is created',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  notifyOnWorkOrderCreated?: boolean;

  @ApiPropertyOptional({
    description: 'Notify when work order is completed',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  notifyOnWorkOrderCompleted?: boolean;

  @ApiPropertyOptional({
    description: 'Notify when payment is created',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  notifyOnPaymentCreated?: boolean;

  @ApiPropertyOptional({
    description: 'Notify when payment is confirmed',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  notifyOnPaymentConfirmed?: boolean;

  @ApiPropertyOptional({
    description: 'Notify when payment is overdue',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  notifyOnPaymentOverdue?: boolean;

  @ApiPropertyOptional({
    description: 'Enable email notifications',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  defaultChannelEmail?: boolean;

  @ApiPropertyOptional({
    description: 'Enable WhatsApp notifications',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  defaultChannelWhatsApp?: boolean;
}
