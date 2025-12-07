import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Service für Prisma-Datenbankoperationen
 *
 * Diese Klasse erweitert den generierten Prisma Client und integriert
 * ihn in den NestJS-Lebenszyklus. Sie verwaltet automatisch die
 * Datenbankverbindung und stellt typsichere Methoden für alle
 * Datenbankoperationen bereit.
 *
 * Features:
 * - Automatische Verbindungsverwaltung
 * - Integration in NestJS-Lebenszyklus
 * - Typsichere Datenbankoperationen
 * - Connection-Pooling und Retry-Logik
 *
 * @class PrismaService
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  /**
   * Initialisiert die Datenbankverbindung beim Starten des Moduls
   */
  async onModuleInit() {
    await this.$connect();
  }

  /**
   * Schließt die Datenbankverbindung beim Beenden des Moduls
   */
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
