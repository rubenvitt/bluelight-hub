import { DomainEvent } from '@domain/common/domain-event';

/**
 * Abstrakte Basisklasse für alle Patient-Domain-Events (Story 1.1, Architecture §D-1).
 *
 * Erzwingt die Audit-Invarianten für die Patient-Bounded-Context:
 * - `einsatzId`: Scope für WebSocket-Broadcast (`einsatz:{einsatzId}`) und
 *   Outbox-Partitionierung.
 * - `patientId`: Aggregat-Bezug; entspricht `aggregateId` der DomainEvent-Basis.
 * - `eventVersion`: monoton pro `patientId` (Architecture §D-1, DB-Constraint
 *   `@@unique([patientId, eventVersion])`).
 * - `actorUserId` / `actorDeviceId`: Erfasser-Bimodalität (§D-5). Genau einer
 *   der beiden gesetzt — die konkrete Validierung übernimmt der Use-Case (Story 1.2).
 * - `originSessionId`: Capture-Session-ID bei Standalone-Origin.
 * - `clockDriftSeconds`: Drift-Annotation, wenn Capture-Geräte-Uhr von Server > 30 s
 *   abweicht (Architecture §D-1).
 *
 * Konkrete Event-Klassen werden in Story 1.1 angelegt; die Verdrahtung in die
 * 4-Punkt-Outbox-Registry (Serializer/Deserializer/Adapters/Index) liefert
 * **Story 1.2** — Story 1.1 produziert ausschließlich die Domain-Bausteine.
 */
export abstract class PatientDomainEvent extends DomainEvent {
  protected constructor(
    public readonly einsatzId: string,
    public readonly patientId: string,
    public readonly eventVersion: number,
    public readonly actorUserId?: string,
    public readonly actorDeviceId?: string,
    public readonly originSessionId?: string,
    public readonly clockDriftSeconds?: number,
    occurredOn?: Date,
  ) {
    super(patientId, occurredOn);
  }
}
