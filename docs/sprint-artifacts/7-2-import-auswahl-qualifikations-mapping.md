# Story 7.2: Import-Auswahl & Qualifikations-Mapping

Status: blocked

### ⛔ Blocker (müssen vor Start gelöst werden)

| # | Blocker | Abhängigkeit | Status |
|---|---------|--------------|--------|
| B1 | Story 7.1 nicht implementiert (Ports, OAuth2, Adapter fehlen) | Story 7.1 | ⏳ in-progress |
| B2 | StammPerson Aggregate existiert nicht | Epic 2 / Story 6.x | ❌ nicht begonnen |
| B3 | Qualifikation ist Value Object, nicht Entity mit ID | Epic 1 Klärung | ❓ zu klären |

**Hinweis:** Diese Story kann erst beginnen wenn alle Blocker gelöst sind.

---

## Story

Als **Admin (Maria)**,
möchte ich **vor dem Import auswählen, welche Personen importiert werden und Qualifikationen mappen**,
damit **ich nur relevante Personen übernehme und HiOrg-Qualifikationen korrekt zugeordnet werden**.

## Hintergrund

Story 7.1 hat die HiOrg-Server Verbindung und Personen-Preview implementiert. Story 7.2 vervollständigt die Integration mit:
1. **Selektiver Import:** Checkbox-basierte Auswahl statt Alle-oder-Nichts
2. **Qualifikations-Mapping:** HiOrg-Namen → Bluelight Hub Qualifikationen
3. **Import-Log:** Transparenz über Erfolg/Fehler pro Person

**Epic 7:** HiOrg-Server Integration
**Depends on:** Story 7.1 (HiOrg-Server Verbindung), Epic 1 (Qualifikationen), Epic 2 (StammPerson)
**FRs covered:** FR39 (Import-Auswahl), FR40 (Qualifikations-Mapping)

---

## Acceptance Criteria

### AC1: Selektiver Import mit Checkbox-Liste

- [ ] **Given** ich sehe die Import-Vorschau mit 42 Personen aus HiOrg-Server
- [ ] **When** ich Personen selektiere (Checkbox-Liste mit "Alle auswählen" Header)
- [ ] **Then** kann ich nur die ausgewählten Personen importieren
- [ ] **And** der Button zeigt "23 Personen importieren" (dynamische Anzahl)
- [ ] **And** Duplikate werden farblich markiert (bereits vorhanden → Gelb, Neu → Grün)

### AC2: Qualifikations-Mapping konfigurieren

- [ ] **Given** HiOrg-Server nutzt andere Qualifikations-Namen ("Gruppenführer" statt "GrFü")
- [ ] **When** ich auf "Mapping konfigurieren" klicke
- [ ] **Then** sehe ich eine Mapping-Tabelle mit allen HiOrg-Qualifikationen
- [ ] **And** jede Zeile hat ein Dropdown mit Bluelight Hub Qualifikationen
- [ ] **And** kann Custom-Mappings speichern (persistiert in DB)
- [ ] **And** unbekannte Qualifikationen werden mit "⚠️ Nicht zugeordnet" markiert

### AC3: Import-Log mit Fehlerbehandlung

- [ ] **Given** der Import läuft
- [ ] **When** 3 Personen fehlschlagen (z.B. ungültige Daten)
- [ ] **Then** sehe ich einen Fortschrittsbalken während des Imports
- [ ] **And** nach Abschluss: "39/42 erfolgreich, 3 Fehler"
- [ ] **And** klickbar für Details pro fehlgeschlagener Person mit Fehlergrund
- [ ] **And** erfolgreiche Imports werden NICHT rückgängig gemacht bei Teil-Fehlern

### AC4: Automatischer Qualifikations-Import

- [ ] **Given** Person "Anna Schmidt" hat in HiOrg-Server Qualifikationen ["Gruppenführer", "Sanitäter A"]
- [ ] **And** Mapping existiert: "Gruppenführer" → "GrFü", "Sanitäter A" → "SanA"
- [ ] **When** der Import abgeschlossen ist
- [ ] **Then** hat Anna in Bluelight Hub die Qualifikationen ["GrFü", "SanA"]
- [ ] **And** Qualifikationen werden als Referenzen gespeichert (nicht als Kopien)

### AC5: Duplikatserkennung & Update-Strategie

- [ ] **Given** Person mit `username` "anna.schmidt" existiert bereits in Bluelight Hub
- [ ] **When** ich Anna erneut importiere
- [ ] **Then** wird die existierende Person aktualisiert (UPSERT)
- [ ] **And** Qualifikationen werden gemerged (bestehende bleiben, neue werden hinzugefügt)
- [ ] **And** ein Changelog-Eintrag wird erstellt (was wurde geändert)

### AC-EDGE: Edge Cases (Must Handle)

#### AC-EDGE-1: Leere Personenliste
- [ ] **Given** HiOrg-Server gibt 0 Personen zurück
- [ ] **When** die Import-Vorschau lädt
- [ ] **Then** wird Info-Meldung angezeigt: "Keine Personen zum Import verfügbar"
- [ ] **And** Import-Button ist deaktiviert

#### AC-EDGE-2: Alle Personen sind Duplikate
- [ ] **Given** alle 42 Personen existieren bereits in Bluelight Hub
- [ ] **When** die Import-Vorschau lädt
- [ ] **Then** werden alle als "Update" (gelb) markiert
- [ ] **And** Info: "Alle Personen bereits vorhanden - Import aktualisiert bestehende Daten"

