import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Globales Modul für Prisma ORM Integration
 *
 * Dieses Modul stellt den PrismaService als globalen Provider bereit,
 * der von allen anderen Modulen ohne expliziten Import genutzt werden kann.
 * Es kapselt die Datenbankverbindung und bietet typsichere
 * Datenbankoperationen über den generierten Prisma Client.
 *
 * Features:
 * - Zentrale Datenbankverbindungsverwaltung
 * - Typsichere Queries durch Prisma Client
 * - Automatisches Connection-Pooling
 * - Global verfügbar ohne Re-Import
 *
 * @module PrismaModule
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
