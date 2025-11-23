# ETB Versioning Pattern - Design Document

## Ziel

Dieses Dokument beschreibt das Snapshot-basierte Versionierungspattern fuer das Einsatztagebuch (ETB) Aggregate. Das Pattern garantiert DRK-konforme Revisionssicherheit durch lueckenlose Aenderungshistorie.

## Architektur-Uebersicht

```
┌─────────────────────────────────────────────────────────────────┐
│                    Application Layer                             │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Command Handler                               │  │
│  │  1. Load Aggregate via Repository                          │  │
│  │  2. Execute Business Method (addEintrag, updateEintrag)    │  │
│  │  3. Save Aggregate via Repository                          │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Domain Layer                                │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │           EinsatztagebuchAggregate                         │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  Business Method (z.B. addEintrag)                  │  │  │
│  │  │  1. createSnapshot() - VOR Mutation                 │  │  │
│  │  │  2. Execute State Change                            │  │  │
│  │  │  3. Increment Version                               │  │  │
│  │  │  4. addDomainEvent()                                │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │  Uncommitted Data:                                         │  │
│  │  - _domainEvents: DomainEvent[]                            │  │
│  │  - _uncommittedSnapshots: EtbSnapshot[]                    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Infrastructure Layer                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Repository (save)                             │  │
│  │  1. Begin Transaction                                      │  │
│  │  2. Persist Aggregate State                                │  │
│  │  3. Persist uncommittedSnapshots to etb_snapshots Table    │  │
│  │  4. Publish Domain Events                                  │  │
│  │  5. Clear uncommitted data (events + snapshots)            │  │
│  │  6. Commit Transaction                                     │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Snapshot-Erstellung: Wann und Warum

### Trigger-Zeitpunkte

Snapshots werden **VOR** jeder mutierenden Operation erstellt:

| Operation | Snapshot-Zeitpunkt | Inhalt |
|-----------|-------------------|--------|
| `addEintrag()` | Vor dem Hinzufuegen | Aktueller Zustand aller Eintraege |
| `updateEintrag()` | Vor dem Update | Zustand inkl. unveraendertem Eintrag |
| `deleteEintrag()` | Vor dem Soft-Delete | Zustand inkl. noch nicht geloeschtem Eintrag |
| `lock()` | Kein Snapshot | Lock aendert keine Eintraege |

### Warum VOR der Mutation?

1. **Rollback-Faehigkeit**: Snapshot enthaelt exakten Pre-Mutation State
2. **Audit-Trail**: "Wie sah es aus bevor diese Aenderung erfolgte?"
3. **Compliance**: DRK-Anforderung fuer lueckenlosen Aenderungsnachweis
4. **Forensik**: Bei Streitfaellen nachvollziehbar wer was wann geaendert hat

## Datenstrukturen

### EtbSnapshot Value Object

```typescript
/**
 * Snapshot des ETB-Zustands zu einem bestimmten Zeitpunkt.
 * Unveraenderlich (immutable) nach Erstellung.
 */
export class EtbSnapshot {
  /** Version, die dieser Snapshot repraesentiert */
  public readonly version: EtbVersion;

  /** Deep Copy aller ETB-Eintraege zu diesem Zeitpunkt */
  public readonly eintraege: EtbEintragSnapshot[];

  /** Zeitstempel der Snapshot-Erstellung */
  public readonly snapshotAt: Date;

  constructor(
    version: EtbVersion,
    eintraege: EtbEintragSnapshot[],
    snapshotAt: Date
  ) { ... }

  /** JSON-serialisierbare Repraesentation fuer DB-Persistierung */
  public toJSON(): EtbSnapshotData { ... }

  /** Factory fuer Rekonstitution aus DB */
  public static fromJSON(data: EtbSnapshotData): EtbSnapshot { ... }
}
```

### EtbEintragSnapshot (Serialisierbarer Eintrag)

```typescript
/**
 * JSON-serialisierbares Format eines ETB-Eintrags fuer Snapshots.
 * Enthaelt keine Domain-Objekte, nur primitive Typen.
 */
export interface EtbEintragSnapshot {
  id: string;
  sequenceNumber: number;
  text: string;
  createdBy: string;
  createdAt: string;  // ISO 8601
  updatedAt?: string; // ISO 8601
  isDeleted: boolean;
}
```

### DB-Schema (Prisma)

```prisma
model EtbSnapshot {
  id            String   @id @default(cuid())
  etbId         String   @map("etb_id")
  versionNumber Int      @map("version_number")
  eintraege     Json     // JSONB Array von EtbEintragSnapshot
  snapshotAt    DateTime @map("snapshot_at")
  createdAt     DateTime @default(now()) @map("created_at")

  etb           Etb      @relation(fields: [etbId], references: [id])

  @@index([etbId, versionNumber])
  @@map("etb_snapshots")
}
```

## Aggregate Implementation

### Neue Methoden im EinsatztagebuchAggregate

```typescript
export class EinsatztagebuchAggregate extends AggregateRoot<EtbId> {
  private _uncommittedSnapshots: EtbSnapshot[] = [];