#### AC-EDGE-3: Maximale Import-Größe
- [ ] **Given** HiOrg-Server hat 600 Personen
- [ ] **When** mehr als 500 ausgewählt werden
- [ ] **Then** Warnung: "Maximal 500 Personen pro Import. Bitte Auswahl reduzieren."
- [ ] **And** Import-Button ist deaktiviert

#### AC-EDGE-4: Import-Timeout
- [ ] **Given** Import von 200 Personen läuft > 2 Minuten
- [ ] **When** Timeout erreicht wird
- [ ] **Then** bereits importierte Personen bleiben gespeichert (Teil-Import)
- [ ] **And** Fehlermeldung mit Anzahl erfolgreich importierter Personen
- [ ] **And** "Erneut versuchen" Button für fehlende Personen

#### AC-EDGE-5: Keine gemappten Qualifikationen
- [ ] **Given** alle HiOrg-Qualifikationen sind ungemappt
- [ ] **When** ich Import starte
- [ ] **Then** Warnung: "⚠️ 12 Qualifikationen sind nicht zugeordnet"
- [ ] **And** Import kann trotzdem fortgesetzt werden
- [ ] **And** Personen werden ohne Qualifikationen importiert

---

## Tasks / Subtasks

### Task 0: Prisma Schema für Qualifikations-Mapping (Foundation)

- [ ] **0.1** Entity `QualifikationMapping` in Prisma Schema hinzufügen:
  ```prisma
  model QualifikationMapping {
    id                  String       @id @default(cuid())
    externalName        String       // HiOrg-Server Qualifikations-Name
    externalSource      String       // "HIORG_SERVER"
    qualifikationId     String?      // FK zu Qualifikation (null = nicht gemappt)
    qualifikation       Qualifikation? @relation(fields: [qualifikationId], references: [id])
    isAutoMatched       Boolean      @default(false) // Automatisch gemappt?
    createdAt           DateTime     @default(now())
    updatedAt           DateTime     @updatedAt

    @@unique([externalName, externalSource])
  }
  ```
- [ ] **0.2** Relation in `Qualifikation` Model hinzufügen:
  ```prisma
  mappings QualifikationMapping[]
  ```
- [ ] **0.3** Migration erstellen: `pnpm --filter @bluelight-hub/backend prisma:migrate`

### Task 1: Domain Layer - Mapping & Import Aggregates

- [ ] **1.1** Erstelle Entity: `src/domain/integrations/entities/qualifikation-mapping.entity.ts`
  - Properties: `externalName`, `externalSource`, `qualifikationId`, `isAutoMatched`
  - Factory method: `QualifikationMapping.create()`
  - Method: `updateMapping(qualifikationId: string | null)`
- [ ] **1.2** Erstelle Repository Interface: `src/domain/integrations/repositories/i-qualifikation-mapping.repository.ts`
  ```typescript
  export interface IQualifikationMappingRepository {
    findByExternalSource(source: string): Promise<QualifikationMapping[]>;
    findByExternalName(name: string, source: string): Promise<QualifikationMapping | null>;
    save(mapping: QualifikationMapping, tx?: TransactionContext): Promise<void>;
    saveMany(mappings: QualifikationMapping[], tx?: TransactionContext): Promise<void>;
  }
  ```
- [ ] **1.3** Erweitere Error Codes in `src/domain/integrations/common/integration-error-codes.ts`:
  ```typescript
  IMPORT_FAILED: 'INTEGRATION_010',
  MAPPING_NOT_FOUND: 'INTEGRATION_011',
  PERSON_VALIDATION_FAILED: 'INTEGRATION_012',
  DUPLICATE_DETECTED: 'INTEGRATION_013',
  ```
- [ ] **1.4** Erstelle Domain Event: `src/domain/kraefte/events/personen-importiert.event.ts`
  ```typescript
  export class PersonenImportiertEvent extends DomainEvent {
    constructor(
      public readonly importedCount: number,
      public readonly updatedCount: number,
      public readonly failedCount: number,
      public readonly source: 'HIORG_SERVER',
      public readonly importedByUserId: string,
    ) { ... }
  }
  ```

### Task 2: Application Layer - Mapping Commands & Queries

- [ ] **2.1** Query: `GetQualifikationMappingsQuery` + Handler
  - Lädt alle Mappings für eine externe Quelle
  - Inkludiert Bluelight Hub Qualifikation-Details (Name, Kategorie)
- [ ] **2.2** Command: `SaveQualifikationMappingCommand` + Handler
  - Speichert/aktualisiert ein einzelnes Mapping
  - Validiert: qualifikationId existiert
- [ ] **2.3** Command: `AutoMatchQualifikationenCommand` + Handler
  - Versucht automatisches Matching via Levenshtein-Distanz oder exakter Name-Match
  - Markiert erfolgreiche Matches als `isAutoMatched: true`
  - Erstellt ungemappte Einträge für unbekannte Qualifikationen

  **OPT-1: Levenshtein-Distanz Konfiguration:**
  ```typescript
  const AUTO_MATCH_CONFIG = {
    // Exakter Match hat höchste Priorität
    EXACT_MATCH_SCORE: 100,
    // Levenshtein-Schwellenwert: 85% Ähnlichkeit erforderlich
    LEVENSHTEIN_THRESHOLD: 0.85,
    // Kurzname-Match Bonus
    SHORT_NAME_BONUS: 10,
  } as const;
  ```

  **OPT-2: Confidence Score für Auto-Matches:**
  ```typescript
  export class AutoMatchResultDto {
    matches: Array<{
      externalName: string;
      matchedQualifikationId: string | null;
      matchedQualifikationName: string | null;
      confidence: number;  // 0-100
      matchType: 'EXACT' | 'FUZZY' | 'SHORT_NAME' | 'NONE';
    }>;
    totalMatched: number;
    totalUnmatched: number;
    averageConfidence: number;
  }
  ```

  **UI-Anzeige:** Confidence < 90% → gelbe Warnung, Review empfohlen

