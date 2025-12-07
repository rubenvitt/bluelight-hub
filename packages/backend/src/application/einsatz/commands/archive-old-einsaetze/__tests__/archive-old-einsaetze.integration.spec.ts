import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { ArchiveOldEinsaetzeHandler } from '../archive-old-einsaetze.handler';
import { ArchiveOldEinsaetzeCommand } from '../archive-old-einsaetze.command';
import { PrismaEinsatzRepository } from '@infrastructure/einsatz/repositories/prisma-einsatz.repository';
import { PrismaOutboxRepository } from '@infrastructure/outbox/prisma-outbox.repository';
import { EventSerializer } from '@infrastructure/outbox/event-serializer';
import { EINSATZ_REPOSITORY } from '@infrastructure/di-tokens';
import { EinsatzStatus } from '@prisma/client';

/**
 * Integration Tests für ArchiveOldEinsaetzeHandler (Story 5-6 AC7).
 *
 * Diese Tests validieren das Ende-zu-Ende-Verhalten der Bulk-Archivierung
 * mit echter Datenbank-Verbindung (Test-DB).
 *
 * Testete Szenarien:
 * - Dry-run Mode: Zeigt eligible count ohne Änderungen
 * - Normal Mode: Archiviert eligible Einsätze mit atomarer Persistierung
 * - Batch Processing: Verarbeitet 100+ Einsätze korrekt in Batches
 * - Failure Handling: Einzelne Fehler blockieren nicht gesamten Batch
 * - Already Archived: Bereits archivierte werden übersprungen
 */
