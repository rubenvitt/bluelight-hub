/**
 * Creates a valid CUID2-format test ID for testing.
 * CUID2 format: 20-30 chars, lowercase a-z0-9, starts with lowercase letter.
 *
 * @param suffix - Optional suffix for uniqueness (will be lowercased)
 * @returns A valid 25-character CUID2-like string
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
 * Creates multiple valid CUID2-format test IDs with different values.
 */
export function createValidTestIds(count: number): string[] {
  const ids = ['clw3h8x9y0000qwertyui00001', 'clw3h8x9y0000qwertyui00002', 'clw3h8x9y0000qwertyui00003'];
  return ids.slice(0, count);
}
