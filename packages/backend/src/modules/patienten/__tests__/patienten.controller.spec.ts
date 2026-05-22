// @ts-nocheck
import { BadRequestException, ConflictException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Result } from '@domain/common/result';
import type { ValidatedUser } from '@/modules/auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { EinsatzScopeGuard } from '@/modules/auth/guards/einsatz-scope.guard';
import { AktualisiereSichtungHandler } from '@/application/patienten/commands/aktualisiere-sichtung/aktualisiere-sichtung.handler';
import { ErfassePatientHandler } from '@/application/patienten/commands/erfasse-patient/erfasse-patient.handler';
import { AKTUALISIERE_SICHTUNG_ERROR_CODES } from '@/application/patienten/errors/aktualisiere-sichtung-error.codes';
import { PATIENT_ERFASSEN_ERROR_CODES } from '@/application/patienten/errors/patient-erfassen-error.codes';
import type { PatientDto } from '@/application/patienten/dto/patient.dto';
import { AktualisiereSichtungDto } from '@/application/patienten/dto/aktualisiere-sichtung.dto';
import { ErfassePatientDto } from '@/application/patienten/dto/erfasse-patient.dto';
import { PatientenController } from '../patienten.controller';

describe('PatientenController', () => {
  let controller: PatientenController;
  let handler: jest.Mocked<ErfassePatientHandler>;
  let sichtungHandler: jest.Mocked<AktualisiereSichtungHandler>;

  const fakeUser: ValidatedUser = { userId: 'user-1' };

  const successPatientDto = (overrides: Partial<PatientDto> = {}): PatientDto => ({
    id: 'pat-1',
    einsatzId: 'einsatz-1',
    patientennummer: 'P-001',
    aktuelleSk: 'SK_II',
    behandlungsstatus: 'UNVERSORGT',
    transportstatus: 'WARTEND',
    erfasstAm: '2026-05-19T10:00:00.000Z',
    erfasserRef: { type: 'user', userId: 'user-1' },
    eventVersion: 1,
    ...overrides,
  });

  beforeEach(async () => {
    handler = { execute: jest.fn() } as unknown as jest.Mocked<ErfassePatientHandler>;
    sichtungHandler = { execute: jest.fn() } as unknown as jest.Mocked<AktualisiereSichtungHandler>;

    const module = await Test.createTestingModule({
      controllers: [PatientenController],
      providers: [
        { provide: ErfassePatientHandler, useValue: handler },
        { provide: AktualisiereSichtungHandler, useValue: sichtungHandler },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(EinsatzScopeGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(PatientenController);
  });

  it('Happy-Path: liefert { data: PatientDto } bei erfolgreichem Result', async () => {
    handler.execute.mockResolvedValueOnce(Result.ok(successPatientDto()));
    const dto = new ErfassePatientDto();
    dto.initialeSk = 'SK_II';
    dto.notiz = 'Polytrauma';

    const response = await controller.erfassePatient('einsatz-1', dto, fakeUser);

    expect(response.data.patientennummer).toBe('P-001');
    expect(handler.execute).toHaveBeenCalledTimes(1);
    const cmd = handler.execute.mock.calls[0][0];
    expect(cmd.einsatzId).toBe('einsatz-1');
    expect(cmd.initialeSk).toBe('SK_II');
    expect(cmd.notiz).toBe('Polytrauma');
    expect(cmd.erfasserRef).toEqual({ type: 'user', userId: 'user-1' });
  });

  it('Patientennummer-Konflikt → 409 ConflictException', async () => {
    handler.execute.mockResolvedValueOnce(Result.fail<PatientDto>(`${PATIENT_ERFASSEN_ERROR_CODES.PATIENTENNUMMER_KONFLIKT}:P-001`));
    const dto = new ErfassePatientDto();
    dto.initialeSk = 'SK_II';

    await expect(controller.erfassePatient('einsatz-1', dto, fakeUser)).rejects.toThrow(ConflictException);
  });

  it('Validation-Error → 400 BadRequestException', async () => {
    handler.execute.mockResolvedValueOnce(Result.fail<PatientDto>(PATIENT_ERFASSEN_ERROR_CODES.INITIALE_SK_REQUIRED));
    const dto = new ErfassePatientDto();
    dto.initialeSk = 'SK_II';

    await expect(controller.erfassePatient('einsatz-1', dto, fakeUser)).rejects.toThrow(BadRequestException);
  });

  it('Unbekannter Fehler → 500 InternalServerError', async () => {
    handler.execute.mockResolvedValueOnce(Result.fail<PatientDto>('Infrastructure:UnerwarteterFehler'));
    const dto = new ErfassePatientDto();
    dto.initialeSk = 'SK_II';

    await expect(controller.erfassePatient('einsatz-1', dto, fakeUser)).rejects.toThrow(InternalServerErrorException);
  });

  describe('PATCH .../sichtung (Story 1.3)', () => {
    function buildDto(): AktualisiereSichtungDto {
      const dto = new AktualisiereSichtungDto();
      dto.neueSk = 'SK_I';
      dto.sichtungArt = 'aerztlich';
      return dto;
    }

    it('Happy-Path: liefert { data: PatientDto } mit neuer SK', async () => {
      sichtungHandler.execute.mockResolvedValueOnce(Result.ok(successPatientDto({ aktuelleSk: 'SK_I', eventVersion: 2 })));

      const response = await controller.aktualisiereSichtung('einsatz-1', 'pat-1', buildDto(), fakeUser);

      expect(response.data.aktuelleSk).toBe('SK_I');
      expect(response.data.eventVersion).toBe(2);
      const cmd = sichtungHandler.execute.mock.calls[0][0];
      expect(cmd.einsatzId).toBe('einsatz-1');
      expect(cmd.patientId).toBe('pat-1');
      expect(cmd.neueSk).toBe('SK_I');
      expect(cmd.sichtungArt).toBe('aerztlich');
      expect(cmd.sichter).toEqual({ type: 'user', userId: 'user-1' });
    });

    it('Patient-not-found → 404 NotFoundException', async () => {
      sichtungHandler.execute.mockResolvedValueOnce(Result.fail<PatientDto>(AKTUALISIERE_SICHTUNG_ERROR_CODES.PATIENT_NICHT_GEFUNDEN));
      await expect(controller.aktualisiereSichtung('einsatz-1', 'pat-1', buildDto(), fakeUser)).rejects.toThrow(NotFoundException);
    });

    it('TOT-Block → 400 BadRequestException mit klarer Meldung', async () => {
      sichtungHandler.execute.mockResolvedValueOnce(Result.fail<PatientDto>('BusinessRule:SichtungVonTotNichtErlaubt:TOT->SK_I'));
      await expect(controller.aktualisiereSichtung('einsatz-1', 'pat-1', buildDto(), fakeUser)).rejects.toThrow(BadRequestException);
    });

    it('No-Op (Unveraendert) → 400 BadRequestException', async () => {
      sichtungHandler.execute.mockResolvedValueOnce(Result.fail<PatientDto>('BusinessRule:SichtungUnveraendert:SK_I'));
      await expect(controller.aktualisiereSichtung('einsatz-1', 'pat-1', buildDto(), fakeUser)).rejects.toThrow(BadRequestException);
    });

    it('Validation-Error (z. B. NEUE_SK_REQUIRED) → 400 BadRequestException', async () => {
      sichtungHandler.execute.mockResolvedValueOnce(Result.fail<PatientDto>(AKTUALISIERE_SICHTUNG_ERROR_CODES.NEUE_SK_REQUIRED));
      await expect(controller.aktualisiereSichtung('einsatz-1', 'pat-1', buildDto(), fakeUser)).rejects.toThrow(BadRequestException);
    });

    it('Infrastructure-Fail → 500 InternalServerError', async () => {
      sichtungHandler.execute.mockResolvedValueOnce(Result.fail<PatientDto>('Infrastructure:UnerwarteterFehler'));
      await expect(controller.aktualisiereSichtung('einsatz-1', 'pat-1', buildDto(), fakeUser)).rejects.toThrow(InternalServerErrorException);
    });
  });
});
