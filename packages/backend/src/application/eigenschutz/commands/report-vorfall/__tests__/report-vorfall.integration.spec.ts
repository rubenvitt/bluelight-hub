/**
 * Story 5.2 AC13 — Integration-Test für die Snapshot-Unveränderlichkeit
 * eines Eigenschutz-Vorfalls.
 *
 * Real-DB-Test (kein Mock): legt Setup-Daten an, baut den Snapshot über
 * den `KontextSnapshotBuilder` zur Vorfallzeit, persistiert das Aggregate
 * via `PrismaEigenschutzVorfallRepository`, mutiert anschließend
 * Gefährdungsbeurteilung, PSA-Profil und Sicherheitsregel — und prüft,
 * dass der Vorfall-Snapshot nach Re-Read **unverändert** den
 * ursprünglichen Stand trägt.
 *
 * Skipt automatisch, wenn `DATABASE_URL` fehlt (CI-Pattern Story 5-6).
 */

import { ConfigService } from '@nestjs/config';
import { createId } from '@paralleldrive/cuid2';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EigenschutzVorfall } from '@domain/eigenschutz/aggregates/eigenschutz-vorfall.aggregate';
import { Beteiligter } from '@domain/eigenschutz/value-objects/beteiligter.vo';
import type { ILogger } from '@domain/ports/i-logger.port';
import { PrismaGefaehrdungsbeurteilungVersionRepository } from '@infrastructure/eigenschutz/repositories/prisma-gefaehrdungsbeurteilung-version.repository';
import { PrismaPsaProfilZuweisungRepository } from '@infrastructure/eigenschutz/repositories/prisma-psa-profil-zuweisung.repository';
import { PrismaSicherheitsregelVersionRepository } from '@infrastructure/eigenschutz/repositories/prisma-sicherheitsregel-version.repository';
import { PrismaEigenschutzVorfallRepository } from '@infrastructure/eigenschutz/repositories/prisma-eigenschutz-vorfall.repository';
import { KontextSnapshotBuilder } from '../../../services/kontext-snapshot-builder';

// Opt-in via STORY_5_2_INTEGRATION=1 — eine echte, isolierte Test-DB
// vorausgesetzt. Ohne das Flag bleibt der Test geskippt, damit der
// Standard-`pnpm test:db`-Lauf nicht mit der Backend-Dev-DB kollidiert
// (Connection-Pool-Sättigung). Pattern analog zu `archive-old-einsaetze`,
// aber mit explizitem Opt-in statt nur DATABASE_URL-Check, weil der
// Backend-dev-Server lokal denselben Pool belegt.
const integrationEnabled = !!process.env.DATABASE_URL && process.env.STORY_5_2_INTEGRATION === '1';
const describeIfDb = integrationEnabled ? describe : describe.skip;

