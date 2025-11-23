// Mock CUID2 für deterministische Tests
// WICHTIG: Muss VOR allen Imports stehen, da Jest Hoisting verwendet
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
    return /^[a-z][a-z0-9]+$/.test(id);
  }),
}));

import { EtbQueryMapper } from '../etb-query.mapper';
import { createTestEtb, createTestEintrag, createTestSnapshot, createTestUserId, resetTestIdCounter } from '@domain/aggregates/__tests__/fixtures/etb.fixtures';

/**
 * Unit Tests fuer den EtbQueryMapper.
 *
 * Dieser Mapper transformiert Domain-Objekte (EinsatztagebuchAggregate, EtbEintrag, EtbSnapshot)
 * in DTOs fuer die API-Schicht. Die Tests validieren die korrekte Transformation
 * und das Filterverhalten fuer soft-deleted Eintraege.
 */

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

describe('EtbQueryMapper', () => {
  beforeEach(() => {
    resetTestIdCounter();
  });

  // ============================================================================
  // toEtbDto Tests
  // ============================================================================

  describe('toEtbDto', () => {
    it('sollte ein Aggregate zu EtbDto mit allen Eigenschaften mappen', () => {
      // Arrange - explizite CUIDs fuer deterministische Tests
      const etb = createTestEtb({
        einsatzId: generateTestCuid(),
        userId: generateTestCuid(),
        entriesCount: 2,
      });

      // Act
      const dto = EtbQueryMapper.toEtbDto(etb);

      // Assert
      expect(dto.id).toBe(etb.id.value);
      expect(dto.einsatzId).toBe(etb.einsatzId.value);
      expect(dto.status).toBe(etb.status.value);
      expect(dto.eintraege).toHaveLength(2);
      expect(dto.version).toBeDefined();
      expect(dto.version.versionNumber).toBe(etb.version.versionNumber);
      expect(dto.version.timestamp).toEqual(etb.version.timestamp);
      expect(dto.createdAt).toEqual(etb.createdAt);
    });

    it('sollte geloeschte Eintraege ausfiltern wenn includeDeleted=false', () => {
      // Arrange
      const etb = createTestEtb({
        einsatzId: generateTestCuid(),
        userId: generateTestCuid(),
        entriesCount: 3,
      });
      const userId = createTestUserId(generateTestCuid());

      // Loesche den zweiten Eintrag
      const secondEntry = etb.eintraege[1];
      etb.deleteEintrag(secondEntry.id, userId);

      // Act
      const dto = EtbQueryMapper.toEtbDto(etb, false);

      // Assert
      expect(dto.eintraege).toHaveLength(2);
      expect(dto.eintraege.every((e) => !e.isDeleted)).toBe(true);
    });

    it('sollte geloeschte Eintraege inkludieren wenn includeDeleted=true', () => {
      // Arrange
      const etb = createTestEtb({
        einsatzId: generateTestCuid(),
        userId: generateTestCuid(),
        entriesCount: 3,
      });
      const userId = createTestUserId(generateTestCuid());

      // Loesche den zweiten Eintrag
      const secondEntry = etb.eintraege[1];
      etb.deleteEintrag(secondEntry.id, userId);

      // Act
      const dto = EtbQueryMapper.toEtbDto(etb, true);

      // Assert
      expect(dto.eintraege).toHaveLength(3);
      expect(dto.eintraege.some((e) => e.isDeleted)).toBe(true);
    });

    it('sollte ein Aggregate ohne Eintraege korrekt mappen', () => {
      // Arrange
      const etb = createTestEtb({
        einsatzId: generateTestCuid(),
        userId: generateTestCuid(),
        entriesCount: 0,
      });

      // Act
      const dto = EtbQueryMapper.toEtbDto(etb);

      // Assert
      expect(dto.eintraege).toHaveLength(0);
      expect(dto.eintraege).toEqual([]);
    });

    it('sollte den Status DRAFT korrekt mappen', () => {
      // Arrange
      const etb = createTestEtb({
        einsatzId: generateTestCuid(),
        userId: generateTestCuid(),
        status: 'DRAFT',
      });

      // Act
      const dto = EtbQueryMapper.toEtbDto(etb);

      // Assert
      expect(dto.status).toBe('DRAFT');
    });

    it('sollte den Status LOCKED korrekt mappen', () => {
      // Arrange
      const etb = createTestEtb({
        einsatzId: generateTestCuid(),
        userId: generateTestCuid(),
        status: 'LOCKED',
      });

      // Act
      const dto = EtbQueryMapper.toEtbDto(etb);

      // Assert
      expect(dto.status).toBe('LOCKED');
    });

    it('sollte das Version-Objekt korrekt mappen', () => {
      // Arrange
      const etb = createTestEtb({
        einsatzId: generateTestCuid(),
        userId: generateTestCuid(),
        entriesCount: 2,
      });

      // Act
      const dto = EtbQueryMapper.toEtbDto(etb);

      // Assert
      expect(dto.version).toEqual({
        versionNumber: etb.version.versionNumber,
        timestamp: etb.version.timestamp,
      });
    });
  });

  // ============================================================================
  // toEintragDto Tests
  // ============================================================================

  describe('toEintragDto', () => {
    it('sollte einen Eintrag zu EintragDto mit allen Eigenschaften mappen', () => {
      // Arrange
      const eintrag = createTestEintrag({
        id: generateTestCuid(),
        createdBy: generateTestCuid(),
        sequenceNumber: 5,
        text: 'Fahrzeug W1 eingetroffen',
      });

      // Act
      const dto = EtbQueryMapper.toEintragDto(eintrag);

      // Assert
      expect(dto.id).toBe(eintrag.id.value);
      expect(dto.sequenceNumber).toBe(eintrag.sequenceNumber.value);
      expect(dto.text).toBe('Fahrzeug W1 eingetroffen');
      expect(dto.createdBy).toBe(eintrag.createdBy.value);
      expect(dto.createdAt).toEqual(eintrag.createdAt);
      expect(dto.isDeleted).toBe(false);
    });

    it('sollte undefined updatedAt korrekt behandeln', () => {
      // Arrange
      const eintrag = createTestEintrag({
        id: generateTestCuid(),
        createdBy: generateTestCuid(),
      });
      // Neuer Eintrag hat kein updatedAt

      // Act
      const dto = EtbQueryMapper.toEintragDto(eintrag);

      // Assert
      expect(dto.updatedAt).toBeUndefined();
    });

    it('sollte Value Objects zu primitiven Werten mappen', () => {
      // Arrange
      const testId = generateTestCuid();
      const testUserId = generateTestCuid();
      const eintrag = createTestEintrag({
        id: testId,
        sequenceNumber: 42,
        createdBy: testUserId,
      });

      // Act
      const dto = EtbQueryMapper.toEintragDto(eintrag);

      // Assert - Value Objects wurden zu primitiven Typen
      expect(typeof dto.id).toBe('string');
      expect(dto.id).toBe(testId);
      expect(typeof dto.sequenceNumber).toBe('number');
      expect(dto.sequenceNumber).toBe(42);
      expect(typeof dto.createdBy).toBe('string');
      expect(dto.createdBy).toBe(testUserId);
    });
  });

  // ============================================================================
  // toSnapshotDto Tests
  // ============================================================================

  describe('toSnapshotDto', () => {
    it('sollte einen Snapshot zu EtbSnapshotDto mappen', () => {
      // Arrange - Snapshot mit expliziten Eintraegen
      const testEintraege = Array.from({ length: 2 }, (_, i) => ({
        id: generateTestCuid(),
        sequenceNumber: i + 1,
        text: `Snapshot Eintrag ${i + 1}`,
        createdBy: generateTestCuid(),
        createdAt: new Date().toISOString(),
        isDeleted: false,
      }));
      const snapshot = createTestSnapshot({
        versionNumber: 3,
        eintraege: testEintraege,
      });

      // Act
      const dto = EtbQueryMapper.toSnapshotDto(snapshot);

      // Assert
      expect(dto.version).toBe(3);
      expect(dto.snapshotAt).toEqual(snapshot.snapshotAt);
      expect(dto.eintraege).toHaveLength(2);
    });

    it('sollte einen Snapshot mit leerem eintraege Array korrekt behandeln', () => {
      // Arrange
      const snapshot = createTestSnapshot({
        versionNumber: 1,
        entriesCount: 0,
      });

      // Act
      const dto = EtbQueryMapper.toSnapshotDto(snapshot);

      // Assert
      expect(dto.eintraege).toHaveLength(0);
      expect(dto.eintraege).toEqual([]);
      expect(dto.version).toBe(1);
    });
  });
});
