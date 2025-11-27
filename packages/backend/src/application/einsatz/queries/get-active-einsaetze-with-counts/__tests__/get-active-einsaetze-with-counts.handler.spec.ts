import { GetActiveEinsaetzeWithCountsQueryHandler } from '../get-active-einsaetze-with-counts.handler';
import { GetActiveEinsaetzeWithCountsQuery } from '../get-active-einsaetze-with-counts.query';
import type { PrismaService } from '../../../../../prisma/prisma.service';
import type { EinsatzListItemDto } from '../../../dto/einsatz-list-item.dto';

/**
 * Helper: Erstellt Mock-Einsatz-Daten mit Prisma _count Relations.
 *
 * Simuliert das Prisma Result-Format wie es vom Handler erwartet wird:
 * - einsatztagebuch._count.eintraege (nur deletedAt: null)
 * - lagekarte._count.pois
 *
 * @param overrides - Optionale Ueberschreibungen der Default-Werte
 * @returns Prisma Einsatz Result mit _count Relations
 */
function createMockPrismaEinsatz(overrides?: {
  id?: string;
  alarmstichwort?: string;
  einsatzort?: string;
  status?: string;
  createdAt?: Date;
  etbEintraegeCount?: number;
  poisCount?: number;
  hasEtb?: boolean;
  hasLagekarte?: boolean;
}) {
  const id = overrides?.id ?? 'test-cuid-123456';
  const createdAt = overrides?.createdAt ?? new Date('2024-01-15T10:30:00.000Z');

  return {
    id,
    alarmstichwort: overrides?.alarmstichwort ?? 'Wohnungsbrand',
    einsatzort: overrides?.einsatzort ?? 'Berlin',
    beschreibung: null,
    alarmierungszeit: null,
    einsatzleiter: null,
    status: overrides?.status ?? 'IN_BEARBEITUNG',
    metadata: null,
    createdAt,
    updatedAt: createdAt,
    createdBy: 'user-test-123',
    updatedBy: null,
    archivedAt: null,
    archivedBy: null,
    // ETB mit _count (oder null)
    einsatztagebuch:
      overrides?.hasEtb === false
        ? null
        : {
            _count: {
              eintraege: overrides?.etbEintraegeCount ?? 5,
            },
          },
    // Lagekarte mit _count (oder null)
    lagekarte:
      overrides?.hasLagekarte === false
        ? null
        : {
            _count: {
              pois: overrides?.poisCount ?? 3,
            },
          },
  };
}

/**
 * Unit Tests fuer GetActiveEinsaetzeWithCountsQueryHandler.
 *
 * Testet Handler-Orchestration mit PrismaService (CQRS Read-Side Pattern).
 * Nutzt Mock PrismaService fuer Unit Test Isolation.
 *
 * **KRITISCHE Test-Szenarien (gemaess ACs):**
 * - AC5.5: Korrekte Counts (etbEintraegeCount, poisCount)
 * - AC5.6: ARCHIVIERT Status wird excludiert
 *
 * Coverage Target: >90%
 */