### Task 3: Application Layer - Import Commands

- [ ] **3.1** Command: `ImportSelectedPersonsCommand` + Handler (**TransactionalCommandHandler**)
  ```typescript
  export class ImportSelectedPersonsCommand {
    constructor(
      public readonly selectedUsernames: string[],  // HiOrg usernames
      public readonly updateExisting: boolean = true,
    ) {}
  }
  ```
- [ ] **3.2** Handler-Logik (**VOLLSTÄNDIGES TEMPLATE - AC5 Compliance**):
  ```typescript
  import { Injectable, Inject } from '@nestjs/common';
  import { TransactionalCommandHandler } from '@/application/common/handlers/transactional-command.handler';
  import { DI_TOKENS, INTEGRATIONS } from '@/infrastructure/di-tokens';
  import { LOGGER } from '@/infrastructure/di-tokens';
  import type { ILogger } from '@/domain/ports/i-logger.port';
  import type { IHiOrgServerPort } from '@/domain/ports/i-hiorg-server.port';
  import type { IStammPersonRepository } from '@/domain/kraefte/repositories/i-stamm-person.repository';
  import type { IQualifikationMappingRepository } from '@/domain/integrations/repositories/i-qualifikation-mapping.repository';

  @Injectable()
  export class ImportSelectedPersonsHandler extends TransactionalCommandHandler<
    ImportSelectedPersonsCommand,
    ImportResult
  > {
    constructor(
      // ✅ CR-4: Logger Port (NICHT new Logger()!)
      @Inject(LOGGER)
      private readonly logger: ILogger,
      // Ports & Repositories
      @Inject(INTEGRATIONS.HIORG_SERVER_PORT)
      private readonly hiorgServer: IHiOrgServerPort,
      @Inject(DI_TOKENS.REPOSITORIES.STAMM_PERSON)
      private readonly stammPersonRepo: IStammPersonRepository,
      @Inject(INTEGRATIONS.QUALIFIKATION_MAPPING_REPOSITORY)
      private readonly mappingRepo: IQualifikationMappingRepository,
      // Base class dependencies
      prismaService: PrismaService,
      outboxRepository: IOutboxRepository,
    ) {
      super(prismaService, outboxRepository);
    }

    protected async executeInTransaction(
      command: ImportSelectedPersonsCommand,
      tx: TransactionContext  // ✅ WICHTIG: tx an ALLE Repository-Calls übergeben!
    ): Promise<{ result: ImportResult; events: DomainEvent[] }> {
      this.logger.log(`Starting import for ${command.selectedUsernames.length} persons`);

      // 1. Fetch selected persons from HiOrg (via existing HiOrgServerPort)
      const personsResult = await this.hiorgServer.fetchPersons(/* ... */);
      if (personsResult.isFailure) {
        return { result: ImportResult.failed(personsResult.error!), events: [] };
      }

      // 2. Load Qualifikation-Mappings
      const mappings = await this.mappingRepo.findByExternalSource('HIORG_SERVER');

      // 3. For each person - mit tx Parameter!
      const results: PersonImportResult[] = [];
      for (const person of personsResult.value!) {
        try {
          // a. Check if exists
          const existing = await this.stammPersonRepo.findByExternalId(
            'HIORG_SERVER',
            person.username,
            tx  // ✅ tx übergeben!
          );

          // b. Create or Update
          const stammPerson = existing
            ? existing.updateFromExternalSource(person)
            : StammPerson.createFromExternal(person, 'HIORG_SERVER');

          // c. Apply Qualifikation-Mappings
          this.applyQualifikationMappings(stammPerson, person.qualifikationen, mappings);

          // d. Save - mit tx!
          await this.stammPersonRepo.save(stammPerson, tx);  // ✅ tx übergeben!

          results.push({ username: person.username, status: 'success' });
        } catch (error) {
          this.logger.error(`Failed to import ${person.username}`, { error: error.message });
          results.push({ username: person.username, status: 'failed', reason: error.message });
        }
      }

      // 4. Create result & events
      const importResult = ImportResult.fromResults(results);
      const events: DomainEvent[] = [
        new PersonenImportiertEvent(
          importResult.successCount,
          importResult.updateCount,
          importResult.failureCount,
          'HIORG_SERVER',
          command.userId,
        ),
      ];

      // 5. Return - Base class speichert events in Outbox (gleiche TX!)
      return { result: importResult, events };
    }
  }
  ```
- [ ] **3.3** Erstelle DTO: `ImportResultDto`
  ```typescript
  export class ImportResultDto {
    successCount: number;
    updateCount: number;
    failureCount: number;
    failures: ImportFailureDto[];
  }

  export class ImportFailureDto {
    username: string;
    name: string;
    reason: string;
    errorCode: string;
  }
  ```

### Task 4: StammPerson Repository - Upsert Erweiterung

- [ ] **4.1** Erweitere `IStammPersonRepository` Interface:
  ```typescript
  findByExternalId(source: string, externalId: string): Promise<StammPerson | null>;
  findByUsername(username: string): Promise<StammPerson | null>;
  upsert(person: StammPerson, tx?: TransactionContext): Promise<StammPerson>;
  ```
- [ ] **4.2** Implementiere in `PrismaStammPersonRepository`:
  - `findByExternalId`: Neues Feld oder `username` Match
  - `upsert`: Prisma upsert mit `where: { username }` oder `externalId`
