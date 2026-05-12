import { request } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withClient } from './test-db';
import type { SeedState, SeedStateUser } from './types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = resolve(__dirname, '../.auth');
const SEED_STATE_FILE = resolve(AUTH_DIR, 'seed-state.json');

const BCRYPT_COST_FACTOR_TOKEN = 10;
const BCRYPT_COST_FACTOR_PASSWORD = 10;

function cuid24(): string {
  // Test-eigene 24-Zeichen-ID, kompatibel zu `@paralleldrive/cuid2.isCuid` (Backend-Validierung
  // in UserId/EinsatzId VOs): /^[a-z][0-9a-z]+$/, Länge 2-32. Erstes Zeichen muss Kleinbuchstabe
  // sein, daher fester 'c'-Prefix; der Rest ist lowercased base64url-Random (führende Nullen sind
  // im Regex erlaubt, nur nicht an Position 0). CodeQL js/insecure-randomness: kryptografisch
  // starker RNG ist hier kostenlos und stillt die Regel.
  const rand = randomBytes(20)
    .toString('base64url')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 23)
    .padStart(23, '0');
  return 'c' + rand;
}

interface SeedOptions {
  backendBaseUrl: string;
  frontendBaseUrl: string;
}

interface SeedUserSpec {
  key: keyof SeedState['users'];
  usernameSuffix: string;
  role: SeedStateUser['role'];
}

// Username-Suffixe ohne Bindestriche: Backend-Username-Regex erlaubt nur [a-zA-Z0-9_].
const TEST_USERS: ReadonlyArray<SeedUserSpec> = [
  { key: 'markus', usernameSuffix: 'markus_sb', role: 'SICHERHEITSBEAUFTRAGTER' },
  { key: 'steffi1', usernameSuffix: 'steffi_1', role: 'ABSCHNITTSLEITER' },
  { key: 'steffi2', usernameSuffix: 'steffi_2', role: 'ABSCHNITTSLEITER' },
  { key: 'steffi3', usernameSuffix: 'steffi_3', role: 'ABSCHNITTSLEITER' },
  { key: 'einheitsfuehrer', usernameSuffix: 'einheitsfuehrer', role: 'EINHEITSFUEHRER' },
  { key: 'sabine', usernameSuffix: 'sabine_nb', role: 'NACHBEREITUNG' },
];

const TEST_PASSWORD = 'E2E711TestPass!';

