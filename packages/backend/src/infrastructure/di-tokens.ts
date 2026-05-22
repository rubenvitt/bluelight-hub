/**
 * Dependency Injection Tokens für Infrastructure Layer.
 *
 * Verwendet Symbol() für Compile-Time Type Safety und
 * Vermeidung von String-basierten Token Collisions.
 *
 * **Warum Symbol statt String:**
 * - Type Safety: TypeScript kann Symbol Types validieren
 * - Keine Namenskollisionen: Jedes Symbol ist einzigartig
 * - Bessere IDE-Unterstützung: Autocomplete und Refactoring
 * - Konsistent mit modernen DI Best Practices
 *
 * @example
 * ```typescript
 * // In Application Layer:
 * constructor(
 *   @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository
 * ) {}
 * ```
 */

/** Repository Token für IUserRepository */
export const USER_REPOSITORY = Symbol('IUserRepository');

/** Service Token für IJwtAuthServicePort */
export const JWT_AUTH_SERVICE = Symbol('IJwtAuthServicePort');

/** Logger Token für ILogger */
export const LOGGER = Symbol('ILogger');

/** Port Token für IRuntimeConfigPort */
export const RUNTIME_CONFIG = Symbol('IRuntimeConfigPort');

/** Repository Token für IEinsatzRepository (bereits in Story 4-5) */
export const EINSATZ_REPOSITORY = Symbol('IEinsatzRepository');

/** Repository Token für IEtbRepository */
export const ETB_REPOSITORY = Symbol('IEtbRepository');

/** Repository Token für IOutboxRepository */
export const OUTBOX_REPOSITORY = Symbol('IOutboxRepository');

/** Repository Token für ILagekarteRepository */
export const LAGEKARTE_REPOSITORY = Symbol('ILagekarteRepository');

/** Repository Token für ILagekarteStateRepository (Legacy State-Persistierung, Issue #638) */
export const LAGEKARTE_STATE_REPOSITORY = Symbol('ILagekarteStateRepository');

/** Repository Token für IServerAccessTokenRepository */
export const SERVER_ACCESS_TOKEN_REPOSITORY = Symbol('IServerAccessTokenRepository');

/** Repository Token für IInviteCodeRepository (Story 1-6) */
export const INVITE_CODE_REPOSITORY = Symbol('IInviteCodeRepository');

/** Repository Token für IServerConfigRepository (Story 4-6) */
export const SERVER_CONFIG_REPOSITORY = Symbol('IServerConfigRepository');

/** Repository Token für IEinsatzTeilnehmerRepository (Story 115) */
export const EINSATZ_TEILNEHMER_REPOSITORY = Symbol('IEinsatzTeilnehmerRepository');

/** Repository Token für IPushSubscriptionRepository (Story 1.1 Plattform, ADR-011) */
export const PUSH_SUBSCRIPTION_REPOSITORY = Symbol('IPushSubscriptionRepository');

/**
 * Service-Token für `IPushNotificationService` (Story 3.8 / ADR-011).
 *
 * Wird von Application-Handlern (z. B. `EmitCriticalPushOnPsaProfilGeaendertHandler`)
 * injiziert; die Konsumenten programmieren ausschließlich gegen das Domain-
 * Interface `@domain/push-notifications/i-push-notification.service`. Die
 * Layer-Boundary wird durch dieses Interface gesichert — der Token bindet
 * via `useExisting` an denselben Singleton wie `PushNotificationsService`
 * aus `PushNotificationsModule`, vermeidet Provider-Doppel und macht die
 * konkrete Implementierung austauschbar, ohne die Konsumenten zu rühren.
 */
export const PUSH_NOTIFICATION_SERVICE = Symbol('IPushNotificationService');

/**
 * Lookup-Port-Token für `IPushRecipientLookupPort` (Story 3.8 AC2).
 *
 * Wird vom Bridge-Handler `EmitCriticalPushOnPsaProfilGeaendertHandler`
 * injiziert. Implementierung im Infrastructure-Layer:
 * `PrismaPushRecipientLookupRepository`.
 */
export const PUSH_RECIPIENT_LOOKUP = Symbol('IPushRecipientLookupPort');

/**
 * DI Token für IErinnerungRepository Port.
 *
 * Verwendung in Handlers:
 * @example
 * @Inject(ERINNERUNG_REPOSITORY)
 * private readonly repo: IErinnerungRepository
 */
export const ERINNERUNG_REPOSITORY = Symbol('IErinnerungRepository');

/** Repository Token für IErinnerungsvorlageRepository */
export const ERINNERUNGSVORLAGE_REPOSITORY = Symbol('IErinnerungsvorlageRepository');

/** Repository Token für IBefehlRepository (Story 1.1) */
export const BEFEHL_REPOSITORY = Symbol('IBefehlRepository');

/** Repository Token für IEinsatzRollenReadRepository (Story 4.3) */
export const EINSATZ_ROLLEN_READ_REPOSITORY = Symbol('IEinsatzRollenReadRepository');

/** Repository Token für IFuehrungsrhythmusTemplateRepository (Story 6.6) */
export const FUEHRUNGSRHYTHMUS_TEMPLATE_REPOSITORY = Symbol('IFuehrungsrhythmusTemplateRepository');

/** Repository Token für INotizRepository */
export const NOTIZ_REPOSITORY = Symbol('INotizRepository');

/** Repository Token für IKategorieRepository */
export const KATEGORIE_REPOSITORY = Symbol('IKategorieRepository');

/** Repository Token für IGefahrenmatrixRepository (Issue #414) */
export const GEFAHRENMATRIX_REPOSITORY = Symbol('IGefahrenmatrixRepository');

/** Repository Token für IGefahrenzoneRepository (Issue #627) */
export const GEFAHRENZONE_REPOSITORY = Symbol('IGefahrenzoneRepository');

