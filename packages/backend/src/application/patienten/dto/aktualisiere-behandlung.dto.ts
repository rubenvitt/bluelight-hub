import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional } from 'class-validator';
import type { BehandlungsstatusCode } from '@domain/patienten/value-objects/behandlungsstatus.vo';

/**
 * Request-DTO für `PATCH /api/v1/einsaetze/{einsatzId}/patienten/{patientId}/behandlung`
 * (Story 1.4, FR18).
 *
 * Setzt den Behandlungsstatus auf den nächsten erlaubten Übergang.
 * VO-Übergangs-Validierung passiert im Aggregate (`Behandlungsstatus.canTransitionTo`).
 *
 * **Enum bewusst auf erreichbare Ziel-Werte verengt:** `UNVERSORGT` ist der
 * initiale Status und nie ein gültiges PATCH-Ziel — der Handler würde diese
 * Eingabe ohnehin hart ablehnen, daher reflektiert die DTO/OpenAPI-Spec den
 * tatsächlichen Vertrag.
 */
const AKTUALISIERE_BEHANDLUNG_NEUERSTATUS_VALUES = ['IN_BEHANDLUNG', 'VERSORGT', 'TRANSPORTBEREIT'] as const;
type AktualisiereBehandlungNeuerStatus = (typeof AKTUALISIERE_BEHANDLUNG_NEUERSTATUS_VALUES)[number];

export class AktualisiereBehandlungDto {
  @ApiProperty({
    enum: AKTUALISIERE_BEHANDLUNG_NEUERSTATUS_VALUES,
    description: 'Neuer Behandlungsstatus: `UNVERSORGT → IN_BEHANDLUNG → VERSORGT | TRANSPORTBEREIT`.',
    example: 'IN_BEHANDLUNG',
  })
  @IsEnum(AKTUALISIERE_BEHANDLUNG_NEUERSTATUS_VALUES, { message: 'neuerStatus muss einer der Werte IN_BEHANDLUNG, VERSORGT oder TRANSPORTBEREIT sein' })
  neuerStatus!: AktualisiereBehandlungNeuerStatus & BehandlungsstatusCode;

  @ApiPropertyOptional({
    description: 'Optionale Geräte-Clock-Drift in Sekunden gegenüber Server-UTC (für Standalone-Capture-Audit).',
    example: 12,
  })
  @IsOptional()
  @IsInt()
  clockDriftSeconds?: number;
}
