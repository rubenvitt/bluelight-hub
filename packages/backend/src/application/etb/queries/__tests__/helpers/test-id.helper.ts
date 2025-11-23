/**
 * Test-ID Helper fuer ETB Query Tests.
 *
 * Erstellt gueltige CUID2-Format Test-IDs fuer deterministische Tests.
 * Gleiche Implementierung wie bei Lagekarte-Queries fuer Konsistenz.
 *
 * @see packages/backend/src/application/lagekarte/queries/__tests__/helpers/test-id.helper.ts
 */

/**
 * Erstellt eine gueltige CUID2-Format Test-ID.
 * CUID2 Format: 20-30 Zeichen, lowercase a-z0-9, beginnt mit Kleinbuchstabe.
 *
 * @param suffix - Optionaler Suffix fuer Eindeutigkeit (wird lowercase)
 * @returns Eine gueltige 25-Zeichen CUID2-aehnliche String
 */
export function createValidTestId(suffix = ''): string {
  // Base: valid CUID2 prefix (20 chars)
  const base = 'clw3h8x9y0000qwertyui';
  // Suffix: lowercase alphanumeric only, padded to 5 chars
  const safeSuffix = suffix
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .padEnd(5, '0')
    .slice(0, 5);
  return base + safeSuffix; // Total: 25 chars
}

/**
 * Erstellt mehrere gueltige CUID2-Format Test-IDs mit unterschiedlichen Werten.
 *
 * @param count - Anzahl der zu erstellenden IDs (max 3)
 * @returns Array von gueltigen Test-IDs
 */
export function createValidTestIds(count: number): string[] {
  const ids = ['clw3h8x9y0000qwertyui00001', 'clw3h8x9y0000qwertyui00002', 'clw3h8x9y0000qwertyui00003'];
  return ids.slice(0, count);
}
