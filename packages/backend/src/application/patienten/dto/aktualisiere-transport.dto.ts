import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional } from 'class-validator';
import type { TransportstatusCode } from '@domain/patienten/value-objects/transportstatus.vo';

/**
 * Request-DTO für `PATCH /api/v1/einsaetze/{einsatzId}/patienten/{patientId}/transport`
 * (Story 1.4, FR19).
 *
 * Linearer Workflow: `WARTEND → IM_TRANSPORT → IM_KRANKENHAUS`.
 *
 * **Enum bewusst auf erreichbare Ziel-Werte verengt:** `WARTEND` ist der
 * initiale Status und nie ein gültiges PATCH-Ziel — die DTO/OpenAPI-Spec
 * reflektiert den tatsächlichen Vertrag.
 */
const AKTUALISIERE_TRANSPORT_NEUERSTATUS_VALUES = ['IM_TRANSPORT', 'IM_KRANKENHAUS'] as const;
type AktualisiereTransportNeuerStatus = (typeof AKTUALISIERE_TRANSPORT_NEUERSTATUS_VALUES)[number];

export class AktualisiereTransportDto {
  @ApiProperty({
    enum: AKTUALISIERE_TRANSPORT_NEUERSTATUS_VALUES,
    description: 'Neuer Transportstatus: `WARTEND → IM_TRANSPORT → IM_KRANKENHAUS`.',
    example: 'IM_TRANSPORT',
  })
  @IsEnum(AKTUALISIERE_TRANSPORT_NEUERSTATUS_VALUES, { message: 'neuerStatus muss einer der Werte IM_TRANSPORT oder IM_KRANKENHAUS sein' })
  neuerStatus!: AktualisiereTransportNeuerStatus & TransportstatusCode;

  @ApiPropertyOptional({
    description: 'Optionale Geräte-Clock-Drift in Sekunden gegenüber Server-UTC.',
    example: 12,
  })
  @IsOptional()
  @IsInt()
  clockDriftSeconds?: number;
}
