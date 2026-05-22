import { Module } from '@nestjs/common';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { OutboxModule } from '@/infrastructure/outbox/outbox.module';
import { PATIENT_REPOSITORY } from '@/infrastructure/di-tokens';
import { PatientRepositoryAdapter } from './patient-repository.adapter';

/**
 * Infrastructure-Module für die Patienten-Domain (Story 1.1, Issue #417).
 *
 * Stellt den `PatientRepository`-Adapter als `PATIENT_REPOSITORY` zur Verfuegung.
 * Application- und Modules-Layer importieren dieses Modul für den
 * Erfassen-Use-Case und den Controller.
 *
 * Story 1.2 verdrahtet zusätzlich den `EventSerializer` aus dem `OutboxModule`,
 * damit das Repository Domain-Events binärgleich zur Outbox-Pipeline in die
 * `PatientEvent`-Tabelle schreiben kann (Architecture §D-6, DRY).
 */
@Module({
  imports: [PrismaModule, OutboxModule],
  providers: [
    {
      provide: PATIENT_REPOSITORY,
      useClass: PatientRepositoryAdapter,
    },
  ],
  exports: [PATIENT_REPOSITORY],
})
export class PatientenInfrastructureModule {}
