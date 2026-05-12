import { z } from 'zod';
import {
  aufloeseSicherungspostenRequestSchema,
  createSicherungspostenRequestSchema,
  personalEntrySchema,
  personalFreitextEntrySchema,
  personalEinsatzPersonEntrySchema,
  sicherungspostenStatusSchema,
  standortAddressSchema,
  standortCoordinateSchema,
  standortSchema,
  updateSicherungspostenRequestSchema,
  type AufloeseSicherungspostenRequest,
  type CreateSicherungspostenRequest,
  type PersonalEntry,
  type PersonalFreitextEntry,
  type PersonalEinsatzPersonEntry,
  type SicherungspostenStatus,
  type Standort,
  type StandortAddress,
  type StandortCoordinate,
  type UpdateSicherungspostenRequest,
} from '@bluelight-hub/shared/schemas';

/**
 * Re-Export der Shared-Zod-Schemas für den Sicherungsposten-Feature-Slice
 * (Story 4.1, T6). Single Source of Truth bleibt das Shared-Package; das
 * Form-Schema unten ist UI-spezifisch und wird im Submit-Handler in den
 * Wire-Payload (`createSicherungspostenRequestSchema`) transformiert.
 */
export {
  aufloeseSicherungspostenRequestSchema,
  createSicherungspostenRequestSchema,
  personalEntrySchema,
  personalFreitextEntrySchema,
  personalEinsatzPersonEntrySchema,
  sicherungspostenStatusSchema,
  standortAddressSchema,
  standortCoordinateSchema,
  standortSchema,
  updateSicherungspostenRequestSchema,
};
export type {
  AufloeseSicherungspostenRequest,
  CreateSicherungspostenRequest,
  PersonalEntry,
  PersonalFreitextEntry,
  PersonalEinsatzPersonEntry,
  SicherungspostenStatus,
  Standort,
  StandortAddress,
  StandortCoordinate,
  UpdateSicherungspostenRequest,
};

/**
 * Form-Schema für den `SicherungspostenDrawer` (Story 4.1).
 *
 * Spiegelt die Felder aus {@link createSicherungspostenRequestSchema} —
 * `expectedVersion` ist Form-fremd und wird vom Mutation-Hook injiziert.
 * Die Ablösezeiten-UI kommt mit Story 4.2; das Feld bleibt im Schema
 * optional, damit kein Submit blockiert wird.
 */
export const sicherungspostenFormSchema = z
  .object({
    bezeichnung: z.string().trim().min(1, 'Bezeichnung ist erforderlich.').max(200, 'Bezeichnung darf maximal 200 Zeichen haben.'),
    standort: standortSchema,
    personal: z.array(personalEntrySchema).max(50, 'Maximal 50 Personal-Einträge erlaubt.'),
    einheitId: z.string().trim().min(1).max(40).optional(),
    zustaendigkeitsbereich: z.string().trim().max(4000, 'Zuständigkeitsbereich darf maximal 4000 Zeichen haben.').optional(),
    abloesezeiten: z.string().trim().max(2000).optional(),
  })
  .strict();

export type SicherungspostenFormValues = z.infer<typeof sicherungspostenFormSchema>;

/**
 * Form-Schema für den Auflöse-Dialog (Story 4.1, AC8 + UX-DR27).
 *
 * `expectedVersion` wird vom Mutation-Hook aus `posten.version` injiziert —
 * das Form sammelt nur die Pflicht-Begründung.
 */
export const aufloeseFormSchema = z
  .object({
    begruendung: z.string().trim().min(1, 'Begründung ist erforderlich.').max(2000, 'Begründung darf maximal 2000 Zeichen haben.'),
  })
  .strict();

export type AufloeseFormValues = z.infer<typeof aufloeseFormSchema>;
