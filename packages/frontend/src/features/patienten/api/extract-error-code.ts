/**
 * Helpers für Story 1.4 Code-Review Feature 1: stabiler `code`-Identifier im
 * HTTP-Error-Body. Frontend matcht UI-Branches auf `code` (Sentinel-Stem),
 * nicht mehr auf den lokalisierten `message`-Text.
 *
 * **Hintergrund:** Der generierte API-Client (`runtime.ts`) wirft eine
 * `ResponseError(response, 'Response returned an error code')`. `error.message`
 * ist also **immer** dieser statische String — `message.includes('Sentinel')`
 * Match-Logik in den UI-Components war wirkungslos.
 *
 * **Vertrag mit dem Backend** (`mapErrorToHttp` in
 * `packages/backend/src/modules/patienten/errors/error-to-http.ts`):
 *  - JSON-Body enthält `{ code: 'BusinessRule:...', message: '<deutsch>' }`.
 *  - `code` ist immer der Sentinel-Stem (`Präfix:Kennung` ohne Detail-Suffix).
 *  - `message` ist der lokalisierte Klartext.
 *
 * **Async-Pre-Parsing:** Da `ResponseError.response.json()` async ist und
 * `extractError`-Helper in den UI-Components synchron in `useMemo` laufen,
 * parst der Mutation-Hook den Body in `mutationFn`'s catch-Branch
 * (`enrichResponseErrorWithCode`) und attached `.code` + `.message` an den
 * geworfenen Error. Synchroner UI-Code liest dann `extractErrorCode(err)`.
 */

/**
 * Liest das `code`-Feld aus einem (ggf. enriched) Error. Liefert `null`, wenn
 * kein Code anliegt (z. B. NetworkError ohne Response).
 */
export function extractErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && code.length > 0 ? code : null;
}

/**
 * Liest die `message` aus einem (ggf. enriched) Error. Fallback ist der
 * native `Error.message` (für nicht-enriched Fehler oder NetworkError).
 *
 * **Wichtig:** Bei einem rohen `ResponseError` aus dem generierten Client ist
 * `.message` IMMER `'Response returned an error code'` — der Caller muss
 * sicherstellen, dass `enrichResponseErrorWithCode` zuvor gelaufen ist, sonst
 * landet dieser Generic-String in der UI.
 */
export function extractErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' && message.length > 0 ? message : null;
}

/**
 * Parst den Response-Body eines `ResponseError` (aus dem generierten Client)
 * und attached `code` + `message` an den Error. Wird in den Mutation-Hooks
 * VOR dem Re-Throw aufgerufen. Idempotent: ein bereits enriched Error wird
 * unverändert zurückgegeben.
 *
 * Bei Parse-Fehlern (z. B. nicht-JSON-Body, abgeschnittene Response) bleibt
 * der Error roh — Caller müssen dann auf den Fallback-Text in der UI
 * vertrauen.
 */
export async function enrichResponseErrorWithCode<TError>(error: TError): Promise<TError> {
  if (!error || typeof error !== 'object') return error;
  const maybeResponseError = error as { response?: Response; code?: string; message?: string };
  if (typeof maybeResponseError.code === 'string' && maybeResponseError.code.length > 0) {
    // Bereits enriched (z. B. doppelter onError-Pfad) — nichts zu tun.
    return error;
  }
  const response = maybeResponseError.response;
  if (!response || typeof response.clone !== 'function') {
    return error;
  }
  try {
    const cloned = response.clone();
    const body = (await cloned.json()) as unknown;
    if (body && typeof body === 'object') {
      const code = (body as { code?: unknown }).code;
      const message = (body as { message?: unknown }).message;
      if (typeof code === 'string' && code.length > 0) {
        Object.defineProperty(error, 'code', { value: code, enumerable: true, writable: true, configurable: true });
      }
      if (typeof message === 'string' && message.length > 0) {
        // Native Error.message ist ein "own data property", `defineProperty`
        // funktioniert auf Error-Instanzen problemlos.
        Object.defineProperty(error, 'message', { value: message, enumerable: false, writable: true, configurable: true });
      }
    }
  } catch {
    // Parse-Fehler werden ignoriert — der Error bleibt unverändert, die UI
    // fällt auf den generischen Fallback-Text zurück.
  }
  return error;
}
