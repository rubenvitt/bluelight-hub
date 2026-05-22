import { BadRequestException, ConflictException, ForbiddenException, InternalServerErrorException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PATIENT_ERFASSEN_ERROR_CODES } from '@/application/patienten/errors/patient-erfassen-error.codes';
import { mapErrorToHttp } from '../error-to-http';

/**
 * Hilfsfunktion: liest `code` aus dem (object-form) Response-Body. Story 1.4
 * Code-Review Feature 1 garantiert für jeden Branch ein `{ code, message }`-
 * Objekt; `getResponse()` einer `HttpException` mit Object-Argument liefert
 * dieses Objekt zurück.
 */
function bodyOf(ex: { getResponse(): unknown }): { code: string; message: string } {
  const body = ex.getResponse();
  if (typeof body !== 'object' || body === null || !('code' in body) || !('message' in body)) {
    throw new Error(`Expected { code, message } body, got: ${JSON.stringify(body)}`);
  }
  return body as { code: string; message: string };
}

describe('mapErrorToHttp (Story 1.2)', () => {
  it('Validation:* → 400 mit Stable `code`', () => {
    const ex1 = mapErrorToHttp(PATIENT_ERFASSEN_ERROR_CODES.INITIALE_SK_REQUIRED);
    expect(ex1).toBeInstanceOf(BadRequestException);
    expect(bodyOf(ex1).code).toBe(PATIENT_ERFASSEN_ERROR_CODES.INITIALE_SK_REQUIRED);
    expect(mapErrorToHttp(PATIENT_ERFASSEN_ERROR_CODES.DIVI_VAK_NUMMER_INVALID)).toBeInstanceOf(BadRequestException);
    expect(mapErrorToHttp(PATIENT_ERFASSEN_ERROR_CODES.NOTIZ_INVALID)).toBeInstanceOf(BadRequestException);
    expect(mapErrorToHttp(PATIENT_ERFASSEN_ERROR_CODES.ETB_CONTEXT_INVALID)).toBeInstanceOf(BadRequestException);
    const ex2 = mapErrorToHttp('Validation:UnknownCode');
    expect(ex2).toBeInstanceOf(BadRequestException);
    expect(bodyOf(ex2).code).toBe('Validation:UnknownCode');
  });

  it('ConflictDetected:* → 409 mit `code` als Sentinel-Stem (ohne Detail-Suffix)', () => {
    const ex1 = mapErrorToHttp(`${PATIENT_ERFASSEN_ERROR_CODES.PATIENTENNUMMER_KONFLIKT}:P-001`);
    expect(ex1).toBeInstanceOf(ConflictException);
    expect(bodyOf(ex1).code).toBe(PATIENT_ERFASSEN_ERROR_CODES.PATIENTENNUMMER_KONFLIKT);
    expect(JSON.stringify(ex1.getResponse())).not.toContain('P-001');
    const ex2 = mapErrorToHttp('ConflictDetected:SomethingElse');
    expect(ex2).toBeInstanceOf(ConflictException);
    expect(bodyOf(ex2).code).toBe('ConflictDetected:SomethingElse');
  });

  it('Forbidden:* → 403 mit `code` als Stem', () => {
    const ex = mapErrorToHttp('Forbidden:NichtErlaubt');
    expect(ex).toBeInstanceOf(ForbiddenException);
    expect(bodyOf(ex).code).toBe('Forbidden:NichtErlaubt');
  });

  it('BusinessRule:* → 422 mit `code` als Stem', () => {
    const ex1 = mapErrorToHttp('BusinessRule:EinsatzNichtAktiv');
    expect(ex1).toBeInstanceOf(UnprocessableEntityException);
    expect(bodyOf(ex1).code).toBe('BusinessRule:EinsatzNichtAktiv');
    expect(mapErrorToHttp(PATIENT_ERFASSEN_ERROR_CODES.EINSATZ_NICHT_AKTIV)).toBeInstanceOf(UnprocessableEntityException);
  });

  it('Infrastructure:* / unbekannte Codes → 500 mit stabilem `code`', () => {
    const ex1 = mapErrorToHttp('Infrastructure:DBDown');
    expect(ex1).toBeInstanceOf(InternalServerErrorException);
    expect(bodyOf(ex1).code).toBe('Infrastructure:DBDown');
    const ex2 = mapErrorToHttp(undefined);
    expect(ex2).toBeInstanceOf(InternalServerErrorException);
    expect(bodyOf(ex2).code).toBe('Infrastructure:UnbekannterFehler');
    const ex3 = mapErrorToHttp('UnknownPrefix:Something');
    expect(ex3).toBeInstanceOf(InternalServerErrorException);
    expect(bodyOf(ex3).code).toBe('Infrastructure:UnbekannterFehler');
  });

  describe('Story 1.3 Sichtung-BusinessRules (400 statt 422 für klare UX)', () => {
    it('SichtungVonTotNichtErlaubt → 400 mit `code`-Stem (Detail-Suffix nicht im Body)', () => {
      const ex = mapErrorToHttp('BusinessRule:SichtungVonTotNichtErlaubt:TOT->SK_I');
      expect(ex).toBeInstanceOf(BadRequestException);
      expect(bodyOf(ex).code).toBe('BusinessRule:SichtungVonTotNichtErlaubt');
      expect(JSON.stringify(ex.getResponse())).not.toContain('TOT->SK_I');
      // `code` enthält per Definition den Sentinel-Stem, **das** ist der gewünschte
      // Identifier — der Detail-Suffix bleibt außen vor.
    });

    it('SichtungUnveraendert → 400 mit `code`-Stem', () => {
      const ex = mapErrorToHttp('BusinessRule:SichtungUnveraendert:SK_II');
      expect(ex).toBeInstanceOf(BadRequestException);
      expect(bodyOf(ex).code).toBe('BusinessRule:SichtungUnveraendert');
    });
  });

  describe('Story 1.4 Behandlung-BusinessRules (400)', () => {
    it('BehandlungUngueltigerUebergang → 400 mit `code` + Klartext', () => {
      const ex = mapErrorToHttp('BusinessRule:BehandlungUngueltigerUebergang');
      expect(ex).toBeInstanceOf(BadRequestException);
      const body = bodyOf(ex);
      expect(body.code).toBe('BusinessRule:BehandlungUngueltigerUebergang');
      expect(body.message).toBe('Ungültiger Übergang im Behandlungsstatus');
    });

    it('BehandlungUnveraendert → 400 mit `code`', () => {
      const ex = mapErrorToHttp('BusinessRule:BehandlungUnveraendert');
      expect(ex).toBeInstanceOf(BadRequestException);
      expect(bodyOf(ex).code).toBe('BusinessRule:BehandlungUnveraendert');
    });
  });

  describe('Story 1.4 Transport-BusinessRules (400)', () => {
    it('TransportUngueltigerUebergang → 400 mit `code`', () => {
      const ex = mapErrorToHttp('BusinessRule:TransportUngueltigerUebergang');
      expect(ex).toBeInstanceOf(BadRequestException);
      expect(bodyOf(ex).code).toBe('BusinessRule:TransportUngueltigerUebergang');
    });

    it('TransportUnveraendert → 400 mit `code`', () => {
      const ex = mapErrorToHttp('BusinessRule:TransportUnveraendert');
      expect(ex).toBeInstanceOf(BadRequestException);
      expect(bodyOf(ex).code).toBe('BusinessRule:TransportUnveraendert');
    });
  });

  describe('Story 1.4 Korrektur-BusinessRules (400)', () => {
    it('KorrekturUnveraendert → 400 mit `code`', () => {
      const ex = mapErrorToHttp('BusinessRule:KorrekturUnveraendert');
      expect(ex).toBeInstanceOf(BadRequestException);
      expect(bodyOf(ex).code).toBe('BusinessRule:KorrekturUnveraendert');
    });
    it('KorrekturFeldInvalid → 400 mit `code`', () => {
      const ex = mapErrorToHttp('BusinessRule:KorrekturFeldInvalid');
      expect(ex).toBeInstanceOf(BadRequestException);
      expect(bodyOf(ex).code).toBe('BusinessRule:KorrekturFeldInvalid');
    });
    it('KorrekturNeuerWertInvalid → 400 mit `code`', () => {
      const ex = mapErrorToHttp('BusinessRule:KorrekturNeuerWertInvalid');
      expect(ex).toBeInstanceOf(BadRequestException);
      expect(bodyOf(ex).code).toBe('BusinessRule:KorrekturNeuerWertInvalid');
    });
    it('KorrekturGrundRequired → 400 mit `code`', () => {
      const ex = mapErrorToHttp('BusinessRule:KorrekturGrundRequired');
      expect(ex).toBeInstanceOf(BadRequestException);
      expect(bodyOf(ex).code).toBe('BusinessRule:KorrekturGrundRequired');
    });
    it('Story 1.4 Code-Review Feature 2: KorrekturTotBenoetigtBestaetigung → 400 mit `code` + Klartext', () => {
      const ex = mapErrorToHttp('BusinessRule:KorrekturTotBenoetigtBestaetigung');
      expect(ex).toBeInstanceOf(BadRequestException);
      const body = bodyOf(ex);
      expect(body.code).toBe('BusinessRule:KorrekturTotBenoetigtBestaetigung');
      expect(body.message).toBe('Diese Korrektur stuft den Patienten auf TOT — bitte explizit bestätigen.');
    });
    it('KorrekturTotBenoetigtBestaetigung mit Suffix fällt in 422-Branch (Regression-Guard)', () => {
      const ex = mapErrorToHttp('BusinessRule:KorrekturTotBenoetigtBestaetigung:SK_II->TOT');
      expect(ex).toBeInstanceOf(UnprocessableEntityException);
      expect(bodyOf(ex).code).toBe('BusinessRule:KorrekturTotBenoetigtBestaetigung');
      const raw = JSON.stringify(ex.getResponse());
      expect(raw).not.toContain('SK_II->TOT');
    });
  });

  describe('No-Sentinel-Leak Policy (Lessons-Learned 1.3-Review) + Code-Review Feature 1 (`code`)', () => {
    it('NotFound:PatientNichtGefunden → 404 mit `code` + Klartext-`message`', () => {
      const ex = mapErrorToHttp('NotFound:PatientNichtGefunden');
      expect(ex).toBeInstanceOf(NotFoundException);
      const body = bodyOf(ex);
      expect(body.code).toBe('NotFound:PatientNichtGefunden');
      expect(body.message).toBe('Patient nicht gefunden');
    });

    it('NotFound:EinsatzNichtGefunden → 404 mit `code` + Klartext', () => {
      const ex = mapErrorToHttp('NotFound:EinsatzNichtGefunden');
      expect(ex).toBeInstanceOf(NotFoundException);
      const body = bodyOf(ex);
      expect(body.code).toBe('NotFound:EinsatzNichtGefunden');
      expect(body.message).toBe('Einsatz nicht gefunden');
    });

    it('Unbekannter NotFound:* fällt auf `NotFound:Unbekannt` + Fallback-Text zurück', () => {
      const ex = mapErrorToHttp('NotFound:IrgendwasAnderes');
      expect(ex).toBeInstanceOf(NotFoundException);
      const body = bodyOf(ex);
      expect(body.code).toBe('NotFound:Unbekannt');
      expect(body.message).toBe('Ressource nicht gefunden');
      const raw = JSON.stringify(ex.getResponse());
      expect(raw).not.toContain('IrgendwasAnderes');
    });

    it('Validation:* → 400 mit `code` + Fallback-Klartext', () => {
      const ex = mapErrorToHttp(PATIENT_ERFASSEN_ERROR_CODES.INITIALE_SK_REQUIRED);
      expect(ex).toBeInstanceOf(BadRequestException);
      const body = bodyOf(ex);
      expect(body.code).toBe(PATIENT_ERFASSEN_ERROR_CODES.INITIALE_SK_REQUIRED);
      expect(body.message).toBe('Eingabe ungültig');
    });

    it('Unbekannter Validation:* → 400, `code` ist der Stem, kein Detail-Leak', () => {
      const ex = mapErrorToHttp('Validation:UnknownCode:foo-detail');
      expect(ex).toBeInstanceOf(BadRequestException);
      const body = bodyOf(ex);
      expect(body.code).toBe('Validation:UnknownCode');
      const raw = JSON.stringify(ex.getResponse());
      expect(raw).not.toContain('foo-detail');
    });
  });

  describe('Story 1.4 Infrastructure-Sentinels', () => {
    it('Infrastructure:PatientSaveFailed → 500 mit `code` + Klartext', () => {
      const ex = mapErrorToHttp('Infrastructure:PatientSaveFailed');
      expect(ex).toBeInstanceOf(InternalServerErrorException);
      const body = bodyOf(ex);
      expect(body.code).toBe('Infrastructure:PatientSaveFailed');
      expect(body.message).toBe('Patient konnte nicht gespeichert werden');
    });

    it('Infrastructure:PatientSaveFailed mit Suffix → 500 mit Klartext, ohne Suffix-Leak', () => {
      const ex = mapErrorToHttp('Infrastructure:PatientSaveFailed:DBConstraintViolation');
      expect(ex).toBeInstanceOf(InternalServerErrorException);
      const body = bodyOf(ex);
      expect(body.code).toBe('Infrastructure:PatientSaveFailed');
      expect(body.message).toBe('Patient konnte nicht gespeichert werden');
      const raw = JSON.stringify(ex.getResponse());
      expect(raw).not.toContain('DBConstraintViolation');
    });
  });

  describe('Story 1.4 Sentinels: exakte Gleichheit (kein startsWith)', () => {
    it('BusinessRule:BehandlungUngueltigerUebergang **mit Suffix** fällt in den generischen 422-Branch (Regression-Guard)', () => {
      // Wenn jemand versehentlich einen Suffix anhängt, soll dies NICHT mehr als
      // 400 mit User-Text durchgehen — es muss als 422 auffallen.
      const ex = mapErrorToHttp('BusinessRule:BehandlungUngueltigerUebergang:UNVERSORGT->VERSORGT');
      expect(ex).toBeInstanceOf(UnprocessableEntityException);
      // `code` bleibt der Stem, das Suffix-Detail leakt nicht.
      expect(bodyOf(ex).code).toBe('BusinessRule:BehandlungUngueltigerUebergang');
    });

    it('BusinessRule:TransportUngueltigerUebergang **mit Suffix** fällt in den generischen 422-Branch', () => {
      const ex = mapErrorToHttp('BusinessRule:TransportUngueltigerUebergang:WARTEND->IM_KRANKENHAUS');
      expect(ex).toBeInstanceOf(UnprocessableEntityException);
      expect(bodyOf(ex).code).toBe('BusinessRule:TransportUngueltigerUebergang');
    });

    it('Story 1.3 SK-Reevaluierung-Sentinel mit Suffix bleibt 400 (startsWith ist hier erwünscht)', () => {
      const ex = mapErrorToHttp('BusinessRule:SichtungVonTotNichtErlaubt:TOT->SK_I');
      expect(ex).toBeInstanceOf(BadRequestException);
      expect(bodyOf(ex).code).toBe('BusinessRule:SichtungVonTotNichtErlaubt');
    });
  });
});