  /**
   * Prueft ob uncommittierte Snapshots existieren.
   * Analog zu hasUncommittedEvents() fuer Domain Events.
   */
  public hasUncommittedSnapshots(): boolean {
    return this._uncommittedSnapshots.length > 0;
  }

  /**
   * Gibt alle uncommittierten Snapshots zurueck.
   * Repository verwendet diese fuer Persistierung.
   * @returns Shallow Copy der Snapshot-Liste
   */
  public getUncommittedSnapshots(): EtbSnapshot[] {
    return [...this._uncommittedSnapshots];
  }

  /**
   * Loescht uncommittierte Snapshots nach erfolgreicher Persistierung.
   * Wird vom Repository nach save() aufgerufen.
   */
  public clearSnapshots(): void {
    this._uncommittedSnapshots = [];
  }

  /**
   * Erstellt JSON-serialisierbare Snapshot-Daten fuer aktuelle Version.
   * Verwendet fuer createSnapshot() vor Mutations.
   */
  public getSnapshotData(): EtbEintragSnapshot[] {
    return this._eintraege.map(e => ({
      id: e.id.value,
      sequenceNumber: e.sequenceNumber.value,
      text: e.text,
      createdBy: e.createdBy.value,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt?.toISOString(),
      isDeleted: e.isDeleted,
    }));
  }

  /**
   * Protected: Erstellt Snapshot des aktuellen Zustands.
   * Wird VOR jeder mutierenden Operation aufgerufen.
   */
  protected createSnapshot(): void {
    const snapshot = new EtbSnapshot(
      this._version,
      this.getSnapshotData(),
      new Date()
    );
    this._uncommittedSnapshots.push(snapshot);
  }
}
```

### Modifizierte Business Methods

```typescript
public addEintrag(text: string, userId: UserId): Result<EtbEintrag> {
  if (this.isLocked()) {
    return Result.fail<EtbEintrag>('ETB ist gesperrt');
  }

  // === SNAPSHOT VOR MUTATION ===
  this.createSnapshot();

  // ... bisherige Logik ...
  this._eintraege.push(eintrag);
  this._version = this._version.increment();
  this.addDomainEvent(new EintragAddedEvent(...));

  return Result.ok<EtbEintrag>(eintrag);
}

public updateEintrag(eintragId: EintragId, newText: string, userId: UserId): Result<void> {
  if (this.isLocked()) {
    return Result.fail<void>('ETB ist gesperrt');
  }

  // ... Validierung ...

  // === SNAPSHOT VOR MUTATION ===
  this.createSnapshot();

  // ... bisherige Logik ...
  eintrag.update(newText);
  this._version = this._version.increment();
  this.addDomainEvent(new EintragUpdatedEvent(...));

  return Result.ok<void>(undefined);
}

public deleteEintrag(eintragId: EintragId, userId: UserId): Result<void> {
  if (this.isLocked()) {
    return Result.fail<void>('ETB ist gesperrt');
  }

  // ... Validierung ...

  // === SNAPSHOT VOR MUTATION ===
  this.createSnapshot();

  // ... bisherige Logik ...
  eintrag.markAsDeleted();
  this._version = this._version.increment();
  this.addDomainEvent(new EintragDeletedEvent(...));

  return Result.ok<void>(undefined);
}
```

## Repository Implementation (Infrastructure Layer)

### IEtbRepository Interface

```typescript
export interface IEtbRepository {
  /**
   * Speichert Aggregate inkl. uncommitted Snapshots.
   * 1. Persist Aggregate State
   * 2. Persist all uncommittedSnapshots
   * 3. Publish Domain Events
   * 4. Clear uncommitted data
   */
  save(aggregate: EinsatztagebuchAggregate, tx?: TransactionContext): Promise<void>;

  findById(id: EtbId, tx?: TransactionContext): Promise<EinsatztagebuchAggregate | null>;
  findByEinsatzId(einsatzId: EinsatzId, tx?: TransactionContext): Promise<EinsatztagebuchAggregate | null>;

