import { validate } from 'class-validator';
import { IsCuid2, IsNanoId, validateCuid2Format, validateNanoidFormat } from './is-nanoid.decorator';

/**
 * Tests für IsCuid2 Decorator und validateCuid2Format Funktion.
 *
 * Diese Tests stellen sicher, dass das CUID2-Format korrekt validiert wird.
 * CUID2 wird für alle Domain-generierten IDs verwendet (z.B. POI-IDs, Lagekarte-IDs).
 */
describe('IsCuid2 Decorator', () => {
  // Test-DTO Klasse für Decorator-Tests
  class TestDto {
    @IsCuid2()
    id!: string;
  }

  class TestDtoWithOptional {
    @IsCuid2()
    id?: string;
  }

  // Test-DTO für legacy IsNanoId (deprecated, delegates to IsCuid2)
  class TestDtoLegacy {
    @IsNanoId()
    id!: string;
  }

  describe('validateCuid2Format', () => {
    describe('Given valid CUID2 formats', () => {
      it.each([
        ['clw3h8x9y0000qwertyui00001', '26 chars, typical CUID2'],
        ['cm1234567890abcdefgh', '20 chars (minimum length)'],
        ['cm1234567890abcdefghijklmnop12', '30 chars (maximum length)'],
        ['abcdefghijklmnopqrstu', '21 chars, all lowercase letters'],
        ['a12345678901234567890', '21 chars, starts with letter, all digits after'],
        ['z00000000000000000000', '21 chars, starts with z'],
      ])('should return true for "%s" (%s)', (value, _description) => {
        // When
        const result = validateCuid2Format(value);

        // Then
        expect(result).toBe(true);
      });
    });

    describe('Given invalid CUID2 formats - wrong length', () => {
      it.each([
        ['abc', 'too short (3 chars)'],
        ['cm12345678901234567', 'too short (19 chars)'],
        ['cm12345678901234567890123456789012', 'too long (34 chars)'],
      ])('should return false for "%s" (%s)', (value, _description) => {
        // When
        const result = validateCuid2Format(value);

        // Then
        expect(result).toBe(false);
      });
    });

    describe('Given invalid CUID2 formats - invalid characters', () => {
      it.each([
        ['CLW3H8X9Y0000QWERTYUI', 'uppercase letters'],
        ['clw3h8x9y_000qwertyui', 'contains underscore'],
        ['clw3h8x9y-000qwertyui', 'contains hyphen'],
        ['clw3h8x9y 000qwertyui', 'contains space'],
        ['clw3h8x9y.000qwertyui', 'contains period'],
        ['clw3h8x9y@000qwertyui', 'contains at-sign'],
      ])('should return false for "%s" (%s)', (value, _description) => {
        // When
        const result = validateCuid2Format(value);

        // Then
        expect(result).toBe(false);
      });
    });

    describe('Given invalid CUID2 formats - must start with letter', () => {
      it.each([
        ['1lw3h8x9y0000qwertyui', 'starts with number'],
        ['0abcdefghijklmnopqrs', 'starts with zero'],
        ['9abcdefghijklmnopqrs', 'starts with nine'],
      ])('should return false for "%s" (%s)', (value, _description) => {
        // When
        const result = validateCuid2Format(value);

        // Then
        expect(result).toBe(false);
      });
    });

    describe('Given empty string', () => {
      it('should return false for empty string', () => {
        // When
        const result = validateCuid2Format('');

        // Then
        expect(result).toBe(false);
      });
    });

    describe('Given null or undefined values', () => {
      it('should return true for null (validation delegated to @IsOptional)', () => {
        // When
        const result = validateCuid2Format(null);

        // Then
        expect(result).toBe(true);
      });

      it('should return true for undefined (validation delegated to @IsOptional)', () => {
        // When
        const result = validateCuid2Format(undefined);

        // Then
        expect(result).toBe(true);
      });
    });

    describe('Given non-string values', () => {
      it.each([
        [123, 'number'],
        [Number.MAX_SAFE_INTEGER, 'large number'],
        [{}, 'empty object'],
        [{ id: 'clw3h8x9y0000qwertyui' }, 'object with id property'],
        [[], 'empty array'],
        [['clw3h8x9y0000qwertyui'], 'array with valid CUID2'],
        [true, 'boolean true'],
        [false, 'boolean false'],
        [Symbol('cuid2'), 'symbol'],
        [() => 'clw3h8x9y0000qwertyui', 'function'],
      ])('should return false for %s (%s)', (value, _description) => {
        // When
        const result = validateCuid2Format(value);

        // Then
        expect(result).toBe(false);
      });
    });
  });

  describe('IsCuid2 Decorator with class-validator', () => {
    describe('Given valid CUID2', () => {
      it('should pass validation for a valid CUID2', async () => {
        // Given
        const dto = new TestDto();
        dto.id = 'clw3h8x9y0000qwertyui00001';

        // When
        const errors = await validate(dto);

        // Then
        expect(errors).toHaveLength(0);
      });

      it('should pass validation for minimum length CUID2 (20 chars)', async () => {
        // Given
        const dto = new TestDto();
        dto.id = 'cm1234567890abcdefgh';

        // When
        const errors = await validate(dto);

        // Then
        expect(errors).toHaveLength(0);
      });

      it('should pass validation for maximum length CUID2 (30 chars)', async () => {
        // Given
        const dto = new TestDto();
        dto.id = 'cm1234567890abcdefghijklmnop12';

        // When
        const errors = await validate(dto);

        // Then
        expect(errors).toHaveLength(0);
      });
    });

    describe('Given invalid CUID2', () => {
      it('should fail validation with descriptive error message', async () => {
        // Given
        const dto = new TestDto();
        dto.id = 'invalid-cuid';

        // When
        const errors = await validate(dto);

        // Then
        expect(errors).toHaveLength(1);
        expect(errors[0].constraints?.isCuid2).toContain('gültige CUID2');
        expect(errors[0].constraints?.isCuid2).toContain('20-30 Zeichen');
      });

      it('should fail validation for old NanoID format (uppercase)', async () => {
        // Given - Old NanoID with uppercase
        const dto = new TestDto();
        dto.id = 'V1StGXR8_Z5jdHi6B-myT';

        // When
        const errors = await validate(dto);

        // Then
        expect(errors).toHaveLength(1);
      });

      it('should fail validation for empty string', async () => {
        // Given
        const dto = new TestDto();
        dto.id = '';

        // When
        const errors = await validate(dto);

        // Then
        expect(errors).toHaveLength(1);
      });

      it('should fail validation for CUID2 starting with number', async () => {
        // Given
        const dto = new TestDto();
        dto.id = '1lw3h8x9y0000qwertyui';

        // When
        const errors = await validate(dto);

        // Then
        expect(errors).toHaveLength(1);
      });
    });

    describe('Given optional field', () => {
      it('should pass validation when optional field is undefined', async () => {
        // Given
        const dto = new TestDtoWithOptional();
        // id bleibt undefined

        // When
        const errors = await validate(dto);

        // Then
        expect(errors).toHaveLength(0);
      });
    });
  });

  describe('IsNanoId Decorator (deprecated, delegates to IsCuid2)', () => {
    it('should pass validation for valid CUID2 via legacy decorator', async () => {
      // Given
      const dto = new TestDtoLegacy();
      dto.id = 'clw3h8x9y0000qwertyui00001';

      // When
      const errors = await validate(dto);

      // Then
      expect(errors).toHaveLength(0);
    });

    it('should fail validation for old NanoID format via legacy decorator', async () => {
      // Given
      const dto = new TestDtoLegacy();
      dto.id = 'V1StGXR8_Z5jdHi6B-myT';

      // When
      const errors = await validate(dto);

      // Then
      expect(errors).toHaveLength(1);
    });
  });

  describe('validateNanoidFormat (deprecated, delegates to validateCuid2Format)', () => {
    it('should return true for valid CUID2', () => {
      // When
      const result = validateNanoidFormat('clw3h8x9y0000qwertyui00001');

      // Then
      expect(result).toBe(true);
    });

    it('should return false for old NanoID format', () => {
      // When
      const result = validateNanoidFormat('V1StGXR8_Z5jdHi6B-myT');

      // Then
      expect(result).toBe(false);
    });

    it('should ignore length parameter (CUID2 has variable length)', () => {
      // Given - CUID2 with 26 chars, even when length=16 is passed
      const cuid2 = 'clw3h8x9y0000qwertyui00001';

      // When
      const result = validateNanoidFormat(cuid2, 16);

      // Then - Should still pass because it's valid CUID2
      expect(result).toBe(true);
    });
  });

  describe('Edge Cases und Grenzwerte', () => {
    it('should handle boundary case: exactly 20 characters (minimum)', () => {
      // Given - genau 20 Zeichen
      const minLength = 'cm1234567890abcdefgh';
      expect(minLength).toHaveLength(20);

      // When
      const result = validateCuid2Format(minLength);

      // Then
      expect(result).toBe(true);
    });

    it('should handle boundary case: exactly 30 characters (maximum)', () => {
      // Given - genau 30 Zeichen
      const maxLength = 'cm1234567890abcdefghijklmnop12';
      expect(maxLength).toHaveLength(30);

      // When
      const result = validateCuid2Format(maxLength);

      // Then
      expect(result).toBe(true);
    });

    it('should reject CUID2 with unicode characters that look like ASCII', () => {
      // Given - Kyrillisches 'а' sieht aus wie lateinisches 'a'
      const cyrillicA = 'clw3h8x9y0000qwertyu\u0430'; // Kyrillisches а (U+0430)

      // When
      const result = validateCuid2Format(cyrillicA);

      // Then
      expect(result).toBe(false);
    });

    it('should reject CUID2 with zero-width characters', () => {
      // Given - Zero-width space versteckt in der Mitte
      const zeroWidth = 'clw3h8x9y0000qwerty\u200Bui'; // Zero-width space (U+200B)

      // When
      const result = validateCuid2Format(zeroWidth);

      // Then
      expect(result).toBe(false);
    });
  });

  describe('Regression Tests für Domain-generierte IDs', () => {
    /**
     * Diese Tests verwenden typische CUID2-Formate,
     * um sicherzustellen, dass existierende Domain-IDs korrekt validiert werden.
     */
    it.each(['clw3h8x9y0000qwertyui00001', 'cm1234567890abcdefghij', 'cloehfgti0001mk08lbzw', 'ckt2b5oe50000gxjj9d2p', 'cm4qz8x7y0002laberxys'])('should accept typical CUID2: %s', (cuid2) => {
      // When
      const result = validateCuid2Format(cuid2);

      // Then
      expect(result).toBe(true);
    });
  });
});
