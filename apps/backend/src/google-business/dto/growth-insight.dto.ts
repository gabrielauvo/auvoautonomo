import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GrowthInsightType, GrowthInsightSeverity } from '@prisma/client';

export class GrowthInsightDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: GrowthInsightType })
  type: GrowthInsightType;

  @ApiProperty({ enum: GrowthInsightSeverity })
  severity: GrowthInsightSeverity;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ type: [String] })
  recommendations: string[];

  @ApiPropertyOptional()
  metrics?: Record<string, number>;

  @ApiProperty()
  isRead: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional()
  expiresAt?: Date;
}

export class InsightMetricsDto {
  @ApiPropertyOptional()
  currentValue?: number;

  @ApiPropertyOptional()
  previousValue?: number;

  @ApiPropertyOptional()
  changePercent?: number;

  @ApiPropertyOptional()
  threshold?: number;
}
