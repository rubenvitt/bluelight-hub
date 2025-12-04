import { EtbKategorie, ETB_KATEGORIE_VALUES } from './etb-kategorie';

describe('EtbKategorie', () => {
  describe('create() - Factory Method', () => {
    describe('Valid Kategorien', () => {
      it('should create EtbKategorie with valid value LAGE', () => {
        // Given: Valide Kategorie LAGE
        const value = 'LAGE';

        // When: EtbKategorie wird erstellt
        const result = EtbKategorie.create(value);

        // Then: Result ist erfolgreich
        expect(result.isSuccess).toBe(true);
        expect(result.isFailure).toBe(false);
        expect(result.value).toBeDefined();
        expect(result.value?.value).toBe('LAGE');
        expect(result.error).toBeUndefined();
      });

      it('should create EtbKategorie with valid value ALARMIERUNG', () => {
        // Given: Valide Kategorie ALARMIERUNG
        const value = 'ALARMIERUNG';

        // When: EtbKategorie wird erstellt
        const result = EtbKategorie.create(value);

        // Then: Result ist erfolgreich
        expect(result.isSuccess).toBe(true);
        expect(result.value?.value).toBe('ALARMIERUNG');
      });

      it('should create EtbKategorie with valid value MASSNAHME', () => {
        // Given: Valide Kategorie MASSNAHME
        const value = 'MASSNAHME';

        // When: EtbKategorie wird erstellt
        const result = EtbKategorie.create(value);

        // Then: Result ist erfolgreich
        expect(result.isSuccess).toBe(true);
        expect(result.value?.value).toBe('MASSNAHME');
      });

      it('should create EtbKategorie with valid value SYSTEM', () => {
        // Given: Valide Kategorie SYSTEM
        const value = 'SYSTEM';

        // When: EtbKategorie wird erstellt
        const result = EtbKategorie.create(value);

        // Then: Result ist erfolgreich
        expect(result.isSuccess).toBe(true);
        expect(result.value?.value).toBe('SYSTEM');
      });

      it('should create EtbKategorie with valid value DOKUMENTATION', () => {
        // Given: Valide Kategorie DOKUMENTATION
        const value = 'DOKUMENTATION';

        // When: EtbKategorie wird erstellt
        const result = EtbKategorie.create(value);

        // Then: Result ist erfolgreich
        expect(result.isSuccess).toBe(true);
        expect(result.value?.value).toBe('DOKUMENTATION');
      });

      it('should create EtbKategorie with all valid values from ETB_KATEGORIE_VALUES', () => {
        // Given: Alle erlaubten Kategorie-Werte
        const validValues = ETB_KATEGORIE_VALUES;

        // When: Alle Kategorien werden erstellt
        const results = validValues.map((value) => EtbKategorie.create(value));

        // Then: Alle Results sind erfolgreich
        for (const result of results) {
          expect(result.isSuccess).toBe(true);
          expect(result.value).toBeDefined();
        }
      });
    });

    describe('Invalid Kategorien', () => {
      it('should fail with invalid kategorie value', () => {
        // Given: Ungueltige Kategorie
        const invalidValue = 'INVALID_KATEGORIE';

        // When: EtbKategorie wird mit ungueltigem Wert erstellt
        const result = EtbKategorie.create(invalidValue);

        // Then: Result schlaegt fehl mit Fehlermeldung
        expect(result.isFailure).toBe(true);
        expect(result.isSuccess).toBe(false);
        expect(result.value).toBeUndefined();
        expect(result.error).toBeDefined();
        expect(result.error).toContain('Ungueltige Kategorie');
        expect(result.error).toContain('INVALID_KATEGORIE');
        expect(result.error).toContain('LAGE');
        expect(result.error).toContain('ALARMIERUNG');
      });

      it('should fail with empty string', () => {
        // Given: Leerer String
        const emptyValue = '';

        // When: EtbKategorie wird mit leerem String erstellt
        const result = EtbKategorie.create(emptyValue);

        // Then: Result schlaegt fehl
        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Ungueltige Kategorie');
      });

      it('should fail with lowercase kategorie value', () => {
        // Given: Lowercase Version einer validen Kategorie (case-sensitive)
        const lowercaseValue = 'lage';

        // When: EtbKategorie wird mit lowercase Wert erstellt
        const result = EtbKategorie.create(lowercaseValue);

        // Then: Result schlaegt fehl (Kategorien sind case-sensitive)
        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Ungueltige Kategorie');
        expect(result.error).toContain('lage');
      });

      it('should fail with partial match kategorie value', () => {
        // Given: Teilstring einer validen Kategorie
        const partialValue = 'LAG';

        // When: EtbKategorie wird mit Teilstring erstellt
        const result = EtbKategorie.create(partialValue);

        // Then: Result schlaegt fehl
        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Ungueltige Kategorie');
      });

      it('should fail with whitespace-padded kategorie value', () => {
        // Given: Valide Kategorie mit Whitespace
        const paddedValue = ' LAGE ';

        // When: EtbKategorie wird mit Whitespace erstellt
        const result = EtbKategorie.create(paddedValue);

        // Then: Result schlaegt fehl (kein Trimming)
        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Ungueltige Kategorie');
      });
    });
  });

  describe('Static Factory Methods', () => {
    it('should create ALARMIERUNG via static factory', () => {
      // Given: Static Factory ALARMIERUNG()
      // When: Kategorie wird erstellt
      const kategorie = EtbKategorie.ALARMIERUNG();

      // Then: Korrekte Kategorie ohne Validierung
      expect(kategorie.value).toBe('ALARMIERUNG');
      expect(kategorie).toBeInstanceOf(EtbKategorie);
    });

    it('should create ANKUNFT via static factory', () => {
      // Given: Static Factory ANKUNFT()
      // When: Kategorie wird erstellt
      const kategorie = EtbKategorie.ANKUNFT();

      // Then: Korrekte Kategorie
      expect(kategorie.value).toBe('ANKUNFT');
    });

    it('should create BEFEHL via static factory', () => {
      // Given: Static Factory BEFEHL()
      // When: Kategorie wird erstellt
      const kategorie = EtbKategorie.BEFEHL();

      // Then: Korrekte Kategorie
      expect(kategorie.value).toBe('BEFEHL');
    });

    it('should create ERKUNDUNG via static factory', () => {
      // Given: Static Factory ERKUNDUNG()
      // When: Kategorie wird erstellt
      const kategorie = EtbKategorie.ERKUNDUNG();

      // Then: Korrekte Kategorie
      expect(kategorie.value).toBe('ERKUNDUNG');
    });

    it('should create LAGE via static factory (default kategorie)', () => {
      // Given: Static Factory LAGE() (Default-Kategorie)
      // When: Kategorie wird erstellt
      const kategorie = EtbKategorie.LAGE();

      // Then: Korrekte Default-Kategorie
      expect(kategorie.value).toBe('LAGE');
    });

    it('should create MASSNAHME via static factory', () => {
      // Given: Static Factory MASSNAHME()
      // When: Kategorie wird erstellt
      const kategorie = EtbKategorie.MASSNAHME();

      // Then: Korrekte Kategorie
      expect(kategorie.value).toBe('MASSNAHME');
    });

    it('should create PERSONAL via static factory', () => {
      // Given: Static Factory PERSONAL()
      // When: Kategorie wird erstellt
      const kategorie = EtbKategorie.PERSONAL();

      // Then: Korrekte Kategorie
      expect(kategorie.value).toBe('PERSONAL');
    });

    it('should create FAHRZEUG via static factory', () => {
      // Given: Static Factory FAHRZEUG()
      // When: Kategorie wird erstellt
      const kategorie = EtbKategorie.FAHRZEUG();

      // Then: Korrekte Kategorie
      expect(kategorie.value).toBe('FAHRZEUG');
    });

    it('should create MATERIAL via static factory', () => {
      // Given: Static Factory MATERIAL()
      // When: Kategorie wird erstellt
      const kategorie = EtbKategorie.MATERIAL();

      // Then: Korrekte Kategorie
      expect(kategorie.value).toBe('MATERIAL');
    });

    it('should create KOMMUNIKATION via static factory', () => {
      // Given: Static Factory KOMMUNIKATION()
      // When: Kategorie wird erstellt
      const kategorie = EtbKategorie.KOMMUNIKATION();

      // Then: Korrekte Kategorie
      expect(kategorie.value).toBe('KOMMUNIKATION');
    });

    it('should create WETTER via static factory', () => {
      // Given: Static Factory WETTER()
      // When: Kategorie wird erstellt
      const kategorie = EtbKategorie.WETTER();

      // Then: Korrekte Kategorie
      expect(kategorie.value).toBe('WETTER');
    });

    it('should create DOKUMENTATION via static factory', () => {
      // Given: Static Factory DOKUMENTATION()
      // When: Kategorie wird erstellt
      const kategorie = EtbKategorie.DOKUMENTATION();

      // Then: Korrekte Kategorie
      expect(kategorie.value).toBe('DOKUMENTATION');
    });

    it('should create SONSTIGES via static factory', () => {
      // Given: Static Factory SONSTIGES()
      // When: Kategorie wird erstellt
      const kategorie = EtbKategorie.SONSTIGES();

      // Then: Korrekte Kategorie
      expect(kategorie.value).toBe('SONSTIGES');
    });

    it('should create SYSTEM via static factory', () => {
      // Given: Static Factory SYSTEM()
      // When: Kategorie wird erstellt
      const kategorie = EtbKategorie.SYSTEM();

      // Then: Korrekte Kategorie
      expect(kategorie.value).toBe('SYSTEM');
    });

    it('should have static factory for all ETB_KATEGORIE_VALUES', () => {
      // Given: Alle Kategorien aus ETB_KATEGORIE_VALUES
      const expectedFactories: Record<string, () => EtbKategorie> = {
        ALARMIERUNG: EtbKategorie.ALARMIERUNG,
        ANKUNFT: EtbKategorie.ANKUNFT,
        BEFEHL: EtbKategorie.BEFEHL,
        ERKUNDUNG: EtbKategorie.ERKUNDUNG,
        LAGE: EtbKategorie.LAGE,
        MASSNAHME: EtbKategorie.MASSNAHME,
        PERSONAL: EtbKategorie.PERSONAL,
        FAHRZEUG: EtbKategorie.FAHRZEUG,
        MATERIAL: EtbKategorie.MATERIAL,
        KOMMUNIKATION: EtbKategorie.KOMMUNIKATION,
        WETTER: EtbKategorie.WETTER,
        DOKUMENTATION: EtbKategorie.DOKUMENTATION,
        SONSTIGES: EtbKategorie.SONSTIGES,
        SYSTEM: EtbKategorie.SYSTEM,
      };

      // When: Alle Factories werden aufgerufen
      for (const [key, factory] of Object.entries(expectedFactories)) {
        const kategorie = factory();
        // Then: Kategorie entspricht dem Key
        expect(kategorie.value).toBe(key);
      }

      // Then: Anzahl der Factories = Anzahl der erlaubten Werte
      expect(Object.keys(expectedFactories).length).toBe(ETB_KATEGORIE_VALUES.length);
    });
  });

  describe('toString() - String Conversion', () => {
    it('should convert LAGE to string', () => {
      // Given: Kategorie LAGE
      const kategorie = EtbKategorie.LAGE();

      // When: Konvertierung zu String
      const str = kategorie.toString();

      // Then: String entspricht dem Wert
      expect(str).toBe('LAGE');
    });

    it('should convert ALARMIERUNG to string', () => {
      // Given: Kategorie ALARMIERUNG
      const kategorie = EtbKategorie.ALARMIERUNG();

      // When: Konvertierung zu String
      const str = kategorie.toString();

      // Then: String entspricht dem Wert
      expect(str).toBe('ALARMIERUNG');
    });

    it('should convert all kategorien to string correctly', () => {
      // Given: Alle Kategorien
      const kategorien = ETB_KATEGORIE_VALUES.map((value) => EtbKategorie.create(value).value!);

      // When: Konvertierung zu Strings
      const strings = kategorien.map((k) => k.toString());

      // Then: Strings entsprechen den Werten
      for (let i = 0; i < strings.length; i++) {
        expect(strings[i]).toBe(ETB_KATEGORIE_VALUES[i]);
      }
    });
  });

  describe('equals() - Equality Comparison', () => {
    it('should return true for two identical LAGE kategorien', () => {
      // Given: Zwei LAGE Kategorien
      const kategorie1 = EtbKategorie.LAGE();
      const kategorie2 = EtbKategorie.LAGE();

      // When: Gleichheit wird geprueft
      const areEqual = kategorie1.equals(kategorie2);

      // Then: Kategorien sind gleich
      expect(areEqual).toBe(true);
      expect(kategorie1).not.toBe(kategorie2); // Different instances
    });

    it('should return false for different kategorien', () => {
      // Given: Zwei verschiedene Kategorien
      const lage = EtbKategorie.LAGE();
      const alarm = EtbKategorie.ALARMIERUNG();

      // When: Gleichheit wird geprueft
      const areEqual = lage.equals(alarm);

      // Then: Kategorien sind nicht gleich
      expect(areEqual).toBe(false);
    });

    it('should return true for same kategorie created via different methods', () => {
      // Given: Gleiche Kategorie via Factory und create()
      const viaFactory = EtbKategorie.MASSNAHME();
      const viaCreate = EtbKategorie.create('MASSNAHME').value!;

      // When: Gleichheit wird geprueft
      const areEqual = viaFactory.equals(viaCreate);

      // Then: Kategorien sind gleich (Value-Based Equality)
      expect(areEqual).toBe(true);
    });

    it('should return true when comparing with itself (same reference)', () => {
      // Given: Gleiche Referenz
      const kategorie = EtbKategorie.LAGE();

      // When: Gleichheit mit sich selbst
      const areEqual = kategorie.equals(kategorie);

      // Then: Gleich
      expect(areEqual).toBe(true);
    });

    it('should return false when comparing with undefined', () => {
      // Given: Kategorie und undefined
      const kategorie = EtbKategorie.LAGE();

      // When: Vergleich mit undefined
      const areEqual = kategorie.equals(undefined);

      // Then: Nicht gleich
      expect(areEqual).toBe(false);
    });
  });

  describe('Immutability', () => {
    it('should freeze props to prevent mutations', () => {
      // Given: Kategorie Instanz
      const kategorie = EtbKategorie.LAGE();

      // When: Frozen-Status wird geprueft
      const isFrozen = Object.isFrozen(kategorie.props);

      // Then: Props sind frozen
      expect(isFrozen).toBe(true);
    });

    it('should prevent runtime mutation of value', () => {
      // Given: Kategorie Instanz
      const kategorie = EtbKategorie.LAGE();

      // When: Versuch value zu aendern
      const mutationAttempt = () => {
        (kategorie.props as { value: string }).value = 'SYSTEM';
      };

      // Then: Mutation wirft Fehler (Object.freeze)
      expect(mutationAttempt).toThrow();
    });
  });

  describe('ETB_KATEGORIE_VALUES - Exported Constants', () => {
    it('should export ETB_KATEGORIE_VALUES as readonly array', () => {
      // Given: Exported constant
      // When: Array wird geprueft
      // Then: Array ist vorhanden und readonly
      expect(ETB_KATEGORIE_VALUES).toBeDefined();
      expect(Array.isArray(ETB_KATEGORIE_VALUES)).toBe(true);
      expect(ETB_KATEGORIE_VALUES.length).toBeGreaterThan(0);
    });

    it('should contain all expected kategorie values', () => {
      // Given: Erwartete Kategorien
      const expectedValues = [
        'ALARMIERUNG',
        'ANKUNFT',
        'BEFEHL',
        'ERKUNDUNG',
        'LAGE',
        'MASSNAHME',
        'PERSONAL',
        'FAHRZEUG',
        'MATERIAL',
        'KOMMUNIKATION',
        'WETTER',
        'DOKUMENTATION',
        'SONSTIGES',
        'SYSTEM',
      ];

      // When: Values werden geprueft
      // Then: Alle erwarteten Werte sind vorhanden
      for (const expected of expectedValues) {
        expect(ETB_KATEGORIE_VALUES).toContain(expected);
      }
      expect(ETB_KATEGORIE_VALUES.length).toBe(expectedValues.length);
    });

    it('should have LAGE as default kategorie (present in array)', () => {
      // Given: ETB_KATEGORIE_VALUES
      // When: LAGE wird gesucht
      const hasLage = ETB_KATEGORIE_VALUES.includes('LAGE');

      // Then: LAGE ist vorhanden (Default-Kategorie)
      expect(hasLage).toBe(true);
    });
  });

  describe('Getter - value', () => {
    it('should provide readonly access to kategorie value', () => {
      // Given: Kategorie mit value
      const kategorie = EtbKategorie.LAGE();

      // When: Value wird abgerufen
      const value = kategorie.value;

      // Then: Korrekter Wert
      expect(value).toBe('LAGE');
      expect(typeof value).toBe('string');
    });

    it('should return correct value for all kategorien', () => {
      // Given: Alle Kategorien
      const kategorien = ETB_KATEGORIE_VALUES.map((v) => EtbKategorie.create(v).value!);

      // When: Values werden abgerufen
      const values = kategorien.map((k) => k.value);

      // Then: Values entsprechen den erwarteten Werten
      expect(values).toEqual(ETB_KATEGORIE_VALUES);
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in invalid kategorie names', () => {
      // Given: Kategorie mit Sonderzeichen
      const invalidValue = 'LAGE-ÄNDERUNG';

      // When: EtbKategorie wird erstellt
      const result = EtbKategorie.create(invalidValue);

      // Then: Schlaegt fehl
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Ungueltige Kategorie');
    });

    it('should handle numeric-like strings', () => {
      // Given: Numerischer String
      const invalidValue = '12345';

      // When: EtbKategorie wird erstellt
      const result = EtbKategorie.create(invalidValue);

      // Then: Schlaegt fehl
      expect(result.isFailure).toBe(true);
    });

    it('should handle very long invalid kategorie names', () => {
      // Given: Sehr langer String
      const longInvalid = 'A'.repeat(500);

      // When: EtbKategorie wird erstellt
      const result = EtbKategorie.create(longInvalid);

      // Then: Schlaegt fehl
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Ungueltige Kategorie');
    });
  });
});
