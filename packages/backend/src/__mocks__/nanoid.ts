/**
 * Mock für nanoid Package (Jest ESM compatibility).
 * Generiert deterministische Test-IDs im korrekten Nanoid-Format.
 */

let counter = 0;

/**
 * Mock nanoid function - generiert gültige 21-Zeichen IDs für Tests.
 * Format: [A-Za-z0-9_-]{21}
 */
export const nanoid = (): string => {
  counter++;
  // Generate valid nanoid format: 21 URL-safe characters
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2);
  const counterPart = counter.toString(36);

  // Pad to exactly 21 characters
  const combined = (timestamp + randomPart + counterPart).substring(0, 21);
  return combined.padEnd(21, '0');
};

// Reset counter for clean test isolation
export const resetNanoidCounter = (): void => {
  counter = 0;
};
