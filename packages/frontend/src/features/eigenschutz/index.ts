/**
 * Public API des Eigenschutz-Feature-Slice.
 *
 * Story 1.6 liefert den Smoke-Test-Einsprungspunkt; Story 2.1 ergänzt die
 * Hooks für Gefährdungsbeurteilungen. Weitere Pages/Schemas kommen mit den
 * Folge-Stories von Epic 2–5 dazu.
 */
export {
  EIGENSCHUTZ_QUERY_KEYS,
  SicherheitsregelConflictError,
  extractSicherheitsregelConflictError,
  useCreateGefaehrdungsbeurteilung,
  useCreateSicherheitsregel,
  useEigenschutzHealth,
  useGefaehrdungsbeurteilung,
  useGefaehrdungsbeurteilungVorlagen,
  useSicherheitsregel,
  useSicherheitsregeln,
  useUpdateGefaehrdungsbeurteilungItems,
  useUpdateSicherheitsregel,
} from './api/queries';
export {
  SicherheitsregelCreateSchemaV1,
  SicherheitsregelDtoSchemaV1,
  SicherheitsregelUpdateSchemaV1,
  type CreateSicherheitsregelInput,
  type SicherheitsregelDto,
  type UpdateSicherheitsregelInput,
} from './schemas/sicherheitsregel.schema';
export { GefaehrdungItemEditor } from './ui/molecules/GefaehrdungItemEditor';
export { GefaehrdungenEditorOrganism } from './ui/organisms/GefaehrdungenEditorOrganism';
export { GefaehrdungseditorDrawer } from './ui/organisms/GefaehrdungseditorDrawer.organism';
export { RiskMatrix5x5 } from './ui/organisms/RiskMatrix5x5';
export { SICHERUNGSPOSTEN_LAYER_ID, SICHERUNGSPOSTEN_MARKER_IMAGE, SICHERUNGSPOSTEN_SOURCE_ID, SecurityPostMapMarker } from './ui/organisms/SecurityPostMapMarker';
export { EigenschutzEntryPage } from './ui/pages/EigenschutzEntryPage';
export { GefaehrdungenDetailPage } from './ui/pages/GefaehrdungenDetailPage';
export { GefaehrdungenPage } from './ui/pages/GefaehrdungenPage';
