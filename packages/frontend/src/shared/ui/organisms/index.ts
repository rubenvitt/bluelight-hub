/**
 * Barrel-Export für Shared Organism-Komponenten.
 *
 * Re-Export-Strategie: Nur Top-Level-Organisms ohne eigenes Sub-Modul.
 * Spezialisierte Sub-Trees (workspace/, dashboard/, command-palette/) bleiben bewusst
 * über ihre eigenen Barrel-Exports erreichbar, um Bundle-Splitting nicht zu unterminieren.
 */

export { EntityFlowStrip } from './EntityFlowStrip.organism';
export type { EntityFlowStripPhase, EntityFlowStripProps } from './EntityFlowStrip.organism';
