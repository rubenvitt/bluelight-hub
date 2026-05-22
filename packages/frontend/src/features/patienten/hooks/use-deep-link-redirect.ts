import { useEffect, useRef } from 'react';
import type { useNavigate } from '@tanstack/react-router';

type NavigateFn = ReturnType<typeof useNavigate>;

export type UseDeepLinkRedirectArgs = {
  einsatzId: string;
  action: 'detail' | undefined;
  patientId: string | undefined;
  navigate: NavigateFn;
};

/**
 * Story 1.7 (AC11) — Deep-Link-Redirect für Patienten-Listen-Routen.
 *
 * Wenn die Route mit `?action=detail&patientId=...` aufgerufen wird, leitet
 * dieser Hook idempotent (per `replace`) auf die canonical Detail-Route um.
 *
 * Idempotenz (F31): Der Ref-Key kombiniert `action` und `patientId`. Bei
 * gleicher Kombination wird kein weiterer Redirect ausgelöst — selbst bei
 * Re-Renders durch nicht-relevante Search-Param-Änderungen. Bei einem
 * Wechsel der Kombination (etwa: anderer `patientId`) feuert der Redirect
 * erneut. Damit bleibt Browser-Back/Forward sauber, und erneute Deep-Links
 * innerhalb derselben Mount-Session werden korrekt aufgelöst.
 */
export function useDeepLinkRedirect({ einsatzId, action, patientId, navigate }: UseDeepLinkRedirectArgs): void {
  const lastHandledRef = useRef<string | null>(null);

  useEffect(() => {
    const key = action === 'detail' && patientId ? `${action}|${patientId}` : null;
    if (!key) return;
    if (key === lastHandledRef.current) return;

    lastHandledRef.current = key;
    void navigate({
      to: '/app/einsatz/$einsatzId/patienten/$patientId',
      params: { einsatzId, patientId },
      replace: true,
    });
  }, [einsatzId, action, patientId, navigate]);
}