  /**
   * Laedt Versions-Historie (alle Snapshots).
   * Sortiert: Neueste Version zuerst.
   */
  getHistory(id: EtbId): Promise<EtbSnapshot[]>;
}
```

### PrismaEtbRepository.save() (Pseudocode)

```typescript
async save(aggregate: EinsatztagebuchAggregate, tx?: TransactionContext): Promise<void> {
  const client = tx ?? this.prisma;

  await client.$transaction(async (prisma) => {
    // 1. Persist Aggregate State
    await prisma.etb.upsert({
      where: { id: aggregate.id.value },
      create: { /* ... */ },
      update: { /* ... */ },
    });

    // 2. Persist Child Entities (Eintraege)
    for (const eintrag of aggregate.eintraege) {
      await prisma.etbEintrag.upsert({ /* ... */ });
    }

    // 3. Persist uncommitted Snapshots
    const snapshots = aggregate.getUncommittedSnapshots();
    for (const snapshot of snapshots) {
      await prisma.etbSnapshot.create({
        data: {
          etbId: aggregate.id.value,
          versionNumber: snapshot.version.versionNumber,
          eintraege: snapshot.toJSON().eintraege,
          snapshotAt: snapshot.snapshotAt,
        },
      });
    }

    // 4. Clear uncommitted data
    aggregate.clearDomainEvents();
    aggregate.clearSnapshots();
  });

  // 5. Publish Domain Events (nach Commit)
  for (const event of events) {
    await this.eventBus.publish(event);
  }
}
```

## Snapshot Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                    Snapshot Lifecycle                            │
└─────────────────────────────────────────────────────────────────┘

1. Aggregate geladen (keine uncommitted Snapshots)
   ┌─────────────────────────────────────┐
   │ EinsatztagebuchAggregate            │
   │ _uncommittedSnapshots: []           │
   │ _version: v3                        │
   └─────────────────────────────────────┘

2. Business Method aufgerufen: addEintrag()
   ┌─────────────────────────────────────┐
   │ createSnapshot() aufgerufen         │
   │ _uncommittedSnapshots: [Snapshot@v3]│
   │ ... State aendern ...               │
   │ _version: v4 (incremented)          │
   └─────────────────────────────────────┘

3. Zweite Aenderung: updateEintrag()
   ┌─────────────────────────────────────┐
   │ createSnapshot() aufgerufen         │
   │ _uncommittedSnapshots: [v3, v4]     │
   │ ... State aendern ...               │
   │ _version: v5 (incremented)          │
   └─────────────────────────────────────┘

4. Repository.save() aufgerufen
   ┌─────────────────────────────────────┐
   │ Persist Aggregate (v5)              │
   │ Persist Snapshot v3 → DB            │
   │ Persist Snapshot v4 → DB            │
   │ clearSnapshots()                    │
   │ _uncommittedSnapshots: []           │
   └─────────────────────────────────────┘

5. getHistory() spaeter aufgerufen
   ┌─────────────────────────────────────┐
   │ Alle Snapshots aus DB laden         │
   │ Return: [v5, v4, v3, v2, v1]        │
   │ (neueste zuerst)                    │
   └─────────────────────────────────────┘
```

## Constraints und Regeln

### Domain Layer Constraints

1. **Keine Prisma Dependencies**: Domain Layer bleibt framework-agnostisch
2. **JSON-Serialisierbarkeit**: Alle Snapshot-Daten muessen JSON-serialisierbar sein
3. **Immutability**: Snapshots sind nach Erstellung unveraenderlich
4. **Type-Safety**: `EtbEintrag[]` statt `any[]` im EtbSnapshot

### Business Rules

1. **Snapshot vor Mutation**: Immer VOR der State-Aenderung erstellen
2. **Kein Snapshot bei Lock**: `lock()` aendert keine Eintraege, daher kein Snapshot
3. **Kein Snapshot bei Read-Only**: Queries erstellen keine Snapshots
4. **Clear nach Save**: Uncommitted Snapshots werden nach Persistierung geloescht

## Test-Strategie

### Unit Tests

```typescript
describe('ETB Snapshot Lifecycle', () => {
  it('should create snapshot before addEintrag', () => {
    const etb = createTestEtb();
    expect(etb.hasUncommittedSnapshots()).toBe(false);

    etb.addEintrag('Test', userId);

    expect(etb.hasUncommittedSnapshots()).toBe(true);
    expect(etb.getUncommittedSnapshots()).toHaveLength(1);
  });

  it('should create multiple snapshots for multiple mutations', () => {
    const etb = createTestEtb();
    const eintrag = etb.addEintrag('First', userId).value;
    etb.updateEintrag(eintrag.id, 'Updated', userId);

    expect(etb.getUncommittedSnapshots()).toHaveLength(2);
  });

  it('should clear snapshots after clearSnapshots()', () => {
    const etb = createTestEtb();
    etb.addEintrag('Test', userId);
    expect(etb.hasUncommittedSnapshots()).toBe(true);

    etb.clearSnapshots();

    expect(etb.hasUncommittedSnapshots()).toBe(false);
  });

  it('should contain pre-mutation state in snapshot', () => {
    const etb = createTestEtb();
    etb.addEintrag('First', userId);
    etb.clearSnapshots(); // Clear initial snapshot

    etb.addEintrag('Second', userId);

    const snapshots = etb.getUncommittedSnapshots();
    expect(snapshots[0].eintraege).toHaveLength(1); // Nur "First"
  });
});
```

## Zusammenfassung

Das Snapshot-basierte Versionierungspattern bietet:

- **DRK-Compliance**: Lueckenlose Aenderungshistorie
- **Audit-Trail**: Wer hat was wann geaendert
- **Rollback-Faehigkeit**: Frueherer Zustand wiederherstellbar
- **Domain-Layer Isolation**: Keine Infrastructure-Dependencies
- **Type-Safety**: Starke Typisierung statt `any[]`

Das Pattern folgt dem gleichen Lifecycle wie Domain Events:
1. Akkumulieren waehrend Business Transaction
2. Persistieren bei Repository.save()
3. Loeschen nach erfolgreicher Persistierung