/**
 * Kräftemanagement Repository Tokens (Epic 1+).
 *
 * Verwaltung von Admin-Konfigurationsdaten:
 * - QUALIFIKATION: Qualifikations-Definitionen (Story 1-1)
 * - FAHRZEUGTYP: Fahrzeugtyp-Definitionen (Story 1-2)
 * - ROLLE: Rollen-Definitionen (Story 1-3, future)
 *
 * **WARUM nested Object statt flat Symbols wie bei anderen Repositories?**
 * - **Namespacing:** Kräfte-Modul hat mehrere zusammenhängende Repositories
 * - **Zukunftssicher:** Epic 1+ wird weitere Repositories hinzufügen (Fahrzeugtyp, Rolle)
 * - **Gruppierung:** Logische Gruppierung von verwandten Tokens für bessere Übersicht
 * - **Konsistenz innerhalb Epic:** Alle Kräfte-Repositories unter einem Namespace
 * - **Andere Module:** USER_REPOSITORY, EINSATZ_REPOSITORY sind einzelne Repositories pro Modul
 *
 * **Verwendung:**
 * ```typescript
 * @Inject(KRAEFTE_REPOSITORIES.QUALIFIKATION) private readonly repo: IQualifikationRepository
 * ```
 */
export const KRAEFTE_REPOSITORIES = {
  /** Repository Token für IQualifikationRepository */
  QUALIFIKATION: Symbol('IQualifikationRepository'),
  /** Repository Token für IFahrzeugtypRepository */
  FAHRZEUGTYP: Symbol('IFahrzeugtypRepository'),
  /** Repository Token für IRollenDefinitionRepository (Story 1-3) */
  ROLLEN_DEFINITION: Symbol('IRollenDefinitionRepository'),
  /** Repository Token für IFunkStatusConfigRepository (Story 1-4) */
  FUNK_STATUS_CONFIG: Symbol('IFunkStatusConfigRepository'),
  /** Repository Token für IStammFahrzeugRepository (Story 2-1) */
  STAMM_FAHRZEUG: Symbol('IStammFahrzeugRepository'),
  /** Repository Token für IStammPersonRepository (Story 2-2) */
  STAMM_PERSON: Symbol('IStammPersonRepository'),
  /** Repository Token für IEinsatzFahrzeugRepository (Story 3-1) */
  EINSATZ_FAHRZEUG: Symbol('IEinsatzFahrzeugRepository'),
  /** Repository Token für IEinsatzPersonRepository (Story 4-1) */
  EINSATZ_PERSON: Symbol('IEinsatzPersonRepository'),
  /** Repository Token für IRollenBesetzungRepository (Story 5-0) */
  ROLLEN_BESETZUNG: Symbol('IRollenBesetzungRepository'),
  /** Repository Token für IEinsatzEinheitRepository (Issue #411) */
  EINSATZ_EINHEIT: Symbol('IEinsatzEinheitRepository'),
} as const;

/** Export Service Token für IPdfExportService (Story 9.6) */
export const PDF_EXPORT_SERVICE = Symbol('IPdfExportService');

/** Repository Token für IEinsatzBeitrittsanfrageRepository (Issue #98) */
export const EINSATZ_BEITRITTSANFRAGE_REPOSITORY = Symbol('IEinsatzBeitrittsanfrageRepository');

/** Export Service Token für ICsvExportService (Story 9.6) */
export const CSV_EXPORT_SERVICE = Symbol('ICsvExportService');

/** Export Service Token für IBefehlCsvService (Story 4.4) */
export const BEFEHL_CSV_SERVICE = Symbol('IBefehlCsvService');

/** Repository Token für IAufbewahrungsKonfigurationRepository (Story 5.5) */
export const AUFBEWAHRUNGS_KONFIGURATION_REPOSITORY = Symbol('IAufbewahrungsKonfigurationRepository');

/** Repository Token für IComplianceReportRepository (Story 5.5) */
export const COMPLIANCE_REPORT_REPOSITORY = Symbol('IComplianceReportRepository');

/** Export Service Token für IJsonExportService (Story 9.6) */
export const JSON_EXPORT_SERVICE = Symbol('IJsonExportService');

/** Transaction Manager Token für ITransactionManager */
export const TRANSACTION_MANAGER = Symbol('ITransactionManager');

/** Event Publisher Token für IEventPublisher */
export const EVENT_PUBLISHER = Symbol('IEventPublisher');

/** Alert Service Token für IAlertService */
export const ALERT_SERVICE = Symbol('IAlertService');

/**
 * Passport Strategy Names für AuthGuards.
 *
 * Diese Konstanten vermeiden Typo-Fehler bei Passport Strategy Names
 * und ermöglichen IDE-Unterstützung (Autocomplete, Refactoring).
 *
 * **Warum Constants:**
 * - Type Safety: String Literals sind typo-anfällig
 * - IDE-Unterstützung: Autocomplete und Go-to-Definition
 * - Konsistenz: Zentrale Definition statt verteilter Magic Strings
 */
export const PASSPORT_STRATEGIES = {
  /** Admin JWT Strategy Name */
  ADMIN_JWT: 'admin-jwt',
} as const;

/**
 * Event Handler Tokens für IEventHandler<TEvent> Implementations.
 *
 * Diese Tokens ermöglichen die Dependency Injection von Event Handlers
 * via Infrastructure Adapters. Der Adapter (mit @OnEvent Decorator) delegiert
 * an den Application Layer Handler (ohne Framework-Abhängigkeiten).
 *
 * **Pattern:**
 * 1. Application Layer Handler implementiert IEventHandler<TEvent>
 * 2. Handler wird mit diesem Token registriert
 * 3. Infrastructure Adapter injiziert Handler via Token
 * 4. Adapter delegiert @OnEvent Calls an Handler.handle()
 */
