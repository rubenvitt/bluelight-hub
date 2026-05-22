/**
 * Tests für `extract-error-code.ts` (Story 1.4 Code-Review Feature 1).
 * Stellt sicher, dass:
 *  - `extractErrorCode` den `code` aus enriched Errors liest.
 *  - `enrichResponseErrorWithCode` JSON-Body aus `ResponseError.response`
 *    parst und `code` + `message` an den Error attached.
 *  - Edge-Cases (kein Body, non-JSON, bereits enriched) sauber gehandhabt
 *    werden.
 */
import { describe, expect, it } from 'vitest';
import { enrichResponseErrorWithCode, extractErrorCode, extractErrorMessage } from '../api/extract-error-code';

function buildResponseError(body: unknown, status = 400): Error {
  const response = new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
  const err = new Error('Response returned an error code');
  (err as { response?: Response }).response = response;
  err.name = 'ResponseError';
  return err;
}

describe('extractErrorCode', () => {
  it('liefert `null` bei null/undefined/primitiven Werten', () => {
    expect(extractErrorCode(null)).toBeNull();
    expect(extractErrorCode(undefined)).toBeNull();
    expect(extractErrorCode('foo')).toBeNull();
    expect(extractErrorCode(42)).toBeNull();
  });

  it('liefert `null` bei Error ohne `code`-Property', () => {
    expect(extractErrorCode(new Error('boom'))).toBeNull();
  });

  it('liefert den `code`-String, wenn am Error attached', () => {
    const err = Object.assign(new Error('Response returned an error code'), { code: 'BusinessRule:BehandlungUngueltigerUebergang' });
    expect(extractErrorCode(err)).toBe('BusinessRule:BehandlungUngueltigerUebergang');
  });

  it('liefert `null` bei leerem `code`-String', () => {
    const err = Object.assign(new Error('boom'), { code: '' });
    expect(extractErrorCode(err)).toBeNull();
  });
});

describe('extractErrorMessage', () => {
  it('liest Error.message', () => {
    expect(extractErrorMessage(new Error('Klartext'))).toBe('Klartext');
  });
  it('liefert `null` bei leerer Message', () => {
    const err = new Error('');
    expect(extractErrorMessage(err)).toBeNull();
  });
});

describe('enrichResponseErrorWithCode', () => {
  it('attached `code` und `message` aus JSON-Response-Body', async () => {
    const err = buildResponseError({ code: 'BusinessRule:BehandlungUngueltigerUebergang', message: 'Ungültiger Übergang im Behandlungsstatus' });
    const enriched = await enrichResponseErrorWithCode(err);
    expect(extractErrorCode(enriched)).toBe('BusinessRule:BehandlungUngueltigerUebergang');
    expect(extractErrorMessage(enriched)).toBe('Ungültiger Übergang im Behandlungsstatus');
  });

  it('lässt Error unverändert, wenn `code` bereits gesetzt ist (idempotent)', async () => {
    const err = Object.assign(buildResponseError({ code: 'OtherCode', message: 'Other' }), { code: 'BusinessRule:Existing' });
    const enriched = await enrichResponseErrorWithCode(err);
    expect(extractErrorCode(enriched)).toBe('BusinessRule:Existing');
  });

  it('lässt Error unverändert, wenn `response` fehlt', async () => {
    const err = new Error('NetworkDown');
    const enriched = await enrichResponseErrorWithCode(err);
    expect(extractErrorCode(enriched)).toBeNull();
    expect(extractErrorMessage(enriched)).toBe('NetworkDown');
  });

  it('lässt Error unverändert, wenn Body kein JSON ist', async () => {
    const err = buildResponseError('not json at all');
    const enriched = await enrichResponseErrorWithCode(err);
    expect(extractErrorCode(enriched)).toBeNull();
  });

  it('lässt Error unverändert, wenn Body JSON ohne `code` ist', async () => {
    const err = buildResponseError({ message: 'nur message' });
    const enriched = await enrichResponseErrorWithCode(err);
    expect(extractErrorCode(enriched)).toBeNull();
    // `message` wird trotzdem übernommen
    expect(extractErrorMessage(enriched)).toBe('nur message');
  });

  it('clont die Response, sodass sie danach noch lesbar bleibt', async () => {
    const err = buildResponseError({ code: 'BusinessRule:Test', message: 'Test' });
    const response = (err as { response: Response }).response;
    await enrichResponseErrorWithCode(err);
    // Original-Response darf nicht "used" sein.
    expect(response.bodyUsed).toBe(false);
  });
});
