import { LIST_PATIENTEN_ERROR_CODES } from '../../../errors/list-patienten-error.codes';
import { ListPatientenQuery } from '../list-patienten.query';

describe('ListPatientenQuery.create (Story 1.6)', () => {
  it('liefert Defaults bei minimalen Props', () => {
    const result = ListPatientenQuery.create({ einsatzId: 'ein_01HXYZ' });
    expect(result.isSuccess).toBe(true);
    const query = result.value!;
    expect(query.einsatzId).toBe('ein_01HXYZ');
    expect(query.filters).toEqual({});
    expect(query.sort).toEqual({ field: 'sk', direction: 'asc' });
    expect(query.pagination).toEqual({ page: 1, pageSize: 50 });
  });

  it('trimmt einsatzId', () => {
    const result = ListPatientenQuery.create({ einsatzId: '   ein_x   ' });
    expect(result.isSuccess).toBe(true);
    expect(result.value!.einsatzId).toBe('ein_x');
  });

  it('lehnt leere einsatzId ab', () => {
    const result = ListPatientenQuery.create({ einsatzId: '   ' });
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(LIST_PATIENTEN_ERROR_CODES.EINSATZ_ID_REQUIRED);
  });

  it('akzeptiert gültige SK-Filter und übernimmt sie', () => {
    const result = ListPatientenQuery.create({
      einsatzId: 'ein_x',
      filters: { sk: ['SK_I', 'SK_II'] },
    });
    expect(result.isSuccess).toBe(true);
    expect(result.value!.filters.sk).toEqual(['SK_I', 'SK_II']);
  });

  it('lehnt unbekannten SK-Wert ab', () => {
    const result = ListPatientenQuery.create({
      einsatzId: 'ein_x',
      filters: { sk: ['SK_X' as unknown as 'SK_I'] },
    });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain(LIST_PATIENTEN_ERROR_CODES.SK_FILTER_INVALID);
  });

  it('akzeptiert gültige Behandlungs- und Transport-Filter', () => {
    const result = ListPatientenQuery.create({
      einsatzId: 'ein_x',
      filters: {
        behandlungsstatus: ['IN_BEHANDLUNG', 'TRANSPORTBEREIT'],
        transportstatus: ['WARTEND'],
      },
    });
    expect(result.isSuccess).toBe(true);
    expect(result.value!.filters.behandlungsstatus).toEqual(['IN_BEHANDLUNG', 'TRANSPORTBEREIT']);
    expect(result.value!.filters.transportstatus).toEqual(['WARTEND']);
  });

  it('lehnt unbekannten Behandlungs-Wert ab', () => {
    const result = ListPatientenQuery.create({
      einsatzId: 'ein_x',
      filters: { behandlungsstatus: ['FOO' as unknown as 'IN_BEHANDLUNG'] },
    });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain(LIST_PATIENTEN_ERROR_CODES.BEHANDLUNGSSTATUS_FILTER_INVALID);
  });

  it('lehnt unbekannten Transport-Wert ab', () => {
    const result = ListPatientenQuery.create({
      einsatzId: 'ein_x',
      filters: { transportstatus: ['UFO' as unknown as 'WARTEND'] },
    });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain(LIST_PATIENTEN_ERROR_CODES.TRANSPORTSTATUS_FILTER_INVALID);
  });

  it('behandelt leere Filter-Arrays als "kein Filter"', () => {
    const result = ListPatientenQuery.create({
      einsatzId: 'ein_x',
      filters: { sk: [], behandlungsstatus: [], transportstatus: [] },
    });
    expect(result.isSuccess).toBe(true);
    expect(result.value!.filters.sk).toBeUndefined();
    expect(result.value!.filters.behandlungsstatus).toBeUndefined();
    expect(result.value!.filters.transportstatus).toBeUndefined();
  });

  it('trimmt search und übernimmt es', () => {
    const result = ListPatientenQuery.create({
      einsatzId: 'ein_x',
      filters: { search: '  Mueller  ' },
    });
    expect(result.isSuccess).toBe(true);
    expect(result.value!.filters.search).toBe('Mueller');
  });

  it('behandelt leeren search als "kein Filter"', () => {
    const result = ListPatientenQuery.create({
      einsatzId: 'ein_x',
      filters: { search: '   ' },
    });
    expect(result.isSuccess).toBe(true);
    expect(result.value!.filters.search).toBeUndefined();
  });

  it('lehnt zu langen search ab (DoS-Schutz)', () => {
    const result = ListPatientenQuery.create({
      einsatzId: 'ein_x',
      filters: { search: 'x'.repeat(65) },
    });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain(LIST_PATIENTEN_ERROR_CODES.SEARCH_INVALID);
  });

  it('akzeptiert valide Sort-Optionen', () => {
    const result = ListPatientenQuery.create({
      einsatzId: 'ein_x',
      sort: { field: 'zeit', direction: 'desc' },
    });
    expect(result.isSuccess).toBe(true);
    expect(result.value!.sort).toEqual({ field: 'zeit', direction: 'desc' });
  });

  it('lehnt unbekanntes Sort-Feld ab', () => {
    const result = ListPatientenQuery.create({
      einsatzId: 'ein_x',
      sort: { field: 'foo' as 'sk', direction: 'asc' },
    });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain(LIST_PATIENTEN_ERROR_CODES.SORT_FIELD_INVALID);
  });

  it('lehnt unbekannte Sort-Richtung ab', () => {
    const result = ListPatientenQuery.create({
      einsatzId: 'ein_x',
      sort: { field: 'sk', direction: 'bar' as 'asc' },
    });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain(LIST_PATIENTEN_ERROR_CODES.SORT_DIRECTION_INVALID);
  });

  it('akzeptiert valide Pagination-Werte', () => {
    const result = ListPatientenQuery.create({
      einsatzId: 'ein_x',
      pagination: { page: 3, pageSize: 25 },
    });
    expect(result.isSuccess).toBe(true);
    expect(result.value!.pagination).toEqual({ page: 3, pageSize: 25 });
  });

  it('lehnt page < 1 ab', () => {
    const result = ListPatientenQuery.create({
      einsatzId: 'ein_x',
      pagination: { page: 0, pageSize: 50 },
    });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain(LIST_PATIENTEN_ERROR_CODES.PAGE_INVALID);
  });

  it('lehnt pageSize > 100 ab', () => {
    const result = ListPatientenQuery.create({
      einsatzId: 'ein_x',
      pagination: { page: 1, pageSize: 101 },
    });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain(LIST_PATIENTEN_ERROR_CODES.PAGE_SIZE_INVALID);
  });

  it('lehnt nicht-ganze Zahlen für pageSize ab', () => {
    const result = ListPatientenQuery.create({
      einsatzId: 'ein_x',
      pagination: { page: 1, pageSize: 50.5 },
    });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain(LIST_PATIENTEN_ERROR_CODES.PAGE_SIZE_INVALID);
  });
});