export const EVENT_HANDLER = {
  /** ETB Auto-Creation Handler Token */
  ETB_AUTO_CREATION: Symbol('IEventHandler<EinsatzCreatedEvent>:EtbAutoCreation'),

  /** Lagekarte Auto-Creation Handler Token */
  LAGEKARTE_AUTO_CREATION: Symbol('IEventHandler<EinsatzCreatedEvent>:LagekarteAutoCreation'),

  /** FahrzeugErfasst ETB-Eintrag Handler Token (Story 3-1) */
  FAHRZEUG_ERFASST_ETB: Symbol('IEventHandler<FahrzeugErfasstEvent>:EtbEintrag'),

  /** FmsStatusGeaendert ETB-Eintrag Handler Token (Story 3-3) */
  FMS_STATUS_GEAENDERT_ETB: Symbol('IEventHandler<FmsStatusGeaendertEvent>:EtbEintrag'),

  /** EinsatzPersonHinzugefuegt ETB-Eintrag Handler Token (Story 4-1) */
  EINSATZ_PERSON_HINZUGEFUEGT_ETB: Symbol('IEventHandler<EinsatzPersonHinzugefuegtEvent>:EtbEintrag'),

  /** PersonZuFahrzeugZugewiesen ETB-Eintrag Handler Token (Story 4-3) */
  PERSON_ZU_FAHRZEUG_ZUGEWIESEN_ETB: Symbol('IEventHandler<PersonZuFahrzeugZugewiesenEvent>:EtbEintrag'),

  /** PersonVonFahrzeugEntfernt ETB-Eintrag Handler Token (Story 4-3) */
  PERSON_VON_FAHRZEUG_ENTFERNT_ETB: Symbol('IEventHandler<PersonVonFahrzeugEntferntEvent>:EtbEintrag'),

  /** RolleBesetzt ETB-Eintrag Handler Token (Story 5-1) */
  ROLLE_BESETZT_ETB: Symbol('IEventHandler<RolleBesetztEvent>:EtbEintrag'),

  /** RolleFreigegeben ETB-Eintrag Handler Token (Story 5-1) */
  ROLLE_FREIGEGEBEN_ETB: Symbol('IEventHandler<RolleFreigegebenEvent>:EtbEintrag'),

  /** ErinnerungAktualisiert ETB-Eintrag Handler Token (Story 1.3 AC5) */
  ERINNERUNG_AKTUALISIERT_ETB: Symbol('IEventHandler<ErinnerungAktualisiertEvent>:EtbEintrag'),

  /** ErinnerungGeloescht ETB-Eintrag Handler Token (Story 1.4 AC5) */
  ERINNERUNG_GELOESCHT_ETB: Symbol('IEventHandler<ErinnerungGeloeschtEvent>:EtbEintrag'),

  /** ErinnerungAusgeloest ETB-Eintrag Handler Token (Story 1.5 AC5) */
  ERINNERUNG_AUSGELOEST_ETB: Symbol('IEventHandler<ErinnerungAusgeloestEvent>:EtbEintrag'),

  /** ErinnerungAcknowledged ETB-Eintrag Handler Token (Story 1.6 AC5) */
  ERINNERUNG_ACKNOWLEDGED_ETB: Symbol('IEventHandler<ErinnerungAcknowledgedEvent>:EtbEintrag'),

  /** ErinnerungSnoozed ETB-Eintrag Handler Token (Story 2.1 AC2) */
  ERINNERUNG_SNOOZED_ETB: Symbol('IEventHandler<ErinnerungSnoozedEvent>:EtbEintrag'),

  /** ErinnerungRetriggered ETB-Eintrag Handler Token (Story 2.2 AC2) */
  ERINNERUNG_RETRIGGERED_ETB: Symbol('IEventHandler<ErinnerungRetriggeredEvent>:EtbEintrag'),

  /** ErinnerungErledigt ETB-Eintrag Handler Token (Story 2.5 AC4) */
  ERINNERUNG_ERLEDIGT_ETB: Symbol('IEventHandler<ErinnerungErledigtEvent>:EtbEintrag'),

  /** ErinnerungErstellt ETB-Eintrag Handler Token (Story 5.0) */
  ERINNERUNG_ERSTELLT_ETB: Symbol('IEventHandler<ErinnerungErstelltEvent>:EtbEintrag'),

  /** ErinnerungAssigned ETB-Eintrag Handler Token (Story 5.0) */
  ERINNERUNG_ASSIGNED_ETB: Symbol('IEventHandler<ErinnerungAssignedEvent>:EtbEintrag'),

  /** ErinnerungEskaliert ETB-Eintrag Handler Token (Story 5.0) */
  ERINNERUNG_ESKALIERT_ETB: Symbol('IEventHandler<ErinnerungEskaliertEvent>:EtbEintrag'),

  /** ErinnerungIntensiviert ETB-Eintrag Handler Token (Story 5.0) */
  ERINNERUNG_INTENSIVIERT_ETB: Symbol('IEventHandler<ErinnerungIntensiviertEvent>:EtbEintrag'),

  /** FuehrungsrhythmusAktiviert ETB-Eintrag Handler Token (Story 6.7) */
  FUEHRUNGSRHYTHMUS_AKTIVIERT_ETB: Symbol('IEventHandler<FuehrungsrhythmusAktiviertEvent>:EtbEintrag'),

  /** NotizErstellt ETB-Eintrag Handler Token (Story 7.1) */
  NOTIZ_ERSTELLT_ETB: Symbol('IEventHandler<NotizErstelltEvent>:EtbEintrag'),

  /** NotizAktualisiert ETB-Eintrag Handler Token (Story 7.3) */
  NOTIZ_AKTUALISIERT_ETB: Symbol('IEventHandler<NotizAktualisiertEvent>:EtbEintrag'),

  /** NotizGeloescht ETB-Eintrag Handler Token (Story 7.4) */
  NOTIZ_GELOESCHT_ETB: Symbol('IEventHandler<NotizGeloeschtEvent>:EtbEintrag'),

  /** KategorieErstellt ETB-Eintrag Handler Token (Story 8.1) */
  KATEGORIE_ERSTELLT_ETB: Symbol('IEventHandler<KategorieErstelltEvent>:EtbEintrag'),

  /** KategorieGeloescht ETB-Eintrag Handler Token (Story 8.1) */
  KATEGORIE_GELOESCHT_ETB: Symbol('IEventHandler<KategorieGeloeschtEvent>:EtbEintrag'),

  /** RolleGeaendert ETB-Eintrag Handler Token (Story 5.4 AC4) */
  ROLLE_GEAENDERT_ETB: Symbol('IEventHandler<RolleGeaendertEvent>:EtbEintrag'),

  /** BefehlErstellt ETB-Eintrag Handler Token (Story 4.3) */
  BEFEHL_ERSTELLT_ETB: Symbol('IEventHandler<BefehlErstelltEvent>:EtbEintrag'),
  /** BefehlQuittiert ETB-Eintrag Handler Token (Story 4.3) */
  BEFEHL_QUITTIERT_ETB: Symbol('IEventHandler<BefehlQuittiertEvent>:EtbEintrag'),

  /** BefehlStatusGeaendert ETB-Eintrag Handler Token */
  BEFEHL_STATUS_GEAENDERT_ETB: Symbol('IEventHandler<BefehlStatusGeaendertEvent>:EtbEintrag'),
  /** BefehlZugestellt ETB-Eintrag Handler Token */
  BEFEHL_ZUGESTELLT_ETB: Symbol('IEventHandler<BefehlZugestelltEvent>:EtbEintrag'),

  /** BefehlAnonymisiert ETB-Eintrag Handler Token (Story 5.5) */
  BEFEHL_ANONYMISIERT_ETB: Symbol('IEventHandler<BefehlAnonymisiertEvent>:EtbEintrag'),
  /** BefehlGeloescht ETB-Eintrag Handler Token (Story 5.5) */
  BEFEHL_GELOESCHT_ETB: Symbol('IEventHandler<BefehlGeloeschtEvent>:EtbEintrag'),

  /** EinsatzCompleted ETB-Lock Handler Token (Issue #581) */
  ETB_EINSATZ_COMPLETED: Symbol('IEventHandler<EinsatzCompletedEvent>:EtbLock'),

  /** GefahrenmatrixAktualisiert ETB-Eintrag Handler Token (Issue #414) */
  GEFAHRENMATRIX_AKTUALISIERT_ETB: Symbol('IEventHandler<GefahrenmatrixAktualisiertEvent>:EtbEintrag'),

  /** EinheitErstellt ETB-Eintrag Handler Token (Issue #411) */
  EINHEIT_ERSTELLT_ETB: Symbol('IEventHandler<EinheitErstelltEvent>:EtbEintrag'),
  /** EinheitStatusGeaendert ETB-Eintrag Handler Token (Issue #411) */
  EINHEIT_STATUS_GEAENDERT_ETB: Symbol('IEventHandler<EinheitStatusGeaendertEvent>:EtbEintrag'),
  /** PersonZuEinheitZugewiesen ETB-Eintrag Handler Token (Issue #411) */
  PERSON_ZU_EINHEIT_ZUGEWIESEN_ETB: Symbol('IEventHandler<PersonZuEinheitZugewiesenEvent>:EtbEintrag'),
  /** PersonVonEinheitEntfernt ETB-Eintrag Handler Token (Issue #411) */
  PERSON_VON_EINHEIT_ENTFERNT_ETB: Symbol('IEventHandler<PersonVonEinheitEntferntEvent>:EtbEintrag'),
  /** FahrzeugEinheitZugewiesen ETB-Eintrag Handler Token (Issue #411) */
  FAHRZEUG_EINHEIT_ZUGEWIESEN_ETB: Symbol('IEventHandler<FahrzeugEinheitZugewiesenEvent>:EtbEintrag'),
  /** NotfallFunkspruchAlert Handler Token (Issue #407) */
  NOTFALL_FUNKSPRUCH_ALERT: Symbol('IEventHandler<EintragAddedEvent>:NotfallFunkspruchAlert'),

  /** FmsStatus → Alarmierung Auto-Population Handler Token (Issue #408) */
  FMS_STATUS_ZU_ALARMIERUNG: Symbol('IEventHandler<FmsStatusGeaendertEvent>:Alarmierung'),

  /** Alarmierung-Erstellt → ETB-Eintrag Handler Token (Issue #408) */
  ALARMIERUNG_ERSTELLT_ZU_ETB: Symbol('IEventHandler<AlarmierungErstelltEvent>:EtbEintrag'),

  /** Alarmierung-Empfänger-Hinzugefügt → ETB-Eintrag Handler Token (Issue #408) */
  ALARMIERUNG_EMPFAENGER_HINZUGEFUEGT_ZU_ETB: Symbol('IEventHandler<AlarmierungEmpfaengerHinzugefuegtEvent>:EtbEintrag'),

  /** Alarmierung-Zeitpunkt-Korrigiert → ETB-Eintrag Handler Token (Issue #408) */
  ALARMIERUNG_ZEITPUNKT_KORRIGIERT_ZU_ETB: Symbol('IEventHandler<AlarmierungZeitpunktKorrigiertEvent>:EtbEintrag'),

  /** Alarmierung-Abgeschlossen → ETB-Eintrag Handler Token (Issue #408) */
  ALARMIERUNG_ABGESCHLOSSEN_ZU_ETB: Symbol('IEventHandler<AlarmierungAbgeschlossenEvent>:EtbEintrag'),

  /* ===== EIGENSCHUTZ EVENT HANDLER TOKENS (Story 1.7 pre-allocated) =====
   *
   * Story 1.7 liefert nur das Event-Registry-Framework (Basisklasse +
   * `EVENT_NAMES.EIGENSCHUTZ`-Namespace + Konsistenz-Spec). DI-Tokens werden
   * bewusst NICHT als Live-Symbols angelegt, da ungenutzte Einträge im
   * Consumer-Validator-Graph Rauschen erzeugen und Epic 2+ Devs eine
   * "halbe" API vortäuschen könnten. Stattdessen hier ein Rezept-Block als
   * Referenz für die nachfolgenden Stories:
   *
   *   GEFAEHRDUNGSBEURTEILUNG_ERSTELLT_PROJECTION: Symbol('IEventHandler<GefaehrdungsbeurteilungErstelltEvent>:AmpelProjection'),
   *   GEFAEHRDUNGSBEURTEILUNG_AKTUALISIERT_PROJECTION: Symbol('IEventHandler<GefaehrdungsbeurteilungAktualisiertEvent>:AmpelProjection'),
   *   PSA_PROFIL_GEAENDERT_WEBSOCKET: Symbol('IEventHandler<PsaProfilGeaendertEvent>:WebSocketBroadcast'),
   *   PSA_PROFIL_GEAENDERT_PUSH: Symbol('IEventHandler<PsaProfilGeaendertEvent>:PushNotification'),
   *   SICHERHEITSREGEL_AUSGERUFEN_WEBSOCKET: Symbol('IEventHandler<SicherheitsregelAusgerufenEvent>:WebSocketBroadcast'),
   *   SICHERHEITSREGEL_QUITTIERT_ETB: Symbol('IEventHandler<SicherheitsregelQuittiertEvent>:EtbEintrag'),
   *   SICHERUNGSPOSTEN_EINGERICHTET_WEBSOCKET: Symbol('IEventHandler<SicherungspostenEingerichtetEvent>:WebSocketBroadcast'),
   *   SICHERUNGSPOSTEN_AKTUALISIERT_WEBSOCKET: Symbol('IEventHandler<SicherungspostenAktualisiertEvent>:WebSocketBroadcast'),
   *   VORFALL_GEMELDET_WEBSOCKET: Symbol('IEventHandler<VorfallGemeldetEvent>:WebSocketBroadcast'),
   *   VORFALL_EXPORTIERT_TELEMETRY: Symbol('IEventHandler<VorfallExportiertEvent>:Telemetry'),
   *   QUITTUNG_ABGEGEBEN_PROJECTION: Symbol('IEventHandler<QuittungAbgegebenEvent>:QuittungsstandProjection'),
   *   LUECKE_GEMELDET_WEBSOCKET: Symbol('IEventHandler<LueckeGemeldetEvent>:WebSocketBroadcast'),
   *   QUITTUNG_UEBERFAELLIG_PUSH: Symbol('IEventHandler<QuittungUeberfaelligEvent>:PushNotification'),
   *   KONFLIKT_ERKANNT_WEBSOCKET: Symbol('IEventHandler<KonfliktErkanntEvent>:WebSocketBroadcast'),
   *   KONFLIKT_AUFGELOEST_WEBSOCKET: Symbol('IEventHandler<KonfliktAufgeloestEvent>:WebSocketBroadcast'),
   *
   * Convention: EIGENSCHUTZ-Token-Namen folgen UPPER_SNAKE_CASE aus
   * `EVENT_NAMES.EIGENSCHUTZ` + "_{Aspect}"-Suffix (PROJECTION, WEBSOCKET,
   * ETB, TELEMETRY, PUSH).
   */

  /* ===== EIGENSCHUTZ → ETB EVENT HANDLER TOKENS (Story 415) ===== */
  /** GefaehrdungsbeurteilungErstellt → ETB-Eintrag */
  EIGENSCHUTZ_GEFAEHRDUNGSBEURTEILUNG_ERSTELLT_ETB: Symbol('IEventHandler<GefaehrdungsbeurteilungErstelltEvent>:EtbEintrag'),
  /** GefaehrdungsbeurteilungAktualisiert → ETB-Eintrag */
  EIGENSCHUTZ_GEFAEHRDUNGSBEURTEILUNG_AKTUALISIERT_ETB: Symbol('IEventHandler<GefaehrdungsbeurteilungAktualisiertEvent>:EtbEintrag'),
  /** SicherheitsregelAusgerufen → ETB-Eintrag (3 Branches: created/updated/deprecated) */
  EIGENSCHUTZ_SICHERHEITSREGEL_AUSGERUFEN_ETB: Symbol('IEventHandler<SicherheitsregelAusgerufenEvent>:EtbEintrag'),
  /** SicherheitsregelQuittiert → ETB-Eintrag */
  EIGENSCHUTZ_SICHERHEITSREGEL_QUITTIERT_ETB: Symbol('IEventHandler<SicherheitsregelQuittiertEvent>:EtbEintrag'),
  /** PsaProfilGeaendert → ETB-Eintrag (2 Branches: AKTIVIERT/DEAKTIVIERT) */
  EIGENSCHUTZ_PSA_PROFIL_GEAENDERT_ETB: Symbol('IEventHandler<PsaProfilGeaendertEvent>:EtbEintrag'),
  /** QuittungAbgegeben → ETB-Eintrag */
  EIGENSCHUTZ_QUITTUNG_ABGEGEBEN_ETB: Symbol('IEventHandler<QuittungAbgegebenEvent>:EtbEintrag'),
  /** LueckeGemeldet → ETB-Eintrag */
  EIGENSCHUTZ_LUECKE_GEMELDET_ETB: Symbol('IEventHandler<LueckeGemeldetEvent>:EtbEintrag'),
  /** QuittungUeberfaellig → ETB-Eintrag (System-Event mit userId === 'SYSTEM') */
  EIGENSCHUTZ_QUITTUNG_UEBERFAELLIG_ETB: Symbol('IEventHandler<QuittungUeberfaelligEvent>:EtbEintrag'),
  /** SicherungspostenEingerichtet → ETB-Eintrag */
  EIGENSCHUTZ_SICHERUNGSPOSTEN_EINGERICHTET_ETB: Symbol('IEventHandler<SicherungspostenEingerichtetEvent>:EtbEintrag'),
  /** SicherungspostenAktualisiert → ETB-Eintrag (2 Branches: aktualisiert/aufgelöst) */
  EIGENSCHUTZ_SICHERUNGSPOSTEN_AKTUALISIERT_ETB: Symbol('IEventHandler<SicherungspostenAktualisiertEvent>:EtbEintrag'),
  /** VorfallGemeldet → ETB-Eintrag */
  EIGENSCHUTZ_VORFALL_GEMELDET_ETB: Symbol('IEventHandler<VorfallGemeldetEvent>:EtbEintrag'),
  /** VorfallExportiert → ETB-Eintrag (Audit-Spur Story 5.6) */
  EIGENSCHUTZ_VORFALL_EXPORTIERT_ETB: Symbol('IEventHandler<VorfallExportiertEvent>:EtbEintrag'),
  /** KonfliktErkannt → ETB-Eintrag (System-Event, Story 3.9) */
  EIGENSCHUTZ_KONFLIKT_ERKANNT_ETB: Symbol('IEventHandler<KonfliktErkanntEvent>:EtbEintrag'),
  /** KonfliktAufgeloest → ETB-Eintrag (Dokumentation, Story 3.10) */
  EIGENSCHUTZ_KONFLIKT_AUFGELOEST_ETB: Symbol('IEventHandler<KonfliktAufgeloestEvent>:EtbEintrag'),
} as const;

