import { z } from 'zod';
import type { TransportstatusEnum } from '@bluelight-hub/shared/client';

const TRANSPORT_VALUES = ['WARTEND', 'IM_TRANSPORT', 'IM_KRANKENHAUS'] as const satisfies readonly TransportstatusEnum[];

export const AktualisiereTransportSchema = z
  .object({
    neuerStatus: z.enum(TRANSPORT_VALUES, {
      errorMap: () => ({ message: 'Bitte neuen Transportstatus auswählen' }),
    }),
  })
  .strict();

export type AktualisiereTransportFormData = z.infer<typeof AktualisiereTransportSchema>;
