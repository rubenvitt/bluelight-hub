import { z } from 'zod';

/**
 * Zod-Schema für CreateInvite Form.
 *
 * - expiresAt: Wird mit Default (7 Tage) vorausgefüllt
 * - label: Optionale Beschreibung
 * - maxUses: Backend-Default 1, wenn nicht angegeben
 */
export const createInviteSchema = z.object({
  label: z.string().max(100, 'Label darf maximal 100 Zeichen haben'),
  expiresAt: z.string().min(1, 'Ablaufdatum ist erforderlich'),
  maxUses: z.number().int().min(1, 'Mindestens 1').max(100, 'Maximal 100').optional(),
});

export type CreateInviteFormData = z.infer<typeof createInviteSchema>;