/**
 * Integration Tokens für externe Dienste (Story 7-1).
 *
 * Tokens für Ports und Repositories der HiOrg-Server Integration.
 *
 * **WARUM nested Object:**
 * - Namespacing: Integration-Modul hat mehrere zusammenhängende Services
 * - Zukunftssicher: Weitere Integrationen können hinzugefügt werden
 * - Trennung: Klar getrennt von KRAEFTE_REPOSITORIES
 */
export const INTEGRATIONS = {
  /** Port Token für IEncryptionPort (AES-256-GCM) */
  ENCRYPTION_PORT: Symbol('IEncryptionPort'),
  /** Port Token für IHiOrgServerPort (API Client) */
  HIORG_SERVER_PORT: Symbol('IHiOrgServerPort'),
  /** Repository Token für IIntegrationCredentialRepository */
  CREDENTIAL_REPOSITORY: Symbol('IIntegrationCredentialRepository'),
  /** Port Token für IOAuth2Port (OAuth2 Authorization Code Flow mit PKCE) */
  OAUTH2_PORT: Symbol('IOAuth2Port'),
  /** Repository Token für IOAuth2StateRepository (PKCE State Speicherung) */
  OAUTH2_STATE_REPOSITORY: Symbol('IOAuth2StateRepository'),
  /** Port Token für IHiOrgOAuthConfigPort (OAuth2 Client Credentials) */
  HIORG_OAUTH_CONFIG_PORT: Symbol('IHiOrgOAuthConfigPort'),
  /** Repository Token für IQualifikationMappingRepository (Story 7-2) */
  QUALIFIKATION_MAPPING_REPOSITORY: Symbol('IQualifikationMappingRepository'),
} as const;

