import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';

/**
 * Legacy-Route `/sync-konflikte` — leitet auf den Eigenschutz-Layout-Mount
 * um und öffnet dort den `SyncConflictsDrawer` über den Search-Param
 * `openConflicts=1`.
 *
 * **Hintergrund:** Die ehemalige `SyncConflictsPage` wurde zugunsten eines
 * Slide-in-Drawers entfernt (Goal G6) — Konflikt-Auflösung ist eine
 * kontextuelle BEFEHLSGEBER-Aktion und gehört nicht in eine eigene
 * Sub-Tab-Route. Diese Datei bleibt erhalten, damit bestehende Deep-Links
 * (Mikro-Banner-History, externer Bookmark, Smoke-Test-URLs) nicht ins
 * Leere laufen — sie redirecten auf den Eigenschutz-Bereich mit aktivem
 * Drawer-Hint.
 *
 * Story 3.10 F6 (Resilient Deep-Links): Auch wenn `entityType` oder
 * `einheitId` als kaputte Werte hereinkommen, fällt `safeParse` auf
 * `undefined` zurück; der Drawer öffnet sich dann ungefiltert.
 */
const SyncConflictsSearchSchema = z
  .object({
    entityType: z.enum(['PSA_PROFIL_ZUWEISUNG', 'GEFAEHRDUNGSBEURTEILUNG_ITEM']).optional(),
    einheitId: z.string().optional(),
  })
  .optional();

export const Route = createFileRoute('/app/einsatz/$einsatzId/sicherheit/eigenschutz/sync-konflikte')({
  validateSearch: (search) => {
    const result = SyncConflictsSearchSchema.safeParse(search);
    return result.success ? (result.data ?? {}) : {};
  },
  beforeLoad: ({ params, search }) => {
    const typed = search as { entityType?: string; einheitId?: string } | undefined;
    throw redirect({
      to: '/app/einsatz/$einsatzId/sicherheit/eigenschutz',
      params: { einsatzId: params.einsatzId },
      search: {
        openConflicts: 1 as const,
        ...(typed?.entityType ? { entityType: typed.entityType as 'PSA_PROFIL_ZUWEISUNG' | 'GEFAEHRDUNGSBEURTEILUNG_ITEM' } : {}),
        ...(typed?.einheitId ? { einheitId: typed.einheitId } : {}),
      },
      replace: true,
    });
  },
});