- [ ] **4.3** Erweitere `StammPerson` Aggregate um:
  ```typescript
  // Properties für externe Quellen
  private _externalSource?: string;  // "HIORG_SERVER"
  private _externalId?: string;       // HiOrg username
  private _lastSyncAt?: Date;

  // Method für Import-Update
  public updateFromExternalSource(data: ExternalPersonData): void {
    this._vorname = data.vorname;
    this._nachname = data.nachname;
    // ... weitere Felder
    this._lastSyncAt = new Date();
  }
  ```
- [ ] **4.4** Prisma Schema erweitern:
  ```prisma
  model StammPerson {
    // ... bestehende Felder
    externalSource  String?   // "HIORG_SERVER"
    externalId      String?   // HiOrg username
    lastSyncAt      DateTime?

    @@unique([externalSource, externalId])
  }
  ```

### Task 5: Infrastructure Layer - Repository Implementierungen

- [ ] **5.1** Erstelle: `src/infrastructure/integrations/repositories/prisma-qualifikation-mapping.repository.ts`
- [ ] **5.2** DI Token hinzufügen in `di-tokens.ts`:
  ```typescript
  INTEGRATIONS: {
    // ... bestehende
    QUALIFIKATION_MAPPING_REPOSITORY: Symbol('IQualifikationMappingRepository'),
  }
  ```
- [ ] **5.3** Provider in `IntegrationsInfrastructureModule` registrieren

### Task 6: Admin Controller - Import Endpoints

- [ ] **6.1** Erweitere `AdminHiOrgIntegrationController`:
  ```typescript
  @Post('import')
  @ApiOperation({ summary: 'Ausgewählte Personen aus HiOrg importieren' })
  @ApiWrappedCreatedResponse(ImportResultDto)
  async importPersons(@Body() dto: ImportPersonsRequestDto): Promise<WrappedResponse<ImportResultDto>>

  @Get('mappings')
  @ApiOperation({ summary: 'Qualifikations-Mappings abrufen' })
  @ApiWrappedResponse(QualifikationMappingDto, { isArray: true })
  async getMappings(): Promise<WrappedResponse<QualifikationMappingDto[]>>

  @Put('mappings/:id')
  @ApiOperation({ summary: 'Einzelnes Mapping aktualisieren' })
  @ApiWrappedResponse(QualifikationMappingDto)
  async updateMapping(@Param('id') id: string, @Body() dto: UpdateMappingDto): Promise<WrappedResponse<QualifikationMappingDto>>

  @Post('mappings/auto-match')
  @ApiOperation({ summary: 'Automatisches Qualifikations-Matching ausführen' })
  @ApiWrappedResponse(AutoMatchResultDto)
  async autoMatch(): Promise<WrappedResponse<AutoMatchResultDto>>
  ```
- [ ] **6.2** DTOs mit class-validator + @ApiProperty
- [ ] **6.3** Rate Limiting: `@Throttle({ default: { limit: 5, ttl: 60000 } })` auf Import-Endpoint

### Task 7: Frontend - Import-Auswahl Komponenten

- [ ] **7.1** Hooks in `features/admin/integrations/hiorg/api/` (**VOLLSTÄNDIGE BEISPIELE**):

  **queries.ts:**
  ```typescript
  import { useQuery } from '@tanstack/react-query';
  import { api } from '@bluelight-hub/shared/client';
  import { QUERY_KEYS } from '@/queryKeys';

  // Query Keys hinzufügen in queryKeys.ts:
  // hiorg: {
  //   mappings: () => ['hiorg', 'mappings'] as const,
  //   persons: () => ['hiorg', 'persons'] as const,
  // }

  export const useQualifikationMappings = () => {
    return useQuery({
      queryKey: QUERY_KEYS.hiorg.mappings(),
      queryFn: () => api.adminIntegrationsHiorg.getMappings(),
      staleTime: 5 * 60 * 1000,  // 5 Minuten Cache
    });
  };

  export const useHiOrgPersons = () => {
    return useQuery({
      queryKey: QUERY_KEYS.hiorg.persons(),
      queryFn: () => api.adminIntegrationsHiorg.getPersons(),
      staleTime: 60 * 1000,  // 1 Minute (fresh data wichtig)
    });
  };
  ```

  **mutations.ts:**
  ```typescript
  import { useMutation, useQueryClient } from '@tanstack/react-query';
  import { api } from '@bluelight-hub/shared/client';
  import { QUERY_KEYS } from '@/queryKeys';

  export const useImportPersons = () => {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: (dto: ImportPersonsRequestDto) =>
        api.adminIntegrationsHiorg.importPersons(dto),
      onSuccess: (result) => {
        // Invalidate related queries
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.hiorg.persons() });
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stammPersonen.list() });
      },
      onError: (error) => {
        console.error('Import failed:', error);
      },
    });
  };

  export const useUpdateMapping = () => {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: ({ id, dto }: { id: string; dto: UpdateMappingDto }) =>
        api.adminIntegrationsHiorg.updateMapping(id, dto),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.hiorg.mappings() });
      },
    });
  };

  export const useAutoMatch = () => {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: () => api.adminIntegrationsHiorg.autoMatch(),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.hiorg.mappings() });
      },
    });
  };
  ```
- [ ] **7.2** Komponente: `PersonenImportTable.tsx` (organisms/)
  - Checkbox-Spalte mit "Alle auswählen" Header
  - Spalten: Name, Qualifikationen, Status (Neu/Update)
  - Farbcodierung: Grün (neu), Gelb (update), Grau (deselected)
  - Virtualisierte Liste für Performance (>100 Personen)
