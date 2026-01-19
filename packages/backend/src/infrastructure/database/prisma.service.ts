import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
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
  constructor() {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
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
  get einsatzTeilnehmer() {
    return this._client.einsatzTeilnehmer;
  }
  get erinnerung() {
    return this._client.erinnerung;
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
  $queryRaw(...args: Parameters<BasePrismaClient['$queryRaw']>): ReturnType<BasePrismaClient['$queryRaw']> {
    return this._client.$queryRaw(...args);
  }
  $executeRaw(...args: Parameters<BasePrismaClient['$executeRaw']>): ReturnType<BasePrismaClient['$executeRaw']> {
    return this._client.$executeRaw(...args);
  }
  $queryRawUnsafe(...args: Parameters<BasePrismaClient['$queryRawUnsafe']>): ReturnType<BasePrismaClient['$queryRawUnsafe']> {
    return this._client.$queryRawUnsafe(...args);
  }
  $executeRawUnsafe(...args: Parameters<BasePrismaClient['$executeRawUnsafe']>): ReturnType<BasePrismaClient['$executeRawUnsafe']> {
    return this._client.$executeRawUnsafe(...args);
  }
}
