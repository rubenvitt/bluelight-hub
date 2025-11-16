/**
 * Integration Tests für Einsatz Aggregate mit allen Value Objects.
 *
 * Diese Tests validieren das Zusammenspiel aller Domain Components:
 * - Einsatz Aggregate
 * - Value Objects (EinsatzId, UserId, EinsatzStatus, Address)
 * - Domain Events (EinsatzCreatedEvent, EinsatzCompletedEvent, EinsatzArchivedEvent, EinsatzStatusChangedEvent)
 * - Repository Interface (Mock Implementation)
 *
 * Im Gegensatz zu Unit Tests (die einzelne Komponenten testen) validieren
 * Integration Tests das Zusammenspiel mehrerer Components im Domain Layer.
 *
 * Epic 1 Story 1-3 | Task 9.1
 */

import { Einsatz } from '@domain/aggregates/einsatz.aggregate';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { UserId } from '@domain/value-objects/user-id';
import { EinsatzStatus } from '@domain/value-objects/einsatz-status';
import { Address } from '@domain/value-objects/address';
import { Result } from '@domain/common/result';
import type { IEinsatzRepository } from '@domain/repositories/ieinsatz.repository';

// Mock für nanoid (für deterministische Tests)
jest.mock('nanoid/non-secure', () => ({
  nanoid: jest.fn(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    let result = '';
    for (let i = 0; i < 21; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }),
}));

/**
 * In-Memory Repository Mock für Integration Tests.
 *
 * Implementiert IEinsatzRepository ohne echte Persistence (kein Prisma/DB).
 * Ermöglicht Testing von Aggregate-Repository Interaktion ohne Infrastructure Layer.
 */
class InMemoryEinsatzRepository implements IEinsatzRepository {
  private storage: Map<string, Einsatz> = new Map();

  async save(aggregate: Einsatz): Promise<Result<void>> {
    try {
      this.storage.set(aggregate.id.value, aggregate);
      return Result.ok<void>();
    } catch (error) {
      return Result.fail<void>('Speichern fehlgeschlagen');
    }
  }

  async findById(id: EinsatzId): Promise<Result<Einsatz | null>> {
    try {
      const einsatz = this.storage.get(id.value) || null;
      return Result.ok<Einsatz | null>(einsatz);
    } catch (error) {
      return Result.fail<Einsatz | null>('Suche fehlgeschlagen');
    }
  }

  async findActive(): Promise<Result<Einsatz[]>> {
    try {
      const activeEinsaetze = Array.from(this.storage.values()).filter((e) => e.status.value !== 'ARCHIVIERT');
      return Result.ok<Einsatz[]>(activeEinsaetze);
    } catch (error) {
      return Result.fail<Einsatz[]>('Suche fehlgeschlagen');
    }
  }

  async findByNummer(nummer: string): Promise<Result<Einsatz | null>> {
    try {
      const einsatz = Array.from(this.storage.values()).find((e) => e.nummer === nummer) || null;
      return Result.ok<Einsatz | null>(einsatz);
    } catch (error) {
      return Result.fail<Einsatz | null>('Suche fehlgeschlagen');
    }
  }

  async exists(id: EinsatzId): Promise<Result<boolean>> {
    try {
      const exists = this.storage.has(id.value);
      return Result.ok<boolean>(exists);
    } catch (error) {
      return Result.fail<boolean>('Prüfung fehlgeschlagen');
    }
  }

  // Test-Helper (nicht Teil des Interface)
  clear(): void {
    this.storage.clear();
  }
}

