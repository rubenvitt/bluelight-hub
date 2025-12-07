/**
 * Shared UI Components
 *
 * Zentrale Exports aller wiederverwendbaren UI-Komponenten nach Atomic Design.
 * Diese Komponenten sind feature-unabhängig und können überall im Frontend verwendet werden.
 *
 * @example
 * ```typescript
 * import { Button, Card, Dialog } from '@/shared/ui';
 * ```
 */

// Atoms - Basis-Komponenten
export * from './atoms';

// Molecules - Kombinierte Komponenten
export * from './molecules';

// Organisms werden NICHT re-exportiert, da aktuell alle feature-spezifisch sind
// (admin, auth, command-palette, dashboard, einsaetze, einsatz, etb, lagekarte)
