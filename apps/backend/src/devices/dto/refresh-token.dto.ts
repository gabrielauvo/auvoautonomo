import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Old Expo Push Token',
    example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
  })
  @IsString()
  @IsNotEmpty()
  oldToken: string;

  @ApiProperty({
    description: 'New Expo Push Token',
    example: 'ExponentPushToken[yyyyyyyyyyyyyyyyyyyyyy]',
  })
  @IsString()
  @IsNotEmpty()
  newToken: string;
}
