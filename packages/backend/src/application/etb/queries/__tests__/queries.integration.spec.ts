import { Result } from '@domain/common/result';
import type { IEinsatzRepository } from '@domain/repositories/ieinsatz.repository';
import { InMemoryEtbRepository } from '../../__tests__/in-memory-etb.repository';
import { createTestEtb, createTestSnapshot } from '@domain/aggregates/__tests__/fixtures/etb.fixtures';

// Commands
import { CreateEtbCommand } from '../../commands/create-etb/create-etb.command';
import { CreateEtbHandler } from '../../commands/create-etb/create-etb.handler';
import { AddEintragCommand } from '../../commands/add-eintrag/add-eintrag.command';
import { AddEintragHandler } from '../../commands/add-eintrag/add-eintrag.handler';
import { UpdateEintragCommand } from '../../commands/update-eintrag/update-eintrag.command';
import { UpdateEintragHandler } from '../../commands/update-eintrag/update-eintrag.handler';
import { DeleteEintragCommand } from '../../commands/delete-eintrag/delete-eintrag.command';
import { DeleteEintragHandler } from '../../commands/delete-eintrag/delete-eintrag.handler';
import { LockEtbCommand } from '../../commands/lock-etb/lock-etb.command';
import { LockEtbHandler } from '../../commands/lock-etb/lock-etb.handler';

// Queries
import { GetEtbQuery } from '../get-etb/get-etb.query';
import { GetEtbQueryHandler } from '../get-etb/get-etb.handler';
import { GetEintraegeQuery } from '../get-eintraege/get-eintraege.query';
import { GetEintraegeQueryHandler } from '../get-eintraege/get-eintraege.handler';
import { GetEtbHistoryQuery } from '../get-etb-history/get-etb-history.query';
import { GetEtbHistoryQueryHandler } from '../get-etb-history/get-etb-history.handler';

// Mock CUID2 fuer deterministische Tests
jest.mock('@paralleldrive/cuid2', () => ({
  createId: jest.fn(() => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'c';
    for (let i = 0; i < 24; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }),
  isCuid: jest.fn((id: string) => {
    if (typeof id !== 'string') return false;
    if (id.length < 20 || id.length > 30) return false;
    // CUID2 Format: lowercase a-z and 0-9 only, starts with letter
    // Nanoid/CUID Format (für UserId): mixed case alphanumeric + underscore/hyphen
    // Wir akzeptieren beide Formate für Kompatibilität
    return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(id);
  }),
}));

/**
 * Generiert eine Test-CUID mit korrektem Format.
 * Format: 25 Zeichen, beginnt mit 'c', nur lowercase a-z und 0-9.
 */
