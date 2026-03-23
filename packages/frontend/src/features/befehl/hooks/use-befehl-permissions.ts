import type { MeineEinsatzRolleDtoRolleEnum } from '@bluelight-hub/shared/client';
import { useMyEinsatzRolle } from '../api/use-my-einsatz-rolle';

/**
 * Permission Hook für Befehl-Aktionen
 *
 * Story 4.2 AC1: Leitet Berechtigungen aus der Einsatz-Rolle ab.
 * Permissions-Mapping identisch zum Backend (GetMeineEinsatzRolleQueryHandler).
 */

export interface BefehlPermissions {
  /** Darf Befehle erstellen */
  canCreate: boolean;
  /** Darf Befehle quittieren */
  canQuittieren: boolean;
  /** Darf Befehle korrigieren */
  canKorrigieren: boolean;
  /** Darf Empfaenger-Status verwalten */
  canManageStatus: boolean;
  /** Darf Befehle exportieren */
  canExport: boolean;
  /** Darf alle Befehle einsehen */
  canViewAll: boolean;
  /** Ist nur Beobachter (read-only) */
  isBeobachter: boolean;
  /** Aktuelle Rolle des Users (null wenn keine) */
  rolle: MeineEinsatzRolleDtoRolleEnum | null;
  /** Laden die Rollen-Daten noch? */
  isLoading: boolean;
}

/** Keine Permissions (Fallback bei Fehler oder fehlender Rolle) */
const NO_PERMISSIONS: BefehlPermissions = {
  canCreate: false,
  canQuittieren: false,
  canKorrigieren: false,
  canManageStatus: false,
  canExport: false,
  canViewAll: false,
  isBeobachter: false,
  rolle: null,
  isLoading: false,
};

/**
 * Hook zur Bestimmung der Befehl-Berechtigungen des aktuellen Users
 *
 * Laedt die eigene Einsatz-Rolle via API und leitet Permissions ab.
 * Waehrend des Ladens: isLoading=true, alle Permissions false.
 *
 * @param einsatzId - Einsatz-ID
 * @returns Berechtigungen basierend auf der Einsatz-Rolle
 */
export function useBefehlPermissions(einsatzId: string): BefehlPermissions {
  const { data, isLoading } = useMyEinsatzRolle(einsatzId);

  if (isLoading) {
    return { ...NO_PERMISSIONS, isLoading: true };
  }

  if (!data) {
    return NO_PERMISSIONS;
  }

  return {
    canCreate: data.permissions.canCreate,
    canQuittieren: data.permissions.canQuittieren,
    canKorrigieren: data.permissions.canKorrigieren,
    canManageStatus: data.permissions.canManageStatus,
    canExport: data.permissions.canExport,
    canViewAll: data.permissions.canViewAll,
    isBeobachter: data.permissions.isBeobachter,
    rolle: data.rolle,
    isLoading: false,
  };
}
