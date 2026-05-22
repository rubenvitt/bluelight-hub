// @ts-nocheck
import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

/**
 * Basistyp für den generierten Prisma Client
 * Wird verwendet um den Typ für Composition zu definieren
 */
type BasePrismaClient = InstanceType<typeof PrismaClient>;

/**
 * Service für Prisma-Datenbankoperationen mit Prisma v7 Adapter-Pattern
 *
 * Diese Klasse verwendet Composition um den generierten Prisma Client
 * in den NestJS-Lebenszyklus zu integrieren. Sie verwaltet automatisch die
 * Datenbankverbindung und stellt typsichere Methoden für alle
 * Datenbankoperationen bereit.
 *
 * Ab Prisma v7 wird das Adapter-Pattern verwendet, um eine direkte
 * TCP-Verbindung zur PostgreSQL-Datenbank herzustellen. Der PrismaPg-Adapter
 * ersetzt das bisherige Query-Engine-Modell und bietet verbesserte
 * Performance durch direkten Datenbankzugriff.
 *
 * Features:
 * - Direkte TCP-Verbindung via @prisma/adapter-pg
 * - Automatische Verbindungsverwaltung
 * - Integration in NestJS-Lebenszyklus
 * - Typsichere Datenbankoperationen
 * - Connection-Pooling durch pg-Pool
 *
 * @class PrismaService
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly _client: BasePrismaClient;

  /**
   * Erstellt eine neue PrismaService-Instanz mit dem PrismaPg-Adapter
   *
   * Der Adapter wird mit der DATABASE_URL aus den Umgebungsvariablen
   * initialisiert und ermöglicht eine direkte TCP-Verbindung zur
   * PostgreSQL-Datenbank ohne die Prisma Query Engine.
   */
  constructor(private readonly configService: ConfigService) {
    const databaseUrl = this.configService.getOrThrow<string>('DATABASE_URL');
    const adapter = new PrismaPg({ connectionString: databaseUrl });
    this._client = new PrismaClient({ adapter });
  }

  /**
   * Initialisiert die Datenbankverbindung beim Starten des Moduls
   */
  async onModuleInit() {
    await this._client.$connect();
  }

  /**
   * Schließt die Datenbankverbindung beim Beenden des Moduls
   */
  async onModuleDestroy() {
    await this._client.$disconnect();
  }

  // Delegate all model accessors to the underlying client
  get user() {
    return this._client.user;
  }
  get einsatz() {
    return this._client.einsatz;
  }
  get einsatztagebuch() {
    return this._client.einsatztagebuch;
  }
  get etbEintrag() {
    return this._client.etbEintrag;
  }
  get etbEintragHistorie() {
    return this._client.etbEintragHistorie;
  }
  get etbTextbaustein() {
    return this._client.etbTextbaustein;
  }
  get etbSnapshot() {
    return this._client.etbSnapshot;
  }
  get etbArchiv() {
    return this._client.etbArchiv;
  }
  get lagekarte() {
    return this._client.lagekarte;
  }
  get outboxEvent() {
    return this._client.outboxEvent;
  }
  get lagekartePoi() {
    return this._client.lagekartePoi;
  }
  get qualifikation() {
    return this._client.qualifikation;
  }
  get fahrzeugtyp() {
    return this._client.fahrzeugtyp;
  }
  get rollenDefinition() {
    return this._client.rollenDefinition;
  }
  get rolleQualifikation() {
    return this._client.rolleQualifikation;
  }
  get funkStatusConfig() {
    return this._client.funkStatusConfig;
  }
  get stammFahrzeug() {
    return this._client.stammFahrzeug;
  }
  get stammPerson() {
    return this._client.stammPerson;
  }
  get stammPersonQualifikation() {
    return this._client.stammPersonQualifikation;
  }
  get einsatzFahrzeug() {
    return this._client.einsatzFahrzeug;
  }
  get einsatzPerson() {
    return this._client.einsatzPerson;
  }
  get einsatzPersonQualifikation() {
    return this._client.einsatzPersonQualifikation;
  }
  get einsatzRollenbesetzung() {
    return this._client.einsatzRollenbesetzung;
  }
  get einsatzRollenzuweisung() {
    return this._client.einsatzRollenzuweisung;
  }
  get integrationCredential() {
    return this._client.integrationCredential;
  }
  get oAuth2State() {
    return this._client.oAuth2State;
  }
  get qualifikationMapping() {
    return this._client.qualifikationMapping;
  }
  get serverAccessToken() {
    return this._client.serverAccessToken;
  }
  get inviteCode() {
    return this._client.inviteCode;
  }
  get serverConfig() {
    return this._client.serverConfig;
  }
  get appConfig() {
    return this._client.appConfig;
  }
  get appConfigSecret() {
    return this._client.appConfigSecret;
  }
  get einsatzTeilnehmer() {
    return this._client.einsatzTeilnehmer;
  }
  get erinnerung() {
    return this._client.erinnerung;
  }
  get erinnerungKonfiguration() {
    return this._client.erinnerungKonfiguration;
  }
  get erinnerungsvorlage() {
    return this._client.erinnerungsvorlage;
  }
  get fuehrungsrhythmusTemplate() {
    return this._client.fuehrungsrhythmusTemplate;
  }
  get fuehrungsrhythmusEintrag() {
    return this._client.fuehrungsrhythmusEintrag;
  }
  get notiz() {
    return this._client.notiz;
  }
  get kategorie() {
    return this._client.kategorie;
  }
  get befehl() {
    return this._client.befehl;
  }
  get befehlEmpfaenger() {
    return this._client.befehlEmpfaenger;
  }
  get befehlKommentar() {
    return this._client.befehlKommentar;
  }
  get aufbewahrungsKonfiguration() {
    return this._client.aufbewahrungsKonfiguration;
  }
  get complianceReport() {
    return this._client.complianceReport;
  }
  get befehlsgeberVorschlag() {
    return this._client.befehlsgeberVorschlag;
  }
  get einsatzBeitrittsanfrage() {
    return this._client.einsatzBeitrittsanfrage;
  }
  get einsatzEinheit() {
    return this._client.einsatzEinheit;
  }
  get einsatzPersonEinheit() {
    return this._client.einsatzPersonEinheit;
  }
  get gefahrenmatrixBewertung() {
    return this._client.gefahrenmatrixBewertung;
  }
  get gefahrenzone() {
    return this._client.gefahrenzone;
  }
  get fahrzeugtypZeichenDefault() {
    return this._client.fahrzeugtypZeichenDefault;
  }
  get einheitentypZeichenDefault() {
    return this._client.einheitentypZeichenDefault;
  }
  get taktischesZeichen() {
    return this._client.taktischesZeichen;
  }
  get zeichenKatalogEintrag() {
    return this._client.zeichenKatalogEintrag;
  }
  get funkkanal() {
    return this._client.funkkanal;
  }
  get funkkanalZuordnung() {
    return this._client.funkkanalZuordnung;
  }
  get alarmierung() {
    return this._client.alarmierung;
  }
  get alarmierungEmpfaenger() {
    return this._client.alarmierungEmpfaenger;
  }
  get pushSubscription() {
    return this._client.pushSubscription;
  }
  get gefaehrdungsbeurteilung() {
    return this._client.gefaehrdungsbeurteilung;
  }
  get gefaehrdungsbeurteilungVersion() {
    return this._client.gefaehrdungsbeurteilungVersion;
  }
  get gefaehrdungsbeurteilungVorlage() {
    return this._client.gefaehrdungsbeurteilungVorlage;
  }
  get sicherheitsregel() {
    return this._client.sicherheitsregel;
  }
  get sicherheitsregelVersion() {
    return this._client.sicherheitsregelVersion;
  }
  get sicherheitsregelQuittung() {
    return this._client.sicherheitsregelQuittung;
  }
  get psaProfilZuweisung() {
    return this._client.psaProfilZuweisung;
  }
  get psaProfilQuittung() {
    return this._client.psaProfilQuittung;
  }
  get syncConflict() {
    return this._client.syncConflict;
  }
  get eigenschutzTelemetryEvent() {
    return this._client.eigenschutzTelemetryEvent;
  }
  get sicherungsposten() {
    return this._client.sicherungsposten;
  }
  get sicherungspostenVersion() {
    return this._client.sicherungspostenVersion;
  }
  get eigenschutzVorfall() {
    return this._client.eigenschutzVorfall;
  }
  get ampelProjection() {
    return this._client.ampelProjection;
  }
  get patient() {
    return this._client.patient;
  }
  get patientEvent() {
    return this._client.patientEvent;
  }

  // Delegate Prisma Client methods
  $connect() {
    return this._client.$connect();
  }
  $disconnect() {
    return this._client.$disconnect();
  }
  $transaction(...args: Parameters<BasePrismaClient['$transaction']>): ReturnType<BasePrismaClient['$transaction']> {
    return this._client.$transaction(...args);
  }
  get $queryRaw() {
    return this._client.$queryRaw.bind(this._client);
  }
  get $executeRaw() {
    return this._client.$executeRaw.bind(this._client);
  }
  get $queryRawUnsafe() {
    return this._client.$queryRawUnsafe.bind(this._client);
  }
  get $executeRawUnsafe() {
    return this._client.$executeRawUnsafe.bind(this._client);
  }
}
