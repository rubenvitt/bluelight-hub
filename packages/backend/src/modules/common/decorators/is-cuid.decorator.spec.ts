import { validate } from 'class-validator';
import { IsCuid, validateCuidFormat } from './is-cuid.decorator';

/**
 * Tests für IsCuid Decorator und validateCuidFormat Funktion.
 *
 * Diese Tests stellen sicher, dass das CUID-Format korrekt validiert wird,
 * insbesondere für Legacy-Daten die mit Prisma's cuid() generiert wurden.
 */
describe('IsCuid Decorator', () => {
  // Test-DTO Klasse für Decorator-Tests
  class TestDto {
    @IsCuid()
    id!: string;
  }

  class TestDtoWithOptional {
    @IsCuid()
    id?: string;
  }

  describe('validateCuidFormat', () => {
    describe('Given valid CUID formats', () => {
      it.each([
        ['clw3h8x9y0000qwertyuiopas', 'typisches Prisma CUID'],
        ['cm5abc1230000abcdef123456', 'anderes gültiges CUID'],
        ['c00000000000000000000000a', 'minimales CUID (nur c und Nullen)'],
        ['czzzzzzzzzzzzzzzzzzzzzzz9', 'maximales CUID (alle z und 9)'],
      ])('should return true for %s (%s)', (value, _description) => {
        // When
        const result = validateCuidFormat(value);

        // Then
        expect(result).toBe(true);
      });
    });

    describe('Given invalid CUID formats', () => {
      it.each([
        ['abc', 'zu kurz'],
        ['abcdefghijklmnopqrstuvwxy', 'beginnt nicht mit c'],
        ['Clw3h8x9y0000qwertyuiopas', 'beginnt mit Großbuchstabe'],
        ['clw3h8x9y0000qwertyuiopasXXX', 'zu lang'],
        ['clw3H8x9y0000qwertyuiopas', 'enthält Großbuchstabe in der Mitte'],
        ['clw3h8x9y0000qwerty_iopas', 'enthält Unterstrich'],
        ['clw3h8x9y0000qwerty-iopas', 'enthält Bindestrich'],
        ['clw3h8x9y0000 wertyuiopas', 'enthält Leerzeichen'],
        ['', 'leerer String'],
      ])('should return false for "%s" (%s)', (value, _description) => {
        // When
        const result = validateCuidFormat(value);

        // Then
        expect(result).toBe(false);
      });
    });

    describe('Given null or undefined values', () => {
      it('should return true for null (validation delegated to @IsOptional)', () => {
        // When
        const result = validateCuidFormat(null);

        // Then
        expect(result).toBe(true);
      });

      it('should return true for undefined (validation delegated to @IsOptional)', () => {
        // When
        const result = validateCuidFormat(undefined);

        // Then
        expect(result).toBe(true);
      });
    });

    describe('Given non-string values', () => {
      it.each([
        [123, 'number'],
        [{}, 'object'],
        [[], 'array'],
        [true, 'boolean'],
      ])('should return false for %s (%s)', (value, _description) => {
        // When
        const result = validateCuidFormat(value);

        // Then
        expect(result).toBe(false);
      });
    });
  });

  describe('IsCuid Decorator with class-validator', () => {
    describe('Given valid CUID', () => {
      it('should pass validation for a valid CUID', async () => {
        // Given
        const dto = new TestDto();
        dto.id = 'clw3h8x9y0000qwertyuiopas';

        // When
        const errors = await validate(dto);

        // Then
        expect(errors).toHaveLength(0);
      });
    });

    describe('Given invalid CUID', () => {
      it('should fail validation with descriptive error message', async () => {
        // Given
        const dto = new TestDto();
        dto.id = 'invalid-cuid';

        // When
        const errors = await validate(dto);

        // Then
        expect(errors).toHaveLength(1);
        expect(errors[0].constraints?.isCuid).toContain('gültige CUID');
        expect(errors[0].constraints?.isCuid).toContain('25 Zeichen');
      });

      it('should fail validation for NanoID format (21 chars)', async () => {
        // Given - NanoID hat 21 Zeichen und andere Zeichensätze
        const dto = new TestDto();
        dto.id = 'V1StGXR8_Z5jdHi6B-myT'; // Typisches NanoID

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

  describe('Regression Tests für Legacy Einsatz-IDs', () => {
    /**
     * Diese Tests verwenden echte CUID-Formate, die von Prisma generiert wurden,
     * um sicherzustellen, dass existierende Daten korrekt validiert werden.
     */
    it.each(['clw3h8x9y0000qwertyuiopas', 'cm5abcdef0000ghijklmnop12', 'cl9xyz1230000abcdefghij56'])('should accept legacy Einsatz-ID: %s', (legacyId) => {
      // When
      const result = validateCuidFormat(legacyId);

      // Then
      expect(result).toBe(true);
    });
  });
});
