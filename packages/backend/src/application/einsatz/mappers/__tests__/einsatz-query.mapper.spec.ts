import { EinsatzQueryMapper } from '../einsatz-query.mapper';
import type { Einsatz } from '@domain/aggregates/einsatz.aggregate';
import { Address } from '@domain/value-objects/address';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { EinsatzStatus } from '@domain/value-objects/einsatz-status';
import { UserId } from '@domain/value-objects/user-id';
import type { EinsatzStatusType } from '@application/einsatz/dto/einsatz.dto';

/**
 * Unit Tests für den EinsatzQueryMapper.
 *
 * Dieser Mapper transformiert Domain-Objekte (EinsatzAggregate, Address)
 * in DTOs für die API-Schicht. Die Tests validieren die korrekte Transformation
 * aller Felder, insbesondere:
 * - Value Objects werden auf .value gemappt
 * - Optionale Felder werden korrekt behandelt
 * - Date-Objekte bleiben Date-Objekte (nicht string-serialisiert)
 */

/**
 * Test Helper: Generiert eine deterministische Test-ID.
 * Nutzt crypto.randomUUID() als Basis.
 */
function generateTestId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 21);
}

// ============================================
// MOCK HELPER FUNCTIONS
// ============================================

/**
 * Properties für createMockEinsatz() Helper.
 * Erlaubt Partial Overrides für alle Einsatz-Eigenschaften.
 */
interface MockEinsatzProps {
  id: string;
  nummer: string;
  alarmstichwort: string;
  status: EinsatzStatusType;
  einsatzort?: Address;
  bemerkung?: string;
  createdBy: string;
  createdAt: Date;
  abgeschlossenAt?: Date;
  archivedAt?: Date;
}

/**
 * Mock-Interface für Einsatz Aggregate (nur benötigte Properties für Mapper).
 * Simuliert die Getter des echten Aggregates ohne Business Logic.
 */
interface MockEinsatz {
  id: { value: string };
  nummer: string;
  alarmstichwort: string;
  status: { value: EinsatzStatusType };
  einsatzort?: Address;
  bemerkung?: string;
  createdBy: { value: string };
  createdAt: Date;
  abgeschlossenAt?: Date;
  archivedAt?: Date;
}

/**
 * Erstellt ein Mock-Einsatz-Objekt für Tests.
 *
 * Nutzt Partial Overrides Pattern um flexible Test-Szenarien zu ermöglichen.
 * Der Mock erfüllt das Interface das der Mapper erwartet, ohne die volle
 * Aggregate-Komplexität mit Business Logic nachzubilden.
 *
 * @param overrides - Partial Object mit zu überschreibenden Properties
 * @returns Mock-Einsatz mit konfigurierten Eigenschaften
 *
 * @example
 * ```typescript
 * // Einsatz mit Defaults
 * const einsatz = createMockEinsatz();
 *
 * // Einsatz mit spezifischem Status
 * const abgeschlossen = createMockEinsatz({ status: 'ABGESCHLOSSEN' });
 *
 * // Einsatz mit Einsatzort
 * const mitOrt = createMockEinsatz({ einsatzort: mockAddress });
 * ```
 */
function createMockEinsatz(overrides: Partial<MockEinsatzProps> = {}): MockEinsatz {
  const defaults: MockEinsatzProps = {
    id: generateTestId(),
    nummer: 'E2024-abc123xy',
    alarmstichwort: 'Wohnungsbrand',
    status: 'ANGELEGT',
    einsatzort: undefined,
    bemerkung: undefined,
    createdBy: generateTestId(),
    createdAt: new Date('2024-01-15T10:30:00.000Z'),
    abgeschlossenAt: undefined,
    archivedAt: undefined,
  };

  const props = { ...defaults, ...overrides };

  return {
    id: { value: props.id },
    nummer: props.nummer,
    alarmstichwort: props.alarmstichwort,
    status: { value: props.status },
    einsatzort: props.einsatzort,
    bemerkung: props.bemerkung,
    createdBy: { value: props.createdBy },
    createdAt: props.createdAt,
    abgeschlossenAt: props.abgeschlossenAt,
    archivedAt: props.archivedAt,
  };
}

