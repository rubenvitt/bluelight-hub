import { ApiExtraModels, ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export const FUNK_PRIORITAET_VALUES = ['routine', 'prioritaet', 'notfall'] as const;
export type FunkPrioritaetValue = (typeof FUNK_PRIORITAET_VALUES)[number];

/**
 * Erlaubte `kind`-Werte für {@link PatientKontextDto}.
 *
 * Single Source of Truth — wird sowohl für `@IsIn(...)` (Runtime-Validation)
 * als auch für `@ApiProperty.enum` (OpenAPI-Schema) verwendet. Siehe
 * Story 1.8 AC1.
 */
export const PATIENT_KONTEXT_KIND_VALUES = [
  'patient.erfasst',
  'patient.gesichtet',
  'patient.sichtung-aktualisiert',
  'patient.behandlung-begonnen',
  'patient.behandlung-abgeschlossen',
  'patient.transport-gestartet',
  'patient.transport-abgeschlossen',
  'patient.korrigiert',
] as const;
export type PatientKontextKindValue = (typeof PATIENT_KONTEXT_KIND_VALUES)[number];

/**
 * Discriminated-Union-DTOs für den {@link EintragKontextShape} eines ETB-Eintrags.
 *
 * - `standard`: Gewöhnlicher Eintrag (default)
 * - `funkspruch`: Eintrag entstand aus Funkspruch; referenziert einen Kanal
 *   und trägt die Priorität.
 */
export class StandardKontextDto {
  @ApiProperty({ enum: ['standard'], example: 'standard' })
  @IsIn(['standard'])
  type!: 'standard';
}

export class FunkKontextDto {
  @ApiProperty({ enum: ['funkspruch'], example: 'funkspruch' })
  @IsIn(['funkspruch'])
  type!: 'funkspruch';

  @ApiProperty({ example: 'clkanal...', description: 'Referenzierter Funkkanal' })
  @IsString()
  @IsNotEmpty()
  kanalId!: string;

  @ApiProperty({ enum: FUNK_PRIORITAET_VALUES, example: 'routine', description: 'Priorität des Funkspruchs' })
  @IsIn(FUNK_PRIORITAET_VALUES)
  funkPrioritaet!: FunkPrioritaetValue;
}

export class PatientKontextDto {
  @ApiProperty({ enum: ['patient'], example: 'patient' })
  @IsIn(['patient'])
  type!: 'patient';

  @ApiProperty({
    enum: PATIENT_KONTEXT_KIND_VALUES,
    example: 'patient.erfasst',
    description: 'Ereignis-Typ des Patienten',
  })
  @IsIn(PATIENT_KONTEXT_KIND_VALUES)
  kind!: PatientKontextKindValue;

  @ApiProperty({ example: 'clpatient...', description: 'Referenzierte Patient-ID' })
  @IsString()
  @IsNotEmpty()
  patientId!: string;

  @ApiProperty({ example: 'P-003', description: 'Patientennummer' })
  @IsString()
  @IsNotEmpty()
  patientennummer!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: {},
    description: 'Zusatzdaten des Ereignisses (z. B. Sichtung, Priorität, etc.)',
  })
  @IsOptional()
  @IsObject()
  payload!: Record<string, any>;
}

export type EintragKontextUnionDto = StandardKontextDto | FunkKontextDto | PatientKontextDto;

/**
 * Wiederverwendbares Swagger-Schema für die EintragKontext-Union.
 */
export const EINTRAG_KONTEXT_SCHEMA = {
  description: 'Kontext des Eintrags (discriminated union: standard | funkspruch | patient)',
  oneOf: [{ $ref: getSchemaPath(StandardKontextDto) }, { $ref: getSchemaPath(FunkKontextDto) }, { $ref: getSchemaPath(PatientKontextDto) }],
  discriminator: {
    propertyName: 'type',
    mapping: {
      standard: getSchemaPath(StandardKontextDto),
      funkspruch: getSchemaPath(FunkKontextDto),
      patient: getSchemaPath(PatientKontextDto),
    },
  },
};

export const ApiEintragKontextExtraModels = () => ApiExtraModels(StandardKontextDto, FunkKontextDto, PatientKontextDto);

/**
 * Hilfs-Prop-Decorator, der Controller-Input-DTOs um das optionale Kontext-Feld
 * ergänzt. Spart Duplikation auf `CreateEtbEintragDto`, Filter-DTOs etc.
 */
export const ApiEintragKontextOptional = () =>
  ApiPropertyOptional({
    ...EINTRAG_KONTEXT_SCHEMA,
    nullable: true,
  });

export const ApiEintragKontextRequired = () =>
  ApiProperty({
    ...EINTRAG_KONTEXT_SCHEMA,
  });

/**
 * Placeholder-Decorator — `@IsOptional()` in Kombination mit der
 * Konsumenten-Ebene reicht aktuell. Falls wir perspektivisch strictere
 * Validierung brauchen, lässt sich hier ein `@IsObject()`/custom-Decorator
 * ergänzen, ohne Call-Sites anzupassen.
 */
export const IsEintragKontext = () => IsOptional();