const noopLogger: ILogger = { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
const TEST_PREFIX = 'STORY52_INT_';

function buildConfig(): ConfigService {
  return {
    getOrThrow: (key: string): string => {
      if (key === 'DATABASE_URL') {
        const v = process.env.DATABASE_URL;
        if (!v) throw new Error('DATABASE_URL fehlt');
        return v;
      }
      throw new Error(`Missing test config key: ${key}`);
    },
  } as unknown as ConfigService;
}

jest.setTimeout(30_000);

describeIfDb('ReportVorfall Integration — Snapshot-Unveränderlichkeit (Story 5.2 AC13)', () => {
  let prisma: PrismaService;
  let builder: KontextSnapshotBuilder;
  let vorfallRepo: PrismaEigenschutzVorfallRepository;
  let gefVersionRepo: PrismaGefaehrdungsbeurteilungVersionRepository;
  let sicherheitsregelVersionRepo: PrismaSicherheitsregelVersionRepository;

  let userId: string;
  let einsatzId: string;
  let einheitId: string;
  let beurteilungId: string;
  const cleanupVorfallIds: string[] = [];

  beforeAll(async () => {
    // Manuelle Wire-Up statt NestJS-DI — die Test.createTestingModule-Compile
    // hing in der Story-5.2-Integrations-Anlage; direkt-instanziierte Services
    // sind robuster und decken die identische Zielsemantik (echte Prisma-DB).
    prisma = new PrismaService(buildConfig());
    await prisma.onModuleInit();
    gefVersionRepo = new PrismaGefaehrdungsbeurteilungVersionRepository(noopLogger, prisma);
    const psaRepo = new PrismaPsaProfilZuweisungRepository(prisma, noopLogger);
    sicherheitsregelVersionRepo = new PrismaSicherheitsregelVersionRepository(noopLogger, prisma);
    builder = new KontextSnapshotBuilder(gefVersionRepo, psaRepo, sicherheitsregelVersionRepo, noopLogger);
    vorfallRepo = new PrismaEigenschutzVorfallRepository(prisma, noopLogger);

    const username = `${TEST_PREFIX}user_${createId()}`;
    const user = await prisma.user.create({ data: { username, role: 'ADMIN', isActive: true } });
    userId = user.id;

    const einsatz = await prisma.einsatz.create({
      data: {
        alarmstichwort: `${TEST_PREFIX}einsatz`,
        beschreibung: 'Story 5.2 Integration',
        status: 'BEGONNEN',
        createdBy: userId,
      },
    });
    einsatzId = einsatz.id;

    const einheit = await prisma.einsatzEinheit.create({
      data: {
        einsatzId,
        name: 'IntegrationsEinheit',
        typ: 'RD',
        createdBy: userId,
      },
    });
    einheitId = einheit.id;
  });

  afterEach(async () => {
    if (cleanupVorfallIds.length > 0) {
      await prisma.eigenschutzVorfall.deleteMany({ where: { id: { in: cleanupVorfallIds } } });
      cleanupVorfallIds.length = 0;
    }
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
    try {
      await prisma.eigenschutzVorfall.deleteMany({ where: { einsatzId } });
      await prisma.psaProfilZuweisung.deleteMany({ where: { einsatzId } });
      await prisma.sicherheitsregelVersion.deleteMany({ where: { regel: { einsatzId } } });
      await prisma.sicherheitsregel.deleteMany({ where: { einsatzId } });
      await prisma.gefaehrdungsbeurteilungVersion.deleteMany({ where: { gefBeurteilung: { einsatzId } } });
      await prisma.gefaehrdungsbeurteilung.deleteMany({ where: { einsatzId } });
      await prisma.einsatzEinheit.deleteMany({ where: { einsatzId } });
      await prisma.einsatz.delete({ where: { id: einsatzId } });
      await prisma.user.delete({ where: { id: userId } });
    } finally {
      await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
    }
    await prisma.onModuleDestroy();
  });

  it('Snapshot bleibt unverändert nach späteren GB-/PSA-/Regeln-Updates', async () => {
    const baseTime = new Date('2026-05-06T10:00:00.000Z');

    // 1) Setup
    const beurteilung = await prisma.gefaehrdungsbeurteilung.create({
      data: {
        einsatzId,
        einheitId,
        items: [{ id: createId(), title: 'Glatteis (V1)', risikoklasse: 'GELB' }],
        version: 1,
        erstelltVonUserId: userId,
        aktualisiertVonUserId: userId,
      },
    });
    beurteilungId = beurteilung.id;

    await prisma.gefaehrdungsbeurteilungVersion.create({
      data: {
        gefBeurteilungId: beurteilungId,
        version: 1,
        items: [{ id: createId(), title: 'Glatteis (V1)', risikoklasse: 'GELB' }],
        changedFields: { created: true },
        gueltigVon: baseTime,
        changedByUserId: userId,
        eventId: createId(),
      },
    });

    await prisma.psaProfilZuweisung.create({
      data: {
        einsatzId,
        einheitId,
        profil: 'BASIS',
        gueltigVon: baseTime,
        aktiviertVonUserId: userId,
        begruendung: 'Routine',
        propagationGroupId: createId(),
        version: 1,
      },
    });

    const regel = await prisma.sicherheitsregel.create({
      data: {
        einsatzId,
        einheitId: null,
        titel: 'Reflexweste tragen',
        inhalt: 'Pflicht im Außenbereich.',
        version: 1,
        erstelltVonUserId: userId,
        aktualisiertVonUserId: userId,
      },
    });
    await prisma.sicherheitsregelVersion.create({
      data: {
        regelId: regel.id,
        version: 1,
        titel: 'Reflexweste tragen',
        inhalt: 'Pflicht im Außenbereich.',
        gueltigVon: baseTime,
        changedByUserId: userId,
        eventId: createId(),
      },
    });

    // 2) Snapshot bauen + Vorfall persistieren
    const vorfallZeit = new Date('2026-05-06T11:00:00.000Z');
    const snapshotResult = await prisma.$transaction(async (tx) => {
      return builder.build({ einsatzId, einheitId, snapshotAt: vorfallZeit, tx });
    });
    expect(snapshotResult.isSuccess).toBe(true);
    const snapshot = snapshotResult.value!;
    expect(snapshot.gefaehrdungsbeurteilung?.version).toBe(1);
    expect(snapshot.aktivePsaProfile).toHaveLength(1);
    expect(snapshot.sicherheitsregeln).toHaveLength(1);
    expect(snapshot.sicherheitsregeln[0]!.version).toBe(1);

    const aggregate = EigenschutzVorfall.create({
      einsatzId,
      einheitId,
      vorfallZeit,
      wann: vorfallZeit,
      was: 'Sturz beim Aufbau',
      wo: null,
      beteiligte: [Beteiligter.create({ kind: 'einsatzPerson', userId }).value!],
      massnahmen: 'Erstversorgung',
      unfallkasseRelevant: false,
      erfasstVonUserId: userId,
      kontextSnapshot: snapshot,
      now: vorfallZeit,
    }).value!;

    const saveResult = await prisma.$transaction(async (tx) => vorfallRepo.save(aggregate, tx));
    expect(saveResult.isSuccess).toBe(true);
    cleanupVorfallIds.push(aggregate.id.value);

    // 3) Nachträgliche Mutationen
    const updateTime = new Date('2026-05-06T12:00:00.000Z');
    await prisma.$transaction(async (tx) =>
      gefVersionRepo.saveNewVersion(
        {
          gefBeurteilungId: beurteilungId,
          version: 2,
          items: [{ id: createId(), title: 'Glatteis (V2)', risikoklasse: 'ROT' }],
          changedFields: { updated: ['Glatteis'] },
          gueltigVon: updateTime,
          changedByUserId: userId,
          eventId: createId(),
        },
        tx,
      ),
    );
    await prisma.gefaehrdungsbeurteilung.update({ where: { id: beurteilungId }, data: { version: 2, items: [{ title: 'Glatteis (V2)', risikoklasse: 'ROT' }] } });

    await prisma.psaProfilZuweisung.updateMany({
      where: { einsatzId, einheitId, profil: 'BASIS', gueltigBis: null },
      data: { gueltigBis: updateTime, version: 2 },
    });

    await prisma.$transaction(async (tx) =>
      sicherheitsregelVersionRepo.saveNewVersion(
        {
          regelId: regel.id,
          version: 2,
          titel: 'Reflexweste tragen',
          inhalt: 'Pflicht IMMER (V2).',
          gueltigVon: updateTime,
          changedByUserId: userId,
          eventId: createId(),
        },
        tx,
      ),
    );
    await prisma.sicherheitsregel.update({ where: { id: regel.id }, data: { version: 2, inhalt: 'Pflicht IMMER (V2).' } });

    // 4) Vorfall neu laden + 5) Assertion: Snapshot ist nicht mutiert
    const reloadResult = await vorfallRepo.findById(aggregate.id.value);
    expect(reloadResult.isSuccess).toBe(true);
    const reloaded = reloadResult.value!;
    const reloadedSnap = reloaded.kontextSnapshot as {
      gefaehrdungsbeurteilung: { version: number; items: Array<{ title?: string }> } | null;
      aktivePsaProfile: Array<{ gueltigBis: string | null }>;
      sicherheitsregeln: Array<{ version: number; inhalt: string }>;
    };

    expect(reloadedSnap.gefaehrdungsbeurteilung?.version).toBe(1);
    expect(reloadedSnap.gefaehrdungsbeurteilung?.items[0]?.title).toBe('Glatteis (V1)');
    expect(reloadedSnap.aktivePsaProfile[0]?.gueltigBis).toBeNull();
    expect(reloadedSnap.sicherheitsregeln[0]?.version).toBe(1);
    expect(reloadedSnap.sicherheitsregeln[0]?.inhalt).toBe('Pflicht im Außenbereich.');

    expect(reloaded.gefBeurteilungVersionId).not.toBeNull();
  }, 30_000);
});