/**
 * Geo-Service Tokens für PLZ-Lookup und Geocoding Ports.
 *
 * **Verwendung:**
 * ```typescript
 * @Inject(GEO_PORTS.PLZ_LOOKUP) private readonly plzLookup: IPlzLookupPort
 * ```
 */
export const GEO_PORTS = {
  /** Port Token für IPlzLookupPort (zippopotam.us Adapter) */
  PLZ_LOOKUP: Symbol('IPlzLookupPort'),
  /** Port Token für IAddressSuchePort (Photon/Komoot Adapter) */
  ADDRESS_SUCHE: Symbol('IAddressSuchePort'),
} as const;

/**
 * Resilience Tokens fuer Circuit Breaker Services (Story 5.3).
 *
 * **Verwendung:**
 * ```typescript
 * @Inject(RESILIENCE.CIRCUIT_BREAKER) private readonly circuitBreaker: CircuitBreakerService
 * ```
 */
export const RESILIENCE = {
  /** Service Token fuer CircuitBreakerService */
  CIRCUIT_BREAKER: Symbol('CircuitBreakerService'),
} as const;

/**
 * Metrics Tokens fuer Prometheus Metriken (Story 5.6).
 *
 * **Verwendung:**
 * ```typescript
 * @Inject(METRICS.REGISTRY) private readonly registry: Registry
 * @Inject(METRICS.HTTP_REQUEST_DURATION) private readonly histogram: Histogram
 * ```
 */
