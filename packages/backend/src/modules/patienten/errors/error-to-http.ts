import { BadRequestException, ConflictException, ForbiddenException, HttpException, InternalServerErrorException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { AKTUALISIERE_SICHTUNG_ERROR_CODES } from '@/application/patienten/errors/aktualisiere-sichtung-error.codes';
import { PATIENT_ERFASSEN_ERROR_CODES } from '@/application/patienten/errors/patient-erfassen-error.codes';

/**
 * Mapping Application-Sentinel-Error-Codes → HTTP-Exceptions (Story 1.2/1.3).
 *
 * Pattern: `Präfix:Kennung[:Detail]` — der Präfix bestimmt die HTTP-Klasse:
 *  - `Validation:` → 400 BadRequest
 *  - `BusinessRule:` → 422 UnprocessableEntity (Story 1.3 mapt die fachlichen
 *    TOT-/Unveraendert-Sentinels zusätzlich auf 400 mit klarer Meldung)
 *  - `NotFound:` → 404 NotFound
 *  - `ConflictDetected:` → 409 Conflict
 *  - `Forbidden:` → 403 Forbidden
 *  - `Infrastructure:` → 500 InternalServerError
 *
 * Wir matchen Patient-Sentinels zuerst (DRY), fallen sonst auf den
 * Präfix-Discriminator zurück.
 */
const PATIENT_VALIDATION_CODES = new Set<string>([
  PATIENT_ERFASSEN_ERROR_CODES.INITIALE_SK_REQUIRED,
  PATIENT_ERFASSEN_ERROR_CODES.ERFASSER_REF_INVALID,
  PATIENT_ERFASSEN_ERROR_CODES.DIVI_VAK_NUMMER_INVALID,
  PATIENT_ERFASSEN_ERROR_CODES.NOTIZ_INVALID,
  PATIENT_ERFASSEN_ERROR_CODES.CLOCK_DRIFT_INVALID,
  PATIENT_ERFASSEN_ERROR_CODES.EINSATZ_ID_REQUIRED,
  PATIENT_ERFASSEN_ERROR_CODES.ETB_CONTEXT_INVALID,
  AKTUALISIERE_SICHTUNG_ERROR_CODES.EINSATZ_ID_REQUIRED,
  AKTUALISIERE_SICHTUNG_ERROR_CODES.PATIENT_ID_REQUIRED,
  AKTUALISIERE_SICHTUNG_ERROR_CODES.NEUE_SK_REQUIRED,
  AKTUALISIERE_SICHTUNG_ERROR_CODES.SICHTUNG_ART_INVALID,
  AKTUALISIERE_SICHTUNG_ERROR_CODES.SICHTER_INVALID,
  AKTUALISIERE_SICHTUNG_ERROR_CODES.CLOCK_DRIFT_INVALID,
  AKTUALISIERE_SICHTUNG_ERROR_CODES.GRUND_INVALID,
  AKTUALISIERE_SICHTUNG_ERROR_CODES.ETB_CONTEXT_INVALID,
]);

const TOT_BLOCK_MESSAGE = 'Patient ist als TOT markiert — Sichtungs-Korrektur nur via Korrektur-Event (Story 1.4) zulässig';
const UNVERAENDERT_MESSAGE = 'Neue Sichtung entspricht der aktuellen — keine Änderung';

export function mapErrorToHttp(error: string | undefined): HttpException {
  const message = error ?? 'Infrastructure:UnbekannterFehler';
  const prefix = message.split(':')[0];
  const codeKey = message.split(':').slice(0, 2).join(':');

  // Story 1.3: fachliche BusinessRules mit präziser HTTP-400-Meldung (statt 422),
  // damit der Frontend-Optimistic-UI-Rollback einen klaren UX-Hint hat.
  if (message.startsWith('BusinessRule:SichtungVonTotNichtErlaubt')) {
    return new BadRequestException(`${TOT_BLOCK_MESSAGE} (${message})`);
  }
  if (message.startsWith('BusinessRule:SichtungUnveraendert')) {
    return new BadRequestException(`${UNVERAENDERT_MESSAGE} (${message})`);
  }
  if (message === AKTUALISIERE_SICHTUNG_ERROR_CODES.PATIENT_NICHT_GEFUNDEN || message.startsWith('NotFound:')) {
    return new NotFoundException(message);
  }

  if (PATIENT_VALIDATION_CODES.has(codeKey) || PATIENT_VALIDATION_CODES.has(message) || prefix === 'Validation') {
    return new BadRequestException(message);
  }
  if (message.startsWith(PATIENT_ERFASSEN_ERROR_CODES.PATIENTENNUMMER_KONFLIKT) || prefix === 'ConflictDetected') {
    return new ConflictException(message);
  }
  if (prefix === 'Forbidden') {
    return new ForbiddenException(message);
  }
  if (prefix === 'BusinessRule') {
    return new UnprocessableEntityException(message);
  }
  return new InternalServerErrorException(message);
}
