import { Result } from '@domain/common/result';

/**
 * Path Alias Validation Test
 *
 * Dieser Test verifiziert, dass TypeScript Path Aliases (@domain/*)
 * korrekt funktionieren. Dies ist eine Infrastruktur-Validierung
 * für Story 1-1 (Domain Layer Project Structure).
 */
describe('TypeScript Path Aliases (@domain/*)', () => {
  it('should successfully import from @domain/common/result', () => {
    // Given: Ein Erfolgswert
    const value = 42;

    // When: Result.ok() wird mit dem Wert aufgerufen
    const result = Result.ok(value);

    // Then: Das Result ist erfolgreich und hat den korrekten Wert
    expect(result.isSuccess).toBe(true);
    expect(result.value).toBe(value);
  });

  it('should successfully import Result.fail for error cases', () => {
    // Given: Eine Fehlermeldung
    const errorMessage = 'Test error';

    // When: Result.fail() wird aufgerufen
    const result = Result.fail(errorMessage);

    // Then: Das Result ist ein Fehler mit der korrekten Message
    expect(result.isSuccess).toBe(false);
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(errorMessage);
  });
});