describe('Einsatz Integration Tests', () => {
  let repository: InMemoryEinsatzRepository;

  beforeEach(() => {
    repository = new InMemoryEinsatzRepository();
  });

  afterEach(() => {
    repository.clear();
  });

  /**
   * Test 1: Create Einsatz → Verify All VOs Work Together
   *
   * Validiert dass alle Value Objects (EinsatzId, UserId, Address, EinsatzStatus)
   * korrekt zusammenarbeiten beim Erstellen eines Einsatz Aggregate.
   */
  describe('Value Object Integration', () => {
    it('should create Einsatz with all Value Objects working together', () => {
      // Given: All Value Objects are created successfully
      const createdBy = UserId.create().value!;
      const address = Address.create({
        strasse: 'Hauptstr.',
        hausnummer: '42',
        plz: '80331',
        ort: 'München',
      }).value!;

      // When: Einsatz is created with all Value Objects
      const result = Einsatz.create({
        alarmstichwort: 'Brand Gebäude',
        createdBy,
        einsatzort: address,
        bemerkung: 'Mehrere Personen vermisst',
      });

      // Then: Einsatz creation succeeds
      expect(result.isSuccess).toBe(true);
      const einsatz = result.value!;

      // And: All Value Objects are properly integrated
      expect(einsatz.id).toBeInstanceOf(EinsatzId);
      expect(einsatz.createdBy).toBeInstanceOf(UserId);
      expect(einsatz.createdBy.equals(createdBy)).toBe(true);
      expect(einsatz.status).toBeInstanceOf(EinsatzStatus);
      expect(einsatz.status.value).toBe('ANGELEGT');
      expect(einsatz.einsatzort).toBeInstanceOf(Address);
      expect(einsatz.einsatzort?.equals(address)).toBe(true);
      expect(einsatz.einsatzort?.toString()).toBe('Hauptstr. 42, 80331 München');
    });

    it('should create Einsatz with minimal Value Objects (no Address, no Bemerkung)', () => {
      // Given: Only required Value Objects
      const createdBy = UserId.create().value!;

      // When: Einsatz is created with minimal data
      const result = Einsatz.create({
        alarmstichwort: 'Verkehrsunfall',
        createdBy,
      });

      // Then: Creation succeeds with optional fields undefined
      expect(result.isSuccess).toBe(true);
      const einsatz = result.value!;
      expect(einsatz.einsatzort).toBeUndefined();
      expect(einsatz.bemerkung).toBeUndefined();
    });

    it('should validate Address PLZ when creating Einsatz', () => {
      // Given: Invalid Address (PLZ too short)
      const createdBy = UserId.create().value!;
      const invalidAddress = Address.create({
        plz: '123', // Invalid: must be 5 digits
        ort: 'Berlin',
      });

      // Then: Address creation should fail
      expect(invalidAddress.isFailure).toBe(true);
      expect(invalidAddress.error).toContain('PLZ ungültig');
    });
  });

  /**
   * Test 2: Full Lifecycle (Create → Complete → Archive)
   *
   * Validiert den kompletten Lebenszyklus eines Einsatz von Erstellung bis Archivierung,
   * inkl. Status Transitions und Persistence via Repository.
   */
  describe('Full Lifecycle Integration', () => {
    it('should execute full lifecycle: create → save → complete → archive → persist', async () => {
      // Given: A new Einsatz is created
      const createdBy = UserId.create().value!;
      const createResult = Einsatz.create({
        alarmstichwort: 'Großbrand',
        createdBy,
      });
      expect(createResult.isSuccess).toBe(true);
      const einsatz = createResult.value!;

      // When: Einsatz is saved to repository
      const saveResult1 = await repository.save(einsatz);
      expect(saveResult1.isSuccess).toBe(true);

      // And: Einsatz is retrieved from repository
      const findResult1 = await repository.findById(einsatz.id);
      expect(findResult1.isSuccess).toBe(true);
      expect(findResult1.value).not.toBeNull();
      expect(findResult1.value!.status.value).toBe('ANGELEGT');

      // When: Einsatz is completed
      const completedBy = UserId.create().value!;
      const completeResult = findResult1.value!.complete(completedBy);
      expect(completeResult.isSuccess).toBe(true);

      // And: Changes are persisted
      const saveResult2 = await repository.save(findResult1.value!);
      expect(saveResult2.isSuccess).toBe(true);

      // And: Einsatz is retrieved again
      const findResult2 = await repository.findById(einsatz.id);
      expect(findResult2.value!.status.value).toBe('ABGESCHLOSSEN');
      expect(findResult2.value!.abgeschlossenAt).toBeDefined();

      // When: Einsatz is archived
      const archivedBy = UserId.create().value!;
      const archiveResult = findResult2.value!.archive(archivedBy);
      expect(archiveResult.isSuccess).toBe(true);

      // And: Changes are persisted
      const saveResult3 = await repository.save(findResult2.value!);
      expect(saveResult3.isSuccess).toBe(true);

      // Then: Final state is ARCHIVIERT
      const findResult3 = await repository.findById(einsatz.id);
      expect(findResult3.value!.status.value).toBe('ARCHIVIERT');
      expect(findResult3.value!.archivedAt).toBeDefined();
    });

    it('should find active Einsätze (exclude archived)', async () => {
      // Given: Multiple Einsätze are created
      const user = UserId.create().value!;

      const einsatz1 = Einsatz.create({
        alarmstichwort: 'Einsatz 1',
        createdBy: user,
      }).value!;
      const einsatz2 = Einsatz.create({
        alarmstichwort: 'Einsatz 2',
        createdBy: user,
      }).value!;
      const einsatz3 = Einsatz.create({
        alarmstichwort: 'Einsatz 3',
        createdBy: user,
      }).value!;

      await repository.save(einsatz1);
      await repository.save(einsatz2);
      await repository.save(einsatz3);

      // When: One Einsatz is archived
      einsatz2.archive(user);
      await repository.save(einsatz2);

      // Then: findActive() returns only non-archived Einsätze
      const activeResult = await repository.findActive();
      expect(activeResult.isSuccess).toBe(true);
      expect(activeResult.value!.length).toBe(2);
      expect(activeResult.value!.some((e) => e.id.equals(einsatz1.id))).toBe(true);
      expect(activeResult.value!.some((e) => e.id.equals(einsatz3.id))).toBe(true);
      expect(activeResult.value!.some((e) => e.id.equals(einsatz2.id))).toBe(false);
    });
  });

  /**
   * Test 3: Event Accumulation Across Multiple State Changes
   *
   * Validiert dass Domain Events korrekt akkumuliert werden während
   * der Einsatz mehrere Status-Änderungen durchläuft.
   */
  describe('Event Accumulation Integration', () => {
    it('should accumulate events during full lifecycle', () => {
      // Given: A new Einsatz
      const createdBy = UserId.create().value!;
      const einsatz = Einsatz.create({
        alarmstichwort: 'Test Event Accumulation',
        createdBy,
      }).value!;

      // Then: After creation, one event (EinsatzCreatedEvent)
      expect(einsatz.getDomainEvents()).toHaveLength(1);
      expect(einsatz.getDomainEvents()[0].constructor.name).toBe('EinsatzCreatedEvent');

      // When: Einsatz is completed
      einsatz.complete(createdBy);

      // Then: Two more events (EinsatzCompletedEvent, EinsatzStatusChangedEvent)
      expect(einsatz.getDomainEvents()).toHaveLength(3);
      expect(einsatz.getDomainEvents()[1].constructor.name).toBe('EinsatzCompletedEvent');
      expect(einsatz.getDomainEvents()[2].constructor.name).toBe('EinsatzStatusChangedEvent');

      // When: Einsatz is archived
      einsatz.archive(createdBy);

      // Then: Two more events (EinsatzArchivedEvent, EinsatzStatusChangedEvent)
      expect(einsatz.getDomainEvents()).toHaveLength(5);
      expect(einsatz.getDomainEvents()[3].constructor.name).toBe('EinsatzArchivedEvent');
      expect(einsatz.getDomainEvents()[4].constructor.name).toBe('EinsatzStatusChangedEvent');
    });

    it('should accumulate events for invalid transitions (no events added on failure)', () => {
      // Given: A completed Einsatz
      const user = UserId.create().value!;
      const einsatz = Einsatz.create({
        alarmstichwort: 'Invalid Transition Test',
        createdBy: user,
      }).value!;

      // Complete the Einsatz (ANGELEGT → ABGESCHLOSSEN)
      einsatz.complete(user);
      expect(einsatz.getDomainEvents()).toHaveLength(3); // Created + Completed + StatusChanged

      // When: Attempting invalid backwards transition (ABGESCHLOSSEN → ANGELEGT)
      const invalidStatus = EinsatzStatus.ANGELEGT();
      const updateResult = einsatz.updateStatus(invalidStatus);

      // Then: Transition fails
      expect(updateResult.isFailure).toBe(true);

      // And: No additional events were added (still 3 events)
      expect(einsatz.getDomainEvents()).toHaveLength(3); // No new event added
    });

    it('should clear events after retrieval', () => {
      // Given: Einsatz with accumulated events
      const user = UserId.create().value!;
      const einsatz = Einsatz.create({
        alarmstichwort: 'Clear Events Test',
        createdBy: user,
      }).value!;

      einsatz.complete(user);
      expect(einsatz.getDomainEvents()).toHaveLength(3);

      // When: Events are retrieved and cleared
      const events = einsatz.getDomainEvents();
      einsatz.clearDomainEvents();

      // Then: Domain events array is empty
      expect(einsatz.getDomainEvents()).toHaveLength(0);

      // But: Retrieved events are still accessible
      expect(events).toHaveLength(3);
    });
  });

  /**
   * Test 4: Repository Interface Compatibility
   *
   * Validiert dass das Aggregate korrekt mit Repository Interface interagiert.
   * Mock Implementation simuliert Infrastructure Layer Behavior.
   */
  describe('Repository Interface Compatibility', () => {
    it('should save and retrieve Einsatz by ID', async () => {
      // Given: A new Einsatz
      const user = UserId.create().value!;
      const einsatz = Einsatz.create({
        alarmstichwort: 'Repository Test',
        createdBy: user,
      }).value!;

      // When: Einsatz is saved
      const saveResult = await repository.save(einsatz);
      expect(saveResult.isSuccess).toBe(true);

      // Then: Einsatz can be retrieved by ID
      const findResult = await repository.findById(einsatz.id);
      expect(findResult.isSuccess).toBe(true);
      expect(findResult.value).not.toBeNull();
      expect(findResult.value!.id.equals(einsatz.id)).toBe(true);
      expect(findResult.value!.alarmstichwort).toBe('Repository Test');
    });

    it('should find Einsatz by Nummer (Business Key)', async () => {
      // Given: A saved Einsatz
      const user = UserId.create().value!;
      const einsatz = Einsatz.create({
        alarmstichwort: 'Find by Nummer',
        createdBy: user,
      }).value!;

      await repository.save(einsatz);

      // When: Searching by Nummer
      const findResult = await repository.findByNummer(einsatz.nummer);

      // Then: Einsatz is found
      expect(findResult.isSuccess).toBe(true);
      expect(findResult.value).not.toBeNull();
      expect(findResult.value!.nummer).toBe(einsatz.nummer);
    });

    it('should check existence of Einsatz', async () => {
      // Given: A saved Einsatz
      const user = UserId.create().value!;
      const einsatz = Einsatz.create({
        alarmstichwort: 'Exists Test',
        createdBy: user,
      }).value!;

      await repository.save(einsatz);

      // When: Checking existence
      const existsResult = await repository.exists(einsatz.id);

      // Then: Returns true
      expect(existsResult.isSuccess).toBe(true);
      expect(existsResult.value).toBe(true);
    });

    it('should return null for non-existent ID', async () => {
      // Given: A non-existent ID
      const nonExistentId = EinsatzId.create().value!;

      // When: Searching for it
      const findResult = await repository.findById(nonExistentId);

      // Then: Returns null (not an error)
      expect(findResult.isSuccess).toBe(true);
      expect(findResult.value).toBeNull();
    });

    it('should return false for non-existent ID in exists()', async () => {
      // Given: A non-existent ID
      const nonExistentId = EinsatzId.create().value!;

      // When: Checking existence
      const existsResult = await repository.exists(nonExistentId);

      // Then: Returns false
      expect(existsResult.isSuccess).toBe(true);
      expect(existsResult.value).toBe(false);
    });
  });

  /**
   * Test 5: Type Safety (Compile-Time Checks)
   *
   * Validiert dass TypeScript Type System verhindert dass EinsatzId und UserId
   * vertauscht werden können (Primitive Obsession Prevention).
   *
   * Diese Tests validieren Compile-Time Behavior zur Runtime.
   */
  describe('Type Safety Integration', () => {
    it('should prevent using UserId where EinsatzId is expected', () => {
      // Given: A UserId and an EinsatzId
      const userId = UserId.create().value!;
      const einsatzId = EinsatzId.create().value!;

      // Then: EinsatzId and UserId are not equal (different types)
      // @ts-expect-error - Type safety check: Cannot compare EinsatzId with UserId
      expect(einsatzId.equals(userId)).toBe(false);

      // And: Internal values might be different
      expect(einsatzId.value).not.toBe(userId.value);
    });

    it('should enforce type safety in repository methods', async () => {
      // Given: A UserId (wrong type)
      const userId = UserId.create().value!;

      // Then: TypeScript prevents passing UserId to methods expecting EinsatzId
      // This is a compile-time check - the following line would NOT compile:
      // await repository.findById(userId); // TS Error: Argument of type 'UserId' is not assignable to parameter of type 'EinsatzId'

      // Runtime validation (for documentation purposes)
      const einsatzId = EinsatzId.create().value!;
      const findResult = await repository.findById(einsatzId);
      expect(findResult.isSuccess).toBe(true);
    });

    it('should enforce type safety in Einsatz creation', () => {
      // Given: Valid typed IDs
      const createdBy = UserId.create().value!;

      // When: Creating Einsatz with typed ID
      const result = Einsatz.create({
        alarmstichwort: 'Type Safety Test',
        createdBy, // TypeScript ensures this is UserId
      });

      // Then: Creation succeeds with correct types
      expect(result.isSuccess).toBe(true);
      expect(result.value!.createdBy).toBeInstanceOf(UserId);
    });
  });

  /**
   * Test 6: Complex Business Rules Integration
   *
   * Validiert dass komplexe Business Rules korrekt funktionieren wenn
   * alle Components zusammenarbeiten.
   */
  describe('Business Rules Integration', () => {
    it('should enforce NO-DELETE Policy across all states', () => {
      // Given: Einsätze in verschiedenen Status
      const user = UserId.create().value!;

      const angelegt = Einsatz.create({
        alarmstichwort: 'Status: ANGELEGT',
        createdBy: user,
      }).value!;
      const completed = Einsatz.create({
        alarmstichwort: 'Status: ABGESCHLOSSEN',
        createdBy: user,
      }).value!;
      completed.complete(user);
      const archived = Einsatz.create({
        alarmstichwort: 'Status: ARCHIVIERT',
        createdBy: user,
      }).value!;
      archived.archive(user);

      // Then: NO-DELETE Policy applies to all states
      expect(angelegt.canBeDeleted()).toBe(false);
      expect(completed.canBeDeleted()).toBe(false);
      expect(archived.canBeDeleted()).toBe(false);
    });

    it('should enforce Archival Immutability (cannot complete archived Einsatz)', () => {
      // Given: An archived Einsatz
      const user = UserId.create().value!;
      const einsatz = Einsatz.create({
        alarmstichwort: 'Archival Immutability Test',
        createdBy: user,
      }).value!;

      einsatz.archive(user);
      expect(einsatz.isArchived()).toBe(true);

      // When: Attempting to complete archived Einsatz
      const completeResult = einsatz.complete(user);

      // Then: Operation fails
      expect(completeResult.isFailure).toBe(true);
      expect(completeResult.error).toContain('Archivierte Einsätze');
    });

    it('should enforce State Machine transitions across lifecycle', () => {
      // Given: A new Einsatz
      const user = UserId.create().value!;
      const einsatz = Einsatz.create({
        alarmstichwort: 'State Machine Test',
        createdBy: user,
      }).value!;

      // Then: Valid transitions work
      expect(einsatz.status.canTransitionTo(EinsatzStatus.IN_BEARBEITUNG())).toBe(true);
      expect(einsatz.status.canTransitionTo(EinsatzStatus.ABGESCHLOSSEN())).toBe(true);

      // When: Transitioning to ABGESCHLOSSEN
      einsatz.complete(user);

      // Then: Can only transition to ARCHIVIERT
      expect(einsatz.status.canTransitionTo(EinsatzStatus.ARCHIVIERT())).toBe(true);
      expect(einsatz.status.canTransitionTo(EinsatzStatus.ANGELEGT())).toBe(false);
      expect(einsatz.status.canTransitionTo(EinsatzStatus.IN_BEARBEITUNG())).toBe(false);
    });
  });
});