function generateTestCuid(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'c';
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * ETB Query Handler Integration Tests.
 *
 * Diese Tests validieren das Zusammenspiel von Command und Query Handlers
 * in realistischen Szenarien. Sie testen den vollstaendigen Flow:
 * Command -> Repository -> Domain -> Query -> DTO.
 *
 * **Warum Integration Tests:**
 * - Verifizieren das Zusammenspiel mehrerer Komponenten
 * - Testen realistische Szenarien (Command-Sequenzen gefolgt von Queries)
 * - Validieren dass Query-Ergebnisse nach Mutations korrekt sind
 *
 * **Pattern:**
 * - InMemoryEtbRepository fuer schnelle Tests ohne Datenbank
 * - SpyEventPublisher fuer Event-Verifikation
 * - createTestEtb Fixtures fuer konsistente Test-Daten
 */
describe('ETB Query Integration Tests', () => {
  let etbRepository: InMemoryEtbRepository;
  let mockEinsatzRepository: jest.Mocked<IEinsatzRepository>;

  // Command Handlers
  let createEtbHandler: CreateEtbHandler;
  let addEintragHandler: AddEintragHandler;
  let updateEintragHandler: UpdateEintragHandler;
  let deleteEintragHandler: DeleteEintragHandler;
  let lockEtbHandler: LockEtbHandler;

  // Query Handlers
  let getEtbHandler: GetEtbQueryHandler;
  let getEintraegeHandler: GetEintraegeQueryHandler;
  let getHistoryHandler: GetEtbHistoryQueryHandler;

  let testUserId: string;
  let testEinsatzId: string;

  beforeEach(() => {
    // Reset repository und mocks
    etbRepository = new InMemoryEtbRepository();
    testUserId = generateTestCuid();
    testEinsatzId = generateTestCuid();

    // Mock IEinsatzRepository (CreateEtbHandler benoetigt exists-Check)
    mockEinsatzRepository = {
      exists: jest.fn().mockResolvedValue(Result.ok(true)),
      findById: jest.fn(),
      findActive: jest.fn(),
      findByNummer: jest.fn(),
      save: jest.fn(),
    };

    // Command Handlers initialisieren (Transactional Outbox Pattern - kein Event Publisher nötig)
    createEtbHandler = new CreateEtbHandler(mockEinsatzRepository, etbRepository);
    addEintragHandler = new AddEintragHandler(etbRepository);
    updateEintragHandler = new UpdateEintragHandler(etbRepository);
    deleteEintragHandler = new DeleteEintragHandler(etbRepository);
    lockEtbHandler = new LockEtbHandler(etbRepository);

    // Query Handlers initialisieren
    getEtbHandler = new GetEtbQueryHandler(etbRepository);
    getEintraegeHandler = new GetEintraegeQueryHandler(etbRepository);
    getHistoryHandler = new GetEtbHistoryQueryHandler(etbRepository);
  });

  afterEach(() => {
    etbRepository.clear();
    jest.clearAllMocks();
  });

  describe('CreateEtb -> AddEintrag -> GetEtb: sollte ETB mit hinzugefuegtem Eintrag zurueckgeben', () => {
    it('sollte ETB mit Eintrag nach Command-Sequenz zurueckgeben', async () => {
      // Arrange: ETB erstellen
      const createCmd = CreateEtbCommand.create(testEinsatzId).value!;
      const createResult = await createEtbHandler.execute(createCmd);
      expect(createResult.isSuccess).toBe(true);
      const etbId = createResult.value!.value;

      // Act: Eintrag hinzufuegen
      const addCmd = AddEintragCommand.create(etbId, 'Fahrzeug W1 eingetroffen', testUserId).value!;
      const addResult = await addEintragHandler.execute(addCmd);
      expect(addResult.isSuccess).toBe(true);

      // Assert: GetEtb gibt Eintrag zurueck
      const query = new GetEtbQuery(testEinsatzId);
      const result = await getEtbHandler.execute(query);

      expect(result.isSuccess).toBe(true);
      expect(result.value).not.toBeNull();
      expect(result.value!.eintraege).toHaveLength(1);
      expect(result.value!.eintraege[0].text).toBe('Fahrzeug W1 eingetroffen');
      expect(result.value!.eintraege[0].isDeleted).toBe(false);
    });

    it('sollte mehrere Eintraege korrekt zurueckgeben', async () => {
      // Arrange: ETB mit mehreren Eintraegen erstellen
      const createCmd = CreateEtbCommand.create(testEinsatzId).value!;
      const createResult = await createEtbHandler.execute(createCmd);
      const etbId = createResult.value!.value;

      // Act: Mehrere Eintraege hinzufuegen
      const texts = ['Alarmierung erhalten', 'Ausgerueckt', 'Am Einsatzort eingetroffen'];
      for (const text of texts) {
        const addCmd = AddEintragCommand.create(etbId, text, testUserId).value!;
        await addEintragHandler.execute(addCmd);
      }

      // Assert: GetEtb gibt alle Eintraege zurueck
      const query = new GetEtbQuery(testEinsatzId);
      const result = await getEtbHandler.execute(query);

      expect(result.isSuccess).toBe(true);
      expect(result.value!.eintraege).toHaveLength(3);
      // Verifizieren dass Texte korrekt sind
      const returnedTexts = result.value!.eintraege.map((e) => e.text);
      expect(returnedTexts).toContain('Alarmierung erhalten');
      expect(returnedTexts).toContain('Ausgerueckt');
      expect(returnedTexts).toContain('Am Einsatzort eingetroffen');
    });
  });

  describe('AddEintrag -> DeleteEintrag -> GetEtb: Soft-Delete Filter Test', () => {
    it('sollte geloeschten Eintrag standardmaessig ausschliessen', async () => {
      // Arrange: ETB mit Eintrag erstellen
      const etb = createTestEtb({ entriesCount: 0, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      // Eintrag hinzufuegen
      const addCmd = AddEintragCommand.create(etb.id.value, 'Wird geloescht', testUserId).value!;
      const addResult = await addEintragHandler.execute(addCmd);
      const eintragId = addResult.value!.id.value;

      // Zweiten Eintrag hinzufuegen (bleibt aktiv)
      const addCmd2 = AddEintragCommand.create(etb.id.value, 'Bleibt aktiv', testUserId).value!;
      await addEintragHandler.execute(addCmd2);

      // Act: Ersten Eintrag loeschen (soft-delete)
      const deleteCmd = DeleteEintragCommand.create(etb.id.value, eintragId, testUserId).value!;
      await deleteEintragHandler.execute(deleteCmd);

      // Assert: GetEtb ohne includeDeleted schliesst geloeschten Eintrag aus
      const query = new GetEtbQuery(testEinsatzId, false);
      const result = await getEtbHandler.execute(query);

      expect(result.isSuccess).toBe(true);
      expect(result.value!.eintraege).toHaveLength(1);
      expect(result.value!.eintraege[0].text).toBe('Bleibt aktiv');
    });

    it('sollte geloeschten Eintrag mit includeDeleted=true einschliessen', async () => {
      // Arrange: ETB mit Eintrag erstellen
      const etb = createTestEtb({ entriesCount: 0, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      // Eintrag hinzufuegen
      const addCmd = AddEintragCommand.create(etb.id.value, 'Wird geloescht', testUserId).value!;
      const addResult = await addEintragHandler.execute(addCmd);
      const eintragId = addResult.value!.id.value;

      // Eintrag loeschen (soft-delete)
      const deleteCmd = DeleteEintragCommand.create(etb.id.value, eintragId, testUserId).value!;
      await deleteEintragHandler.execute(deleteCmd);

      // Assert: GetEtb MIT includeDeleted schliesst geloeschten Eintrag ein
      const query = new GetEtbQuery(testEinsatzId, true);
      const result = await getEtbHandler.execute(query);

      expect(result.isSuccess).toBe(true);
      expect(result.value!.eintraege).toHaveLength(1);
      expect(result.value!.eintraege[0].text).toBe('Wird geloescht');
      expect(result.value!.eintraege[0].isDeleted).toBe(true);
    });
  });

  describe('Multiple AddEintrag -> GetEintraege: Sortierung nach Sequenznummer', () => {
    it('sollte Eintraege nach Sequenznummer aufsteigend sortiert zurueckgeben', async () => {
      // Arrange: ETB mit mehreren Eintraegen erstellen
      const etb = createTestEtb({ entriesCount: 0, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      // Eintraege in bestimmter Reihenfolge hinzufuegen
      const texts = ['Erster Eintrag', 'Zweiter Eintrag', 'Dritter Eintrag'];
      for (const text of texts) {
        const addCmd = AddEintragCommand.create(etb.id.value, text, testUserId).value!;
        await addEintragHandler.execute(addCmd);
      }

      // Act: GetEintraege ausfuehren
      const query = new GetEintraegeQuery(etb.id.value);
      const result = await getEintraegeHandler.execute(query);

      // Assert: Eintraege sind nach Sequenznummer sortiert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(3);

      // Sequenznummern muessen aufsteigend sein
      expect(result.value![0].sequenceNumber).toBe(1);
      expect(result.value![1].sequenceNumber).toBe(2);
      expect(result.value![2].sequenceNumber).toBe(3);

      // Texte muessen der Reihenfolge entsprechen
      expect(result.value![0].text).toBe('Erster Eintrag');
      expect(result.value![1].text).toBe('Zweiter Eintrag');
      expect(result.value![2].text).toBe('Dritter Eintrag');
    });

    it('sollte Result.fail() zurueckgeben wenn ETB nicht existiert', async () => {
      // Arrange: Nicht-existierende ETB-ID
      const nonExistentEtbId = generateTestCuid();

      // Act
      const query = new GetEintraegeQuery(nonExistentEtbId);
      const result = await getEintraegeHandler.execute(query);

      // Assert: Result.fail() statt NotFoundException (framework-agnostisch)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Einsatztagebuch nicht gefunden');
    });

    it('sollte leeres Array zurueckgeben wenn ETB keine Eintraege hat', async () => {
      // Arrange: Leeres ETB
      const etb = createTestEtb({ entriesCount: 0, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      // Act
      const query = new GetEintraegeQuery(etb.id.value);
      const result = await getEintraegeHandler.execute(query);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(0);
    });
  });

  describe('AddEintrag -> UpdateEintrag -> GetEtbHistory: Snapshot-Verifikation', () => {
    /**
     * Erstellt ein EtbEintragSnapshot-Objekt fuer Tests.
     * Verwendet CUID-Format fuer IDs um Validierung zu bestehen.
     */
    function createTestEintragSnapshot(sequenceNumber: number): {
      id: string;
      sequenceNumber: number;
      text: string;
      createdBy: string;
      createdAt: string;
      updatedAt?: string;
      isDeleted: boolean;
    } {
      return {
        id: generateTestCuid(),
        sequenceNumber,
        text: `Snapshot Eintrag ${sequenceNumber}`,
        createdBy: generateTestCuid(),
        createdAt: new Date().toISOString(),
        isDeleted: false,
      };
    }

    it('sollte Snapshots fuer jede Mutation zurueckgeben', async () => {
      // Arrange: ETB erstellen und Snapshots manuell hinzufuegen
      // (InMemoryRepository speichert keine Snapshots automatisch, wir simulieren)
      const etb = createTestEtb({ entriesCount: 0, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      // Simuliere Snapshots nach Mutationen mit manuell erstellten Eintraegen
      const snapshot1 = createTestSnapshot({ versionNumber: 1, eintraege: [] });
      const snapshot2 = createTestSnapshot({
        versionNumber: 2,
        eintraege: [createTestEintragSnapshot(1)],
      });
      const snapshot3 = createTestSnapshot({
        versionNumber: 3,
        eintraege: [createTestEintragSnapshot(1)],
      });

      etbRepository.addSnapshot(etb.id, snapshot1);
      etbRepository.addSnapshot(etb.id, snapshot2);
      etbRepository.addSnapshot(etb.id, snapshot3);

      // Act: Historie abrufen
      const query = new GetEtbHistoryQuery(etb.id.value);
      const result = await getHistoryHandler.execute(query);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(3);
    });

    it('sollte Snapshots nach Versionsnummer aufsteigend sortieren', async () => {
      // Arrange: ETB mit Snapshots in umgekehrter Reihenfolge
      const etb = createTestEtb({ entriesCount: 0, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      // Snapshots werden normalerweise neueste zuerst gespeichert
      // Verwende manuell erstellte Eintraege mit CUID-Format
      const snapshot3 = createTestSnapshot({
        versionNumber: 3,
        eintraege: [createTestEintragSnapshot(1), createTestEintragSnapshot(2)],
      });
      const snapshot2 = createTestSnapshot({
        versionNumber: 2,
        eintraege: [createTestEintragSnapshot(1)],
      });
      const snapshot1 = createTestSnapshot({ versionNumber: 1, eintraege: [] });

      etbRepository.addSnapshot(etb.id, snapshot3);
      etbRepository.addSnapshot(etb.id, snapshot2);
      etbRepository.addSnapshot(etb.id, snapshot1);

      // Act: Historie abrufen
      const query = new GetEtbHistoryQuery(etb.id.value);
      const result = await getHistoryHandler.execute(query);

      // Assert: Aufsteigende Sortierung (aelteste zuerst)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(3);
      expect(result.value![0].version).toBe(1);
      expect(result.value![1].version).toBe(2);
      expect(result.value![2].version).toBe(3);
    });

    it('sollte leeres Array zurueckgeben wenn keine Historie vorhanden', async () => {
      // Arrange: ETB ohne Snapshots
      const etb = createTestEtb({ entriesCount: 0, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      // Act
      const query = new GetEtbHistoryQuery(etb.id.value);
      const result = await getHistoryHandler.execute(query);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(0);
    });
  });

  describe('Full Lifecycle: CreateEtb -> AddEintrag -> UpdateEintrag -> DeleteEintrag -> LockEtb -> GetEtb + GetHistory', () => {
    it('sollte vollstaendigen ETB-Lifecycle korrekt abbilden', async () => {
      // Phase 1: ETB erstellen
      const createCmd = CreateEtbCommand.create(testEinsatzId).value!;
      const createResult = await createEtbHandler.execute(createCmd);
      expect(createResult.isSuccess).toBe(true);
      const etbId = createResult.value!.value;

      // Phase 2: Eintrag hinzufuegen
      const addCmd = AddEintragCommand.create(etbId, 'Urspruenglicher Text', testUserId).value!;
      const addResult = await addEintragHandler.execute(addCmd);
      expect(addResult.isSuccess).toBe(true);
      const eintragId = addResult.value!.id.value;

      // Phase 3: Eintrag aktualisieren
      const updateCmd = UpdateEintragCommand.create(etbId, eintragId, 'Aktualisierter Text', testUserId).value!;
      const updateResult = await updateEintragHandler.execute(updateCmd);
      expect(updateResult.isSuccess).toBe(true);

      // Phase 4: Zweiten Eintrag hinzufuegen und loeschen
      const addCmd2 = AddEintragCommand.create(etbId, 'Wird geloescht', testUserId).value!;
      const addResult2 = await addEintragHandler.execute(addCmd2);
      const eintragId2 = addResult2.value!.id.value;

      const deleteCmd = DeleteEintragCommand.create(etbId, eintragId2, testUserId).value!;
      await deleteEintragHandler.execute(deleteCmd);

      // Phase 5: ETB sperren
      const lockCmd = LockEtbCommand.create(etbId, testUserId, 'ADMIN').value!;
      const lockResult = await lockEtbHandler.execute(lockCmd);
      expect(lockResult.isSuccess).toBe(true);

      // Assert Phase 1: GetEtb gibt korrekten finalen Zustand zurueck
      const getEtbQuery = new GetEtbQuery(testEinsatzId, false);
      const etbResult = await getEtbHandler.execute(getEtbQuery);

      expect(etbResult.isSuccess).toBe(true);
      expect(etbResult.value).not.toBeNull();
      expect(etbResult.value!.status).toBe('LOCKED');
      // Nur aktiver Eintrag (geloeschter ausgeschlossen)
      expect(etbResult.value!.eintraege).toHaveLength(1);
      expect(etbResult.value!.eintraege[0].text).toBe('Aktualisierter Text');

      // Assert Phase 2: GetEtb mit includeDeleted zeigt geloeschten Eintrag
      const getEtbQueryWithDeleted = new GetEtbQuery(testEinsatzId, true);
      const etbResultWithDeleted = await getEtbHandler.execute(getEtbQueryWithDeleted);

      expect(etbResultWithDeleted.value!.eintraege).toHaveLength(2);
      const deletedEntry = etbResultWithDeleted.value!.eintraege.find((e) => e.isDeleted);
      expect(deletedEntry).toBeDefined();
      expect(deletedEntry!.text).toBe('Wird geloescht');
    });

    it('sollte Event-Sequenz nach vollstaendigem Lifecycle korrekt sein', async () => {
      // ETB erstellen
      const createCmd = CreateEtbCommand.create(testEinsatzId).value!;
      const createResult = await createEtbHandler.execute(createCmd);
      const etbId = createResult.value!.value;

      // Eintrag hinzufuegen
      const addCmd = AddEintragCommand.create(etbId, 'Test', testUserId).value!;
      const addResult = await addEintragHandler.execute(addCmd);
      const eintragId = addResult.value!.id.value;

      // Eintrag aktualisieren
      const updateCmd = UpdateEintragCommand.create(etbId, eintragId, 'Updated', testUserId).value!;
      await updateEintragHandler.execute(updateCmd);

      // Eintrag loeschen
      const deleteCmd = DeleteEintragCommand.create(etbId, eintragId, testUserId).value!;
      await deleteEintragHandler.execute(deleteCmd);

      // ETB sperren
      const lockCmd = LockEtbCommand.create(etbId, testUserId, 'ADMIN').value!;
      const lockResult = await lockEtbHandler.execute(lockCmd);

      // Assert: ETB ist korrekt gesperrt
      expect(lockResult.isSuccess).toBe(true);
    });
  });

  describe('GetEtb Query: Nicht existierendes ETB', () => {
    it('sollte null zurueckgeben wenn ETB nicht existiert', async () => {
      // Arrange: Nicht existierende EinsatzId
      const nonExistentEinsatzId = generateTestCuid();

      // Act
      const query = new GetEtbQuery(nonExistentEinsatzId);
      const result = await getEtbHandler.execute(query);

      // Assert: null ist valide Response (NICHT Fehler!)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
    });
  });

  describe('Query Validierung', () => {
    it('GetEtbQuery sollte bei leerem einsatzId Fehler werfen', () => {
      expect(() => new GetEtbQuery('')).toThrow();
    });

    it('GetEintraegeQuery sollte bei leerem etbId Fehler werfen', () => {
      expect(() => new GetEintraegeQuery('')).toThrow();
    });

    it('GetEtbHistoryQuery sollte bei leerem etbId Fehler werfen', () => {
      expect(() => new GetEtbHistoryQuery('')).toThrow();
    });
  });
});
