import { IsDateString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ScheduleDayQueryDto {
  @ApiProperty({
    description: 'Data no formato YYYY-MM-DD',
    example: '2024-12-11',
  })
  @IsDateString({}, { message: 'Data deve estar no formato YYYY-MM-DD' })
  date: string;
}

export class ScheduleRangeQueryDto {
  @ApiProperty({
    description: 'Data inicial no formato YYYY-MM-DD',
    example: '2024-12-01',
  })
  @IsDateString({}, { message: 'Data inicial deve estar no formato YYYY-MM-DD' })
  startDate: string;

  @ApiProperty({
    description: 'Data final no formato YYYY-MM-DD',
    example: '2024-12-31',
  })
  @IsDateString({}, { message: 'Data final deve estar no formato YYYY-MM-DD' })
  endDate: string;
}