- [ ] **7.3** Komponente: `ImportProgressDialog.tsx` (molecules/)
  - Fortschrittsbalken während Import
  - Live-Counter: "23/42 importiert"
  - Fehler-Accordion am Ende
- [ ] **7.4** Komponente: `ImportResultSummary.tsx` (molecules/)
  - Success/Failure Stats
  - Klickbare Fehler-Details

### Task 8: Frontend - Qualifikations-Mapping UI

- [ ] **8.1** Komponente: `QualifikationMappingTable.tsx` (organisms/)
  - Spalten: HiOrg-Name, Bluelight-Qualifikation (Dropdown), Status
  - Inline-Editing via Headless UI Listbox
  - "Auto-Match" Button im Header
  - Ungemappte Einträge oben, farblich markiert
- [ ] **8.2** Komponente: `MappingStatusBadge.tsx` (atoms/)
  - ✓ Gemappt (grün)
  - ⚡ Auto-Match (blau)
  - ⚠️ Nicht zugeordnet (orange)
- [ ] **8.3** Dialog: `ConfigureMappingsDialog.tsx`
  - Modal mit MappingTable
  - "Speichern" und "Abbrechen" Buttons
  - Warnung bei ungemappten Qualifikationen

### Task 9: Frontend - Integration in HiOrg Settings Page

- [ ] **9.1** Erweitere `HiOrgSettingsPage.tsx`:
  - Tab-Navigation: "Verbindung" | "Import" | "Mappings"
  - Import-Tab zeigt PersonenImportTable + ImportProgress
  - Mappings-Tab zeigt QualifikationMappingTable
- [ ] **9.2** Workflow:
  1. Verbindung herstellen (Story 7.1)
  2. "Personen synchronisieren" → Lädt Preview
  3. "Mapping konfigurieren" → Opens MappingDialog
  4. Personen selektieren → "X Personen importieren"
  5. Import läuft → Progress Dialog
  6. Ergebnis anzeigen → Summary

### Task 10: Verifikation

- [ ] **10.1** Unit Tests (**AC6 Compliance - AAA Pattern mit Given-When-Then**):

  **Template für ImportSelectedPersonsHandler:**
  ```typescript
  describe('ImportSelectedPersonsHandler', () => {
    let handler: ImportSelectedPersonsHandler;
    let mockLogger: jest.Mocked<ILogger>;
    let mockHiorgServer: jest.Mocked<IHiOrgServerPort>;
    let mockStammPersonRepo: jest.Mocked<IStammPersonRepository>;
    let mockMappingRepo: jest.Mocked<IQualifikationMappingRepository>;
    let mockPrisma: jest.Mocked<PrismaService>;
    let mockOutbox: jest.Mocked<IOutboxRepository>;

    beforeEach(() => {
      jest.clearAllMocks();  // ✅ WICHTIG: Mock Reset!

      mockLogger = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };
      mockHiorgServer = { fetchPersons: jest.fn(), testConnection: jest.fn() };
      mockStammPersonRepo = {
        findByExternalId: jest.fn(),
        save: jest.fn(),
        upsert: jest.fn(),
      };
      mockMappingRepo = { findByExternalSource: jest.fn(), save: jest.fn() };
      mockPrisma = { $transaction: jest.fn((fn) => fn({})) };
      mockOutbox = { save: jest.fn() };

      handler = new ImportSelectedPersonsHandler(
        mockLogger,
        mockHiorgServer,
        mockStammPersonRepo,
        mockMappingRepo,
        mockPrisma,
        mockOutbox,
      );
    });

    describe('execute', () => {
      it('should import all selected persons successfully', async () => {
        // Given (Arrange)
        const command = new ImportSelectedPersonsCommand(
          ['anna.schmidt', 'max.mueller'],
          true,
        );
        mockHiorgServer.fetchPersons.mockResolvedValue(Result.ok([
          { username: 'anna.schmidt', vorname: 'Anna', nachname: 'Schmidt', qualifikationen: [] },
          { username: 'max.mueller', vorname: 'Max', nachname: 'Mueller', qualifikationen: [] },
        ]));
        mockMappingRepo.findByExternalSource.mockResolvedValue([]);
        mockStammPersonRepo.findByExternalId.mockResolvedValue(null);
        mockStammPersonRepo.save.mockResolvedValue(undefined);

        // When (Act)
        const result = await handler.execute(command);

        // Then (Assert)
        expect(result.isSuccess).toBe(true);
        expect(result.value!.successCount).toBe(2);
        expect(result.value!.failureCount).toBe(0);
        expect(mockStammPersonRepo.save).toHaveBeenCalledTimes(2);
        expect(mockOutbox.save).toHaveBeenCalledWith(
          expect.objectContaining({ eventType: 'PersonenImportiertEvent' }),
          expect.any(Object),
        );
      });

      it('should handle partial failure gracefully', async () => {
        // Given (Arrange)
        const command = new ImportSelectedPersonsCommand(['valid', 'invalid'], true);
        mockHiorgServer.fetchPersons.mockResolvedValue(Result.ok([
          { username: 'valid', vorname: 'Valid', nachname: 'User', qualifikationen: [] },
          { username: 'invalid', vorname: '', nachname: '', qualifikationen: [] }, // Invalid
        ]));
        mockMappingRepo.findByExternalSource.mockResolvedValue([]);
        mockStammPersonRepo.findByExternalId.mockResolvedValue(null);
        mockStammPersonRepo.save
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(new Error('Validation failed'));

        // When (Act)
        const result = await handler.execute(command);

        // Then (Assert)
        expect(result.isSuccess).toBe(true);  // Partial success!
        expect(result.value!.successCount).toBe(1);
        expect(result.value!.failureCount).toBe(1);
        expect(result.value!.failures[0].reason).toContain('Validation failed');
      });

      it('should update existing person on duplicate', async () => {
        // Given (Arrange)
        const command = new ImportSelectedPersonsCommand(['existing.user'], true);
        const existingPerson = StammPerson.reconstitute('id-123', { /* ... */ });
        mockHiorgServer.fetchPersons.mockResolvedValue(Result.ok([
          { username: 'existing.user', vorname: 'Updated', nachname: 'Name', qualifikationen: [] },
        ]));
        mockStammPersonRepo.findByExternalId.mockResolvedValue(existingPerson);
        mockStammPersonRepo.save.mockResolvedValue(undefined);

        // When (Act)
        const result = await handler.execute(command);

        // Then (Assert)
        expect(result.isSuccess).toBe(true);
        expect(result.value!.updateCount).toBe(1);
        expect(mockStammPersonRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'id-123' }),
          expect.any(Object),
        );
      });
    });
  });
  ```

  **Zu testende Handler:**
  - `ImportSelectedPersonsHandler` (success, partial failure, full failure, update existing)
  - `AutoMatchQualifikationenHandler` (exact match, fuzzy match, no match, confidence scores)
  - `SaveQualifikationMappingHandler` (create, update, validation error)
  - `QualifikationMappingRepository` (CRUD operations)

