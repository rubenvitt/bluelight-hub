import { Address } from './address';

describe('Address', () => {
  describe('create() - Factory Method', () => {
    describe('Valid PLZ Formats', () => {
      it('should create Address with valid 5-digit PLZ', () => {
        // Given: Valid German PLZ
        const props = {
          strasse: 'Musterstr.',
          hausnummer: '42',
          plz: '80331',
          ort: 'München',
        };

        // When: Creating Address
        const result = Address.create(props);

        // Then: Success with correct values
        expect(result.isSuccess).toBe(true);
        expect(result.isFailure).toBe(false);
        expect(result.value).toBeDefined();
        expect(result.value?.plz).toBe('80331');
        expect(result.value?.strasse).toBe('Musterstr.');
        expect(result.value?.hausnummer).toBe('42');
        expect(result.value?.ort).toBe('München');
      });

      it('should create Address with PLZ starting with zero (Dresden)', () => {
        // Given: Valid PLZ with leading zero
        const props = { plz: '01067', ort: 'Dresden' };

        // When: Creating Address
        const result = Address.create(props);

        // Then: Success (leading zeros are significant)
        expect(result.isSuccess).toBe(true);
        expect(result.value?.plz).toBe('01067');
      });

      it('should create Address with all-zero PLZ', () => {
        // Given: Edge case PLZ (00000)
        const props = { plz: '00000' };

        // When: Creating Address
        const result = Address.create(props);

        // Then: Success (format is valid, even if unrealistic)
        expect(result.isSuccess).toBe(true);
        expect(result.value?.plz).toBe('00000');
      });
    });

    describe('Invalid PLZ Formats', () => {
      it('should fail with 4-digit PLZ (too short)', () => {
        // Given: Invalid PLZ (too short)
        const props = { plz: '1234' };

        // When: Creating Address
        const result = Address.create(props);

        // Then: Failure with error message
        expect(result.isFailure).toBe(true);
        expect(result.isSuccess).toBe(false);
        expect(result.error).toContain('PLZ ungültig');
        expect(result.error).toContain('5 Ziffern');
        expect(result.value).toBeUndefined();
      });

      it('should fail with 6-digit PLZ (too long)', () => {
        // Given: Invalid PLZ (too long)
        const props = { plz: '123456' };

        // When: Creating Address
        const result = Address.create(props);

        // Then: Failure
        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('PLZ ungültig');
      });

      it('should fail with alphanumeric PLZ', () => {
        // Given: Invalid PLZ (letters included)
        const props = { plz: '803A1' };

        // When: Creating Address
        const result = Address.create(props);

        // Then: Failure
        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('PLZ ungültig');
      });

      it('should fail with PLZ containing spaces', () => {
        // Given: Invalid PLZ (spaces)
        const props = { plz: '80 331' };

        // When: Creating Address
        const result = Address.create(props);

        // Then: Failure
        expect(result.isFailure).toBe(true);
      });

      it('should fail with empty string PLZ', () => {
        // Given: Invalid PLZ (empty string)
        const props = { plz: '' };

        // When: Creating Address
        const result = Address.create(props);

        // Then: Failure
        expect(result.isFailure).toBe(true);
      });

      it('should fail with PLZ containing special characters', () => {
        // Given: Invalid PLZ (special chars)
        const props = { plz: '80-31' };

        // When: Creating Address
        const result = Address.create(props);

        // Then: Failure
        expect(result.isFailure).toBe(true);
      });
    });

    describe('Optional PLZ Field', () => {
      it('should succeed when PLZ is undefined (optional field)', () => {
        // Given: No PLZ provided
        const props = { strasse: 'Hauptstr.', ort: 'Berlin' };

        // When: Creating Address
        const result = Address.create(props);

        // Then: Success (PLZ is optional)
        expect(result.isSuccess).toBe(true);
        expect(result.value?.plz).toBeUndefined();
        expect(result.value?.strasse).toBe('Hauptstr.');
        expect(result.value?.ort).toBe('Berlin');
      });

      it('should succeed with empty Address (all fields undefined)', () => {
        // Given: No fields provided
        const props = {};

        // When: Creating Address
        const result = Address.create(props);

        // Then: Success (all fields are optional)
        expect(result.isSuccess).toBe(true);
        expect(result.value?.plz).toBeUndefined();
        expect(result.value?.strasse).toBeUndefined();
        expect(result.value?.hausnummer).toBeUndefined();
        expect(result.value?.ort).toBeUndefined();
      });

      it('should succeed with only PLZ provided', () => {
        // Given: Only PLZ (no other address fields)
        const props = { plz: '10115' };

        // When: Creating Address
        const result = Address.create(props);

        // Then: Success
        expect(result.isSuccess).toBe(true);
        expect(result.value?.plz).toBe('10115');
      });
    });
  });

  describe('toString() - Formatted Output', () => {
    describe('Complete Addresses', () => {
      it('should format complete address with all fields', () => {
        // Given: Address with all fields
        const addr = Address.create({
          strasse: 'Musterstr.',
          hausnummer: '42',
          plz: '80331',
          ort: 'München',
        }).value!;

        // When: Converting to string
        const formatted = addr.toString();

        // Then: Formatted as "Strasse Hausnummer, PLZ Ort"
        expect(formatted).toBe('Musterstr. 42, 80331 München');
      });

      it('should format address with PLZ containing leading zero', () => {
        // Given: Address with leading-zero PLZ
        const addr = Address.create({
          strasse: 'Prager Str.',
          hausnummer: '10',
          plz: '01067',
          ort: 'Dresden',
        }).value!;

        // When: Converting to string
        const formatted = addr.toString();

        // Then: Leading zero preserved
        expect(formatted).toBe('Prager Str. 10, 01067 Dresden');
      });
    });

    describe('Partial Addresses', () => {
      it('should handle missing hausnummer gracefully', () => {
        // Given: Address without Hausnummer
        const addr = Address.create({
          strasse: 'Hauptstr.',
          plz: '10115',
          ort: 'Berlin',
        }).value!;

        // When: Converting to string
        const formatted = addr.toString();

        // Then: Formatted without hausnummer
        expect(formatted).toBe('Hauptstr., 10115 Berlin');
      });

      it('should handle missing PLZ gracefully', () => {
        // Given: Address without PLZ
        const addr = Address.create({
          strasse: 'Bahnhofstr.',
          hausnummer: '1',
          ort: 'Hamburg',
        }).value!;

        // When: Converting to string
        const formatted = addr.toString();

        // Then: Formatted without PLZ
        expect(formatted).toBe('Bahnhofstr. 1, Hamburg');
      });

      it('should handle missing Ort gracefully', () => {
        // Given: Address without Ort
        const addr = Address.create({
          strasse: 'Lindenstr.',
          hausnummer: '5',
          plz: '50667',
        }).value!;

        // When: Converting to string
        const formatted = addr.toString();

        // Then: Formatted without Ort
        expect(formatted).toBe('Lindenstr. 5, 50667');
      });

      it('should handle missing Strasse gracefully', () => {
        // Given: Address without Strasse
        const addr = Address.create({
          plz: '20095',
          ort: 'Hamburg',
        }).value!;

        // When: Converting to string
        const formatted = addr.toString();

        // Then: Only PLZ and Ort
        expect(formatted).toBe('20095 Hamburg');
      });

      it('should handle only Strasse and Hausnummer', () => {
        // Given: Address with only street info
        const addr = Address.create({
          strasse: 'Marktplatz',
          hausnummer: '3',
        }).value!;

        // When: Converting to string
        const formatted = addr.toString();

        // Then: Only street info
        expect(formatted).toBe('Marktplatz 3');
      });

      it('should handle only Strasse (no Hausnummer)', () => {
        // Given: Address with only street name
        const addr = Address.create({
          strasse: 'Hauptbahnhof',
        }).value!;

        // When: Converting to string
        const formatted = addr.toString();

        // Then: Only street name
        expect(formatted).toBe('Hauptbahnhof');
      });

      it('should handle only Ort', () => {
        // Given: Address with only city
        const addr = Address.create({
          ort: 'Berlin',
        }).value!;

        // When: Converting to string
        const formatted = addr.toString();

        // Then: Only city
        expect(formatted).toBe('Berlin');
      });

      it('should handle only PLZ', () => {
        // Given: Address with only postal code
        const addr = Address.create({
          plz: '60311',
        }).value!;

        // When: Converting to string
        const formatted = addr.toString();

        // Then: Only PLZ
        expect(formatted).toBe('60311');
      });
    });

    describe('Empty Address', () => {
      it('should return empty string for Address with no fields', () => {
        // Given: Empty address
        const addr = Address.create({}).value!;

        // When: Converting to string
        const formatted = addr.toString();

        // Then: Empty string
        expect(formatted).toBe('');
      });
    });
  });

  describe('equals() - Structural Equality', () => {
    it('should return true for addresses with identical values', () => {
      // Given: Two addresses with same data
      const addr1 = Address.create({
        strasse: 'Main St',
        plz: '12345',
        ort: 'City',
      }).value!;
      const addr2 = Address.create({
        strasse: 'Main St',
        plz: '12345',
        ort: 'City',
      }).value!;

      // When: Comparing
      const areEqual = addr1.equals(addr2);

      // Then: Structurally equal
      expect(areEqual).toBe(true);
      expect(addr1).not.toBe(addr2); // Different instances
    });

    it('should return false for addresses with different PLZ', () => {
      // Given: Two addresses with different PLZ
      const addr1 = Address.create({ plz: '80331' }).value!;
      const addr2 = Address.create({ plz: '10115' }).value!;

      // When: Comparing
      const areEqual = addr1.equals(addr2);

      // Then: Not equal
      expect(areEqual).toBe(false);
    });

    it('should return false for addresses with different Strasse', () => {
      // Given: Two addresses with different street
      const addr1 = Address.create({ strasse: 'Hauptstr.' }).value!;
      const addr2 = Address.create({ strasse: 'Nebenstr.' }).value!;

      // When: Comparing
      const areEqual = addr1.equals(addr2);

      // Then: Not equal
      expect(areEqual).toBe(false);
    });

    it('should return true for identical empty addresses', () => {
      // Given: Two empty addresses
      const addr1 = Address.create({}).value!;
      const addr2 = Address.create({}).value!;

      // When: Comparing
      const areEqual = addr1.equals(addr2);

      // Then: Equal (both empty)
      expect(areEqual).toBe(true);
    });

    it('should return false when comparing with undefined', () => {
      // Given: Address and undefined
      const addr = Address.create({ plz: '12345' }).value!;

      // When: Comparing with undefined
      const areEqual = addr.equals(undefined);

      // Then: Not equal
      expect(areEqual).toBe(false);
    });

    it('should return true when comparing with itself (same reference)', () => {
      // Given: Same address reference
      const addr = Address.create({ plz: '80331' }).value!;

      // When: Comparing with self
      const areEqual = addr.equals(addr);

      // Then: Equal (same reference)
      expect(areEqual).toBe(true);
    });

    it('should handle optional fields correctly in equality', () => {
      // Given: Addresses with same optional field values (both undefined or both missing)
      const addr1 = Address.create({
        strasse: 'Hauptstr.',
        plz: '12345',
        hausnummer: undefined,
      }).value!;
      const addr2 = Address.create({
        strasse: 'Hauptstr.',
        plz: '12345',
        hausnummer: undefined,
      }).value!;

      // When: Comparing
      const areEqual = addr1.equals(addr2);

      // Then: Equal (same structure, same values)
      expect(areEqual).toBe(true);
    });
  });

  describe('hashCode() - Hash Generation', () => {
    it('should generate same hashCode for equal addresses', () => {
      // Given: Two equal addresses
      const addr1 = Address.create({
        strasse: 'Teststr.',
        plz: '54321',
      }).value!;
      const addr2 = Address.create({
        strasse: 'Teststr.',
        plz: '54321',
      }).value!;

      // When: Generating hashCodes
      const hash1 = addr1.hashCode();
      const hash2 = addr2.hashCode();

      // Then: Same hash
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashCode for different addresses', () => {
      // Given: Two different addresses
      const addr1 = Address.create({ plz: '80331' }).value!;
      const addr2 = Address.create({ plz: '10115' }).value!;

      // When: Generating hashCodes
      const hash1 = addr1.hashCode();
      const hash2 = addr2.hashCode();

      // Then: Different hashes (highly probable)
      expect(hash1).not.toBe(hash2);
    });

    it('should generate consistent hashCode for same instance', () => {
      // Given: Single address instance
      const addr = Address.create({ ort: 'München' }).value!;

      // When: Calling hashCode multiple times
      const hash1 = addr.hashCode();
      const hash2 = addr.hashCode();

      // Then: Consistent hash
      expect(hash1).toBe(hash2);
    });

    it('should return numeric hashCode', () => {
      // Given: Address instance
      const addr = Address.create({ plz: '12345' }).value!;

      // When: Getting hashCode
      const hash = addr.hashCode();

      // Then: Is a number
      expect(typeof hash).toBe('number');
      expect(Number.isInteger(hash)).toBe(true);
    });
  });

  describe('Immutability', () => {
    it('should freeze props to prevent mutations', () => {
      // Given: Address instance
      const addr = Address.create({
        strasse: 'Immutable St',
        plz: '99999',
      }).value!;

      // When: Checking frozen state
      const isFrozen = Object.isFrozen(addr.props);

      // Then: Props are frozen
      expect(isFrozen).toBe(true);
    });

    it('should prevent runtime mutation of props', () => {
      // Given: Address instance
      const addr = Address.create({ plz: '11111' }).value!;

      // When: Attempting to mutate props
      const mutationAttempt = () => {
        (addr.props as { plz: string }).plz = '99999';
      };

      // Then: Mutation throws error in strict mode or silently fails
      // (Object.freeze prevents mutation)
      expect(mutationAttempt).toThrow();
    });

    it('should create shallow copy of props in constructor', () => {
      // Given: Props object
      const originalProps = { strasse: 'Original', plz: '12345' };
      const addr = Address.create(originalProps).value!;

      // When: Mutating original props object
      originalProps.strasse = 'Modified';

      // Then: Address props unchanged (shallow copy was made)
      expect(addr.strasse).toBe('Original');
      expect(originalProps.strasse).toBe('Modified');
    });
  });

  describe('Getters', () => {
    it('should provide readonly access to strasse', () => {
      // Given: Address with strasse
      const addr = Address.create({ strasse: 'Teststr.' }).value!;

      // When: Accessing strasse
      const strasse = addr.strasse;

      // Then: Correct value
      expect(strasse).toBe('Teststr.');
    });

    it('should provide readonly access to hausnummer', () => {
      // Given: Address with hausnummer
      const addr = Address.create({ hausnummer: '99' }).value!;

      // When: Accessing hausnummer
      const hausnummer = addr.hausnummer;

      // Then: Correct value
      expect(hausnummer).toBe('99');
    });

    it('should provide readonly access to plz', () => {
      // Given: Address with PLZ
      const addr = Address.create({ plz: '54321' }).value!;

      // When: Accessing plz
      const plz = addr.plz;

      // Then: Correct value
      expect(plz).toBe('54321');
    });

    it('should provide readonly access to ort', () => {
      // Given: Address with ort
      const addr = Address.create({ ort: 'Frankfurt' }).value!;

      // When: Accessing ort
      const ort = addr.ort;

      // Then: Correct value
      expect(ort).toBe('Frankfurt');
    });

    it('should return undefined for missing optional fields', () => {
      // Given: Empty address
      const addr = Address.create({}).value!;

      // When: Accessing fields
      const strasse = addr.strasse;
      const hausnummer = addr.hausnummer;
      const plz = addr.plz;
      const ort = addr.ort;

      // Then: All undefined
      expect(strasse).toBeUndefined();
      expect(hausnummer).toBeUndefined();
      expect(plz).toBeUndefined();
      expect(ort).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle address with only whitespace in fields (no validation)', () => {
      // Given: Address with whitespace-only fields (PLZ is excluded to avoid validation)
      const addr = Address.create({
        strasse: '   ',
        hausnummer: ' ',
        ort: '  ',
      }).value!;

      // When: Converting to string
      const formatted = addr.toString();

      // Then: Whitespace preserved (no trimming)
      // Format: "strasse hausnummer, ort" = "    , ort" (3 + space + 1 = 5 spaces, comma, space, 2 spaces)
      expect(formatted).toBe('     ,   ');
    });

    it('should handle very long street names', () => {
      // Given: Address with extremely long street name
      const longStreet = 'A'.repeat(500);
      const addr = Address.create({
        strasse: longStreet,
        plz: '12345',
      }).value!;

      // When: Accessing street
      const strasse = addr.strasse;

      // Then: Full length preserved
      expect(strasse).toBe(longStreet);
      expect(strasse?.length).toBe(500);
    });

    it('should handle unicode characters in address fields', () => {
      // Given: Address with unicode characters
      const addr = Address.create({
        strasse: 'Königstraße',
        ort: 'München',
      }).value!;

      // When: Converting to string
      const formatted = addr.toString();

      // Then: Unicode preserved
      expect(formatted).toBe('Königstraße, München');
      expect(addr.strasse).toBe('Königstraße');
    });

    it('should handle numeric-like strings in non-PLZ fields', () => {
      // Given: Address with numeric strings in non-PLZ fields
      const addr = Address.create({
        strasse: '123',
        hausnummer: '456',
        ort: '789',
      }).value!;

      // When: Accessing fields
      const strasse = addr.strasse;
      const ort = addr.ort;

      // Then: Stored as strings (no type coercion)
      expect(strasse).toBe('123');
      expect(ort).toBe('789');
      expect(typeof strasse).toBe('string');
    });
  });
});
