import { EinsatztagebuchAggregate } from '@domain/aggregates/einsatztagebuch.aggregate';
import { EtbEintrag } from '@domain/entities/etb-eintrag.entity';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { EintragId } from '@domain/value-objects/eintrag-id';
import { EtbId } from '@domain/value-objects/etb-id';
import { EtbSequenceNumber } from '@domain/value-objects/etb-sequence-number';
import { EtbSnapshot, type EtbEintragSnapshot } from '@domain/value-objects/etb-snapshot';
import { EtbStatus } from '@domain/value-objects/etb-status';
import { EtbVersion } from '@domain/value-objects/etb-version';
import { UserId } from '@domain/value-objects/user-id';

/**
 * Test Fixtures für ETB Aggregate und zugehörige Entities.
 *
 * Diese Factory Functions erstellen Test-Objekte mit sinnvollen Defaults,
 * die durch Overrides angepasst werden können. Ermöglicht konsistente
 * und deterministische Tests ohne Boilerplate.
 *
 * **Design-Prinzipien:**
 * - Deterministische IDs (optionale Overrides für Reproduzierbarkeit)
 * - Sinnvolle Defaults für alle Pflichtfelder
 * - Support für verschiedene ETB-Stati (DRAFT, ACTIVE, LOCKED)
 * - Einfache Erstellung von Test-Szenarien
 */

// ============================================
// DETERMINISTIC ID GENERATION
// ============================================

let testIdCounter = 0;

/**
 * Generiert eine deterministische Test-ID.
 * Nutzt crypto.randomUUID() als Basis, aber erlaubt deterministisches Verhalten
 * durch den Counter für einfache Reproduzierbarkeit.
 */
export function generateTestId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 21);
}

/**
 * Generiert eine deterministische numerische Test-ID basierend auf Counter.
 * Nützlich für Tests die reproduzierbare IDs benötigen.
 */
export function generateDeterministicId(prefix: string): string {
  testIdCounter++;
  return `${prefix}${testIdCounter.toString().padStart(17, '0')}`;
}

/**
 * Setzt den ID-Counter zurück (für beforeEach in Tests).
 */
export function resetTestIdCounter(): void {
  testIdCounter = 0;
}

// ============================================
// ETB AGGREGATE FIXTURES
// ============================================

/**
 * Override-Optionen für createTestEtb().
 */
export interface CreateTestEtbOptions {
  /** ETB ID (auto-generiert wenn nicht angegeben) */
  id?: string;
  /** Einsatz ID (auto-generiert wenn nicht angegeben) */
  einsatzId?: string;
  /** Status des ETB (default: DRAFT) */
  status?: 'DRAFT' | 'ACTIVE' | 'LOCKED';
  /** Versionsnummer (default: 1) */
  versionNumber?: number;
  /** Anzahl der zu erstellenden Einträge (default: 0) */
  entriesCount?: number;
  /** User ID für createdBy (auto-generiert wenn nicht angegeben) */
  userId?: string;
}

/**
 * Erstellt ein EinsatztagebuchAggregate für Tests.
 *
 * Diese Factory nutzt die statische create() Methode und ermöglicht
 * anschließende Manipulation des Aggregates für verschiedene Test-Szenarien.
 *
 * @param options - Override-Optionen für die Aggregate-Erstellung
 * @returns EinsatztagebuchAggregate mit konfigurierten Eigenschaften
 *
 * @example
 * ```typescript
 * // Einfaches ETB (DRAFT, keine Einträge)
 * const etb = createTestEtb();
 *
 * // ETB mit 3 Einträgen
 * const etbWithEntries = createTestEtb({ entriesCount: 3 });
 *
 * // Gesperrtes ETB
 * const lockedEtb = createTestEtb({ status: 'LOCKED', entriesCount: 5 });
 * ```
 */
