import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedTestData } from './seed';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = resolve(__dirname, '../.auth');
const PIDS_FILE = resolve(AUTH_DIR, 'process-pids.json');

const BACKEND_PORT = process.env.E2E_BACKEND_PORT ?? '3091';
const FRONTEND_PORT = process.env.E2E_FRONTEND_PORT ?? '4173';
const BACKEND_BASE_URL = process.env.E2E_BACKEND_BASE_URL ?? `http://127.0.0.1:${BACKEND_PORT}`;
const FRONTEND_BASE_URL = process.env.E2E_FRONTEND_URL ?? `http://127.0.0.1:${FRONTEND_PORT}`;

const READY_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 500;

function assertDatabaseUrl(): void {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // Aussagekräftiger Banner — kein Silent-Skip, Story 7.11 AC2 Pflicht
    throw new Error(
      '\n' +
        '════════════════════════════════════════════════════════════════════════════\n' +
        '[E2E-Setup] DATABASE_URL ist nicht gesetzt.\n' +
        '\n' +
        'Die Story-7.11-E2E-Suite benötigt eine echte Postgres-Verbindung — kein Mock,\n' +
        'kein Silent-Skip. Erwartet wird ein Postgres-Service unter `DATABASE_URL`\n' +
        '(lokal z. B. `postgresql://test:test@localhost:5432/testdb`, CI via Service-Job).\n' +
        '\n' +
        'Setze die Variable und führe den Run erneut aus.\n' +
        '════════════════════════════════════════════════════════════════════════════\n',
    );
  }
  // P10 (Review): Hard-Guard gegen versehentliche Produktiv-DB.
  // `cleanupMarkedData` DELETEt anhand E2E711-Prefix; ohne Guard droht Datenverlust,
  // wenn ein Dev `DATABASE_URL=prod-url` exportiert. Test-DB-Indikator ODER explizite Opt-In-Variable.
  const looksLikeTestDb = /test|e2e|local/i.test(url);
  const explicitOptIn = process.env.E2E_ALLOW_DESTRUCTIVE_DB === '1';
  if (!looksLikeTestDb && !explicitOptIn) {
    throw new Error(
      '\n' +
        '════════════════════════════════════════════════════════════════════════════\n' +
        '[E2E-Setup] DATABASE_URL enthält keinen test/e2e/local-Indikator.\n' +
        '\n' +
        'Die E2E-Suite führt destruktives DELETE auf Marker-Prefix `E2E711-*` aus.\n' +
        'Wenn das Absicht ist (z. B. dediziertes Pilot-Backend), setze E2E_ALLOW_DESTRUCTIVE_DB=1.\n' +
        '════════════════════════════════════════════════════════════════════════════\n',
    );
  }
}

const NEST_READY_MARKER = /Nest application successfully started/;

async function waitForHttp(url: string, label: string): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < READY_TIMEOUT_MS) {
    try {
      const response = await fetch(url, { method: 'GET' });
      // P7 (Review): 5xx ist NICHT „ready" — Backend prozess läuft, aber Health-Endpoint failt.
      if (response.status >= 200 && response.status < 400) {
        return;
      }
    } catch {
      // Connection refused → noch nicht ready
    }
    await new Promise<void>((done) => setTimeout(() => done(), POLL_INTERVAL_MS));
  }
  throw new Error(`[E2E-Setup] ${label} ist nach ${READY_TIMEOUT_MS}ms nicht erreichbar (${url})`);
}

type SpawnFailureSignal = { rejected: boolean; reject: (err: Error) => void };

