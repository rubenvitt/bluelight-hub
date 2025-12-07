/**
 * Zentrale Test-Helper für Domain Layer Tests.
 *
 * Diese Utilities ermöglichen framework-unabhängige Tests ohne externe Dependencies.
 * Alle Helper sind pure TypeScript ohne Prisma, NestJS, oder andere Framework-Abhängigkeiten.
 *
 * **Design-Prinzipien:**
 * - Pure TypeScript/Jest only
 * - Deterministische Test-Daten
 * - AAA Pattern Support (Arrange-Act-Assert)
 * - Co-located mit Tests in __tests__/ folders
 */

// ============================================
// CUID2 MOCK SETUP
// ============================================

/**
 * Mock für CUID2 createId() Funktion.
 * Generiert valide CUID2-formatierte Test-IDs (lowercase letter + 20-30 lowercase alphanumeric chars).
 *
 * WICHTIG: Dieser Mock muss in jedem Test-File aufgerufen werden, das Value Objects
 * mit auto-generierten IDs (EinsatzId, UserId, etc.) nutzt.
 *
 * @example
 * ```typescript
 * // In deinem Test-File:
 * import { mockCuid2ForJest } from '@domain/__tests__/test-helpers';
 * mockCuid2ForJest();
 *
 * describe('MyTest', () => {
 *   it('should work', () => { ... });
 * });
 * ```
 */
