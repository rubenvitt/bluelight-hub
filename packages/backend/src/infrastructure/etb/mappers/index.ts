/**
 * ETB Infrastructure Mappers - Re-exports fuer einfachen Import.
 *
 * Diese Datei exportiert alle Mapper-Klassen und Typen fuer die
 * ETB Infrastructure Layer. Ermoeglicht einzelnen Import:
 *
 * @example
 * ```typescript
 * import { PrismaEtbMapper, PrismaEintragMapper } from '@infrastructure/etb/mappers';
 * ```
 */

export {
  // Mapper Classes
  PrismaEtbMapper,
  PrismaEintragMapper,
  // Type Exports
  type EinsatztagebuchWithEintraege,
  type EtbPersistenceData,
  type EtbEintragPersistenceData,
  // @deprecated - use EtbEintragPersistenceData instead
  type PrismaEtbEintragData,
} from './prisma-etb.mapper';
