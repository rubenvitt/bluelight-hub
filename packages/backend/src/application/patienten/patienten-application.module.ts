import { Module } from '@nestjs/common';
import { PatientenInfrastructureModule } from '@/infrastructure/patienten/patienten-infrastructure.module';
import { OutboxModule } from '@/infrastructure/outbox/outbox.module';
import { EtbInfrastructureModule } from '@/infrastructure/etb/etb-infrastructure.module';
import { AktualisiereSichtungHandler } from './commands/aktualisiere-sichtung/aktualisiere-sichtung.handler';
import { ErfassePatientHandler } from './commands/erfasse-patient/erfasse-patient.handler';
import { PatientMapper } from './mappers/patient.mapper';

/**
 * Application-Module für die Patienten-Domain (Story 1.2/1.3).
 *
 * Exportiert die Use-Case-Handler, damit der `PatientenController`
 * (Modules-Layer) sie via Constructor-Injection nutzen kann.
 */
@Module({
  imports: [
    PatientenInfrastructureModule, // PATIENT_REPOSITORY
    EtbInfrastructureModule, // ETB_REPOSITORY (für ETB-Auto-Create + Eintrag)
    OutboxModule, // OUTBOX_REPOSITORY + EventSerializer
  ],
  providers: [ErfassePatientHandler, AktualisiereSichtungHandler, PatientMapper],
  exports: [ErfassePatientHandler, AktualisiereSichtungHandler, PatientMapper],
})
export class PatientenApplicationModule {}
