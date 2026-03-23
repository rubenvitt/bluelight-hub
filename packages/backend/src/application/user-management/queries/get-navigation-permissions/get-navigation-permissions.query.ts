/**
 * Gueltige UserRole-Werte fuer Navigations-Berechtigungen.
 *
 * Korrespondiert mit den Werten aus dem UserRole Value Object
 * ({@link @domain/value-objects/user-role}).
 */
export type NavigationUserRole = 'SUPER_ADMIN' | 'ADMIN' | 'USER';

/**
 * Query fuer das Abrufen der Navigations-Berechtigungen eines Benutzers.
 *
 * CQRS Read-Only Query - keine State-Aenderungen, keine Events.
 * Benoetigt die UserRole des authentifizierten Benutzers um
 * die zugaenglichen Navigationsbereiche zu bestimmen.
 */
export class GetNavigationPermissionsQuery {
  constructor(
    /** UserRole aus JWT (SUPER_ADMIN | ADMIN | USER) */
    public readonly userRole: NavigationUserRole,
    /**
     * Optional: Custom Permissions als JSON-Array.
     *
     * Wird aktuell nicht vom Controller befuellt - vorbereitet fuer
     * zukuenftige Custom-Permission-Integration (z.B. pro-User Freischaltungen).
     *
     * **Security-Hinweis:** Das Pattern `nav:*` gewaehrt Zugang zu ALLEN
     * Navigationsbereichen inkl. Admin-Flaechen. Bei der Implementierung
     * der Custom-Permission-Vergabe MUSS sichergestellt werden, dass
     * `nav:*` nur an berechtigte Rollen (ADMIN/SUPER_ADMIN) vergeben wird.
     */
    public readonly customPermissions?: string[],
  ) {}
}