/**
 * Erstellt ein Mock-Address-Objekt für Tests.
 *
 * Nutzt Address.create() Factory um ein validiertes Address Value Object
 * mit sinnvollen Defaults zu erstellen.
 *
 * HINWEIS: Address Value Object unterstützt KEIN 'land' Property (nur strasse, hausnummer, plz, ort).
 * Das 'land' Feld existiert nur im AddressDto, nicht im Domain-Modell.
 *
 * @param overrides - Partial Object mit zu überschreibenden Properties
 * @returns Address Value Object
 *
 * @example
 * ```typescript
 * // Vollständige Adresse
 * const address = createMockAddress();
 *
 * // Adresse ohne Hausnummer
 * const noNumber = createMockAddress({ hausnummer: undefined });
 * ```
 */
function createMockAddress(
  overrides: Partial<{
    strasse: string;
    hausnummer?: string;
    plz: string;
    ort: string;
  }> = {},
): Address {
  const defaults = {
    strasse: 'Musterstrasse',
    hausnummer: '42a',
    plz: '80331',
    ort: 'Muenchen',
  };

  const props = { ...defaults, ...overrides };

  const result = Address.create(props);
  if (result.isFailure || !result.value) {
    throw new Error(`Failed to create Address: ${result.error}`);
  }

  return result.value;
}

// ============================================
// toEinsatzDto Tests
// ============================================

