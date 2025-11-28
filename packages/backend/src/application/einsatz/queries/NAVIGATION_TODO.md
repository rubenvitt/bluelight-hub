# Navigation Query Handler - TODOs

## Status: Query Handler erstellt, Repository-Methoden fehlen noch

Die Query Handler `GetPreviousEinsatzIdQueryHandler` und `GetNextEinsatzIdQueryHandler` wurden erstellt,
aber sie benötigen noch die folgenden Repository-Methoden.

## Fehlende Repository-Methoden

Das `IEinsatzRepository` Interface muss erweitert werden mit:

### 1. findPreviousId(createdAt: Date)

```typescript
/**
 * Findet die ID des zeitlich vorherigen Einsatzes.
 *
 * Gibt die ID des Einsatzes zurück, der zeitlich VOR dem angegebenen
 * Zeitstempel erstellt wurde.
 *
 * **Business Rules:**
 * - Nur aktive Einsätze (Status !== ARCHIVIERT) werden berücksichtigt
 * - Sortierung nach createdAt DESC (neueste zuerst)
 * - Return null wenn kein vorheriger Einsatz existiert
 *
 * @param createdAt - Zeitstempel des aktuellen Einsatzes
 * @returns Result<string | null> - Success mit ID oder null
 */
findPreviousId(createdAt: Date): Promise<Result<string | null>>;
```

### 2. findNextId(createdAt: Date)

```typescript
/**
 * Findet die ID des zeitlich naechsten Einsatzes.
 *
 * Gibt die ID des Einsatzes zurück, der zeitlich NACH dem angegebenen
 * Zeitstempel erstellt wurde.
 *
 * **Business Rules:**
 * - Nur aktive Einsätze (Status !== ARCHIVIERT) werden berücksichtigt
 * - Sortierung nach createdAt ASC (älteste zuerst)
 * - Return null wenn kein nächster Einsatz existiert
 *
 * @param createdAt - Zeitstempel des aktuellen Einsatzes
 * @returns Result<string | null> - Success mit ID oder null
 */
findNextId(createdAt: Date): Promise<Result<string | null>>;
```

## Referenz-Implementation

Die alte Repository-Implementation (`src/einsatz/einsatz.repository.ts`) enthält bereits
funktionierende Implementierungen dieser Methoden (Zeilen 120-158):

```typescript
async findPreviousId(createdAt: Date): Promise<string | null> {
  const result = await this.prisma.einsatz.findFirst({
    where: {
      createdAt: { lt: createdAt },
      status: { not: EinsatzStatus.ARCHIVIERT },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  return result?.id || null;
}

async findNextId(createdAt: Date): Promise<string | null> {
  const result = await this.prisma.einsatz.findFirst({
    where: {
      createdAt: { gt: createdAt },
      status: { not: EinsatzStatus.ARCHIVIERT },
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  return result?.id || null;
}
```

## Nächste Schritte

1. **IEinsatzRepository Interface erweitern** (`src/domain/repositories/ieinsatz.repository.ts`):
   - Füge `findPreviousId(createdAt: Date): Promise<Result<string | null>>` hinzu
   - Füge `findNextId(createdAt: Date): Promise<Result<string | null>>` hinzu
   - Deutsche JSDoc-Kommentare nach CLAUDE.md Standard

2. **PrismaEinsatzRepository Implementation** (`src/infrastructure/einsatz/repositories/prisma-einsatz.repository.ts`):
   - Implementiere `findPreviousId()` mit Result Pattern
   - Implementiere `findNextId()` mit Result Pattern
   - Try-Catch Error Handling
   - Structured Logging bei Fehlern

3. **Query Handler aktivieren**:
   - Entferne TODO-Kommentare und Placeholder-Code
   - Aktiviere `repository.findPreviousId()` und `repository.findNextId()` Calls
   - Teste mit echten Daten

4. **Controller Integration**:
   - Registriere Handler in Application Module
   - Füge Endpoints in EinsatzController hinzu
   - Generiere API-Client mit `pnpm run generate-api`

## Notizen

- Die Query Handler sind vollständig implementiert und folgen dem CQRS-Pattern
- Deutsche JSDoc-Kommentare nach Projekt-Standard
- Result Pattern für explizites Error Handling
- Validierung via Value Objects (EinsatzId)
- Null-Handling für "nicht gefunden" (kein Error!)
