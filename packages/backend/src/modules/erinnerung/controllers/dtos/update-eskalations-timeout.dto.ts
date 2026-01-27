import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max } from 'class-validator';

export class UpdateEskalationsTimeoutDto {
  @ApiProperty({ description: 'Neuer Timeout in Minuten (1-60)', example: 10, minimum: 1, maximum: 60 })
  @IsInt()
  @Min(1)
  @Max(60)
  timeoutMinutes!: number;
}
