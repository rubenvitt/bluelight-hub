/**
 * Utility functions for handling Prisma errors
 */

/**
 * Type guard to check if an error is a Prisma P2002 unique constraint violation
 */
export function isPrismaP2002(e: unknown): e is { code: 'P2002' } {
  return e !== null && typeof e === 'object' && 'code' in e && e.code === 'P2002';
}

/**
 * Type guard to check if an error is a Prisma error with a specific code
 */
export function isPrismaError(e: unknown, code: string): e is { code: string } {
  return e !== null && typeof e === 'object' && 'code' in e && e.code === code;
}