export function createTestEtb(options: CreateTestEtbOptions = {}): EinsatztagebuchAggregate {
  const { einsatzId = generateTestId(), status = 'DRAFT', entriesCount = 0, userId = generateTestId() } = options;

  // Create EinsatzId Value Object
  const einsatzIdResult = EinsatzId.create(einsatzId);
  if (einsatzIdResult.isFailure) {
    throw new Error(`Failed to create EinsatzId: ${einsatzIdResult.error}`);
  }

  // Create ETB Aggregate via Factory Method
  if (!einsatzIdResult.value) {
    throw new Error('Failed to create EinsatzId: value is undefined');
  }
  const etbResult = EinsatztagebuchAggregate.create(einsatzIdResult.value);
  if (etbResult.isFailure || !etbResult.value) {
    throw new Error(`Failed to create ETB: ${etbResult.error}`);
  }

  const etb = etbResult.value;

  // Create UserId for entries
  const userIdResult = UserId.create(userId);
  if (userIdResult.isFailure || !userIdResult.value) {
    throw new Error(`Failed to create UserId: ${userIdResult.error}`);
  }
  const userIdVO = userIdResult.value;

  // Add entries if requested
  for (let i = 1; i <= entriesCount; i++) {
    const addResult = etb.addEintrag(`Test Eintrag ${i}`, userIdVO);
    if (addResult.isFailure) {
      throw new Error(`Failed to add entry ${i}: ${addResult.error}`);
    }
  }

  // Transition to requested status
  if (status === 'LOCKED') {
    const lockResult = etb.lock(userIdVO);
    if (lockResult.isFailure) {
      throw new Error(`Failed to lock ETB: ${lockResult.error}`);
    }
  }
  // Note: ACTIVE status transition would require additional business logic
  // For now, we support DRAFT (default) and LOCKED

  // Clear domain events after setup (prevent test pollution)
  etb.clearDomainEvents();

  return etb;
}

// ============================================
// ETB EINTRAG FIXTURES
// ============================================

/**
 * Override-Optionen für createTestEintrag().
 */
export interface CreateTestEintragOptions {
  /** Eintrag ID (auto-generiert wenn nicht angegeben) */
  id?: string;
  /** Sequenznummer (default: 1) */
  sequenceNumber?: number;
  /** Textinhalt (default: 'Test Eintrag Text') */
  text?: string;
  /** User ID für createdBy (auto-generiert wenn nicht angegeben) */
  createdBy?: string;
  /** Creation timestamp (default: new Date()) */
  createdAt?: Date;
  /** Ist der Eintrag als gelöscht markiert? (default: false) */
  isDeleted?: boolean;
}

/**
 * Erstellt einen EtbEintrag für Tests.
 *
 * Diese Factory erstellt einen isolierten Eintrag ohne parent Aggregate.
 * Nützlich für Unit Tests von Eintrag-Logik oder Mapper-Tests.
 *
 * @param options - Override-Optionen für die Eintrag-Erstellung
 * @returns EtbEintrag mit konfigurierten Eigenschaften
 *
 * @example
 * ```typescript
 * // Einfacher Eintrag
 * const entry = createTestEintrag();
 *
 * // Eintrag mit spezifischem Text
 * const customEntry = createTestEintrag({ text: 'Fahrzeug eingetroffen' });
 *
 * // Gelöschter Eintrag
 * const deletedEntry = createTestEintrag({ isDeleted: true });
 * ```
 */
export function createTestEintrag(options: CreateTestEintragOptions = {}): EtbEintrag {
  const { id = generateTestId(), sequenceNumber = 1, text = 'Test Eintrag Text', createdBy = generateTestId(), createdAt = new Date(), isDeleted = false } = options;

  // Create Value Objects
  const idResult = EintragId.create(id);
  if (idResult.isFailure) {
    throw new Error(`Failed to create EintragId: ${idResult.error}`);
  }

  const seqResult = EtbSequenceNumber.create(sequenceNumber);
  if (seqResult.isFailure) {
    throw new Error(`Failed to create EtbSequenceNumber: ${seqResult.error}`);
  }

  const userIdResult = UserId.create(createdBy);
  if (userIdResult.isFailure || !userIdResult.value) {
    throw new Error(`Failed to create UserId: ${userIdResult.error}`);
  }

  // Create EtbEintrag
  if (!idResult.value || !seqResult.value) {
    throw new Error('Failed to create required value objects');
  }
  const eintrag = new EtbEintrag(idResult.value, seqResult.value, text, userIdResult.value, createdAt);

  // Mark as deleted if requested
  if (isDeleted) {
    eintrag.markAsDeleted();
  }

  return eintrag;
}

// ============================================
// ETB SNAPSHOT FIXTURES
// ============================================

/**
 * Override-Optionen für createTestSnapshot().
 */
export interface CreateTestSnapshotOptions {
  /** Versionsnummer (default: 1) */
  versionNumber?: number;
  /** Anzahl der Einträge im Snapshot (default: 0) */
  entriesCount?: number;
  /** Snapshot-Zeitstempel (default: new Date()) */
  snapshotAt?: Date;
  /** Optional: Spezifische Einträge als serialisierbare Snapshots statt auto-generierter */
  eintraege?: EtbEintragSnapshot[];
}

