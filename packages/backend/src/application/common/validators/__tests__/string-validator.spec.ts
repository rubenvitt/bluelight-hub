import { validateRequiredString, validateNanoidFormat, NANOID_REGEX } from '../string-validator';

/**
 * Unit Tests für String Validation Helpers.
 *
 * Testet validateRequiredString() und validateNanoidFormat()
 * gemäß BDD Given-When-Then Pattern.
 * Coverage Target: >90%
 */
describe('String Validator', () => {
  describe('validateRequiredString', () => {
    it('should not throw for valid non-empty string', () => {
      // Given
      const validValue = 'valid-value';
      const fieldName = 'testField';

      // When/Then
      expect(() => validateRequiredString(validValue, fieldName)).not.toThrow();
    });

    it('should throw error when value is undefined', () => {
      // Given
      const undefinedValue = undefined;
      const fieldName = 'testField';

      // When/Then
      expect(() => validateRequiredString(undefinedValue, fieldName)).toThrow('testField is required');
    });

    it('should throw error when value is empty string', () => {
      // Given
      const emptyValue = '';
      const fieldName = 'einsatzId';

      // When/Then
      expect(() => validateRequiredString(emptyValue, fieldName)).toThrow('einsatzId is required');
    });

    it('should throw error when value is whitespace only', () => {
      // Given
      const whitespaceValue = '   ';
      const fieldName = 'lagekarteId';

      // When/Then
      expect(() => validateRequiredString(whitespaceValue, fieldName)).toThrow('lagekarteId is required');
    });

    it('should not throw for string with leading/trailing whitespace but content', () => {
      // Given
      const valueWithWhitespace = '  valid  ';
      const fieldName = 'testField';

      // When/Then
      expect(() => validateRequiredString(valueWithWhitespace, fieldName)).not.toThrow();
    });

    it('should use custom field name in error message', () => {
      // Given
      const emptyValue = '';
      const customFieldName = 'customField';

      // When/Then
      expect(() => validateRequiredString(emptyValue, customFieldName)).toThrow('customField is required');
    });
  });

  describe('validateNanoidFormat', () => {
    it('should not throw for valid 21-character nanoid', () => {
      // Given
      const validNanoid = 'V1StGXR8_Z5jdHi6B-myT'; // 21 chars
      const fieldName = 'testId';

      // When/Then
      expect(() => validateNanoidFormat(validNanoid, fieldName)).not.toThrow();
    });

    it('should not throw for nanoid with all valid characters (A-Z, a-z, 0-9, _, -)', () => {
      // Given
      const validNanoid = 'AZaz09_-0123456789XYZ'; // 21 chars with all valid chars
      const fieldName = 'testId';

      // When/Then
      expect(() => validateNanoidFormat(validNanoid, fieldName)).not.toThrow();
    });

    it('should throw error for nanoid that is too short', () => {
      // Given
      const shortId = 'invalid'; // Only 7 chars
      const fieldName = 'einsatzId';

      // When/Then
      expect(() => validateNanoidFormat(shortId, fieldName)).toThrow('einsatzId must be a valid nanoid format (21 alphanumeric characters)');
    });

    it('should throw error for nanoid that is too long', () => {
      // Given
      const longId = 'toolongnanoidexceedstwentyonecharacters'; // 42 chars
      const fieldName = 'lagekarteId';

      // When/Then
      expect(() => validateNanoidFormat(longId, fieldName)).toThrow('lagekarteId must be a valid nanoid format (21 alphanumeric characters)');
    });

    it('should throw error for nanoid with invalid characters', () => {
      // Given
      const invalidId = 'invalid@chars#!21char'; // 21 chars but invalid symbols
      const fieldName = 'poiId';

      // When/Then
      expect(() => validateNanoidFormat(invalidId, fieldName)).toThrow('poiId must be a valid nanoid format (21 alphanumeric characters)');
    });

    it('should throw error for nanoid with spaces', () => {
      // Given
      const idWithSpaces = 'einsatz 123 456 7890'; // 20 chars but has spaces
      const fieldName = 'einsatzId';

      // When/Then
      expect(() => validateNanoidFormat(idWithSpaces, fieldName)).toThrow('einsatzId must be a valid nanoid format (21 alphanumeric characters)');
    });

    it('should use custom field name in error message', () => {
      // Given
      const invalidId = 'short';
      const customFieldName = 'customIdField';

      // When/Then
      expect(() => validateNanoidFormat(invalidId, customFieldName)).toThrow('customIdField must be a valid nanoid format');
    });

    it('should accept numeric-only nanoid (21 digits)', () => {
      // Given
      const numericNanoid = '123456789012345678901'; // 21 digits
      const fieldName = 'testId';

      // When/Then
      expect(() => validateNanoidFormat(numericNanoid, fieldName)).not.toThrow();
    });
  });

  describe('NANOID_REGEX constant', () => {
    it('should match valid 21-character nanoid', () => {
      // Given
      const validNanoid = 'V1StGXR8_Z5jdHi6B-myT';

      // When
      const result = NANOID_REGEX.test(validNanoid);

      // Then
      expect(result).toBe(true);
    });

    it('should not match invalid nanoid formats', () => {
      // Given
      const invalidIds = ['short', 'toolongnanoidexceedstwentyonecharacters', 'invalid@chars#!21char', 'einsatz 123 456 7890', ''];

      // When/Then
      for (const id of invalidIds) {
        expect(NANOID_REGEX.test(id)).toBe(false);
      }
    });
  });
});
