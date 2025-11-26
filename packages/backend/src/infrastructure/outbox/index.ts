/**
 * Outbox Infrastructure Module Exports.
 *
 * Dieses Modul stellt die Infrastruktur für das Transactional Outbox Pattern bereit:
 * - EventSerializer: Domain Events → JSON-Serialisierung
 * - EventDeserializer: JSON → Domain Events (für Retry/Replay)
 * - PrismaOutboxRepository: Persistenz in outbox_events Tabelle
 *
 * Verwendung:
 * ```typescript
 * import {
 *   EventSerializer,
 *   EventDeserializer,
 *   PrismaOutboxRepository,
 *   type IOutboxRepository,
 *   type OutboxEventDto,
 *   type PrismaTransaction,
 * } from '@infrastructure/outbox';
 * ```
 *
 * Epic 4 Story 4.4 - Transactional Outbox Pattern
 */

// Serialization
export { EventSerializer, type SerializedEvent } from './event-serializer';
export { EventDeserializer } from './event-deserializer';

// Repository
export {
  PrismaOutboxRepository,
  type IOutboxRepository,
  type OutboxEventDto,
  type PrismaTransaction,
} from './prisma-outbox.repository';

// Polling Worker
export {
  OutboxEventPublisher,
  type OutboxPublisherConfig,
  DEFAULT_OUTBOX_PUBLISHER_CONFIG,
  OUTBOX_PUBLISHER_CONFIG,
} from './outbox-event-publisher.service';

// Module
export { OutboxModule } from './outbox.module';
