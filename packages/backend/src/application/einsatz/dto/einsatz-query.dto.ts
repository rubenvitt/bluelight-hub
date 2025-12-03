import { ApiPropertyOptional } from '@nestjs/swagger';
import { EinsatzStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Enum fuer Sortierfelder in Einsatz-Abfragen.
 *
 * Definiert die erlaubten Felder nach denen Einsaetze sortiert werden koennen.
 */
export enum EinsatzOrderByField {
  createdAt = 'createdAt',
  updatedAt = 'updatedAt',
  alarmstichwort = 'alarmstichwort',
  status = 'status',
  name = 'name',
}

/**
 * Enum fuer Sortierrichtung.
 *
 * Definiert die Sortierrichtung (aufsteigend/absteigend).
 */
export enum OrderDirection {
  asc = 'asc',
  desc = 'desc',
}

/**
 * DTO fuer Query-Parameter beim Abrufen von Einsaetzen.
 *
 * Enthaelt alle Filter- und Paginierungs-Parameter die bei GET /api/einsatz
 * verwendet werden koennen.
 *
 * **Filter-Parameter:**
 * - status: Filter nach Einsatz-Status (z.B. nur IN_BEARBEITUNG)
 * - search: Volltextsuche in alarmstichwort, einsatzort und ID
 * - includeArchived: Archivierte Einsaetze einschliessen (default: false)
 * - includeCompleteness: Vollstaendigkeits-Info berechnen (default: false)
 *
 * **Pagination-Parameter:**
 * - page: Seitennummer (startet bei 1)
 * - limit: Anzahl Eintraege pro Seite (max. 100)
 *
 * **Sortierung:**
 * - orderBy: Sortierfeld (default: createdAt)
 * - orderDirection: Sortierrichtung (default: desc = neueste zuerst)
 *
 * **Defaults:**
 * - page: 1
 * - limit: 10
 * - includeArchived: false
 * - includeCompleteness: false
 * - orderBy: createdAt
 * - orderDirection: desc
 *
 * @example
 * ```
 * GET /api/einsatz?status=IN_BEARBEITUNG&page=2&limit=20&orderBy=alarmstichwort&orderDirection=asc
 * GET /api/einsatz?search=Brand&includeArchived=true
 * GET /api/einsatz?includeCompleteness=true
 * ```
 */
export class EinsatzQueryDto {
  @ApiPropertyOptional({
    enum: EinsatzStatus,
    description: 'Filter nach Einsatz-Status',
    example: EinsatzStatus.ANGELEGT,
  })
  @IsOptional()
  @IsEnum(EinsatzStatus)
  status?: EinsatzStatus;

  @ApiPropertyOptional({
    description: 'Vollstaendigkeits-Information einschliessen',
    example: false,
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === '1' || value === 1) return true;
    if (value === 'false' || value === false || value === '0' || value === 0) return false;
    return undefined;
  })
  @IsBoolean()
  includeCompleteness?: boolean;

  @ApiPropertyOptional({
    description: 'Seitennummer fuer Pagination (startet bei 1)',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => (value ? Number.parseInt(value, 10) : undefined))
  page?: number;

  @ApiPropertyOptional({
    description: 'Anzahl Eintraege pro Seite',
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => (value ? Number.parseInt(value, 10) : undefined))
  limit?: number;

  @ApiPropertyOptional({
    description: 'Suchbegriff fuer Alarmstichwort oder ID (durchsucht auch den generierten Namen)',
    example: 'Wohnungsbrand',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Archivierte Einsaetze einschliessen (Standard: false - gemaess No-Delete Policy)',
    example: false,
    type: Boolean,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === '1' || value === 1) return true;
    if (value === 'false' || value === false || value === '0' || value === 0) return false;
    return false;
  })
  @IsBoolean()
  includeArchived?: boolean = false;

  @ApiPropertyOptional({
    description: 'Sortierfeld',
    example: 'createdAt',
    enum: EinsatzOrderByField,
  })
  @IsOptional()
  @IsEnum(EinsatzOrderByField, { message: 'orderBy muss eines der definierten Felder sein' })
  orderBy?: EinsatzOrderByField;

  @ApiPropertyOptional({
    description: 'Sortierrichtung',
    example: 'desc',
    enum: OrderDirection,
  })
  @IsOptional()
  @IsEnum(OrderDirection, { message: 'orderDirection muss "asc" oder "desc" sein' })
  orderDirection?: OrderDirection;
}
