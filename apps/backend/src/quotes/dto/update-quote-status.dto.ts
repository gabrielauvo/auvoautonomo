import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum QuoteStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

export class UpdateQuoteStatusDto {
  @ApiProperty({
    description: 'New status for the quote',
    enum: QuoteStatus,
    example: QuoteStatus.SENT,
  })
  @IsEnum(QuoteStatus)
  @IsNotEmpty()
  status: QuoteStatus;
}