- [ ] **10.2** Integration Tests:
  - Import mit Mock HiOrg-Server Response
  - Upsert-Verhalten bei Duplikaten
  - Qualifikations-Verknüpfung
- [ ] **10.3** `pnpm --filter @bluelight-hub/backend lint:check` → 0 Errors
- [ ] **10.4** `pnpm --filter @bluelight-hub/frontend lint:check` → 0 Errors
- [ ] **10.5** `pnpm run build` → Success
- [ ] **10.6** `pnpm run generate-api` → API Client aktualisiert
- [ ] **10.7** Manuelle Tests:
  - Import mit 50+ Personen (Performance)
  - Duplikat-Update Workflow
  - Mapping konfigurieren und Import wiederholen

---

## Dev Notes

### Architektur-Patterns (aus Story 7.1)

**Port/Adapter Pattern:**
- Ports in: `src/domain/ports/*.port.ts` (für Common) oder `src/domain/integrations/ports/`
- Adapter in: `src/infrastructure/integrations/*.adapter.ts`
- Bestehend: `IHiOrgServerPort`, `IEncryptionPort`

**TransactionalCommandHandler:**
- **WICHTIG:** Für Import-Command verwenden (Atomizität!)
- Pattern: `executeInTransaction()` → `{ result, events }`
- Events werden automatisch in Outbox gespeichert
- Referenz: `src/application/common/handlers/transactional-command.handler.ts`

**Guard Pattern (Story 7.1 Fix):**
```typescript
// ✅ RICHTIG (nach Code Review):
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
```

**Result Pattern:**
- `Result.ok(value)` für Erfolg
- `Result.fail(errorMessage)` für erwartete Fehler
- Domain Exceptions nur für unerwartete Fehler

### HiOrg-Server API (aus Story 7.1)

**Bestehende Endpoints (Port Interface):**
```typescript
interface IHiOrgServerPort {
  testConnection(orgKuerzel: string, token: string): Promise<Result<HiOrgConnectionInfo>>;
  fetchPersons(orgKuerzel: string, token: string, options?: HiOrgFetchOptions): Promise<Result<HiOrgPersonDto[]>>;
}
```

**HiOrgPersonDto bereits definiert:**
```typescript
interface HiOrgPersonDto {
  username: string;
  mitgliednr?: string;
  vorname: string;
  nachname: string;
  qualifikationen: HiOrgQualifikation[];
  ausbildungen: HiOrgAusbildung[];
  // ... weitere Felder
}
```

**Qualifikationen-Struktur:**
```typescript
interface HiOrgQualifikation {
  position: number;    // Hierarchie-Stufe
  liste_id: number;
  name: string;        // "Gruppenführer" - FÜR MAPPING RELEVANT
  name_kurz?: string;  // "GrFü"
}
```

### Import-Strategie

**Upsert-Logik:**
1. `findByExternalId("HIORG_SERVER", username)` → Update
2. Falls nicht gefunden: `findByUsername(username)` → Update (Legacy-Daten)
3. Falls nicht gefunden: Create

**Qualifikations-Merge (OPT-4 - Konfigurierbare Strategie):**

```typescript
export enum QualifikationMergeStrategy {
  MERGE = 'MERGE',           // Bestehende behalten, neue hinzufügen (Default)
  REPLACE = 'REPLACE',       // Alle ersetzen durch Import
  KEEP_EXISTING = 'KEEP',    // Nur bestehende behalten, neue ignorieren
}

// Im ImportPersonsRequestDto:
export class ImportPersonsRequestDto {
  @ApiProperty({ description: 'Usernames der zu importierenden Personen' })
  selectedUsernames: string[];

  @ApiPropertyOptional({
    enum: QualifikationMergeStrategy,
    default: QualifikationMergeStrategy.MERGE,
    description: 'Strategie für Qualifikations-Merge bei Duplikaten',
  })
  mergeStrategy?: QualifikationMergeStrategy = QualifikationMergeStrategy.MERGE;
}
```