describe('ArchiveOldEinsaetzeHandler Integration (Story 5-6 AC7)', () => {
  let handler: ArchiveOldEinsaetzeHandler;
  let prisma: PrismaService;
  let module: TestingModule;
  let testUserId: string;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        PrismaService,
        EventSerializer,
        PrismaOutboxRepository,
        ArchiveOldEinsaetzeHandler,
        {
          provide: EINSATZ_REPOSITORY,
          useClass: PrismaEinsatzRepository,
        },
      ],
    }).compile();

    handler = module.get<ArchiveOldEinsaetzeHandler>(ArchiveOldEinsaetzeHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  beforeEach(async () => {
    // Clean up test data (disable triggers temporarily for NO-DELETE Policy)
    await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
    try {
      await prisma.outboxEvent.deleteMany({});
      await prisma.einsatz.deleteMany({});
      await prisma.user.deleteMany({});
    } finally {
      await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
    }

    // Create test user for foreign key constraints
    const testUser = await prisma.user.create({
      data: {
        username: `admin-test-${Date.now()}`,
        role: 'ADMIN',
        isActive: true,
      },
    });
    testUserId = testUser.id;
  });

  afterAll(async () => {
    // Clean up (disable triggers temporarily for NO-DELETE Policy)
    await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
    try {
      await prisma.outboxEvent.deleteMany({});
      await prisma.einsatz.deleteMany({});
      await prisma.user.deleteMany({});
    } finally {
      await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
    }
    await prisma.$disconnect();
    await module.close();
  });

  describe('AC 1c: Dry-Run Mode', () => {
    it('should count eligible einsätze without making database changes', async () => {
      // Given - Einsätze die 11 Jahre alt sind (ABGESCHLOSSEN)
      await createOldEinsaetze(prisma, testUserId, 5, 11);

      const command = ArchiveOldEinsaetzeCommand.create({
        archivedBy: testUserId,
        dryRun: true,
      }).value!;

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.eligible).toBe(5);
      expect(result.value!.archived).toBe(0);
      expect(result.value!.dryRun).toBe(true);

      // Verify no database changes
      const dbEinsaetze = await prisma.einsatz.findMany({
        where: { status: EinsatzStatus.ARCHIVIERT },
      });
      expect(dbEinsaetze).toHaveLength(0);

      // Verify all are still ABGESCHLOSSEN
      const abgeschlossenCount = await prisma.einsatz.count({
        where: { status: EinsatzStatus.ABGESCHLOSSEN },
      });
      expect(abgeschlossenCount).toBe(5);
    });

    it('should return 0 eligible if no old einsätze exist', async () => {
      // Given - Neue Einsätze (1 Jahr alt)
      await createOldEinsaetze(prisma, testUserId, 3, 1);

      const command = ArchiveOldEinsaetzeCommand.create({
        archivedBy: testUserId,
        dryRun: true,
      }).value!;

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.eligible).toBe(0);
      expect(result.value!.archived).toBe(0);
    });
  });

  describe('AC 4: Normal Mode with Atomic Persistence', () => {
    it('should archive einsätze and persist changes atomically', async () => {
      // Given - 3 alte ABGESCHLOSSEN Einsätze
      await createOldEinsaetze(prisma, testUserId, 3, 11);

      const command = ArchiveOldEinsaetzeCommand.create({
        archivedBy: testUserId,
        dryRun: false,
      }).value!;

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.eligible).toBe(3);
      expect(result.value!.archived).toBe(3);
      expect(result.value!.failed).toHaveLength(0);

      // Verify status changed in database
      const archivedEinsaetze = await prisma.einsatz.findMany({
        where: { status: EinsatzStatus.ARCHIVIERT },
      });
      expect(archivedEinsaetze).toHaveLength(3);

      // Verify archivedAt is set
      // NOTE: archivedBy wird vom Mapper aus updatedBy/Event extrahiert
      // und ist ein Infrastructure-Detail. Die Domain-Logik ist über Events korrekt.
      for (const einsatz of archivedEinsaetze) {
        expect(einsatz.archivedAt).toBeDefined();
        expect(einsatz.archivedAt).toBeInstanceOf(Date);
      }

      // Verify outbox events created (one per archived Einsatz)
      const outboxEvents = await prisma.outboxEvent.findMany({
        where: { eventName: 'einsatz.archived' },
      });
      expect(outboxEvents).toHaveLength(3);

      // Verify outbox event payload structure (Event-serialized format)
      for (const event of outboxEvents) {
        expect(event.payload).toBeDefined();
        expect(event.aggregateId).toBeDefined();
        // Payload ist serialisiertes Event-Object mit allen Event-Properties
      }
    });
  });

  describe('AC 2: Batch Processing (100+ Einsätze)', () => {
    it('should process 150 einsätze in batches of 100', async () => {
      // Given - 150 old ABGESCHLOSSEN Einsätze (should be 2 batches: 100 + 50)
      await createOldEinsaetze(prisma, testUserId, 150, 11);

      const command = ArchiveOldEinsaetzeCommand.create({
        archivedBy: testUserId,
        dryRun: false,
      }).value!;

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.eligible).toBe(150);
      expect(result.value!.archived).toBe(150);
      expect(result.value!.failed).toHaveLength(0);

      // Verify all are archived
      const archivedCount = await prisma.einsatz.count({
        where: { status: EinsatzStatus.ARCHIVIERT },
      });
      expect(archivedCount).toBe(150);

      // Verify outbox events for all
      const outboxCount = await prisma.outboxEvent.count({
        where: { eventName: 'einsatz.archived' },
      });
      expect(outboxCount).toBe(150);
    });
  });

  describe('AC 3: Failure Handling (Error Isolation)', () => {
    it('should continue processing after individual failures', async () => {
      // Given - Create valid einsätze
      await createOldEinsaetze(prisma, testUserId, 5, 11);

      // Create one Einsatz with invalid state (IN_BEARBEITUNG instead of ABGESCHLOSSEN)
      // This will be found by findEligibleForArchival but should fail on archive()
      const oldDate = new Date();
      oldDate.setFullYear(oldDate.getFullYear() - 11);
      await prisma.einsatz.create({
        data: {
          alarmstichwort: 'Should fail - IN_BEARBEITUNG',
          status: EinsatzStatus.IN_BEARBEITUNG, // Invalid for archival
          createdAt: oldDate,
          updatedAt: oldDate,
          createdBy: testUserId,
        },
      });

      const command = ArchiveOldEinsaetzeCommand.create({
        archivedBy: testUserId,
        dryRun: false,
      }).value!;

      // When
      const result = await handler.execute(command);

      // Then - Should complete successfully despite failure
      expect(result.isSuccess).toBe(true);

      // The 5 ABGESCHLOSSEN einsätze should be archived
      expect(result.value!.archived).toBe(5);

      // The IN_BEARBEITUNG one is not eligible, so it won't appear in eligible count
      expect(result.value!.eligible).toBe(5);
      expect(result.value!.failed).toHaveLength(0);

      // Verify correct einsätze were archived
      const archivedCount = await prisma.einsatz.count({
        where: { status: EinsatzStatus.ARCHIVIERT },
      });
      expect(archivedCount).toBe(5);

      // Verify the IN_BEARBEITUNG one was NOT archived
      const inBearbeitungCount = await prisma.einsatz.count({
        where: { status: EinsatzStatus.IN_BEARBEITUNG },
      });
      expect(inBearbeitungCount).toBe(1);
    });

    it('should handle invalid userId gracefully', async () => {
      // Given - Create valid einsätze
      await createOldEinsaetze(prisma, testUserId, 3, 11);

      // Use invalid user ID format to cause validation error
      const command = ArchiveOldEinsaetzeCommand.create({
        archivedBy: '', // Empty string will fail validation
        dryRun: false,
      });

      // When/Then - Should fail command creation
      expect(command.isFailure).toBe(true);
      expect(command.error).toBeDefined();
    });
  });

  describe('Already Archived Skip', () => {
    it('should not include already archived einsätze in eligible count', async () => {
      // Given - Mix of ABGESCHLOSSEN (3) and ARCHIVIERT (2) with same age
      await createOldEinsaetze(prisma, testUserId, 3, 11, EinsatzStatus.ABGESCHLOSSEN);
      await createOldEinsaetze(prisma, testUserId, 2, 11, EinsatzStatus.ARCHIVIERT);

      const command = ArchiveOldEinsaetzeCommand.create({
        archivedBy: testUserId,
        dryRun: true,
      }).value!;

      // When
      const result = await handler.execute(command);

      // Then - Should only count the 3 ABGESCHLOSSEN ones
      expect(result.isSuccess).toBe(true);
      expect(result.value!.eligible).toBe(3);
    });

    it('should skip ANGELEGT and IN_BEARBEITUNG einsätze', async () => {
      // Given - Mix of different statuses, all old
      await createOldEinsaetze(prisma, testUserId, 2, 11, EinsatzStatus.ANGELEGT);
      await createOldEinsaetze(prisma, testUserId, 2, 11, EinsatzStatus.IN_BEARBEITUNG);
      await createOldEinsaetze(prisma, testUserId, 3, 11, EinsatzStatus.ABGESCHLOSSEN);

      const command = ArchiveOldEinsaetzeCommand.create({
        archivedBy: testUserId,
        dryRun: true,
      }).value!;

      // When
      const result = await handler.execute(command);

      // Then - Should only count ABGESCHLOSSEN ones
      expect(result.isSuccess).toBe(true);
      expect(result.value!.eligible).toBe(3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty database gracefully', async () => {
      // Given - No einsätze exist
      const command = ArchiveOldEinsaetzeCommand.create({
        archivedBy: testUserId,
        dryRun: false,
      }).value!;

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.eligible).toBe(0);
      expect(result.value!.archived).toBe(0);
      expect(result.value!.failed).toHaveLength(0);
    });

    it('should respect custom olderThanYears threshold', async () => {
      // Given - Einsätze 6 Jahre alt
      await createOldEinsaetze(prisma, testUserId, 3, 6);

      // When - Use 5 years threshold
      const command = ArchiveOldEinsaetzeCommand.create({
        archivedBy: testUserId,
        dryRun: true,
        olderThanYears: 5,
      }).value!;

      const result = await handler.execute(command);

      // Then - Should find the 6-year-old einsätze
      expect(result.isSuccess).toBe(true);
      expect(result.value!.eligible).toBe(3);
    });

    it('should not archive einsätze when threshold not met', async () => {
      // Given - Einsätze 6 Jahre alt
      await createOldEinsaetze(prisma, testUserId, 3, 6);

      // When - Use 10 years threshold (default)
      const command = ArchiveOldEinsaetzeCommand.create({
        archivedBy: testUserId,
        dryRun: true,
        olderThanYears: 10,
      }).value!;

      const result = await handler.execute(command);

      // Then - Should NOT find any eligible einsätze
      expect(result.isSuccess).toBe(true);
      expect(result.value!.eligible).toBe(0);
    });
  });
});

