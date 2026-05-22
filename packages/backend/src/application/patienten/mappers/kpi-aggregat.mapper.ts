import type { PatientKpiCountRows } from '@domain/patienten/repositories/patient.repository';
import { BehandlungCountsDto, KpiAggregatDto, SkCountsDto, TransportCountsDto } from '../dto/kpi-aggregat.dto';

/**
 * Eingabe-Shape für `KpiAggregatMapper.fromCounts` (Story 1.5, AC1).
 *
 * Erweitert das Domain-Repository-Resultat um den `stand`-Zeitstempel, der
 * im Query-Handler **vor** dem ersten `groupBy`-Call gesetzt wird, damit der
 * DTO-Timestamp deterministisch zur Datenabfrage-Zeit passt.
 */
export interface KpiCountRowsInput extends PatientKpiCountRows {
  stand: string;
}

/**
 * Optional-Hook zum Reporten von Schema-Drift (unbekannte Enum-Werte) oder
 * Cross-Dimension-Mismatch (sum(sk) ≠ sum(behandlung) ≠ sum(transport)).
 * Im Handler i. d. R. an `logger.warn` gebunden.
 */
export type KpiMapperWarn = (message: string) => void;

const SK_DEFAULTS: SkCountsDto = { SK_I: 0, SK_II: 0, SK_III: 0, SK_IV: 0, TOT: 0 };
const BEHANDLUNG_DEFAULTS: BehandlungCountsDto = {
  UNVERSORGT: 0,
  IN_BEHANDLUNG: 0,
  VERSORGT: 0,
  TRANSPORTBEREIT: 0,
};
const TRANSPORT_DEFAULTS: TransportCountsDto = { WARTEND: 0, IM_TRANSPORT: 0, IM_KRANKENHAUS: 0 };

const SK_KEYS = new Set<string>(Object.keys(SK_DEFAULTS));
const BEHANDLUNG_KEYS = new Set<string>(Object.keys(BEHANDLUNG_DEFAULTS));
const TRANSPORT_KEYS = new Set<string>(Object.keys(TRANSPORT_DEFAULTS));

function sumValues(counts: Record<string, number>): number {
  let total = 0;
  for (const key of Object.keys(counts)) {
    total += counts[key] ?? 0;
  }
  return total;
}

/**
 * Reine Mapping-Funktion `PatientKpiCountRows → KpiAggregatDto` (Story 1.5).
 *
 * Garantien:
 *  - Alle 5 SK- / 4 Behandlung- / 3 Transport-Buckets sind im Ergebnis vorhanden
 *    (fehlende Buckets aus Postgres `GROUP BY` werden auf `0` ergänzt).
 *  - Unbekannte Enum-Werte (Schema-Drift, neue Codes ohne Migration) oder
 *    `null`/`undefined`-Buckets werden verworfen und über `onWarning` als
 *    `kpi-mapper-unknown-bucket:<dim>:<value>` gemeldet — keine stille
 *    Bucket-Pollution (Story-1.5-Code-Review).
 *  - `totalPatienten` wird aus der SK-Dimension gebildet. Drift gegenüber
 *    `behandlung`/`transport` (z. B. paralleler `INSERT` zwischen den drei
 *    `groupBy`-Calls — sie laufen ohne REPEATABLE-READ-Transaktion) wird
 *    über `onWarning` als
 *    `kpi-mapper-dimension-drift:sk=…:behandlung=…:transport=…` reportet.
 *  - `stand` wird unverändert durchgereicht.
 */
export const KpiAggregatMapper = {
  fromCounts(input: KpiCountRowsInput, onWarning?: KpiMapperWarn): KpiAggregatDto {
    const sk: SkCountsDto = { ...SK_DEFAULTS };
    for (const row of input.skRows) {
      if (row.aktuelleSk == null || !SK_KEYS.has(row.aktuelleSk)) {
        onWarning?.(`kpi-mapper-unknown-bucket:sk:${String(row.aktuelleSk)}:count=${row.count}`);
        continue;
      }
      sk[row.aktuelleSk] = row.count;
    }

    const behandlung: BehandlungCountsDto = { ...BEHANDLUNG_DEFAULTS };
    for (const row of input.behandlungRows) {
      if (row.behandlungsstatus == null || !BEHANDLUNG_KEYS.has(row.behandlungsstatus)) {
        onWarning?.(`kpi-mapper-unknown-bucket:behandlung:${String(row.behandlungsstatus)}:count=${row.count}`);
        continue;
      }
      behandlung[row.behandlungsstatus] = row.count;
    }

    const transport: TransportCountsDto = { ...TRANSPORT_DEFAULTS };
    for (const row of input.transportRows) {
      if (row.transportstatus == null || !TRANSPORT_KEYS.has(row.transportstatus)) {
        onWarning?.(`kpi-mapper-unknown-bucket:transport:${String(row.transportstatus)}:count=${row.count}`);
        continue;
      }
      transport[row.transportstatus] = row.count;
    }

    const totalPatienten = sk.SK_I + sk.SK_II + sk.SK_III + sk.SK_IV + sk.TOT;
    const sumBehandlung = sumValues(behandlung as unknown as Record<string, number>);
    const sumTransport = sumValues(transport as unknown as Record<string, number>);

    if (sumBehandlung !== totalPatienten || sumTransport !== totalPatienten) {
      onWarning?.(`kpi-mapper-dimension-drift:sk=${totalPatienten}:behandlung=${sumBehandlung}:transport=${sumTransport}`);
    }

    return { sk, behandlung, transport, totalPatienten, stand: input.stand };
  },
} as const;
