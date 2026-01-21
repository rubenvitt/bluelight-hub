/**
 * FloatingPill Portal
 *
 * Rendert FloatingPills als Portal ausserhalb des normalen DOM-Trees.
 * Stellt sicher, dass Pills immer ueber anderen UI-Elementen schweben.
 *
 * **Story 2.4 Task 2:**
 * - Portal-Rendering via React createPortal
 * - Context fuer FloatingPill-State aus Store
 * - Hooks: useFloatingPill(erinnerungId)
 *
 * **Positionierung:**
 * - Fixed, top-right (top-4 right-4)
 * - z-index 50 (ueber Modal-Overlays)
 * - Stacking bei mehreren Pills
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { useAcknowledgeErinnerung, useSnoozeErinnerung, type SnoozeMinutes } from '../../api';
import { soundService, timerService, intensificationService } from '../../services';
import { useActiveFloatingPills, hideFloatingPill, type FloatingPillEntry } from '../../stores';
import { FloatingPill } from './FloatingPill';

/**
 * Portal Container ID
 */
const PORTAL_CONTAINER_ID = 'floating-pill-portal';

/**
 * Erstellt den Portal-Container wenn nicht vorhanden
 */
function getOrCreatePortalContainer(): HTMLElement {
  let container = document.getElementById(PORTAL_CONTAINER_ID);

  if (!container) {
    container = document.createElement('div');
    container.id = PORTAL_CONTAINER_ID;
    container.className = 'fixed top-4 right-4 z-50 flex flex-col gap-3';
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', 'Dringende Erinnerungen');
    document.body.appendChild(container);
  }

  return container;
}

interface FloatingPillPortalProps {
  /** Die aktuelle Einsatz-ID (fuer API Calls) */
  einsatzId: string;
}

/**
 * FloatingPillPortal - Container fuer alle aktiven FloatingPills
 *
 * Rendert alle aktiven FloatingPills aus dem Store als Portal.
 * Verwaltet die Acknowledge/Snooze Handler und Exit-Animationen.
 *
 * @example
 * ```tsx
 * // In App.tsx oder ErinnerungPanel.tsx
 * <FloatingPillPortal einsatzId={currentEinsatzId} />
 * ```
 */