export function mockCuid2ForJest(): void {
  jest.mock('@paralleldrive/cuid2', () => ({
    createId: jest.fn(() => {
      // Generate valid CUID2 format: starts with lowercase letter, 20-30 lowercase alphanumeric chars
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
}

// ============================================
// DETERMINISTIC ID GENERATION
// ============================================

let testIdCounter = 0;

/**
 * Generiert eine deterministische Test-CUID2.
 * Nützlich für Tests, die vorhersagbare IDs benötigen.
 *
 * @param suffix - Optionaler Suffix für Eindeutigkeit zwischen Tests
 * @returns Gültige CUID2-formatierte Test-ID
 *
 * @example
 * ```typescript
 * const einsatzId = generateTestCuid('einsatz1');
 * const userId = generateTestCuid('user1');
 * ```
 */
export function generateTestCuid(suffix = ''): string {
  const base = 'clw3h8x9y0000qwertyu';
  const padding = suffix.padEnd(5, '0').slice(0, 5);
  return base + padding;
}

/**
 * Generiert eine UUID-basierte Test-ID (für Value Objects die UUID nutzen).
 *
 * @returns UUID v4 string
 */
export function generateTestUuid(): string {
  return crypto.randomUUID();
}

/**
 * Generiert eine numerische Counter-basierte ID.
 * Nützlich für reproduzierbare Test-Szenarien.
 *
 * @param prefix - Prefix für die ID (z.B. 'test')
 * @returns Deterministische numerische ID mit Prefix
 */
export function generateDeterministicId(prefix: string): string {
  testIdCounter++;
  return `${prefix}${testIdCounter.toString().padStart(17, '0')}`;
}

/**
 * Setzt den ID-Counter zurück.
 * Sollte in beforeEach() aufgerufen werden für deterministische Tests.
 *
 * @example
 * ```typescript
 * beforeEach(() => {
 *   resetTestIdCounter();
 * });
 * ```
 */
export function resetTestIdCounter(): void {
  testIdCounter = 0;
}

// ============================================
// DATE/TIME HELPERS
// ============================================

/**
 * Erstellt ein fixiertes Test-Datum.
 * Standardmäßig: 1. Januar 2024, 12:00:00 UTC
 *
 * @param isoString - Optional: ISO 8601 String für spezifisches Datum
 * @returns Date Objekt
 */
export function createTestDate(isoString?: string): Date {
  return isoString ? new Date(isoString) : new Date('2024-01-01T12:00:00.000Z');
}

/**
 * Mockt Date.now() für deterministische Zeitstempel.
 * Nützlich für Tests die Timestamps validieren.
 *
 * @param timestamp - Optional: Spezifischer Unix timestamp (default: 1.1.2024 12:00 UTC)
 * @returns Mock-Funktion zum Restore in afterEach()
 */
export function mockDateNow(timestamp?: number): jest.SpyInstance {
  const fixedTime = timestamp ?? new Date('2024-01-01T12:00:00.000Z').getTime();
  return jest.spyOn(Date, 'now').mockReturnValue(fixedTime);
}

// ============================================
// RESULT PATTERN ASSERTIONS
// ============================================

/**
 * Type-Guard für Result.isSuccess.
 * Ermöglicht TypeScript type-narrowing in Tests.
 *
 * @example
 * ```typescript
 * const result = ValueObject.create('test');
 * expect(isSuccess(result)).toBe(true);
 * if (isSuccess(result)) {
 *   // TypeScript weiß jetzt, dass result.value !== undefined
 *   expect(result.value.toString()).toBe('test');
 * }
 * ```
 */
export function isSuccess<T>(result: { isSuccess: boolean; value?: T }): result is { isSuccess: true; value: T } {
  return result.isSuccess && result.value !== undefined;
}

/**
 * Type-Guard für Result.isFailure.
 * Ermöglicht TypeScript type-narrowing in Tests.
 *
 * @example
 * ```typescript
 * const result = ValueObject.create('');
 * expect(isFailure(result)).toBe(true);
 * if (isFailure(result)) {
 *   // TypeScript weiß jetzt, dass result.error !== undefined
 *   expect(result.error).toContain('required');
 * }
 * ```
 */
export function isFailure<_T>(result: { isFailure: boolean; error?: string }): result is { isFailure: true; error: string } {
  return result.isFailure && result.error !== undefined;
}

// ============================================
// GERMAN AAA PATTERN HELPERS
// ============================================

/**
 * No-op function für Given-When-Then Kommentare.
 * Dient nur zur Strukturierung und Dokumentation von Tests.
 *
 * @example
 * ```typescript
 * describe('MyAggregate', () => {
 *   it('should do something', () => {
 *     given('Valid input data');
 *     const data = { name: 'Test' };
 *
 *     when('Creating aggregate');
 *     const result = MyAggregate.create(data);
 *
 *     then('Should succeed');
 *     expect(result.isSuccess).toBe(true);
 *   });
 * });
 * ```
 */
export function given(_description: string): void {
  // No-op, nur für Lesbarkeit
}

/**
 * No-op function für When-Phase in AAA Pattern.
 */
export function when(_description: string): void {
  // No-op, nur für Lesbarkeit
}

/**
 * No-op function für Then-Phase in AAA Pattern.
 */
export function then(_description: string): void {
  // No-op, nur für Lesbarkeit
}

// ============================================
// TEST DATA BUILDERS
// ============================================

/**
 * Builder Pattern für komplexe Test-Daten.
 * Basis-Klasse für domänenspezifische Builder.
 *
 * @example
 * ```typescript
 * class EinsatzBuilder extends TestDataBuilder<CreateEinsatzProps> {
 *   constructor() {
 *     super({ alarmstichwort: 'Test' });
 *   }
 *
 *   withAlarmstichwort(value: string) {
 *     return this.with('alarmstichwort', value);
 *   }
 * }
 *
 * // Usage:
 * const props = new EinsatzBuilder()
 *   .withAlarmstichwort('Wohnungsbrand')
 *   .build();
 * ```
 */
export abstract class TestDataBuilder<T extends Record<string, unknown>> {
  protected data: T;

  constructor(defaults: T) {
    this.data = { ...defaults };
  }

  /**
   * Setzt einen Wert für ein Property.
   */
  protected with<K extends keyof T>(key: K, value: T[K]): this {
    this.data[key] = value;
    return this;
  }

  /**
   * Gibt die finalen Test-Daten zurück.
   */
  build(): T {
    return { ...this.data };
  }
}

// ============================================
// ASSERTION HELPERS
// ============================================

/**
 * Prüft ob ein Value Object eine bestimmte Struktur hat.
 * Nützlich für Value Object Tests.
 *
 * @param obj - Zu prüfendes Objekt
 * @param expectedValue - Erwarteter Wert
 */
export function expectValueObjectToEqual<T>(obj: { value: T }, expectedValue: T): void {
  expect(obj).toBeDefined();
  expect(obj.value).toBe(expectedValue);
}

/**
 * Prüft ob ein Entity eine bestimmte ID hat.
 * Nützlich für Entity Tests.
 *
 * @param entity - Entity mit id Property
 * @param expectedIdValue - Erwarteter ID-Wert
 */
export function expectEntityToHaveId<T extends { value: string }>(entity: { id: T }, expectedIdValue: string): void {
  expect(entity).toBeDefined();
  expect(entity.id).toBeDefined();
  expect(entity.id.value).toBe(expectedIdValue);
}

/**
 * Prüft ob ein Aggregate Events emittiert hat.
 * Nützlich für Aggregate Tests.
 *
 * @param aggregate - Aggregate mit getDomainEvents() Methode
 * @param expectedEventCount - Erwartete Anzahl Events
 */
export function expectAggregateToHaveEvents(aggregate: { getDomainEvents(): unknown[] }, expectedEventCount: number): void {
  expect(aggregate.getDomainEvents()).toHaveLength(expectedEventCount);
}

/**
 * Prüft ob ein spezifischer Event-Typ emittiert wurde.
 *
 * @param aggregate - Aggregate mit getDomainEvents() Methode
 * @param eventType - Erwarteter Event-Konstruktor
 * @param index - Optional: Index des Events (default: 0)
 */
export function expectAggregateToHaveEmittedEvent<T>(
  aggregate: { getDomainEvents(): unknown[] },
  // biome-ignore lint/suspicious/noExplicitAny: Generic constructor type needed for instanceof check
  eventType: new (...args: any[]) => T,
  index = 0,
): void {
  const events = aggregate.getDomainEvents();
  expect(events[index]).toBeInstanceOf(eventType);
}
