import { IsNumber, IsUUID, Min } from 'class-validator';

export class CreateBundleItemDto {
  @IsUUID()
  itemId: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity: number;
}
