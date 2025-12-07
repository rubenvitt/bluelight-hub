import { ApiProperty } from '@nestjs/swagger';

/**
 * Klasse für Metadaten in API-Antworten
 */
export class ApiMeta {
  /**
   * Zeitstempel der Antwort im ISO-Format
   */
  @ApiProperty({
    description: 'Zeitstempel der Antwort',
    example: '2023-01-01T12:00:00.000Z',
  })
  timestamp!: string;

  /**
   * API-Version
   */
  @ApiProperty({
    description: 'API-Version',
    example: 'alpha',
    required: false,
  })
  version?: string;

  /**
   * Request-ID für Tracking
   */
  @ApiProperty({
    description: 'Request-ID für Tracking',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  requestId?: string;
}

/**
 * Klasse für Paginierungs-Informationen
 */
export class ApiPagination {
  /**
   * Aktuelle Seite
   */
  @ApiProperty({
    description: 'Aktuelle Seite',
    example: 1,
  })
  page!: number;

  /**
   * Anzahl der Elemente pro Seite
   */
  @ApiProperty({
    description: 'Anzahl der Elemente pro Seite',
    example: 20,
  })
  limit!: number;

  /**
   * Gesamtanzahl der Elemente
   */
  @ApiProperty({
    description: 'Gesamtanzahl der Elemente',
    example: 100,
  })
  total!: number;

  /**
   * Gesamtanzahl der Seiten
   */
  @ApiProperty({
    description: 'Gesamtanzahl der Seiten',
    example: 5,
  })
  totalPages!: number;
}

/**
 * Klasse für HATEOAS-Links
 */
export class ApiLinks {
  /**
   * Link zur aktuellen Ressource
   */
  @ApiProperty({
    description: 'Link zur aktuellen Ressource',
    example: '/api/v-alpha/users?page=1&limit=20',
  })
  self!: string;

  /**
   * Link zur nächsten Seite
   */
  @ApiProperty({
    description: 'Link zur nächsten Seite',
    example: '/api/v-alpha/users?page=2&limit=20',
    required: false,
  })
  next?: string;

  /**
   * Link zur vorherigen Seite
   */
  @ApiProperty({
    description: 'Link zur vorherigen Seite',
    example: '/api/v-alpha/users?page=0&limit=20',
    required: false,
  })
  prev?: string;
}

/**
 * Abstrakte Basisklasse für alle API-Antworten
 * @template T Typ der Antwortdaten
 */
export abstract class ApiResponse<T> {
  /**
   * Die eigentlichen Antwortdaten
   */
  abstract data: T;

  /**
   * Metadaten zur Antwort
   */
  @ApiProperty({
    description: 'Metadaten zur Antwort',
    type: ApiMeta,
  })
  meta!: ApiMeta;

  /**
   * Optionale Nachricht
   */
  @ApiProperty({
    description: 'Optionale Nachricht',
    required: false,
    example: 'Operation erfolgreich durchgeführt',
  })
  message?: string;

  /**
   * Optionale Paginierungs-Informationen
   */
  @ApiProperty({
    description: 'Paginierungs-Informationen',
    type: ApiPagination,
    required: false,
  })
  pagination?: ApiPagination;
}
