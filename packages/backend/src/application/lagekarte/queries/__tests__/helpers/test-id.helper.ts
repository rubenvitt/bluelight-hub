/**
 * Creates a valid 21-character nanoid for testing.
 * This helper ensures consistent test IDs across all query tests.
 *
 * @param prefix - Optional prefix for the test ID (default: 'test')
 * @returns A valid 21-character nanoid
 */
export function createValidTestId(prefix = 'test'): string {
  const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  let id = prefix;
  while (id.length < 21) {
    id += validChars.charAt(Math.floor(Math.random() * validChars.length));
  }
  return id.substring(0, 21);
}

/**
 * Creates multiple valid test IDs with different values.
 */
export function createValidTestIds(count: number): string[] {
  const ids = ['V1StGXR8_Z5jdHi6B-myT', 'AZaz09_-0123456789XYZ', 'abcdefghij0123456789k'];
  return ids.slice(0, count);
}