export const METRICS = {
  /** Prometheus Registry */
  REGISTRY: Symbol('PrometheusRegistry'),
  /** HTTP Request Duration Histogram */
  HTTP_REQUEST_DURATION: Symbol('HttpRequestDurationHistogram'),
  /** WebSocket Active Connections Gauge */
  WS_CONNECTIONS: Symbol('WebSocketConnectionsGauge'),
  /** Outbox Queue Depth Gauge */
  OUTBOX_QUEUE_DEPTH: Symbol('OutboxQueueDepthGauge'),
  /**
   * Histogram für End-to-End-Latenz `assess_started → all_banners_delivered`
   * (Story 3.11 AC4 / NFR-P1: Ziel-Fenster ≤ 90 s als explizite Bucket-Grenze).
   */
  EIGENSCHUTZ_PSA_PROPAGATION_DURATION: Symbol('EigenschutzPsaPropagationDurationHistogram'),
  /**
   * Histogram für Latenz `all_banners_delivered → psa_quittung_abgegeben`
   * (Story 3.11 AC4). Niedrig-kardinal (`einheit_id_bucket: 'present' | 'absent'`).
   */
  EIGENSCHUTZ_QUITTUNG_LATENCY: Symbol('EigenschutzQuittungLatencyHistogram'),
  /**
   * Counter für Blind-Acknowledgments (Quittung < 2 s nach Banner-Öffnen,
   * Story 3.11 AC4 + AC10). Coaching-Signal pro Einheit.
   */
  EIGENSCHUTZ_BLIND_ACK_TOTAL: Symbol('EigenschutzBlindAckTotalCounter'),
} as const;