describe('GetActiveEinsaetzeWithCountsQueryHandler', () => {
  let handler: GetActiveEinsaetzeWithCountsQueryHandler;
  let mockPrismaService: jest.Mocked<PrismaService>;

  beforeEach(() => {
    // Mock PrismaService mit Einsatz-Repository
    mockPrismaService = {
      einsatz: {
        findMany: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    handler = new GetActiveEinsaetzeWithCountsQueryHandler(mockPrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Erfolgreiche Abfragen', () => {
    it('should return empty array when no active einsaetze exist', async () => {
      // Given: Prisma returnt leeres Array
      mockPrismaService.einsatz.findMany.mockResolvedValue([]);
      const query = new GetActiveEinsaetzeWithCountsQuery();

      // When
      const result = await handler.execute(query);

      // Then: Leeres Array ist valides Resultat (NICHT Fehler)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual([]);
      expect(result.value!.length).toBe(0);
      expect(mockPrismaService.einsatz.findMany).toHaveBeenCalledTimes(1);
    });

    it('should return list items with correct ETB and POI counts (AC5.5)', async () => {
      // Given: Prisma returnt Einsaetze mit nested counts
      const mockEinsatz = createMockPrismaEinsatz({
        id: 'einsatz-abc-123',
        alarmstichwort: 'Grossbrand',
        einsatzort: 'München',
        status: 'IN_BEARBEITUNG',
        createdAt: new Date('2024-01-15T10:30:00.000Z'),
        etbEintraegeCount: 15,
        poisCount: 8,
      });

      mockPrismaService.einsatz.findMany.mockResolvedValue([mockEinsatz]);
      const query = new GetActiveEinsaetzeWithCountsQuery();

      // When
      const result = await handler.execute(query);

      // Then: Result enthaelt EinsatzListItemDto mit korrekten Counts
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(1);

      const dto = result.value![0];
      expect(dto.id).toBe('einsatz-abc-123');
      expect(dto.nummer).toBe('E2024-einsatz-'); // Format: E{YEAR}-{ID-8}
      expect(dto.alarmstichwort).toBe('Grossbrand');
      expect(dto.status).toBe('IN_BEARBEITUNG');
      expect(dto.einsatzort).toEqual({ ort: 'München' });
      expect(dto.createdAt).toEqual(new Date('2024-01-15T10:30:00.000Z'));
      expect(dto.etbEintraegeCount).toBe(15); // AC5.5: Korrekte ETB-Count
      expect(dto.poisCount).toBe(8); // AC5.5: Korrekte POI-Count
    });

    it('should exclude ARCHIVIERT status from results (AC5.6)', async () => {
      // Given: Prisma query filtert status != ARCHIVIERT
      const einsatz1 = createMockPrismaEinsatz({
        id: 'einsatz-001',
        alarmstichwort: 'Aktiv 1',
        status: 'ANGELEGT',
      });
      const einsatz2 = createMockPrismaEinsatz({
        id: 'einsatz-002',
        alarmstichwort: 'Aktiv 2',
        status: 'IN_BEARBEITUNG',
      });
      const einsatz3 = createMockPrismaEinsatz({
        id: 'einsatz-003',
        alarmstichwort: 'Aktiv 3',
        status: 'ABGESCHLOSSEN',
      });
      // ARCHIVIERT ist NICHT im Result (Prisma filtert bereits)

      mockPrismaService.einsatz.findMany.mockResolvedValue([einsatz1, einsatz2, einsatz3]);
      const query = new GetActiveEinsaetzeWithCountsQuery();

      // When
      const result = await handler.execute(query);

      // Then: Nur aktive Status in DTOs (AC5.6)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(3);

      const statuses = result.value!.map((dto) => dto.status);
      expect(statuses).toContain('ANGELEGT');
      expect(statuses).toContain('IN_BEARBEITUNG');
      expect(statuses).toContain('ABGESCHLOSSEN');
      expect(statuses).not.toContain('ARCHIVIERT'); // AC5.6: ARCHIVIERT excluded

      // Verifiziere Prisma Query
      expect(mockPrismaService.einsatz.findMany).toHaveBeenCalledWith({
        where: { status: { not: 'ARCHIVIERT' } },
        include: {
          einsatztagebuch: {
            select: {
              _count: {
                select: {
                  eintraege: { where: { deletedAt: null } },
                },
              },
            },
          },
          lagekarte: {
            select: {
              _count: {
                select: { pois: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should sort by createdAt DESC (newest first)', async () => {
      // Given: 3 Einsaetze mit verschiedenen createdAt Timestamps
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      const einsatz1 = createMockPrismaEinsatz({
        id: 'einsatz-old',
        alarmstichwort: 'Brand Alt',
        createdAt: twoHoursAgo, // Aeltester
      });
      const einsatz2 = createMockPrismaEinsatz({
        id: 'einsatz-middle',
        alarmstichwort: 'Brand Mittel',
        createdAt: oneHourAgo, // Mittlerer
      });
      const einsatz3 = createMockPrismaEinsatz({
        id: 'einsatz-new',
        alarmstichwort: 'Brand Neu',
        createdAt: now, // Neuester
      });

      // Prisma returnt bereits sortiert (DESC)
      mockPrismaService.einsatz.findMany.mockResolvedValue([einsatz3, einsatz2, einsatz1]);
      const query = new GetActiveEinsaetzeWithCountsQuery();

      // When
      const result = await handler.execute(query);

      // Then: DTOs in DESC Reihenfolge (neuester zuerst)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(3);

      const dtos = result.value!;
      // Neuester zuerst
      expect(dtos[0].alarmstichwort).toBe('Brand Neu');
      expect(dtos[0].createdAt).toEqual(now);

      // Mittlerer zweiter
      expect(dtos[1].alarmstichwort).toBe('Brand Mittel');
      expect(dtos[1].createdAt).toEqual(oneHourAgo);

      // Aeltester letzter
      expect(dtos[2].alarmstichwort).toBe('Brand Alt');
      expect(dtos[2].createdAt).toEqual(twoHoursAgo);
    });

    it('should handle Einsatz without ETB (null count = 0)', async () => {
      // Given: Einsatz mit einsatztagebuch: null
      const mockEinsatz = createMockPrismaEinsatz({
        id: 'einsatz-no-etb',
        alarmstichwort: 'Einsatz ohne ETB',
        hasEtb: false, // ETB nicht erstellt
        poisCount: 5,
      });

      mockPrismaService.einsatz.findMany.mockResolvedValue([mockEinsatz]);
      const query = new GetActiveEinsaetzeWithCountsQuery();

      // When
      const result = await handler.execute(query);

      // Then: etbEintraegeCount = 0 (Nullish Coalescing)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(1);

      const dto = result.value![0];
      expect(dto.id).toBe('einsatz-no-etb');
      expect(dto.etbEintraegeCount).toBe(0); // null ?? 0
      expect(dto.poisCount).toBe(5);
    });

    it('should handle Einsatz without Lagekarte (null count = 0)', async () => {
      // Given: Einsatz mit lagekarte: null
      const mockEinsatz = createMockPrismaEinsatz({
        id: 'einsatz-no-lagekarte',
        alarmstichwort: 'Einsatz ohne Lagekarte',
        etbEintraegeCount: 10,
        hasLagekarte: false, // Lagekarte nicht erstellt
      });

      mockPrismaService.einsatz.findMany.mockResolvedValue([mockEinsatz]);
      const query = new GetActiveEinsaetzeWithCountsQuery();

      // When
      const result = await handler.execute(query);

      // Then: poisCount = 0 (Nullish Coalescing)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(1);

      const dto = result.value![0];
      expect(dto.id).toBe('einsatz-no-lagekarte');
      expect(dto.etbEintraegeCount).toBe(10);
      expect(dto.poisCount).toBe(0); // null ?? 0
    });

    it('should only count non-deleted ETB entries (deletedAt: null)', async () => {
      // Given: ETB mit einigen deleted entries
      // Prisma _count filtert bereits via: where: { deletedAt: null }
      const mockEinsatz = createMockPrismaEinsatz({
        id: 'einsatz-with-deleted-entries',
        alarmstichwort: 'Einsatz mit gelöschten Einträgen',
        etbEintraegeCount: 12, // Nur nicht-gelöschte (deletedAt: null)
        // Annahme: 15 total Einträge, 3 davon deletedAt !== null
      });

      mockPrismaService.einsatz.findMany.mockResolvedValue([mockEinsatz]);
      const query = new GetActiveEinsaetzeWithCountsQuery();

      // When
      const result = await handler.execute(query);

      // Then: Count excludes soft-deleted entries
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(1);

      const dto = result.value![0];
      expect(dto.etbEintraegeCount).toBe(12); // Nur deletedAt: null

      // Verifiziere Prisma Query nutzt deletedAt Filter
      expect(mockPrismaService.einsatz.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            einsatztagebuch: {
              select: {
                _count: {
                  select: {
                    eintraege: { where: { deletedAt: null } }, // Soft-Delete Filter
                  },
                },
              },
            },
            lagekarte: expect.any(Object),
          },
        }),
      );
    });

    it('should handle alarmstichwort null -> empty string for API', async () => {
      // Given: Einsatz mit alarmstichwort: null
      const mockEinsatz = createMockPrismaEinsatz({
        id: 'einsatz-no-alarmstichwort',
        alarmstichwort: '', // Prisma might return null
      });
      // Simuliere Prisma null Wert
      mockEinsatz.alarmstichwort = null as unknown as string;

      mockPrismaService.einsatz.findMany.mockResolvedValue([mockEinsatz]);
      const query = new GetActiveEinsaetzeWithCountsQuery();

      // When
      const result = await handler.execute(query);

      // Then: alarmstichwort wird zu '' (API braucht string, nicht null)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(1);

      const dto = result.value![0];
      expect(dto.alarmstichwort).toBe(''); // null ?? ''
    });

    it('should handle einsatzort null -> undefined for API', async () => {
      // Given: Einsatz ohne einsatzort
      const mockEinsatz = createMockPrismaEinsatz({
        id: 'einsatz-no-ort',
        alarmstichwort: 'Test',
        einsatzort: '',
      });
      // Simuliere Prisma null Wert
      mockEinsatz.einsatzort = null as unknown as string;

      mockPrismaService.einsatz.findMany.mockResolvedValue([mockEinsatz]);
      const query = new GetActiveEinsaetzeWithCountsQuery();

      // When
      const result = await handler.execute(query);

      // Then: einsatzort ist undefined (nicht { ort: '' })
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(1);

      const dto = result.value![0];
      expect(dto.einsatzort).toBeUndefined();
    });

    it('should generate correct nummer format: E{YEAR}-{ID-8}', async () => {
      // Given: Einsatz mit bekannter ID und createdAt
      const mockEinsatz = createMockPrismaEinsatz({
        id: 'clw3h8x9y0000qwertyuiopas', // 25 Zeichen CUID
        createdAt: new Date('2024-01-15T10:30:00.000Z'),
      });

      mockPrismaService.einsatz.findMany.mockResolvedValue([mockEinsatz]);
      const query = new GetActiveEinsaetzeWithCountsQuery();

      // When
      const result = await handler.execute(query);

      // Then: Nummer = E2024-clw3h8x9
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(1);

      const dto = result.value![0];
      expect(dto.nummer).toBe('E2024-clw3h8x9'); // E{YEAR}-{ID-8}
    });

    it('should handle multiple einsaetze with varying counts', async () => {
      // Given: 3 Einsaetze mit unterschiedlichen Counts
      const einsatz1 = createMockPrismaEinsatz({
        id: 'einsatz-001',
        etbEintraegeCount: 5,
        poisCount: 0,
      });
      const einsatz2 = createMockPrismaEinsatz({
        id: 'einsatz-002',
        etbEintraegeCount: 0,
        poisCount: 10,
      });
      const einsatz3 = createMockPrismaEinsatz({
        id: 'einsatz-003',
        etbEintraegeCount: 20,
        poisCount: 15,
      });

      mockPrismaService.einsatz.findMany.mockResolvedValue([einsatz1, einsatz2, einsatz3]);
      const query = new GetActiveEinsaetzeWithCountsQuery();

      // When
      const result = await handler.execute(query);

      // Then: Alle Counts korrekt gemapped
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(3);

      const dtos = result.value!;
      expect(dtos[0].etbEintraegeCount).toBe(5);
      expect(dtos[0].poisCount).toBe(0);

      expect(dtos[1].etbEintraegeCount).toBe(0);
      expect(dtos[1].poisCount).toBe(10);

      expect(dtos[2].etbEintraegeCount).toBe(20);
      expect(dtos[2].poisCount).toBe(15);
    });
  });

  describe('Fehlerbehandlung', () => {
    it('should return failure when Prisma throws error', async () => {
      // Given: Prisma wirft Database Error
      mockPrismaService.einsatz.findMany.mockRejectedValue(new Error('Database connection failed'));
      const query = new GetActiveEinsaetzeWithCountsQuery();

      // When
      const result = await handler.execute(query);

      // Then: Result.isFailure ist true
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Fehler beim Laden der Eins');
      expect(result.value).toBeUndefined();
      expect(mockPrismaService.einsatz.findMany).toHaveBeenCalledTimes(1);
    });

    it('should return failure when Prisma throws generic error', async () => {
      // Given: Prisma wirft unspezifischen Error
      mockPrismaService.einsatz.findMany.mockRejectedValue(new Error('Unexpected error'));
      const query = new GetActiveEinsaetzeWithCountsQuery();

      // When
      const result = await handler.execute(query);

      // Then: Handler catcht Error und returnt Result.fail()
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Fehler beim Laden der Eins');
    });

    it('should handle Prisma timeout gracefully', async () => {
      // Given: Prisma Timeout
      mockPrismaService.einsatz.findMany.mockRejectedValue(new Error('Query timeout'));
      const query = new GetActiveEinsaetzeWithCountsQuery();

      // When
      const result = await handler.execute(query);

      // Then: Fehler wird als Result.fail() behandelt
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Fehler beim Laden der Eins');
    });
  });

  describe('Orchestrierung-Verifikation', () => {
    it('should call prisma.einsatz.findMany exactly once', async () => {
      // Given
      mockPrismaService.einsatz.findMany.mockResolvedValue([]);
      const query = new GetActiveEinsaetzeWithCountsQuery();

      // When
      await handler.execute(query);

      // Then
      expect(mockPrismaService.einsatz.findMany).toHaveBeenCalledTimes(1);
    });

    it('should call prisma.einsatz.findMany with correct query parameters', async () => {
      // Given
      mockPrismaService.einsatz.findMany.mockResolvedValue([]);
      const query = new GetActiveEinsaetzeWithCountsQuery();

      // When
      await handler.execute(query);

      // Then: Verifiziere Query-Struktur
      expect(mockPrismaService.einsatz.findMany).toHaveBeenCalledWith({
        where: { status: { not: 'ARCHIVIERT' } },
        include: {
          einsatztagebuch: {
            select: {
              _count: {
                select: {
                  eintraege: { where: { deletedAt: null } },
                },
              },
            },
          },
          lagekarte: {
            select: {
              _count: {
                select: { pois: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should handle query execution with parameterless Query object', async () => {
      // Given: Query ohne Parameter
      mockPrismaService.einsatz.findMany.mockResolvedValue([]);
      const query = new GetActiveEinsaetzeWithCountsQuery();

      // When
      const result = await handler.execute(query);

      // Then: Handler funktioniert mit parameterloser Query
      expect(result.isSuccess).toBe(true);
      expect(mockPrismaService.einsatz.findMany).toHaveBeenCalledTimes(1);
    });

    it('should NOT modify Prisma result array (immutability)', async () => {
      // Given: Prisma Result Array
      const einsatz1 = createMockPrismaEinsatz({ id: 'einsatz-001' });
      const einsatz2 = createMockPrismaEinsatz({ id: 'einsatz-002' });
      const originalArray = [einsatz1, einsatz2];

      mockPrismaService.einsatz.findMany.mockResolvedValue(originalArray);
      const query = new GetActiveEinsaetzeWithCountsQuery();

      // When
      await handler.execute(query);

      // Then: Original Array wurde NICHT mutiert
      expect(originalArray).toHaveLength(2);
      expect(originalArray[0]).toBe(einsatz1);
      expect(originalArray[1]).toBe(einsatz2);
    });
  });

  describe('DTO-Mapping Edge Cases', () => {
    it('should handle einsaetze with same createdAt timestamp', async () => {
      // Given: 2 Einsaetze mit identischem Timestamp
      const now = new Date();
      const einsatz1 = createMockPrismaEinsatz({
        id: 'einsatz-a',
        alarmstichwort: 'Brand A',
        createdAt: now,
      });
      const einsatz2 = createMockPrismaEinsatz({
        id: 'einsatz-b',
        alarmstichwort: 'Brand B',
        createdAt: now,
      });

      mockPrismaService.einsatz.findMany.mockResolvedValue([einsatz1, einsatz2]);
      const query = new GetActiveEinsaetzeWithCountsQuery();

      // When
      const result = await handler.execute(query);

      // Then: Beide DTOs sind vorhanden (Reihenfolge bei gleichen Timestamps undefiniert)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(2);
      expect(result.value!.map((dto) => dto.alarmstichwort).sort()).toEqual(['Brand A', 'Brand B']);
    });

    it('should handle very short Einsatz IDs (< 8 chars)', async () => {
      // Given: Einsatz mit kurzer ID (Edge Case, sollte nicht vorkommen aber robust sein)
      const mockEinsatz = createMockPrismaEinsatz({
        id: 'abc123', // Nur 6 Zeichen
        createdAt: new Date('2024-01-15T10:30:00.000Z'),
      });

      mockPrismaService.einsatz.findMany.mockResolvedValue([mockEinsatz]);
      const query = new GetActiveEinsaetzeWithCountsQuery();

      // When
      const result = await handler.execute(query);

      // Then: Nummer = E2024-abc123 (vollständige ID, da < 8 chars)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(1);
      expect(result.value![0].nummer).toBe('E2024-abc123');
    });

    it('should preserve exact createdAt timestamp in DTO', async () => {
      // Given: Einsatz mit spezifischem Timestamp
      const timestamp = new Date('2024-01-15T14:23:45.678Z');
      const mockEinsatz = createMockPrismaEinsatz({
        createdAt: timestamp,
      });

      mockPrismaService.einsatz.findMany.mockResolvedValue([mockEinsatz]);
      const query = new GetActiveEinsaetzeWithCountsQuery();

      // When
      const result = await handler.execute(query);

      // Then: createdAt wird exakt uebernommen (keine Umformatierung)
      expect(result.isSuccess).toBe(true);
      expect(result.value![0].createdAt).toEqual(timestamp);
      expect(result.value![0].createdAt.toISOString()).toBe('2024-01-15T14:23:45.678Z');
    });

    it('should map all required DTO fields correctly', async () => {
      // Given: Vollständiger Mock-Einsatz
      const mockEinsatz = createMockPrismaEinsatz({
        id: 'test-id-full',
        alarmstichwort: 'Volltest',
        einsatzort: 'Teststadt',
        status: 'ABGESCHLOSSEN',
        createdAt: new Date('2024-06-10T08:00:00.000Z'),
        etbEintraegeCount: 42,
        poisCount: 13,
      });

      mockPrismaService.einsatz.findMany.mockResolvedValue([mockEinsatz]);
      const query = new GetActiveEinsaetzeWithCountsQuery();

      // When
      const result = await handler.execute(query);

      // Then: Alle DTO-Felder korrekt gemapped
      expect(result.isSuccess).toBe(true);
      const dto: EinsatzListItemDto = result.value![0];

      expect(dto.id).toBe('test-id-full');
      expect(dto.nummer).toBe('E2024-test-id-');
      expect(dto.alarmstichwort).toBe('Volltest');
      expect(dto.status).toBe('ABGESCHLOSSEN');
      expect(dto.einsatzort).toEqual({ ort: 'Teststadt' });
      expect(dto.createdAt).toEqual(new Date('2024-06-10T08:00:00.000Z'));
      expect(dto.etbEintraegeCount).toBe(42);
      expect(dto.poisCount).toBe(13);
    });
  });
});
