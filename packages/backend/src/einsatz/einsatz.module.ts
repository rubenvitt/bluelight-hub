import { PrismaModule } from '@/prisma/prisma.module';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { EinsatzApplicationModule } from '@/application/einsatz/einsatz-application.module';
import { EinsatzInfrastructureModule } from '@/infrastructure/einsatz/einsatz-infrastructure.module';
import { EinsatzController } from './einsatz.controller';

/**
 * Einsatz-Modul für die Verwaltung von Einsätzen (Hexagonal Architecture)
 *
 * Features:
 * - CQRS Command/Query Handlers für alle Operationen
 * - Automatische Namengenerierung (via Utilities)
 * - Vollständigkeitsberechnung (via Query Handlers)
 * - Event-basierte Kommunikation (Domain Events)
 * - REST API mit Swagger-Dokumentation
 *
 * **Architektur (Story 5-1):**
 * - Controller nutzt ausschließlich CommandBus/QueryBus
 * - Alle Business-Logik in Application Layer (EinsatzApplicationModule)
 * - Infrastructure via EinsatzInfrastructureModule (Repositories)
 *
 * @remarks
 * Die Kommunikation mit anderen Modulen erfolgt über
 * Domain-Events (Transactional Outbox Pattern).
 */
@Module({
  imports: [CqrsModule, PrismaModule, EinsatzApplicationModule, EinsatzInfrastructureModule],
  controllers: [EinsatzController],
  providers: [],
  exports: [],
})
export class EinsatzModule {}