describe('EinsatzQueryMapper', () => {
  describe('toEinsatzDto', () => {
    it('should map all required fields correctly', () => {
      // Given - Mock-Einsatz mit allen Pflichtfeldern
      const mockEinsatz = createMockEinsatz();

      // When - Mapping zu DTO
      const dto = EinsatzQueryMapper.toEinsatzDto(mockEinsatz as unknown as Einsatz);

      // Then - Alle Pflichtfelder sind korrekt gemappt
      expect(dto.id).toBe(mockEinsatz.id.value);
      expect(dto.nummer).toBe('E2024-abc123xy');
      expect(dto.alarmstichwort).toBe('Wohnungsbrand');
      expect(dto.status).toBe('ANGELEGT');
      expect(dto.createdBy).toBe(mockEinsatz.createdBy.value);
      expect(dto.createdAt).toEqual(new Date('2024-01-15T10:30:00.000Z'));
    });

    it('should map optional einsatzort when present', () => {
      // Given - Mock-Einsatz mit Einsatzort
      const mockAddress = createMockAddress();
      const mockEinsatz = createMockEinsatz({
        einsatzort: mockAddress,
      });

      // When - Mapping zu DTO
      const dto = EinsatzQueryMapper.toEinsatzDto(mockEinsatz as unknown as Einsatz);

      // Then - Einsatzort ist als AddressDto gemappt
      expect(dto.einsatzort).toBeDefined();
      expect(dto.einsatzort?.strasse).toBe('Musterstrasse');
      expect(dto.einsatzort?.hausnummer).toBe('42a');
      expect(dto.einsatzort?.plz).toBe('80331');
      expect(dto.einsatzort?.ort).toBe('Muenchen');
      // HINWEIS: 'land' existiert nicht im Address Value Object, daher nicht im DTO
      expect(dto.einsatzort?.land).toBeUndefined();
    });

    it('should not include einsatzort when undefined', () => {
      // Given - Mock-Einsatz ohne Einsatzort
      const mockEinsatz = createMockEinsatz({
        einsatzort: undefined,
      });

      // When - Mapping zu DTO
      const dto = EinsatzQueryMapper.toEinsatzDto(mockEinsatz as unknown as Einsatz);

      // Then - einsatzort ist undefined
      expect(dto.einsatzort).toBeUndefined();
    });

    it('should map optional bemerkung when present', () => {
      // Given - Mock-Einsatz mit Bemerkung
      const mockEinsatz = createMockEinsatz({
        bemerkung: 'Dachstuhl brennt, Personen evakuiert',
      });

      // When - Mapping zu DTO
      const dto = EinsatzQueryMapper.toEinsatzDto(mockEinsatz as unknown as Einsatz);

      // Then - Bemerkung ist korrekt gemappt
      expect(dto.bemerkung).toBe('Dachstuhl brennt, Personen evakuiert');
    });

    it('should not include bemerkung when undefined', () => {
      // Given - Mock-Einsatz ohne Bemerkung
      const mockEinsatz = createMockEinsatz({
        bemerkung: undefined,
      });

      // When - Mapping zu DTO
      const dto = EinsatzQueryMapper.toEinsatzDto(mockEinsatz as unknown as Einsatz);

      // Then - bemerkung ist undefined
      expect(dto.bemerkung).toBeUndefined();
    });

    it('should map abgeschlossenAt when status is ABGESCHLOSSEN', () => {
      // Given - Mock-Einsatz mit Status ABGESCHLOSSEN und abgeschlossenAt
      const abgeschlossenAt = new Date('2024-01-15T14:45:00.000Z');
      const mockEinsatz = createMockEinsatz({
        status: 'ABGESCHLOSSEN',
        abgeschlossenAt,
      });

      // When - Mapping zu DTO
      const dto = EinsatzQueryMapper.toEinsatzDto(mockEinsatz as unknown as Einsatz);

      // Then - abgeschlossenAt ist korrekt gemappt
      expect(dto.status).toBe('ABGESCHLOSSEN');
      expect(dto.abgeschlossenAt).toEqual(abgeschlossenAt);
    });

    it('should map archivedAt when status is ARCHIVIERT', () => {
      // Given - Mock-Einsatz mit Status ARCHIVIERT und archivedAt
      const archivedAt = new Date('2034-01-15T10:00:00.000Z');
      const abgeschlossenAt = new Date('2024-01-15T14:45:00.000Z');
      const mockEinsatz = createMockEinsatz({
        status: 'ARCHIVIERT',
        abgeschlossenAt,
        archivedAt,
      });

      // When - Mapping zu DTO
      const dto = EinsatzQueryMapper.toEinsatzDto(mockEinsatz as unknown as Einsatz);

      // Then - archivedAt ist korrekt gemappt
      expect(dto.status).toBe('ARCHIVIERT');
      expect(dto.archivedAt).toEqual(archivedAt);
      expect(dto.abgeschlossenAt).toEqual(abgeschlossenAt);
    });

    it('should extract .value from Value Objects correctly', () => {
      // Given - Mock-Einsatz mit Value Objects (id, status, createdBy)
      const testId = generateTestId();
      const testUserId = generateTestId();
      const mockEinsatz = createMockEinsatz({
        id: testId,
        status: 'IN_BEARBEITUNG',
        createdBy: testUserId,
      });

      // When - Mapping zu DTO
      const dto = EinsatzQueryMapper.toEinsatzDto(mockEinsatz as unknown as Einsatz);

      // Then - Value Objects wurden zu primitiven Typen extrahiert
      expect(typeof dto.id).toBe('string');
      expect(dto.id).toBe(testId);
      expect(typeof dto.status).toBe('string');
      expect(dto.status).toBe('IN_BEARBEITUNG');
      expect(typeof dto.createdBy).toBe('string');
      expect(dto.createdBy).toBe(testUserId);
    });

    it('should map all EinsatzStatus values correctly', () => {
      // Given/When/Then - Alle möglichen Status werden korrekt gemappt
      const statusValues: EinsatzStatusType[] = ['ANGELEGT', 'IN_BEARBEITUNG', 'ABGESCHLOSSEN', 'ARCHIVIERT'];

      for (const status of statusValues) {
        const mockEinsatz = createMockEinsatz({ status });
        const dto = EinsatzQueryMapper.toEinsatzDto(mockEinsatz as unknown as Einsatz);
        expect(dto.status).toBe(status);
      }
    });

    it('should preserve Date objects without string serialization', () => {
      // Given - Mock-Einsatz mit spezifischen Timestamps
      const createdAt = new Date('2024-01-15T10:30:00.000Z');
      const abgeschlossenAt = new Date('2024-01-15T14:45:00.000Z');
      const archivedAt = new Date('2034-01-15T10:00:00.000Z');

      const mockEinsatz = createMockEinsatz({
        status: 'ARCHIVIERT',
        createdAt,
        abgeschlossenAt,
        archivedAt,
      });

      // When - Mapping zu DTO
      const dto = EinsatzQueryMapper.toEinsatzDto(mockEinsatz as unknown as Einsatz);

      // Then - Date-Objekte bleiben Date-Objekte (keine String-Serialisierung)
      expect(dto.createdAt).toBeInstanceOf(Date);
      expect(dto.createdAt).toEqual(createdAt);
      expect(dto.abgeschlossenAt).toBeInstanceOf(Date);
      expect(dto.abgeschlossenAt).toEqual(abgeschlossenAt);
      expect(dto.archivedAt).toBeInstanceOf(Date);
      expect(dto.archivedAt).toEqual(archivedAt);
    });
  });

  // ============================================
  // toAddressDto Tests
  // ============================================

  describe('toAddressDto', () => {
    it('should map all address fields correctly', () => {
      // Given - Vollständige Address mit allen verfügbaren Feldern
      const address = createMockAddress({
        strasse: 'Hauptstrasse',
        hausnummer: '123',
        plz: '10115',
        ort: 'Berlin',
      });

      // When - Mapping zu AddressDto
      const dto = EinsatzQueryMapper.toAddressDto(address);

      // Then - Alle Domain-Felder sind korrekt gemappt
      expect(dto.strasse).toBe('Hauptstrasse');
      expect(dto.hausnummer).toBe('123');
      expect(dto.plz).toBe('10115');
      expect(dto.ort).toBe('Berlin');
      // HINWEIS: 'land' existiert nicht im Address Value Object, ist daher undefined
      expect(dto.land).toBeUndefined();
    });

    it('should handle optional hausnummer field', () => {
      // Given - Address ohne Hausnummer
      const address = createMockAddress({
        strasse: 'Dorfplatz',
        hausnummer: undefined,
        plz: '82467',
        ort: 'Garmisch-Partenkirchen',
      });

      // When - Mapping zu AddressDto
      const dto = EinsatzQueryMapper.toAddressDto(address);

      // Then - hausnummer ist undefined, andere Felder sind gesetzt
      expect(dto.strasse).toBe('Dorfplatz');
      expect(dto.hausnummer).toBeUndefined();
      expect(dto.plz).toBe('82467');
      expect(dto.ort).toBe('Garmisch-Partenkirchen');
    });

    it('should handle land field always being undefined', () => {
      // Given - Address (land existiert nicht im Domain-Modell)
      const address = createMockAddress({
        strasse: 'Bahnhofstrasse',
        hausnummer: '7',
        plz: '20095',
        ort: 'Hamburg',
      });

      // When - Mapping zu AddressDto
      const dto = EinsatzQueryMapper.toAddressDto(address);

      // Then - land ist IMMER undefined (existiert nicht im Address Value Object)
      expect(dto.strasse).toBe('Bahnhofstrasse');
      expect(dto.hausnummer).toBe('7');
      expect(dto.plz).toBe('20095');
      expect(dto.ort).toBe('Hamburg');
      expect(dto.land).toBeUndefined();
    });

    it('should handle address without optional hausnummer', () => {
      // Given - Address ohne Hausnummer (einziges optionales Feld im Domain-Modell)
      const address = createMockAddress({
        strasse: 'Marktplatz',
        hausnummer: undefined,
        plz: '69117',
        ort: 'Heidelberg',
      });

      // When - Mapping zu AddressDto
      const dto = EinsatzQueryMapper.toAddressDto(address);

      // Then - Nur hausnummer ist undefined, andere Domain-Felder sind gesetzt
      expect(dto.strasse).toBe('Marktplatz');
      expect(dto.hausnummer).toBeUndefined();
      expect(dto.plz).toBe('69117');
      expect(dto.ort).toBe('Heidelberg');
      expect(dto.land).toBeUndefined(); // land existiert nicht im Domain-Modell
    });

    it('should preserve Address Value Object immutability', () => {
      // Given - Address Value Object
      const address = createMockAddress();

      // When - Mapping zu AddressDto
      const dto = EinsatzQueryMapper.toAddressDto(address);

      // Then - Modification des DTOs ändert nicht das Value Object
      dto.strasse = 'Modified Street';
      expect(address.strasse).toBe('Musterstrasse'); // Unchanged
    });
  });
});