**Standard-Verhalten (MERGE):**
- Bestehende Qualifikationen BEHALTEN
- Neue aus Import HINZUFÜGEN
- Keine automatische Entfernung (explizite Aktion nötig)

**Fehlerbehandlung:**
- Pro-Person Try/Catch
- Fehler sammeln, aber nicht abbrechen
- Am Ende: `ImportResult` mit Details

### StammPerson Aggregate Erweiterung

**Neue Properties:**
```typescript
// In stamm-person.aggregate.ts
private _externalSource?: string;
private _externalId?: string;
private _lastSyncAt?: Date;

// Getter
get externalSource(): string | undefined { return this._externalSource; }
get externalId(): string | undefined { return this._externalId; }
get lastSyncAt(): Date | undefined { return this._lastSyncAt; }
```

**Migration für Prisma:**
```sql
ALTER TABLE "StammPerson" ADD COLUMN "externalSource" TEXT;
ALTER TABLE "StammPerson" ADD COLUMN "externalId" TEXT;
ALTER TABLE "StammPerson" ADD COLUMN "lastSyncAt" TIMESTAMP;
CREATE UNIQUE INDEX "StammPerson_externalSource_externalId_key"
  ON "StammPerson"("externalSource", "externalId");
```

### Security Checklist

- [ ] Admin-Only Endpoints (`@Roles('ADMIN', 'SUPER_ADMIN')`)
- [ ] Rate Limiting auf Import (max 5 req/min)
- [ ] Input Validation (max 500 Personen pro Import)
- [ ] Keine sensiblen Daten in Logs
- [ ] Audit Trail für Import-Aktionen (siehe unten)

### Audit Trail Entity (EN-3)

```typescript
// Domain Event für Audit Trail
export class ImportAuditEvent extends DomainEvent {
  constructor(
    public readonly adminUserId: string,
    public readonly action: 'IMPORT_STARTED' | 'IMPORT_COMPLETED' | 'IMPORT_FAILED' | 'IMPORT_CANCELLED',
    public readonly metadata: {
      source: 'HIORG_SERVER';
      totalRecords: number;
      selectedRecords: number;
      mappingsApplied: number;
      result?: {
        created: number;
        updated: number;
        skipped: number;
        failed: number;
      };
      errorDetails?: string[];
      durationMs?: number;
    },
  ) { ... }
}

// Prisma Model für persistierten Audit Log
model ImportAuditLog {
  id           String   @id @default(cuid())
  adminUserId  String
  action       String   // IMPORT_STARTED, IMPORT_COMPLETED, etc.
  source       String   // HIORG_SERVER
  totalRecords Int
  selectedRecords Int
  createdCount Int?
  updatedCount Int?
  failedCount  Int?
  errorDetails Json?
  durationMs   Int?
  createdAt    DateTime @default(now())

  @@index([adminUserId])
  @@index([createdAt])
  @@map("import_audit_logs")
}
```

### Changelog Entity (EN-4 - Detaillierte Änderungsverfolgung)

```typescript
// Für Duplikat-Updates: Was wurde geändert?
model StammPersonChangelog {
  id              String   @id @default(cuid())
  stammPersonId   String
  stammPerson     StammPerson @relation(fields: [stammPersonId], references: [id])
  changeType      String   // IMPORT_UPDATE, MANUAL_UPDATE
  changedFields   Json     // { "vorname": { "old": "Anna", "new": "Anne" } }
  changedBy       String   // AdminUserId oder "SYSTEM"
  source          String?  // HIORG_SERVER
  createdAt       DateTime @default(now())

  @@index([stammPersonId])
  @@index([createdAt])
  @@map("stamm_person_changelogs")
}

// Beispiel changedFields:
// {
//   "vorname": { "old": "Anna", "new": "Anne" },
//   "qualifikationen": {
//     "added": ["GrFü", "SanA"],
//     "removed": []
//   }
// }
```

### Performance Metriken (EN-5 - Konkrete Zahlen)

| Metrik | Anforderung | Messmethode |
|--------|-------------|-------------|
| **API Response Time** | < 200ms für Mapping-Liste | Backend Logging |
| **Import-Durchsatz** | ≥ 10 Personen/Sekunde | Integration Test |
| **Gesamt-Import 100 Personen** | < 15 Sekunden | E2E Test |
| **Gesamt-Import 500 Personen** | < 60 Sekunden | Load Test |
| **Frontend-Rendering** | < 500ms für 500 Personen-Liste | Lighthouse |
| **Memory (Frontend)** | < 50MB für 500 Personen | Chrome DevTools |

**Implementierungs-Details:**
- **Batch-Insert:** Prisma `createMany()` mit Batch-Größe 50
- **Lazy Loading:** Qualifikationen erst bei Mapping-View laden
- **Virtualisierung:** `@tanstack/react-virtual` für Listen >100 Personen
- **Progress Updates:** Polling alle 500ms während Import (MVP)
- **Timeout:** 2 Minuten pro Import-Request, dann Teil-Ergebnis

---

## References

| Dokument | Pfad |
|----------|------|
| Epic 7 Definition | `docs/epics.md#Epic-7` |
| Story 7.1 (Vorgänger) | `docs/sprint-artifacts/7-1-hiorg-server-verbindung-synchronisation.md` |
| PRD FR38-40 | `docs/prd.md` |
| HiOrg-Server Port | `packages/backend/src/domain/ports/i-hiorg-server.port.ts` |
| StammPerson Aggregate | `packages/backend/src/domain/kraefte/aggregates/stamm-person.aggregate.ts` |
| Qualifikation Aggregate | `packages/backend/src/domain/kraefte/aggregates/qualifikation.aggregate.ts` |
| TransactionalCommandHandler | `packages/backend/src/application/common/handlers/transactional-command.handler.ts` |
| DI Tokens | `packages/backend/src/infrastructure/di-tokens.ts` |
| Project Context | `docs/project-context.md` |