/**
 * Monitoring Tokens fuer System-Monitoring (Story 5.6).
 *
 * **Verwendung:**
 * ```typescript
 * @Inject(MONITORING.METRICS_COLLECTOR) private readonly collector: IMetricsCollector
 * @Inject(MONITORING.GATEWAY) private readonly gateway: MonitoringGateway
 * ```
 */
export const MONITORING = {
  /** Port Token fuer IMetricsCollector */
  METRICS_COLLECTOR: Symbol('IMetricsCollector'),
  /** Gateway Token fuer MonitoringGateway */
  GATEWAY: Symbol('MonitoringGateway'),
} as const;

/** Repository Token für ITaktischesZeichenRepository (Issue #636) */
export const TAKTISCHE_ZEICHEN_REPOSITORY = Symbol('ITaktischesZeichenRepository');

/**
 * Repository-Token für `PatientRepository` (Story 1.1, Issue #417).
 *
 * Wird vom Infrastructure-Module `PatientenInfrastructureModule` als
 * `useClass: PatientRepositoryAdapter` provided und von Application-Handlern
 * (Stories 1.2 ff.) via `@Inject(PATIENT_REPOSITORY)` konsumiert.
 */
export const PATIENT_REPOSITORY = Symbol('PatientRepository');

/**
 * Eigenschutz-Gefährdungsbeurteilung Repository Tokens (Story 2.1).
 *
 * Trennung in drei Repositories (Haupt-Aggregate, Version-Chain, Vorlagen),
 * damit Application-Handler gezielt nur die benötigten Ports injizieren
 * (z. B. nutzt der Read-Query für Vorlagen nur den Vorlagen-Port).
 */
export const GEFAEHRDUNGSBEURTEILUNG_REPOSITORY = Symbol('IGefaehrdungsbeurteilungRepository');
export const GEFAEHRDUNGSBEURTEILUNG_VERSION_REPOSITORY = Symbol('IGefaehrdungsbeurteilungVersionRepository');
export const GEFAEHRDUNGSBEURTEILUNG_VORLAGE_REPOSITORY = Symbol('IGefaehrdungsbeurteilungVorlageRepository');

/**
 * Eigenschutz-Sicherheitsregel Repository Tokens (Story 2.6).
 *
 * Trennung in zwei Repositories (Haupt-Aggregate + Version-Chain), analog zu
 * GEFAEHRDUNGSBEURTEILUNG_*. Handler injizieren gezielt nur die benötigten
 * Ports. Die Quittungs-Repositories (Story 2.7) kommen separat dazu.
 */
export const SICHERHEITSREGEL_REPOSITORY = Symbol('ISicherheitsregelRepository');
export const SICHERHEITSREGEL_VERSION_REPOSITORY = Symbol('ISicherheitsregelVersionRepository');
/**
 * DI-Token für `ISicherheitsregelQuittungRepository` (Story 2.7).
 *
 * Wird vom `AckSicherheitsregelHandler` (Application) und der Quittungs-
 * Liste-Query injiziert. Die Implementierung im Infrastructure-Layer ist
 * `PrismaSicherheitsregelQuittungRepository`.
 */
export const SICHERHEITSREGEL_QUITTUNG_REPOSITORY = Symbol('ISicherheitsregelQuittungRepository');

/**
 * Repository Token für `IPsaProfilZuweisungRepository` (Story 3.1).
 *
 * Wird vom `ChangePsaProfilHandler` (Application) injiziert. Die
 * Implementierung im Infrastructure-Layer ist
 * `PrismaPsaProfilZuweisungRepository`.
 */
export const PSA_PROFIL_ZUWEISUNG_REPOSITORY = Symbol('IPsaProfilZuweisungRepository');

/**
 * Repository Token für `IPsaProfilQuittungRepository` (Story 3.4).
 *
 * Wird vom `AckPsaQuittungHandler` (Application) und den Quittungs-Listen-
 * Queries injiziert. Die Implementierung im Infrastructure-Layer ist
 * `PrismaPsaProfilQuittungRepository`.
 */
export const PSA_PROFIL_QUITTUNG_REPOSITORY = Symbol('IPsaProfilQuittungRepository');

/**
 * Repository Token für `IAmpelProjectionRepository` (Story 6.1).
 *
 * Hält das materialisierte Ampel-Read-Model pro `(einsatzId, einheitId)`
 * aktuell. Implementierung im Infrastructure-Layer:
 * `PrismaAmpelProjectionRepository`.
 */
export const AMPEL_PROJECTION_REPOSITORY = Symbol('IAmpelProjectionRepository');

/**
 * Read-Port-Token für `IAmpelWarnBadgeReadPort` (Story 6.5).
 *
 * Liefert konkrete Warn-Badge-Kandidaten für Dashboard-Klickziele, ohne das
 * schnelle `AmpelProjection`-Read-Model um Badge-JSON zu erweitern.
 * Implementierung im Infrastructure-Layer: `PrismaAmpelWarnBadgeReadRepository`.
 */
export const AMPEL_WARN_BADGE_READ_PORT = Symbol('IAmpelWarnBadgeReadPort');

/**
 * Repository Token für `ISyncConflictRepository` (Story 3.9).
 *
 * Wird vom `ReportSyncConflictHandler` injiziert, um Konflikt-Rows in
 * `sync_conflicts` idempotent zu persistieren (Idempotenz-Schlüssel:
 * `einsatzId + entityId + localExpectedVersion + reportedByUserId`,
 * resolvedAt IS NULL — Tab-Reload-Schutz).
 *
 * Implementierung im Infrastructure-Layer:
 * `PrismaSyncConflictRepository`.
 */
export const SYNC_CONFLICT_REPOSITORY = Symbol('ISyncConflictRepository');

/**
 * Repository Token für `IEigenschutzTelemetryRepository` (Story 3.11).
 *
 * Wird vom `TelemetryIngestService` injiziert, um Telemetrie-Batches
 * (1–50 Events) atomar in `eigenschutz_telemetry_events` zu persistieren.
 * Implementierung im Infrastructure-Layer:
 * `PrismaEigenschutzTelemetryRepository`.
 */