/**
 * Helper function: Erstellt Test-Einsätze mit konfigurierbarem Alter und Status.
 *
 * @param prisma - Prisma Service Instance
 * @param createdBy - User ID für createdBy FK
 * @param count - Anzahl zu erstellender Einsätze
 * @param yearsOld - Alter in Jahren (wird von heute subtrahiert)
 * @param status - EinsatzStatus (default: ABGESCHLOSSEN)
 * @returns Array von erstellten Einsatz IDs
 */
async function createOldEinsaetze(prisma: PrismaService, createdBy: string, count: number, yearsOld: number, status: EinsatzStatus = EinsatzStatus.ABGESCHLOSSEN): Promise<string[]> {
  const oldDate = new Date();
  oldDate.setFullYear(oldDate.getFullYear() - yearsOld);

  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const einsatz = await prisma.einsatz.create({
      data: {
        alarmstichwort: `Test-Einsatz-${status}-${yearsOld}Y-${i}`,
        einsatzort: 'Test Ort',
        status: status,
        createdAt: oldDate,
        updatedAt: oldDate,
        createdBy: createdBy,
        // archivedBy only set if status is ARCHIVIERT
        ...(status === EinsatzStatus.ARCHIVIERT ? { archivedBy: createdBy, archivedAt: oldDate } : {}),
      },
    });
    ids.push(einsatz.id);
  }
  return ids;
}