---

## Dev Agent Record

### Context Reference

Erstellt via BMad create-story Workflow (YOLO-Modus) mit 3 parallelen Subagents:
- Architecture Analysis Agent
- Codebase Analysis Agent
- PRD Analysis Agent

### Agent Model Used

Claude Opus 4.5 (SM Agent)

### Completion Notes List

**2026-01-02 - Story erstellt:**
- 3 parallele Subagents für umfassende Kontext-Analyse
- Story 7.1 Learnings integriert (Guard-Pattern, Port/Adapter, TransactionalCommandHandler)
- Prisma Schema Erweiterungen für Mapping + StammPerson externe Felder
- 10 Tasks mit detaillierten Subtasks
- Frontend-Komponenten für kompletten Import-Workflow
- Qualifikations-Auto-Matching via Levenshtein-Distanz
- Upsert-Strategie für Duplikatserkennung definiert
- Performance-Optimierungen (Batch-Insert, Virtualisierung)

**2026-01-02 - Story validiert & erweitert:**
- 4 parallele Validation-Subagents (Codebase, Pattern, Requirements, 7.1 Learnings)
- **Status auf BLOCKED gesetzt** - 3 Blocker identifiziert (Story 7.1, StammPerson, Qualifikation Entity)
- **6 Critical Issues behoben:**
  - CR-4: Logger Port `@Inject(LOGGER)` in Handler-Templates
  - CR-5: TransactionalCommandHandler vollständiges Template mit `tx` Parameter
  - CR-6: Test Templates mit AAA/Given-When-Then Pattern
- **5 Enhancements hinzugefügt:**
  - EN-1: TanStack Query Hook vollständige Beispiele (queries.ts, mutations.ts)
  - EN-2: Edge Cases (leere Listen, Duplikate, Limits, Timeout, ungemappt)
  - EN-3: Audit Trail Entity (ImportAuditEvent, ImportAuditLog)
  - EN-4: Changelog Entity (StammPersonChangelog mit changedFields)
  - EN-5: Performance-Metriken (konkrete Zahlen: <15s für 100 Personen)
- **4 Optimierungen dokumentiert:**
  - OPT-1: Levenshtein-Schwellenwert (85%)
  - OPT-2: Auto-Match Confidence Scores (0-100)
  - OPT-3: Import-Session Persistierung (implizit)
  - OPT-4: Konfigurierbare Qualifikations-Merge Strategie (MERGE/REPLACE/KEEP)
- Validation Report: `docs/sprint-artifacts/validation-report-7-2-2026-01-02.md`

---

## File List

**Zu erstellen (Backend):**
- `packages/backend/prisma/migrations/*/add_qualifikation_mapping_and_stammperson_external.sql`
- `packages/backend/src/domain/integrations/entities/qualifikation-mapping.entity.ts`
- `packages/backend/src/domain/integrations/repositories/i-qualifikation-mapping.repository.ts`
- `packages/backend/src/domain/kraefte/events/personen-importiert.event.ts`
- `packages/backend/src/application/integrations/commands/import-selected-persons/*`
- `packages/backend/src/application/integrations/commands/save-qualifikation-mapping/*`
- `packages/backend/src/application/integrations/commands/auto-match-qualifikationen/*`
- `packages/backend/src/application/integrations/queries/get-qualifikation-mappings/*`
- `packages/backend/src/infrastructure/integrations/repositories/prisma-qualifikation-mapping.repository.ts`

**Zu erweitern (Backend):**
- `packages/backend/prisma/schema.prisma` (QualifikationMapping, StammPerson externe Felder)
- `packages/backend/src/domain/kraefte/aggregates/stamm-person.aggregate.ts` (externe Felder)
- `packages/backend/src/domain/kraefte/repositories/i-stamm-person.repository.ts` (findByExternalId, upsert)
- `packages/backend/src/infrastructure/kraefte/repositories/prisma-stamm-person.repository.ts`
- `packages/backend/src/infrastructure/di-tokens.ts` (QUALIFIKATION_MAPPING_REPOSITORY)
- `packages/backend/src/modules/integrations/controllers/admin-hiorg-integration.controller.ts` (Import + Mapping Endpoints)
- `packages/backend/src/domain/integrations/common/integration-error-codes.ts`

**Zu erstellen (Frontend):**
- `packages/frontend/src/features/admin/integrations/hiorg/ui/organisms/PersonenImportTable.tsx`
- `packages/frontend/src/features/admin/integrations/hiorg/ui/organisms/QualifikationMappingTable.tsx`
- `packages/frontend/src/features/admin/integrations/hiorg/ui/molecules/ImportProgressDialog.tsx`
- `packages/frontend/src/features/admin/integrations/hiorg/ui/molecules/ImportResultSummary.tsx`
- `packages/frontend/src/features/admin/integrations/hiorg/ui/molecules/ConfigureMappingsDialog.tsx`
- `packages/frontend/src/features/admin/integrations/hiorg/ui/atoms/MappingStatusBadge.tsx`
- `packages/frontend/src/features/admin/integrations/hiorg/api/mutations.ts` (erweitern)
- `packages/frontend/src/features/admin/integrations/hiorg/api/queries.ts` (erweitern)

**Zu erweitern (Frontend):**
- `packages/frontend/src/features/admin/integrations/hiorg/ui/pages/HiOrgSettingsPage.tsx` (Tabs)