export const EIGENSCHUTZ_TELEMETRY_REPOSITORY = Symbol('IEigenschutzTelemetryRepository');

/**
 * Eigenschutz-Sicherungsposten Repository Tokens (Story 4.1).
 *
 * Aufteilung in Haupt-Aggregate + Versions-Chain analog zur Gefährdungs-
 * beurteilung. Application-Handler injizieren gezielt nur die nötigen Ports.
 */
export const SICHERUNGSPOSTEN_REPOSITORY = Symbol('ISicherungspostenRepository');
export const SICHERUNGSPOSTEN_VERSION_REPOSITORY = Symbol('ISicherungspostenVersionRepository');

/**
 * Eigenschutz-Vorfall Repository Token (Story 5.1, FR31/FR32).
 *
 * Append-only-Aggregat — Application-Handler injizieren den Port für Insert
 * (`save`) sowie Lese-Pfade (`findById`, `existsInEinsatz`). Story 5.2 (Snapshot-
 * Builder) und 5.3+ (Listen-Endpoints) erweitern den Port bei Bedarf.
 */
export const EIGENSCHUTZ_VORFALL_REPOSITORY = Symbol('IEigenschutzVorfallRepository');

/**
 * Eigenschutz-Vorfall PDF-Renderer Token (Story 5.4, FR34/AR13).
 *
 * Bindet `IEigenschutzVorfallPdfRenderer` an die pdfkit-Implementierung im
 * Infrastructure-Layer (`EigenschutzVorfallPdfRenderer`). Self-contained —
 * der Renderer arbeitet ausschließlich auf dem Aggregate-Snapshot.
 */
export const EIGENSCHUTZ_VORFALL_PDF_RENDERER = Symbol('IEigenschutzVorfallPdfRenderer');

/**
 * Eigenschutz-Vorfall JSON-Renderer Token (Story 5.5, FR35).
 *
 * Bindet `IEigenschutzVorfallJsonRenderer` an die Implementierung im
 * Infrastructure-Layer (`EigenschutzVorfallJsonRenderer`). Self-contained —
 * der Renderer arbeitet ausschließlich auf dem Aggregate-Snapshot.
 */
export const EIGENSCHUTZ_VORFALL_JSON_RENDERER = Symbol('IEigenschutzVorfallJsonRenderer');

/**
 * Query-Port-Token für `IPsaPropagationOverdueQueryPort` (Story 3.7 AC2).
 *
 * Wird vom `RepromptPsaQuittungScheduler` injiziert, um überfällige PSA-
 * Bekanntgaben (`PsaProfilGeaendert` ohne `PsaProfilQuittung`,
 * `occurredAt < threshold`, idempotent ggü. bereits emittierten
 * `QuittungUeberfaellig`-Events) zu finden. Implementierung im Infrastructure-
 * Layer: `PrismaPsaPropagationOverdueQueryRepository`.
 */
export const PSA_PROPAGATION_OVERDUE_QUERY = Symbol('IPsaPropagationOverdueQueryPort');

/**
 * Read-Repository Token für `IPsaProfilZuweisungReadRepository` (Story 3.1).
 *
 * Liefert Read-Model-Rows der aktiven PSA-Profile einer Einheit für die
 * GET-Endpoints im Controller. Trennt Read- vom Aggregate-Pfad
 * (Lesson L5 aus Story 2.4).
 */
export const PSA_PROFIL_ZUWEISUNG_READ_REPOSITORY = Symbol('IPsaProfilZuweisungReadRepository');

/** Repository Token für IDefaultZeichenRepository (Issue #668) */
export const DEFAULT_ZEICHEN_REPOSITORY = Symbol('IDefaultZeichenRepository');

/** Repository Token für IZeichenKatalogRepository (Issue #636) */
export const ZEICHEN_KATALOG_REPOSITORY = Symbol('IZeichenKatalogRepository');

/**
 * Funkkanal Tokens (Issue #407).
 *
 * REPOSITORY — IFunkkanalRepository Port
 * MAPPER — PrismaFunkkanalMapper (stateless, wird i.d.R. nicht via DI gelöst)
 * KANALPLAN_PDF_SERVICE — Task 23 (PDF-Export)
 * EINSATZ_EVENT_PUBLISHER — WebSocket-Broadcast für den Einsatz-Room (Task 18)
 */
export const FUNKKANAL_TOKENS = {
  REPOSITORY: Symbol('IFunkkanalRepository'),
  MAPPER: Symbol('FunkkanalPrismaMapper'),
  KANALPLAN_PDF_SERVICE: Symbol('KanalplanPdfService'),
  EINSATZ_EVENT_PUBLISHER: Symbol('IEinsatzEventPublisher'),
} as const;

/**
 * Alarmierung Tokens (Issue #408).
 *
 * REPOSITORY — IAlarmierungRepository Port
 */
export const ALARMIERUNG_TOKENS = {
  REPOSITORY: Symbol('IAlarmierungRepository'),
} as const;

/** Flache Re-Exports analog zum bestehenden Muster (z.B. ETB_REPOSITORY). */
export const ALARMIERUNG_REPOSITORY = ALARMIERUNG_TOKENS.REPOSITORY;

/** Flache Re-Exports analog zum bestehenden Muster (z.B. ETB_REPOSITORY). */
export const FUNKKANAL_REPOSITORY = FUNKKANAL_TOKENS.REPOSITORY;
export const KANALPLAN_PDF_SERVICE = FUNKKANAL_TOKENS.KANALPLAN_PDF_SERVICE;
export const EINSATZ_EVENT_PUBLISHER = FUNKKANAL_TOKENS.EINSATZ_EVENT_PUBLISHER;

/**
 * Alias für konsistente Verwendung in Application Layer.
 *
 * **Verwendung:**
 * ```typescript
 * @Inject(DI_TOKENS.REPOSITORIES.QUALIFIKATION)
 * ```
 */
export const DI_TOKENS = {
  REPOSITORIES: KRAEFTE_REPOSITORIES,
} as const;
