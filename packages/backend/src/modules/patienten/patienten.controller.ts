import { Body, Controller, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiWrappedCreatedResponse, ApiWrappedResponse } from '@/modules/common/decorators/api-wrapped-response.decorator';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { EinsatzParam } from '@/modules/auth/decorators/einsatz-param.decorator';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { EinsatzScopeGuard } from '@/modules/auth/guards/einsatz-scope.guard';
import type { ValidatedUser } from '@/modules/auth/strategies/jwt.strategy';
import { AktualisiereSichtungCommand } from '@/application/patienten/commands/aktualisiere-sichtung/aktualisiere-sichtung.command';
import { AktualisiereSichtungHandler } from '@/application/patienten/commands/aktualisiere-sichtung/aktualisiere-sichtung.handler';
import { ErfassePatientCommand } from '@/application/patienten/commands/erfasse-patient/erfasse-patient.command';
import { ErfassePatientHandler } from '@/application/patienten/commands/erfasse-patient/erfasse-patient.handler';
import { AktualisiereSichtungDto } from '@/application/patienten/dto/aktualisiere-sichtung.dto';
import { ErfassePatientDto } from '@/application/patienten/dto/erfasse-patient.dto';
import { PatientDto } from '@/application/patienten/dto/patient.dto';
import { mapErrorToHttp } from './errors/error-to-http';

/**
 * HTTP-Endpoint für Patient-Erfassung im Einsatz (Story 1.2).
 *
 * **Auth:** Nutzer muss authentifiziert (`JwtAuthGuard`) UND dem `einsatzId`
 * zugeordnet sein (`EinsatzScopeGuard`, gespeist über `@EinsatzParam`).
 *
 * **Response-Vertrag:** `@ApiWrappedCreatedResponse` produziert die Wrapper-Shape
 * `{ data: PatientDto, meta }` — die Standard-Swagger-Response-Decorators sind
 * hier laut CLAUDE.md AC7 explizit verboten (bricht API-Client-Generation).
 */
@Controller('api/v1/einsaetze/:einsatzId/patienten')
@ApiTags('Patienten')
@UseGuards(JwtAuthGuard, EinsatzScopeGuard)
@EinsatzParam('einsatzId')
export class PatientenController {
  constructor(
    private readonly erfassePatientHandler: ErfassePatientHandler,
    private readonly aktualisiereSichtungHandler: AktualisiereSichtungHandler,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiWrappedCreatedResponse(PatientDto, {
    description: 'Patient erfasst — Snapshot + ETB-Eintrag + Outbox-Event sind in einer Transaktion persistiert.',
  })
  async erfassePatient(@Param('einsatzId') einsatzId: string, @Body() dto: ErfassePatientDto, @CurrentUser() user: ValidatedUser): Promise<{ data: PatientDto }> {
    const command = new ErfassePatientCommand({
      einsatzId,
      initialeSk: dto.initialeSk,
      diviVakNummer: dto.diviVakNummer,
      notiz: dto.notiz,
      clockDriftSeconds: dto.clockDriftSeconds,
      erfasserRef: { type: 'user', userId: user.userId },
    });

    const result = await this.erfassePatientHandler.execute(command);
    if (result.isFailure) {
      throw mapErrorToHttp(result.error);
    }
    return { data: result.value! };
  }

  /**
   * Reevaluierung der Sichtungs-Kategorie eines bereits erfassten Patienten
   * (Story 1.3, FR17). Aktualisiert in einer einzigen Prisma-Transaktion:
   * PatientEvent + denormalisierter Snapshot + ETB-Eintrag + Outbox-Event.
   *
   * **Append-only:** Der `PatientErfasst`-Originaleintrag bleibt unverändert
   * im Event-Stream; `Patient.aktuelleSk` ist der Read-Snapshot.
   */
  @Patch(':patientId/sichtung')
  @HttpCode(HttpStatus.OK)
  @ApiWrappedResponse(PatientDto, {
    description: 'Sichtungs-Kategorie aktualisiert — Reevaluierung als append-only-Event + ETB-Audit-Spur.',
  })
  async aktualisiereSichtung(
    @Param('einsatzId') einsatzId: string,
    @Param('patientId') patientId: string,
    @Body() dto: AktualisiereSichtungDto,
    @CurrentUser() user: ValidatedUser,
  ): Promise<{ data: PatientDto }> {
    const command = new AktualisiereSichtungCommand({
      einsatzId,
      patientId,
      neueSk: dto.neueSk,
      sichtungArt: dto.sichtungArt,
      sichter: { type: 'user', userId: user.userId },
      grund: dto.grund,
      clockDriftSeconds: dto.clockDriftSeconds,
    });

    const result = await this.aktualisiereSichtungHandler.execute(command);
    if (result.isFailure) {
      throw mapErrorToHttp(result.error);
    }
    return { data: result.value! };
  }
}
