import { useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { PiWarning } from 'react-icons/pi';
import { Button } from '@/shared/ui/atoms/button.atom';

interface ForbiddenPageProps {
  /** Erklaerung warum der Zugriff verweigert wurde */
  reason?: string;
  /** Vorgeschlagene naechste Aktion (z.B. 'Zurück zum Überblick') */
  suggestedAction?: string;
  /** Ziel-Route fuer den Zurueck-Button */
  backTo?: string;
  /** Die blockierte Route (fuer Kontext/Logging) */
  blockedRoute?: string;
}

/**
 * ForbiddenPage - Anzeige bei verweigertem Zugang.
 *
 * Story 5.1 AC2: Zeigt eine verstaendliche Erklaerung mit naechster
 * zulaessiger Aktion. EinsatzContextBar bleibt sichtbar (kein Kontextverlust).
 *
 * - Inline Error (kein Modal/Toast) → Konsistent mit Epic 4 Pattern
 * - aria-live="polite" fuer Screenreader
 * - Auto-Fokus auf Zurueck-Button via useEffect + ref.focus()
 */
export function ForbiddenPage({ reason, suggestedAction = 'Zurück zum Überblick', backTo = '/app/einsaetze', blockedRoute: _blockedRoute }: ForbiddenPageProps) {
  const navigate = useNavigate();
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const hasInitialFocusRef = useRef(false);

  // Fokus-Management: Auto-Fokus auf Zurueck-Button nach Redirect (AC2)
  useEffect(() => {
    if (hasInitialFocusRef.current) return;
    hasInitialFocusRef.current = true;
    backButtonRef.current?.focus();
  }, []);

  return (
    <div className="mx-auto max-w-lg py-12">
      <div className="rounded-panel border border-status-warning-border bg-status-warning-surface p-8 shadow-panel" role="status" aria-live="polite">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-status-warning-surface">
            <PiWarning className="h-6 w-6 text-status-warning-text" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-text-primary text-title-sm">Zugriff nicht freigegeben</h2>
            <p className="mt-2 text-body-sm text-text-secondary">
              {reason ?? 'Dieser Bereich ist für Ihre Rolle nicht freigegeben.'}
            </p>
          </div>
        </div>
        <div className="mt-6">
          <Button
            ref={backButtonRef}
            appearance="ghost"
            size="sm"
            onClick={() => void navigate({ to: backTo })}
          >
            {suggestedAction}
          </Button>
        </div>
      </div>
    </div>
  );
}
