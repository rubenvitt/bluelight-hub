import { readFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanupMarkedData, disconnectTestDb } from './test-db';
import { readSeedState } from './seed';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = resolve(__dirname, '../.auth');
const PIDS_FILE = resolve(AUTH_DIR, 'process-pids.json');

async function killProcess(pid: number | null, label: string): Promise<void> {
  if (pid === null) {
    return;
  }
  try {
    // P6 (Review): Process-Group-Kill, damit der `node`-Grandchild unter `pnpm` nicht orphan
    // wird. Spawn nutzt `detached: true`, die negative PID adressiert die ganze Group.
    process.kill(-pid, 'SIGTERM');
  } catch (err) {
    // Group-Kill nicht möglich (z. B. PID-Group nicht aufgesetzt) → Fallback auf direkten Kill.
    try {
      process.kill(pid, 'SIGTERM');
    } catch (fallbackErr) {
      process.stderr.write(`[E2E-Teardown] Konnte ${label}-Prozess (PID ${pid}) nicht beenden: ${(err as Error).message} / Fallback: ${(fallbackErr as Error).message}\n`);
      return;
    }
  }

  // SIGKILL nach 5 s, falls Group nicht reagiert.
  await new Promise<void>((done) => {
    setTimeout(() => {
      try {
        process.kill(-pid, 0);
        process.kill(-pid, 'SIGKILL');
      } catch {
        // Group bereits weg
      }
      done();
    }, 5000);
  });
}

export default async function globalTeardown(): Promise<void> {
  // 1. DB-Cleanup mit Marker
  try {
    const seedState = await readSeedState();
    await cleanupMarkedData(seedState.marker);
  } catch (err) {
    process.stderr.write(`[E2E-Teardown] DB-Cleanup übersprungen: ${(err as Error).message}\n`);
  }
  await disconnectTestDb();

  // 2. Child-Processes beenden
  try {
    const pidsRaw = await readFile(PIDS_FILE, 'utf8');
    const { backendPid, frontendPid } = JSON.parse(pidsRaw) as { backendPid: number | null; frontendPid: number | null };
    await Promise.all([killProcess(backendPid, 'backend'), killProcess(frontendPid, 'frontend')]);
  } catch (err) {
    process.stderr.write(`[E2E-Teardown] PID-File nicht lesbar: ${(err as Error).message}\n`);
  }

  // 3. Auth-Bundles bewusst stehen lassen (gitignored, dient lokalem Debugging)
  // Falls explizit Clean-Slate gewünscht: E2E_CLEAN_AUTH=true
  if (process.env.E2E_CLEAN_AUTH === 'true') {
    await rm(AUTH_DIR, { recursive: true, force: true });
  }
}
