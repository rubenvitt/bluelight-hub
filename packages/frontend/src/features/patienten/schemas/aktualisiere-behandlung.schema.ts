import { z } from 'zod';
import type { BehandlungsstatusEnum } from '@bluelight-hub/shared/client';

/**
 * Zod-Schema für `BehandlungsStatusPillGroup`-Submit (Story 1.4, AC5).
 *
 * Spiegelt die Backend-Validierung aus `AktualisiereBehandlungDto`. Wird vom
 * TanStack-Form-Validator (`onChange`) verwendet.
 */
const BEHANDLUNG_VALUES = ['UNVERSORGT', 'IN_BEHANDLUNG', 'VERSORGT', 'TRANSPORTBEREIT'] as const satisfies readonly BehandlungsstatusEnum[];

export const AktualisiereBehandlungSchema = z
  .object({
    neuerStatus: z.enum(BEHANDLUNG_VALUES, {
      errorMap: () => ({ message: 'Bitte neuen Behandlungsstatus auswählen' }),
    }),
  })
  .strict();

export type AktualisiereBehandlungFormData = z.infer<typeof AktualisiereBehandlungSchema>;
