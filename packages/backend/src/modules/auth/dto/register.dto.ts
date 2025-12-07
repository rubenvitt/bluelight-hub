import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * DTO für die Benutzerregistrierung
 */
export class RegisterDto {
  @ApiProperty({
    description: 'Benutzername',
    example: 'john_doe',
    minLength: 3,
    maxLength: 30,
  })
  @IsString({
    message: 'username must be a string',
  })
  @MinLength(3, {
    message: 'Benutzername muss mindestens 3 Zeichen lang sein',
  })
  @MaxLength(30, {
    message: 'Benutzername darf maximal 30 Zeichen lang sein',
  })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Benutzername darf nur Buchstaben, Zahlen, Unterstriche und Bindestriche enthalten',
  })
  username!: string;
}
