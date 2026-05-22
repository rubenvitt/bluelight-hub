/**
 * Shared UI Components
 *
 * Zentrale Exports aller wiederverwendbaren UI-Komponenten nach Atomic Design.
 * Diese Komponenten sind feature-unabhängig und können überall im Frontend verwendet werden.
 *
 * @example
 * ```typescript
 * import { Button, Card, Dialog } from '@/shared/ui';
 * import { Combobox } from '@/shared/ui/headless';
 * import { AuthLayout } from '@/shared/ui/templates';
 * ```
 */

// Atoms - Basis-Komponenten
export * from './atoms';

// Molecules - Kombinierte Komponenten
export * from './molecules';

// Headless UI Wrapper (nicht automatisch exportiert, da spezielle Imports)
export * from './headless';

// Templates werden NICHT barrel-exportiert, da sie feature-spezifische Imports haben
// (z.B. SingleEinsatzLayout importiert etb/einsatz Features).
// Import direkt: import { AuthLayout } from '@/shared/ui/templates';
// import { SingleEinsatzLayout } from '@/shared/ui/templates/SingleEinsatzLayout';

// Feature-neutrale Organisms für Shell- und Workspace-Primitives
export * from './organisms/workspace';
export { EntityFlowStrip, type EntityFlowPhase } from './organisms/EntityFlowStrip.organism';
export { DataTable } from './organisms/data-table.organism';

// Weitere Organisms werden NICHT re-exportiert, da sie aktuell feature-spezifisch sind
// (admin, auth, command-palette, dashboard, einsaetze, einsatz, etb, lagekarte)

// UI Utilities
export * from './cn';
export * from './module-colors';
export * from './timeBasedBackground';