export function FloatingPillPortal({ einsatzId }: FloatingPillPortalProps) {
  // Aktive FloatingPills aus Store
  const activeFloatingPills = useActiveFloatingPills();

  // Pills die gerade exit-Animation zeigen
  const [exitingPills, setExitingPills] = useState<Set<string>>(new Set());

  // Portal Container
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  // H8 Fix: Ref für Timeout-Cleanup bei Unmount
  const exitTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // API Mutations
  const acknowledgeErinnerung = useAcknowledgeErinnerung();
  const snoozeErinnerung = useSnoozeErinnerung();

  // Portal Container beim Mount erstellen
  useEffect(() => {
    const container = getOrCreatePortalContainer();
    setPortalContainer(container);

    // H1 Fix: Cleanup nach React Render Cycle verschieben
    return () => {
      setTimeout(() => {
        const currentContainer = document.getElementById(PORTAL_CONTAINER_ID);
        if (currentContainer && currentContainer.childNodes.length === 0) {
          currentContainer.remove();
        }
      }, 0);
    };
  }, []);

  // H8 Fix: Cleanup aller pending Timeouts bei Unmount
  useEffect(() => {
    return () => {
      for (const timeoutId of exitTimeoutsRef.current.values()) {
        clearTimeout(timeoutId);
      }
      exitTimeoutsRef.current.clear();
    };
  }, []);

  // H2 Fix: Koordiniertes Focus Management - fokussiere älteste Pill
  useEffect(() => {
    if (activeFloatingPills.length === 0) return;

    // Sortiere nach activatedAt (älteste zuerst)
    const sortedPills = [...activeFloatingPills].sort((a, b) => new Date(a.activatedAt).getTime() - new Date(b.activatedAt).getTime());

    const oldestPill = sortedPills[0];
    if (!oldestPill) return;

    const pillElement = document.getElementById(`floating-pill-${oldestPill.erinnerungId}`);

    // Fokussiere nur wenn kein anderes Pill-Element bereits Fokus hat
    if (pillElement && !document.activeElement?.id?.startsWith('floating-pill-')) {
      pillElement.focus();
    }
  }, [activeFloatingPills]);

  /**
   * Acknowledge Handler fuer eine FloatingPill
   *
   * Story 2.4 AC4: Intensivierung stoppt bei Acknowledge
   * C3+C7 Fix: onSuccess statt onSettled, Error Recovery
   */
  const handleAcknowledge = useCallback(
    (erinnerungId: string) => {
      if (acknowledgeErinnerung.isPending) return;

      // Exit-Animation starten
      setExitingPills((prev) => new Set(prev).add(erinnerungId));

      // Sound + Timer + Intensification stoppen
      soundService.stopAllSounds();
      timerService.resetTriggered(erinnerungId);
      intensificationService.stopTimer(erinnerungId);

      // API Call
      acknowledgeErinnerung.mutate(
        { einsatzId, erinnerungId },
        {
          onSuccess: () => {
            // C7 Fix: Nur bei Erfolg FloatingPill entfernen
            const timeoutId = setTimeout(() => {
              hideFloatingPill(erinnerungId);
              setExitingPills((prev) => {
                const next = new Set(prev);
                next.delete(erinnerungId);
                return next;
              });
              exitTimeoutsRef.current.delete(erinnerungId);
            }, 200);
            exitTimeoutsRef.current.set(erinnerungId, timeoutId);
          },
          onError: () => {
            // C7 Fix: Bei Fehler Exit-Animation zurücksetzen, Pill bleibt aktiv
            setExitingPills((prev) => {
              const next = new Set(prev);
              next.delete(erinnerungId);
              return next;
            });
            toast.error('Bestätigung fehlgeschlagen', {
              description: 'Bitte erneut versuchen.',
            });
          },
        },
      );
    },
    [acknowledgeErinnerung, einsatzId],
  );

  /**
   * Snooze Handler fuer eine FloatingPill
   *
   * Story 2.4 AC4: Intensivierung stoppt bei Snooze
   * C3+C7 Fix: onSuccess statt onSettled, Error Recovery
   */
  const handleSnooze = useCallback(
    (erinnerungId: string, minutes: SnoozeMinutes) => {
      if (snoozeErinnerung.isPending) return;

      // Exit-Animation starten
      setExitingPills((prev) => new Set(prev).add(erinnerungId));

      // Sound + Timer + Intensification stoppen
      soundService.stopAllSounds();
      timerService.resetTriggered(erinnerungId);
      intensificationService.stopTimer(erinnerungId);

      // API Call
      snoozeErinnerung.mutate(
        { einsatzId, erinnerungId, snoozeMinutes: minutes },
        {
          onSuccess: () => {
            // C7 Fix: Nur bei Erfolg FloatingPill entfernen
            const timeoutId = setTimeout(() => {
              hideFloatingPill(erinnerungId);
              setExitingPills((prev) => {
                const next = new Set(prev);
                next.delete(erinnerungId);
                return next;
              });
              exitTimeoutsRef.current.delete(erinnerungId);
            }, 200);
            exitTimeoutsRef.current.set(erinnerungId, timeoutId);
          },
          onError: () => {
            // C7 Fix: Bei Fehler Exit-Animation zurücksetzen, Pill bleibt aktiv
            setExitingPills((prev) => {
              const next = new Set(prev);
              next.delete(erinnerungId);
              return next;
            });
            toast.error('Snooze fehlgeschlagen', {
              description: 'Bitte erneut versuchen.',
            });
          },
        },
      );
    },
    [snoozeErinnerung, einsatzId],
  );

  // Nichts rendern wenn keine Pills aktiv oder Container nicht bereit
  if (!portalContainer || activeFloatingPills.length === 0) {
    return null;
  }

  return createPortal(
    activeFloatingPills.map((pill: FloatingPillEntry) => (
      <FloatingPill
        key={pill.erinnerungId}
        erinnerungId={pill.erinnerungId}
        titel={pill.titel}
        ausgeloestAm={pill.ausgeloestAm}
        onAcknowledge={() => handleAcknowledge(pill.erinnerungId)}
        onSnooze={(minutes) => handleSnooze(pill.erinnerungId, minutes)}
        disabled={acknowledgeErinnerung.isPending || snoozeErinnerung.isPending}
        isExiting={exitingPills.has(pill.erinnerungId)}
      />
    )),
    portalContainer,
  );
}