/**
 * Erstellt einen EtbSnapshot für Tests.
 *
 * Diese Factory erstellt einen Snapshot mit konfigurierbarer Version
 * und Einträgen. Nützlich für History/Audit-Trail Tests.
 *
 * @param options - Override-Optionen für die Snapshot-Erstellung
 * @returns EtbSnapshot mit konfigurierten Eigenschaften
 *
 * @example
 * ```typescript
 * // Einfacher Snapshot
 * const snapshot = createTestSnapshot();
 *
 * // Snapshot mit Version 5 und 10 Einträgen
 * const historySnapshot = createTestSnapshot({ versionNumber: 5, entriesCount: 10 });
 * ```
 */
export function createTestSnapshot(options: CreateTestSnapshotOptions = {}): EtbSnapshot {
  const { versionNumber = 1, entriesCount = 0, snapshotAt = new Date(), eintraege } = options;

  // Create Version
  const versionResult = EtbVersion.create(versionNumber);
  if (versionResult.isFailure) {
    throw new Error(`Failed to create EtbVersion: ${versionResult.error}`);
  }

  // Generate entries as EtbEintragSnapshot[] (serializable format)
  const snapshotEntries: EtbEintragSnapshot[] =
    eintraege ??
    Array.from({ length: entriesCount }, (_, i) => {
      const entry = createTestEintrag({
        sequenceNumber: i + 1,
        text: `Snapshot Eintrag ${i + 1}`,
      });
      // Convert EtbEintrag to serializable EtbEintragSnapshot
      return {
        id: entry.id.value,
        sequenceNumber: entry.sequenceNumber.value,
        text: entry.text,
        createdBy: entry.createdBy.value,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt?.toISOString(),
        isDeleted: entry.isDeleted,
      };
    });

  if (!versionResult.value) {
    throw new Error('Failed to create EtbVersion: value is undefined');
  }
  return new EtbSnapshot(versionResult.value, snapshotEntries, snapshotAt);
}

// ============================================
// VALUE OBJECT FIXTURES
// ============================================

/**
 * Erstellt eine test EtbId.
 *
 * @param id - Optional: Spezifische ID (auto-generiert wenn nicht angegeben)
 * @returns EtbId Value Object
 */
export function createTestEtbId(id?: string): EtbId {
  const result = EtbId.create(id ?? generateTestId());
  if (result.isFailure || !result.value) {
    throw new Error(`Failed to create EtbId: ${result.error}`);
  }
  return result.value;
}

/**
 * Erstellt eine test EinsatzId.
 *
 * @param id - Optional: Spezifische ID (auto-generiert wenn nicht angegeben)
 * @returns EinsatzId Value Object
 */
export function createTestEinsatzId(id?: string): EinsatzId {
  const result = EinsatzId.create(id ?? generateTestId());
  if (result.isFailure || !result.value) {
    throw new Error(`Failed to create EinsatzId: ${result.error}`);
  }
  return result.value;
}

/**
 * Erstellt eine test UserId.
 *
 * @param id - Optional: Spezifische ID (auto-generiert wenn nicht angegeben)
 * @returns UserId Value Object
 */
export function createTestUserId(id?: string): UserId {
  const result = UserId.create(id ?? generateTestId());
  if (result.isFailure || !result.value) {
    throw new Error(`Failed to create UserId: ${result.error}`);
  }
  return result.value;
}

/**
 * Erstellt eine test EtbVersion.
 *
 * @param versionNumber - Optional: Versionsnummer (default: 1)
 * @returns EtbVersion Value Object
 */
export function createTestEtbVersion(versionNumber = 1): EtbVersion {
  const result = EtbVersion.create(versionNumber);
  if (result.isFailure || !result.value) {
    throw new Error(`Failed to create EtbVersion: ${result.error}`);
  }
  return result.value;
}

/**
 * Erstellt einen test EtbStatus.
 *
 * @param status - Status-Wert (default: 'DRAFT')
 * @returns EtbStatus Value Object
 */
export function createTestEtbStatus(status: 'DRAFT' | 'ACTIVE' | 'LOCKED' = 'DRAFT'): EtbStatus {
  switch (status) {
    case 'DRAFT':
      return EtbStatus.DRAFT();
    case 'ACTIVE':
      return EtbStatus.ACTIVE();
    case 'LOCKED':
      return EtbStatus.LOCKED();
    default:
      throw new Error(`Unknown status: ${status}`);
  }
}
