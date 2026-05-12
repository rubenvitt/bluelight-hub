import { z } from 'zod';

/**
 * Standort eines Sicherungspostens — discriminated Union (Story 4.1, AC2).
 *
 * - `coordinate`: WGS84-Koordinatenpaar mit optionalem Adress-Hinweis (Pflege
 *   manuell in Story 4.1; Map-Click-Picker kommt mit Story 4.3).
 * - `address`: reiner Adress-/Freitext (z. B. „Eingang Hörsaal C").
 *
 * GeoJSON-Mapping bewusst nicht in 4.1 — der MapGL-Layer aus Story 4.3
 * konvertiert beim Render-Zeitpunkt.
 */
export const standortCoordinateSchema = z
  .object({
    kind: z.literal('coordinate'),
    // `.finite()` lehnt NaN/±Infinity ab — der Drawer initialisiert leere Coordinate-Inputs als NaN,
    // damit der Submit fehlt-leer-Inputs erkennt und kein Posten auf Null-Insel (0,0) entsteht.
    longitude: z.number().finite().min(-180).max(180),
    latitude: z.number().finite().min(-90).max(90),
    addressHint: z.string().max(500).optional(),
  })
  .strict();

export const standortAddressSchema = z
  .object({
    kind: z.literal('address'),
    text: z.string().trim().min(1).max(500),
  })
  .strict();

export const standortSchema = z.discriminatedUnion('kind', [standortCoordinateSchema, standortAddressSchema]);

export type StandortCoordinate = z.infer<typeof standortCoordinateSchema>;
export type StandortAddress = z.infer<typeof standortAddressSchema>;
export type Standort = z.infer<typeof standortSchema>;

/**
 * Personal-Eintrag eines Sicherungspostens — discriminated Union (Story 4.1, AC7).
 *
 * Multi-Select-Mix aus EinsatzPerson-Referenzen (im Einsatz registrierte
 * Personen, analog `BesetzeRolleDialog`) und Freitext-Einträgen (z. B.
 * spontane Helfer, die noch nicht als EinsatzPerson erfasst sind).
 *
 * `kind: 'user'` mit `userId` wurde abgelöst — siehe JSONB-Migration
 * `20260512163000_rename_user_to_einsatzperson_in_eigenschutz_jsonb`.
 */
export const personalEinsatzPersonEntrySchema = z
  .object({
    kind: z.literal('einsatzPerson'),
    einsatzPersonId: z.string().trim().min(1).max(40),
  })
  .strict();

export const personalFreitextEntrySchema = z
  .object({
    kind: z.literal('freitext'),
    name: z.string().trim().min(1).max(200),
    rolle: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export const personalEntrySchema = z.discriminatedUnion('kind', [personalEinsatzPersonEntrySchema, personalFreitextEntrySchema]);

export type PersonalEinsatzPersonEntry = z.infer<typeof personalEinsatzPersonEntrySchema>;
export type PersonalFreitextEntry = z.infer<typeof personalFreitextEntrySchema>;
export type PersonalEntry = z.infer<typeof personalEntrySchema>;

/**
 * Status eines Sicherungspostens für die Listen-Filter (Story 4.1, AC7+AC8).
 *
 * - `AKTIV`: `aufgeloestAm IS NULL`
 * - `AUFGELOEST`: `aufgeloestAm IS NOT NULL`
 */
export const sicherungspostenStatusSchema = z.enum(['AKTIV', 'AUFGELOEST']);
export type SicherungspostenStatus = z.infer<typeof sicherungspostenStatusSchema>;

/**
 * Request-Body für `POST /sicherungsposten` (Story 4.1, AC8).
 */
export const createSicherungspostenRequestSchema = z
  .object({
    bezeichnung: z.string().trim().min(1).max(200),
    standort: standortSchema,
    personal: z.array(personalEntrySchema).max(50),
    einheitId: z.string().trim().min(1).max(40).optional(),
    zustaendigkeitsbereich: z.string().trim().max(4000).optional(),
    abloesezeiten: z.string().trim().max(2000).optional(),
  })
  .strict();
export type CreateSicherungspostenRequest = z.infer<typeof createSicherungspostenRequestSchema>;

/**
 * Request-Body für `PATCH /sicherungsposten/:id` (Story 4.1, AC8).
 *
 * Partielle Update-Semantik: nur explizit gesetzte Felder werden überschrieben.
 * `expectedVersion` ist Pflicht (Optimistic-Concurrency).
 */
export const updateSicherungspostenRequestSchema = z
  .object({
    expectedVersion: z.number().int().min(1),
    bezeichnung: z.string().trim().min(1).max(200).optional(),
    standort: standortSchema.optional(),
    personal: z.array(personalEntrySchema).max(50).optional(),
    einheitId: z.string().trim().min(1).max(40).nullable().optional(),
    zustaendigkeitsbereich: z.string().trim().max(4000).nullable().optional(),
    abloesezeiten: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();
export type UpdateSicherungspostenRequest = z.infer<typeof updateSicherungspostenRequestSchema>;

/**
 * Request-Body für `POST /sicherungsposten/:id/aufloesen` (Story 4.1, AC8 + UX-DR27).
 *
 * Pflicht-Begründung 1–2000 Zeichen, Optimistic-Concurrency via `expectedVersion`.
 */
export const aufloeseSicherungspostenRequestSchema = z
  .object({
    expectedVersion: z.number().int().min(1),
    begruendung: z.string().trim().min(1).max(2000),
  })
  .strict();
export type AufloeseSicherungspostenRequest = z.infer<typeof aufloeseSicherungspostenRequestSchema>;
