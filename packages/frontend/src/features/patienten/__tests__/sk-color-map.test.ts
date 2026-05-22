import { describe, expect, it } from 'vitest';
import { SK_COLOR_MAP } from '../constants/sk-color-map';

describe('SK_COLOR_MAP (Story 1.2, SiKoKo/DIN 13050; Tokens-Migration Story 1.5)', () => {
  it('alle 5 SK-Kategorien sind definiert', () => {
    expect(Object.keys(SK_COLOR_MAP).sort()).toEqual(['SK_I', 'SK_II', 'SK_III', 'SK_IV', 'TOT']);
  });

  it('SK_IV ist verbindlich BLAU (Token-Familie sk-blau, nicht Schwarz/Tot)', () => {
    expect(SK_COLOR_MAP.SK_IV.klass).toContain('sk-blau');
    expect(SK_COLOR_MAP.SK_IV.klass).not.toContain('sk-schwarz');
  });

  it('TOT ist verbindlich SCHWARZ (Token-Familie sk-schwarz, separate Kategorie)', () => {
    expect(SK_COLOR_MAP.TOT.klass).toContain('sk-schwarz');
    expect(SK_COLOR_MAP.TOT.text).toBeTruthy();
  });

  it('SK_I nutzt Token-Familie sk-rot (Akut)', () => {
    expect(SK_COLOR_MAP.SK_I.klass).toContain('sk-rot');
  });

  it('SK_II nutzt Token-Familie sk-gelb (Dringlich)', () => {
    expect(SK_COLOR_MAP.SK_II.klass).toContain('sk-gelb');
  });

  it('SK_III nutzt Token-Familie sk-gruen (Nicht dringlich)', () => {
    expect(SK_COLOR_MAP.SK_III.klass).toContain('sk-gruen');
  });

  it('jede Kategorie liefert surface/border/text/fill/klass als CSS-var-Referenzen', () => {
    for (const sk of Object.keys(SK_COLOR_MAP) as Array<keyof typeof SK_COLOR_MAP>) {
      const token = SK_COLOR_MAP[sk];
      expect(token.surface).toMatch(/^var\(--color-sk-/);
      expect(token.border).toMatch(/^var\(--color-sk-/);
      expect(token.text).toMatch(/^var\(--color-sk-/);
      expect(token.fill).toMatch(/^var\(--color-sk-/);
      expect(token.klass).toBeTruthy();
    }
  });
});