function spawnLogged(command: string, args: ReadonlyArray<string>, label: string, env: NodeJS.ProcessEnv): { child: ChildProcess; readyMarker: Promise<void>; failureSignal: SpawnFailureSignal } {
  // P6 (Review): `detached: true` ermöglicht Process-Group-Kill in Teardown (sigterm
  // an die ganze Gruppe, damit der `node`-Grandchild nicht orphan wird).
  const child = spawn(command, args as string[], { env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });

  const failureSignal: SpawnFailureSignal = { rejected: false, reject: () => undefined };
  // P8 (Review): Sofortiger Abort bei Spawn-Error oder Frühem Exit, statt 60s warten.
  const failurePromise = new Promise<never>((_, reject) => {
    failureSignal.reject = (err) => {
      if (!failureSignal.rejected) {
        failureSignal.rejected = true;
        reject(err);
      }
    };
  });
  child.on('error', (err) => failureSignal.reject(new Error(`[${label}] Spawn-Fehler: ${err.message}`)));

  // P23 (Review): Stdout-Marker als Primärpfad für Backend-Bootstrap (AC2 Schritt 1).
  let markerSeen = false;
  let markerResolve: (() => void) | null = null;
  const readyMarker = new Promise<void>((res) => {
    markerResolve = res;
  });

  child.stdout?.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    process.stdout.write(`[${label}] ${text}`);
    if (!markerSeen && NEST_READY_MARKER.test(text)) {
      markerSeen = true;
      markerResolve?.();
    }
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    process.stderr.write(`[${label}] ${chunk.toString()}`);
  });
  child.on('exit', (code, signal) => {
    process.stdout.write(`[${label}] Process exited (code=${code ?? 'null'}, signal=${signal ?? 'null'})\n`);
    if (code !== null && code !== 0 && !markerSeen) {
      failureSignal.reject(new Error(`[${label}] Process exited code=${code} before becoming ready`));
    }
  });

  // Bind failure promise zur Lebenszeit von readyMarker:
  // Wenn ein Failure auftritt bevor Marker da ist, race-rejected die kombinierte Promise.
  const racedReady = Promise.race([readyMarker, failurePromise]) as Promise<void>;

  return { child, readyMarker: racedReady, failureSignal };
}

export default async function globalSetup(): Promise<void> {
  assertDatabaseUrl();
  await mkdir(AUTH_DIR, { recursive: true });

  const repoRoot = resolve(__dirname, '../../../..');

  // 1. Backend out-of-process starten (Pivot-Anker §2)
  const backend = spawnLogged('pnpm', ['--filter', '@bluelight-hub/backend', 'exec', 'node', 'dist/main.js'], 'backend', {
    ...process.env,
    NODE_ENV: 'test',
    PORT: BACKEND_PORT,
    BACKEND_PORT,
    JWT_SECRET: process.env.JWT_SECRET ?? 'test-secret',
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret',
    // P24 (Review): `INSECURE_MODE` ist hier dokumentiert nötig, weil das Production-Backend
    // ohne Self-Signed-Zertifikat HTTPS-Lock aktiv hat. E2E-Suite läuft gegen HTTP-Loopback.
    INSECURE_MODE: 'true',
  });

  // P19 (Review): PIDs *direkt nach Spawn* persistieren (vor Seed), damit Teardown
  // Children auch bei Seed-Failure findet.
  await writeFile(PIDS_FILE, JSON.stringify({ backendPid: backend.child.pid ?? null, frontendPid: null }, null, 2), 'utf8');

  // P8 (Review): Stdout-Marker primär, HTTP-Polling als Fallback (AC2 Schritt 1).
  await Promise.race([backend.readyMarker.then(() => waitForHttp(`${BACKEND_BASE_URL}/api/health`, 'Backend')), waitForHttp(`${BACKEND_BASE_URL}/api/health`, 'Backend')]);

  // 2. Frontend statisch via `vite preview` (Pivot-Anker §3, NICHT `vite dev`)
  const frontend = spawnLogged('pnpm', ['--filter', '@bluelight-hub/frontend', 'exec', 'vite', 'preview', '--host', '127.0.0.1', '--port', FRONTEND_PORT, '--strictPort'], 'frontend', {
    ...process.env,
    VITE_API_BASE_URL: `${BACKEND_BASE_URL}/api`,
  });

  await writeFile(PIDS_FILE, JSON.stringify({ backendPid: backend.child.pid ?? null, frontendPid: frontend.child.pid ?? null }, null, 2), 'utf8');

  await waitForHttp(FRONTEND_BASE_URL, 'Frontend');

  // P19 (Review): Process-Exit-Fallback-Kill, falls Teardown nicht greift (z. B. Seed-Crash).
  const killAll = (): void => {
    for (const pid of [backend.child.pid, frontend.child.pid]) {
      if (pid !== undefined && pid !== null) {
        try {
          process.kill(-pid, 'SIGTERM');
        } catch {
          // Process bereits beendet
        }
      }
    }
  };
  process.on('exit', killAll);

  // 3. Test-Daten seeden + Storage-State exportieren
  try {
    await seedTestData({ backendBaseUrl: BACKEND_BASE_URL, frontendBaseUrl: FRONTEND_BASE_URL });
  } catch (e) {
    killAll();
    throw e;
  }

  // 4. PIDs (final) für Teardown persistieren
  await writeFile(PIDS_FILE, JSON.stringify({ backendPid: backend.child.pid ?? null, frontendPid: frontend.child.pid ?? null }, null, 2), 'utf8');

  // repoRoot in Env als Hint für Specs (optional)
  process.env.E2E_REPO_ROOT = repoRoot;
}
