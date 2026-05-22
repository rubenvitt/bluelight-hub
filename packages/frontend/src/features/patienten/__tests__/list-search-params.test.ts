import { describe, expect, it } from 'vitest';
import { validatePatientenListSearch } from '../api/list-search-params';

/**
 * Tests für die gemeinsame Search-Param-Validierung beider Patienten-Listen-Routen
 * (F29, F30, F34).
 */
describe('validatePatientenListSearch', () => {
  it('parses comma-separated sk filter into array', () => {
    const result = validatePatientenListSearch({ sk: 'SK_I,SK_II' });
    expect(result.sk).toEqual(['SK_I', 'SK_II']);
  });

  it('drops invalid sk values (whitelist)', () => {
    const result = validatePatientenListSearch({ sk: 'SK_I,UNKNOWN' });
    expect(result.sk).toEqual(['SK_I']);
  });

  it('returns undefined when whitelist filters all values out', () => {
    const result = validatePatientenListSearch({ behandlungsstatus: 'NOPE' });
    expect(result.behandlungsstatus).toBeUndefined();
  });

  it('rejects non-integer page (F34)', () => {
    const result = validatePatientenListSearch({ page: 1.5 });
    expect(result.page).toBeUndefined();
  });

  it('rejects page outside min/max range', () => {
    expect(validatePatientenListSearch({ page: 0 }).page).toBeUndefined();
    expect(validatePatientenListSearch({ page: 99_999 }).page).toBeUndefined();
  });

  it('accepts integer page within range', () => {
    expect(validatePatientenListSearch({ page: 5 }).page).toBe(5);
  });

  it('rejects non-integer pageSize (F34)', () => {
    expect(validatePatientenListSearch({ pageSize: 10.7 }).pageSize).toBeUndefined();
  });

  it('accepts a valid CUID2 patientId with action=detail (F30)', () => {
    const validCuid = 'a' + 'b'.repeat(23); // 24 chars, starts with letter
    const result = validatePatientenListSearch({ action: 'detail', patientId: validCuid });
    expect(result.patientId).toBe(validCuid);
    expect(result.action).toBe('detail');
  });

  it('rejects invalid (too short) patientId — replaces magic length >= 6 (F30)', () => {
    const result = validatePatientenListSearch({ action: 'detail', patientId: 'abc123' });
    expect(result.patientId).toBeUndefined();
    expect(result.action).toBeUndefined();
  });

  it('rejects patientId that does not start with a letter', () => {
    const invalid = '1' + 'a'.repeat(23);
    expect(validatePatientenListSearch({ patientId: invalid }).patientId).toBeUndefined();
  });

  it('drops action when patientId is missing', () => {
    const result = validatePatientenListSearch({ action: 'detail' });
    expect(result.action).toBeUndefined();
    expect(result.patientId).toBeUndefined();
  });

  it('trims whitespace around patientId before validating', () => {
    const cuid = 'a' + 'b'.repeat(23);
    const result = validatePatientenListSearch({ action: 'detail', patientId: `  ${cuid}  ` });
    expect(result.patientId).toBe(cuid);
  });

  it('preserves valid sort fields and drops unknown sort values', () => {
    expect(validatePatientenListSearch({ sortBy: 'sk', sortDir: 'asc' })).toMatchObject({
      sortBy: 'sk',
      sortDir: 'asc',
    });
    expect(validatePatientenListSearch({ sortBy: 'unknown', sortDir: 'sideways' })).toMatchObject({
      sortBy: undefined,
      sortDir: undefined,
    });
  });

  it('returns empty search-string as undefined', () => {
    expect(validatePatientenListSearch({ search: '' }).search).toBeUndefined();
    expect(validatePatientenListSearch({ search: 'foo' }).search).toBe('foo');
  });
});
