import { PrismaModule } from '@/prisma/prisma.module';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { EinsatzApplicationModule } from '@/application/einsatz/einsatz-application.module';
import { EinsatzController } from './einsatz.controller';
import { EinsatzRepository } from './einsatz.repository';
import { EinsatzService } from './einsatz.service';

/**
 * Einsatz-Modul für die Verwaltung von Einsätzen
 *
 * Features:
 * - CRUD-Operationen für Einsätze
 * - Automatische Namengenerierung
 * - Vollständigkeitsberechnung
 * - Event-basierte Kommunikation mit anderen Modulen
 * - REST API mit Swagger-Dokumentation
 *
 * @remarks
 * Die Kommunikation mit anderen Modulen (z.B. ETB) erfolgt
 * über Domain-Events (EinsatzErstelltEvent), um zyklische
 * Abhängigkeiten zu vermeiden.
 */
@Module({
  imports: [CqrsModule, PrismaModule, EinsatzApplicationModule],
  controllers: [EinsatzController],
  providers: [EinsatzService, EinsatzRepository],
  exports: [EinsatzService],
})
export class EinsatzModule {}