export async function seedTestData({ backendBaseUrl, frontendBaseUrl }: SeedOptions): Promise<SeedState> {
  const marker = `E2E711-${Date.now()}`;
  // Username-Variante des Markers ohne Bindestriche und lowercase: Backend-Regex erlaubt nur
  // [a-zA-Z0-9_]; `findByUsername` normalisiert zusätzlich auf lowercase, daher gleich passend speichern.
  const usernameMarker = marker.replace(/-/g, '_').toLowerCase();
  const adminUsername = `${usernameMarker}_admin`;
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, BCRYPT_COST_FACTOR_PASSWORD);

  // 1. Admin + ServerAccessToken via SQL — umgeht Bootstrap-Endpoints
  const adminId = cuid24();
  const tokenId = `blh_${cuid24()}`;
  const rawToken = `blh_test_${cuid24()}`;
  const tokenHash = await bcrypt.hash(rawToken, BCRYPT_COST_FACTOR_TOKEN);

  await withClient(async (client) => {
    await client.query(
      `INSERT INTO "User" (id, username, "passwordHash", role, "isActive", "operativeRole", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'ADMIN', true, 'FUEHRUNGSKRAFT', NOW(), NOW())
       ON CONFLICT (username) DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash", "isActive" = true`,
      [adminId, adminUsername, passwordHash],
    );
    await client.query(
      `INSERT INTO "server_access_tokens" (id, "tokenHash", name, "isRevoked", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, false, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [tokenId, tokenHash, `${marker}-token`],
    );
  });

  // 2. Test-User per SQL — mit allen Eigenschutz-Permissions im JSON-Array
  // (Permissions-Match über `EinsatzScopeGuard.einsatzPermissions`, siehe Story 1.3).
  // Die Eigenschutz-Rollen-Bridge (`RollenDefinition` + `EinsatzPerson` + `EinsatzRollenbesetzung.rollenName` mit Präfix `Eigenschutz: …`)
  // ist Backend-Setup-Pflicht (Block-B-Pre-Condition) — kann der Test-Seed nicht autonom anlegen,
  // weil Story 1.3/1.5 das Match über Snapshot-VARCHAR-Felder + RollenDefinition-Records macht.
  const eigenschutzPermissions = JSON.stringify([
    'eigenschutz:gefaehrdungsbeurteilung:read',
    'eigenschutz:gefaehrdungsbeurteilung:write',
    'eigenschutz:psa:read',
    'eigenschutz:psa:write',
    'eigenschutz:psa:acknowledge',
    'eigenschutz:sicherheitsregel:read',
    'eigenschutz:sicherheitsregel:write',
    'eigenschutz:sicherheitsregel:acknowledge',
    'eigenschutz:sicherungsposten:read',
    'eigenschutz:sicherungsposten:write',
    'eigenschutz:vorfall:read',
    'eigenschutz:vorfall:report',
    'eigenschutz:vorfall:export',
    'eigenschutz:telemetry:write',
  ]);

  const usersMap: Partial<Record<keyof SeedState['users'], SeedStateUser>> = {};
  await mkdir(AUTH_DIR, { recursive: true });
  for (const spec of TEST_USERS) {
    const userId = cuid24();
    const username = `${usernameMarker}_${spec.usernameSuffix}`;
    await withClient(async (client) => {
      await client.query(
        `INSERT INTO "User" (id, username, "passwordHash", role, "isActive", "operativeRole", permissions, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'USER', true, 'FUEHRUNGSKRAFT', $4, NOW(), NOW())`,
        [userId, username, passwordHash, eigenschutzPermissions],
      );
    });
    usersMap[spec.key] = {
      username,
      password: TEST_PASSWORD,
      userId,
      role: spec.role,
      storageStateFile: resolve(AUTH_DIR, `${spec.key}.json`),
    };
  }

  // 3. Einsatz via HTTP-API anlegen (testet zugleich den Auth-Pfad)
  const apiContext = await request.newContext({
    baseURL: backendBaseUrl,
    extraHTTPHeaders: { 'X-Server-Access-Token': rawToken },
  });
  const adminLogin = await apiContext.post('/api/auth/login', {
    data: { username: adminUsername, password: TEST_PASSWORD },
  });
  if (!adminLogin.ok()) {
    throw new Error(`[E2E-Seed] Admin-Login schlug fehl: ${adminLogin.status()} ${await adminLogin.text()}`);
  }

  const createEinsatz = await apiContext.post('/api/v-alpha/einsatz', {
    data: {
      alarmstichwort: `${marker} CBRN-Übung`,
      beschreibung: 'E2E-Run Story 7.11 — Journey 1b + Journey 4.',
      einsatzort: 'Übungsfeld Patientenablage Süd',
    },
  });
  if (!createEinsatz.ok()) {
    throw new Error(`[E2E-Seed] Einsatz-Create schlug fehl: ${createEinsatz.status()} ${await createEinsatz.text()}`);
  }
  const einsatzBody = (await createEinsatz.json()) as { data?: { id?: string } };
  const einsatzId = einsatzBody.data?.id;
  if (!einsatzId) {
    throw new Error('[E2E-Seed] Einsatz-Create lieferte keine ID.');
  }

  // `nummer` UNIQUE-konform auf den Marker setzen, damit Teardown alle Test-Einsätze findet
  await withClient(async (client) => {
    await client.query(`UPDATE einsaetze SET nummer = $1 WHERE id = $2`, [`${marker}-einsatz`, einsatzId]);
  });

  // 4. EinsatzEinheiten als Abschnitte (Enum-Wert `ABSCHNITT` ist Pflicht — verifiziert gegen
  //    `EinsatzEinheitTyp` in `schema.prisma`: TRUPP | STAFFEL | GRUPPE | ZUG | ABSCHNITT)
  const abschnittSpecs: ReadonlyArray<{ name: string; typ: string }> = [
    { name: `${marker}-Patientenablage`, typ: 'ABSCHNITT' },
    { name: `${marker}-Verkehr`, typ: 'ABSCHNITT' },
    { name: `${marker}-Technik`, typ: 'ABSCHNITT' },
  ];
  const abschnitte: SeedState['abschnitte'] = [];
  for (const a of abschnittSpecs) {
    const einheitId = cuid24();
    await withClient(async (client) => {
      await client.query(
        `INSERT INTO einsatz_einheiten (id, einsatz_id, name, typ, status, soll_staerke, created_at, updated_at, created_by)
         VALUES ($1, $2, $3, $4::"EinsatzEinheitTyp", 'IM_EINSATZ'::"EinsatzEinheitStatus", 6, NOW(), NOW(), $5)`,
        [einheitId, einsatzId, a.name, a.typ, adminId],
      );
    });
    abschnitte.push({ id: einheitId, name: a.name, einheitId });
  }

  // 5. Rollenbesetzung **wird hier NICHT angelegt** (Architektur-Decoupling Story 1.3/1.5):
  //    `einsatz_rollen_besetzung` referenziert `RollenDefinition` (Plattform-Seed) und
  //    `EinsatzPerson` (Einsatz-Stammdatensatz, separater Lifecycle). Die Eigenschutz-Rollen-Bridge
  //    (`RollenDefinition.name` mit Präfix `Eigenschutz: …` + `EinsatzPerson` pro Test-User)
  //    ist Backend-Setup-Pflicht — der Test-Seed füllt stattdessen `User.permissions` (s.o.),
  //    sodass der `PermissionsGuard` durchlässt. Story-1.3 `EinsatzScopeGuard.einsatzPermissions`
  //    erweitert das einsatzweit.
  //
  //    Falls die Pilot-Backend-Konfiguration zusätzlich auf den `rollenName`-Match angewiesen ist,
  //    muss vor dem ersten `linux-e2e`-Run ein Backend-Seed laufen, der die Eigenschutz-
  //    RollenDefinitions erzeugt (siehe Audit-Bericht Sektion 1 + Block-B-Item).

  // 6. Pro User Storage-State exportieren (eigener APIRequestContext → Cookies → JSON)
  for (const spec of TEST_USERS) {
    const user = usersMap[spec.key]!;
    const userCtx = await request.newContext({ baseURL: backendBaseUrl });
    const loginResponse = await userCtx.post('/api/auth/login', {
      data: { username: user.username, password: TEST_PASSWORD },
    });
    if (!loginResponse.ok()) {
      await userCtx.dispose();
      throw new Error(`[E2E-Seed] Login für ${user.username} schlug fehl: ${loginResponse.status()}`);
    }
    await userCtx.storageState({ path: user.storageStateFile });
    await userCtx.dispose();
  }
  await apiContext.dispose();

  // 7. seed-state.json persistieren
  const seedState: SeedState = {
    marker,
    einsatzId,
    abschnitte,
    users: {
      markus: usersMap.markus!,
      steffi1: usersMap.steffi1!,
      steffi2: usersMap.steffi2!,
      steffi3: usersMap.steffi3!,
      einheitsfuehrer: usersMap.einheitsfuehrer!,
      sabine: usersMap.sabine!,
    },
    serverAccessToken: rawToken,
    backendBaseUrl,
    frontendBaseUrl,
  };
  await mkdir(dirname(SEED_STATE_FILE), { recursive: true });
  await writeFile(SEED_STATE_FILE, JSON.stringify(seedState, null, 2), 'utf8');
  return seedState;
}

export function getSeedStateFilePath(): string {
  return SEED_STATE_FILE;
}

export async function readSeedState(): Promise<SeedState> {
  const raw = await readFile(SEED_STATE_FILE, 'utf8');
  return JSON.parse(raw) as SeedState;
}
