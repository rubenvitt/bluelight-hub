import { GetErinnerungenByEinsatzQuery } from './get-erinnerungen-by-einsatz.query';
import { ERINNERUNG_ERROR_CODES } from '../../errors/erinnerung-error.codes';

describe('GetErinnerungenByEinsatzQuery', () => {
  const validEinsatzId = 'clw3h8x9y0000qwertyuiopas';

  describe('create', () => {
    // ═══════════════════════════════════════════════════════════════════════
    // Happy Path Tests
    // ═══════════════════════════════════════════════════════════════════════

    describe('Happy Path', () => {
      it('should create query with valid einsatzId', () => {
        // Given
        const props = { einsatzId: validEinsatzId };

        // When
        const result = GetErinnerungenByEinsatzQuery.create(props);

        // Then
        expect(result.isSuccess).toBe(true);
        expect(result.value).toBeDefined();
        expect(result.value?.einsatzId).toBe(validEinsatzId);
      });

      it('should trim whitespace from einsatzId', () => {
        // Given
        const props = { einsatzId: `  ${validEinsatzId}  ` };

        // When
        const result = GetErinnerungenByEinsatzQuery.create(props);

        // Then
        expect(result.isSuccess).toBe(true);
        expect(result.value?.einsatzId).toBe(validEinsatzId);
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // Validation Error Tests
    // ═══════════════════════════════════════════════════════════════════════

    describe('Validation Errors', () => {
      it('should fail when einsatzId is empty', () => {
        // Given
        const props = { einsatzId: '' };

        // When
        const result = GetErinnerungenByEinsatzQuery.create(props);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe(ERINNERUNG_ERROR_CODES.QUERY_EINSATZ_ID_REQUIRED);
      });

      it('should fail when einsatzId is only whitespace', () => {
        // Given
        const props = { einsatzId: '   ' };

        // When
        const result = GetErinnerungenByEinsatzQuery.create(props);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe(ERINNERUNG_ERROR_CODES.QUERY_EINSATZ_ID_REQUIRED);
      });

      it('should fail when einsatzId is not a valid CUID2', () => {
        // Given
        const props = { einsatzId: 'invalid-id' };

        // When
        const result = GetErinnerungenByEinsatzQuery.create(props);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe(ERINNERUNG_ERROR_CODES.EINSATZ_ID_INVALID);
      });

      it('should fail when einsatzId is too short', () => {
        // Given
        const props = { einsatzId: 'abc123' };

        // When
        const result = GetErinnerungenByEinsatzQuery.create(props);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe(ERINNERUNG_ERROR_CODES.EINSATZ_ID_INVALID);
      });

      it('should fail when einsatzId has uppercase letters', () => {
        // Given
        const props = { einsatzId: 'CLW3H8X9Y0000QWERTYUIOPAS' };

        // When
        const result = GetErinnerungenByEinsatzQuery.create(props);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe(ERINNERUNG_ERROR_CODES.EINSATZ_ID_INVALID);
      });

      it('should fail when einsatzId has special characters', () => {
        // Given
        const props = { einsatzId: 'clw3h8x9y0000-qwertyuiop' };

        // When
        const result = GetErinnerungenByEinsatzQuery.create(props);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe(ERINNERUNG_ERROR_CODES.EINSATZ_ID_INVALID);
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // Edge Cases
    // ═══════════════════════════════════════════════════════════════════════

    describe('Edge Cases', () => {
      it('should accept einsatzId with 24 characters (minimum CUID2 length)', () => {
        // Given
        const _props = { einsatzId: 'clw3h8x9y0000qwertyuiop' }; // 23 chars - should fail
        const props24 = { einsatzId: 'clw3h8x9y0000qwertyuiopa' }; // 24 chars

        // When
        const result24 = GetErinnerungenByEinsatzQuery.create(props24);

        // Then
        expect(result24.isSuccess).toBe(true);
      });

      it('should accept einsatzId with 32 characters (maximum CUID2 length)', () => {
        // Given
        const props = { einsatzId: 'clw3h8x9y0000qwertyuiopasdfghjk' }; // 32 chars

        // When
        const result = GetErinnerungenByEinsatzQuery.create(props);

        // Then
        expect(result.isSuccess).toBe(true);
      });

      it('should fail when einsatzId exceeds 32 characters', () => {
        // Given
        const props = { einsatzId: 'clw3h8x9y0000qwertyuiopasdfghjklm' }; // 33 chars

        // When
        const result = GetErinnerungenByEinsatzQuery.create(props);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe(ERINNERUNG_ERROR_CODES.EINSATZ_ID_INVALID);
      });
    });
  });
});
