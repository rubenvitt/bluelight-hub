import { CreateErinnerungCommand } from './create-erinnerung.command';
import { ERINNERUNG_ERROR_CODES } from '../../errors/erinnerung-error.codes';

describe('CreateErinnerungCommand', () => {
  // Valid test data
  const validEinsatzId = 'clw3h8x9y0000qwertyuiopas';
  const validErstelltVon = 'clw3h8x9y0001abcdefghijkl';
  const validTitel = 'Lagebesprechung';
  const validFaelligAm = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes in future

  describe('create', () => {
    // ═══════════════════════════════════════════════════════════════════════
    // Happy Path Tests
    // ═══════════════════════════════════════════════════════════════════════

    describe('Happy Path', () => {
      it('should create command with valid minimal props', () => {
        // Given
        const props = {
          einsatzId: validEinsatzId,
          titel: validTitel,
          faelligAm: validFaelligAm,
          erstelltVon: validErstelltVon,
        };

        // When
        const result = CreateErinnerungCommand.create(props);

        // Then
        expect(result.isSuccess).toBe(true);
        expect(result.value).toBeDefined();
        expect(result.value?.einsatzId).toBe(validEinsatzId);
        expect(result.value?.titel).toBe(validTitel);
        expect(result.value?.faelligAm).toBe(validFaelligAm);
        expect(result.value?.erstelltVon).toBe(validErstelltVon);
        expect(result.value?.beschreibung).toBeUndefined();
      });

      it('should create command with optional beschreibung', () => {
        // Given
        const beschreibung = 'Im ELW 1 mit Einsatzleitung';
        const props = {
          einsatzId: validEinsatzId,
          titel: validTitel,
          faelligAm: validFaelligAm,
          erstelltVon: validErstelltVon,
          beschreibung,
        };

        // When
        const result = CreateErinnerungCommand.create(props);

        // Then
        expect(result.isSuccess).toBe(true);
        expect(result.value?.beschreibung).toBe(beschreibung);
      });

      it('should trim whitespace from titel', () => {
        // Given
        const props = {
          einsatzId: validEinsatzId,
          titel: '  Lagebesprechung  ',
          faelligAm: validFaelligAm,
          erstelltVon: validErstelltVon,
        };

        // When
        const result = CreateErinnerungCommand.create(props);

        // Then
        expect(result.isSuccess).toBe(true);
        expect(result.value?.titel).toBe('Lagebesprechung');
      });

      it('should trim whitespace from beschreibung', () => {
        // Given
        const props = {
          einsatzId: validEinsatzId,
          titel: validTitel,
          faelligAm: validFaelligAm,
          erstelltVon: validErstelltVon,
          beschreibung: '  Im ELW 1  ',
        };

        // When
        const result = CreateErinnerungCommand.create(props);

        // Then
        expect(result.isSuccess).toBe(true);
        expect(result.value?.beschreibung).toBe('Im ELW 1');
      });

      it('should set beschreibung to undefined for empty string', () => {
        // Given
        const props = {
          einsatzId: validEinsatzId,
          titel: validTitel,
          faelligAm: validFaelligAm,
          erstelltVon: validErstelltVon,
          beschreibung: '   ',
        };

        // When
        const result = CreateErinnerungCommand.create(props);

        // Then
        expect(result.isSuccess).toBe(true);
        expect(result.value?.beschreibung).toBeUndefined();
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // Titel Validation Tests
    // ═══════════════════════════════════════════════════════════════════════

    describe('Titel Validation', () => {
      it('should fail when titel is empty', () => {
        // Given
        const props = {
          einsatzId: validEinsatzId,
          titel: '',
          faelligAm: validFaelligAm,
          erstelltVon: validErstelltVon,
        };

        // When
        const result = CreateErinnerungCommand.create(props);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe(ERINNERUNG_ERROR_CODES.TITEL_REQUIRED);
      });

      it('should fail when titel is only whitespace', () => {
        // Given
        const props = {
          einsatzId: validEinsatzId,
          titel: '   ',
          faelligAm: validFaelligAm,
          erstelltVon: validErstelltVon,
        };

        // When
        const result = CreateErinnerungCommand.create(props);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe(ERINNERUNG_ERROR_CODES.TITEL_REQUIRED);
      });

      it('should fail when titel exceeds 100 characters', () => {
        // Given
        const props = {
          einsatzId: validEinsatzId,
          titel: 'a'.repeat(101),
          faelligAm: validFaelligAm,
          erstelltVon: validErstelltVon,
        };

        // When
        const result = CreateErinnerungCommand.create(props);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe(ERINNERUNG_ERROR_CODES.TITEL_TOO_LONG);
      });

      it('should accept titel with exactly 100 characters', () => {
        // Given
        const props = {
          einsatzId: validEinsatzId,
          titel: 'a'.repeat(100),
          faelligAm: validFaelligAm,
          erstelltVon: validErstelltVon,
        };

        // When
        const result = CreateErinnerungCommand.create(props);

        // Then
        expect(result.isSuccess).toBe(true);
        expect(result.value?.titel.length).toBe(100);
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // FaelligAm Validation Tests
    // ═══════════════════════════════════════════════════════════════════════

    describe('FaelligAm Validation', () => {
      it('should fail when faelligAm is null', () => {
        // Given
        const props = {
          einsatzId: validEinsatzId,
          titel: validTitel,
          faelligAm: null as unknown as Date,
          erstelltVon: validErstelltVon,
        };

        // When
        const result = CreateErinnerungCommand.create(props);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe(ERINNERUNG_ERROR_CODES.FAELLIG_AM_REQUIRED);
      });

      it('should fail when faelligAm is in the past', () => {
        // Given
        const props = {
          einsatzId: validEinsatzId,
          titel: validTitel,
          faelligAm: new Date(Date.now() - 1000), // 1 second in past
          erstelltVon: validErstelltVon,
        };

        // When
        const result = CreateErinnerungCommand.create(props);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe(ERINNERUNG_ERROR_CODES.FAELLIG_AM_IN_PAST);
      });

      it('should fail when faelligAm is exactly now', () => {
        // Given
        const now = new Date();
        const props = {
          einsatzId: validEinsatzId,
          titel: validTitel,
          faelligAm: now,
          erstelltVon: validErstelltVon,
        };

        // When
        const result = CreateErinnerungCommand.create(props);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe(ERINNERUNG_ERROR_CODES.FAELLIG_AM_IN_PAST);
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // EinsatzId Validation Tests
    // ═══════════════════════════════════════════════════════════════════════

    describe('EinsatzId Validation', () => {
      it('should fail when einsatzId is empty', () => {
        // Given
        const props = {
          einsatzId: '',
          titel: validTitel,
          faelligAm: validFaelligAm,
          erstelltVon: validErstelltVon,
        };

        // When
        const result = CreateErinnerungCommand.create(props);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe(ERINNERUNG_ERROR_CODES.EINSATZ_ID_REQUIRED);
      });

      it('should fail when einsatzId is not a valid CUID2', () => {
        // Given
        const props = {
          einsatzId: 'invalid-id',
          titel: validTitel,
          faelligAm: validFaelligAm,
          erstelltVon: validErstelltVon,
        };

        // When
        const result = CreateErinnerungCommand.create(props);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe(ERINNERUNG_ERROR_CODES.EINSATZ_ID_INVALID);
      });

      it('should fail when einsatzId has uppercase letters', () => {
        // Given
        const props = {
          einsatzId: 'CLW3H8X9Y0000QWERTYUIOPAS',
          titel: validTitel,
          faelligAm: validFaelligAm,
          erstelltVon: validErstelltVon,
        };

        // When
        const result = CreateErinnerungCommand.create(props);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe(ERINNERUNG_ERROR_CODES.EINSATZ_ID_INVALID);
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // ErstelltVon Validation Tests
    // ═══════════════════════════════════════════════════════════════════════

    describe('ErstelltVon Validation', () => {
      it('should fail when erstelltVon is empty', () => {
        // Given
        const props = {
          einsatzId: validEinsatzId,
          titel: validTitel,
          faelligAm: validFaelligAm,
          erstelltVon: '',
        };

        // When
        const result = CreateErinnerungCommand.create(props);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe(ERINNERUNG_ERROR_CODES.ERSTELLT_VON_REQUIRED);
      });

      it('should fail when erstelltVon is only whitespace', () => {
        // Given
        const props = {
          einsatzId: validEinsatzId,
          titel: validTitel,
          faelligAm: validFaelligAm,
          erstelltVon: '   ',
        };

        // When
        const result = CreateErinnerungCommand.create(props);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe(ERINNERUNG_ERROR_CODES.ERSTELLT_VON_REQUIRED);
      });
    });
  });
});
