#!/usr/bin/env bash
# Worktree-Setup für parallele Multi-Agent-Entwicklung
# Richtet eine isolierte Entwicklungsumgebung pro Git-Worktree ein:
# - Dynamische Ports (Frontend, Backend, PostgreSQL)
# - Eigener PostgreSQL-Container + Volume
# - Generierte .env Dateien
# - pnpm install + Prisma migrate + Seed
#
# Usage:
#   bash scripts/worktree-setup.sh           # Setup (bestehende .env im Hauptrepo bleibt)
#   bash scripts/worktree-setup.sh --force   # .env auch im Hauptrepo neu generieren
set -euo pipefail

FORCE=false
if [ "${1:-}" = "--force" ] || [ "${1:-}" = "-f" ]; then
  FORCE=true
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git rev-parse --show-toplevel)"

# shellcheck source=worktree-ports.sh
source "$SCRIPT_DIR/worktree-ports.sh"

# --- mise trust (Tool-Version-Manager vertraut neuen Pfaden nicht automatisch) ---
if command -v mise >/dev/null 2>&1; then
  mise trust --quiet 2>/dev/null || true
fi

# --- Erkennung ---
WORKTREE_ID="$(get_worktree_id)"
OFFSET="$(calculate_port_offset "$WORKTREE_ID")"
PROJECT_NAME="$(get_compose_project_name "$WORKTREE_ID")"

echo "=== Bluelight Hub Worktree Setup ==="
echo "Worktree:  ${WORKTREE_ID:-HAUPTREPO}"
echo "Offset:    $OFFSET"
echo "Project:   $PROJECT_NAME"
echo ""

# --- Port-Berechnung ---
eval "$(get_ports "$OFFSET")"
DATABASE_URL="postgresql://bluelight:bluelight@localhost:${DATABASE_PORT}/bluelight-hub?schema=public"

echo "Frontend:  localhost:${VITE_PORT}"
echo "Backend:   localhost:${BACKEND_PORT}"
echo "Database:  localhost:${DATABASE_PORT}"
echo ""

# --- Kollisionsprüfung ---
COLLISION=false
for port in "$VITE_PORT" "$BACKEND_PORT" "$DATABASE_PORT"; do
  if lsof -i :"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "WARNUNG: Port $port ist bereits belegt!"
    COLLISION=true
  fi
done
if [ "$COLLISION" = true ]; then
  echo "FEHLER: Port-Kollision(en) erkannt. Bitte prüfe mit: lsof -i :<port>"
  exit 1
fi

# --- HTTPS-Zertifikate (vor .env-Generierung, da URL-Schema davon abhängt) ---
if [ ! -d "$REPO_ROOT/certs" ] || [ ! -f "$REPO_ROOT/certs/localhost.pem" ]; then
  echo "Generiere HTTPS-Zertifikate..."
  cd "$REPO_ROOT"
  pnpm run gen:certs
fi

USE_HTTPS=true
if [ ! -f "$REPO_ROOT/certs/localhost.pem" ]; then
  USE_HTTPS=false
fi

if [ "$USE_HTTPS" = true ]; then
  SCHEME="https"
else
  SCHEME="http"
fi
VITE_API_URL="${SCHEME}://localhost:${BACKEND_PORT}"

# --- .env Generierung ---
BACKEND_ENV="$REPO_ROOT/packages/backend/.env"
FRONTEND_ENV="$REPO_ROOT/packages/frontend/.env"

if [ "$OFFSET" -eq 0 ] && [ -f "$BACKEND_ENV" ] && [ "$FORCE" = false ]; then
  echo "Hauptrepo: Bestehende .env Dateien bleiben unverändert (--force zum Überschreiben)"
else
  # MASTER_SECRET und VAPID-Keypair aus bestehender .env wiederverwenden (falls vorhanden)
  EXISTING_SECRET=""
  EXISTING_VAPID_PUBLIC=""
  EXISTING_VAPID_PRIVATE=""
  EXISTING_VAPID_SUBJECT=""
  if [ -f "$BACKEND_ENV" ]; then
    EXISTING_SECRET=$(grep '^MASTER_SECRET=' "$BACKEND_ENV" 2>/dev/null | cut -d'=' -f2- | tr -d '"' || true)
    EXISTING_VAPID_PUBLIC=$(grep '^VAPID_PUBLIC_KEY=' "$BACKEND_ENV" 2>/dev/null | cut -d'=' -f2- | tr -d '"' || true)
    EXISTING_VAPID_PRIVATE=$(grep '^VAPID_PRIVATE_KEY=' "$BACKEND_ENV" 2>/dev/null | cut -d'=' -f2- | tr -d '"' || true)
    EXISTING_VAPID_SUBJECT=$(grep '^VAPID_SUBJECT=' "$BACKEND_ENV" 2>/dev/null | cut -d'=' -f2- | tr -d '"' || true)
  fi
  MASTER_SECRET="${EXISTING_SECRET:-$(openssl rand -hex 32)}"
  VAPID_SUBJECT_VALUE="${EXISTING_VAPID_SUBJECT:-mailto:ops@example.org}"

  # Backend .env generieren
  cat > "$BACKEND_ENV" <<EOF
# Auto-generiert von worktree-setup.sh (Offset: $OFFSET)
PORT=${BACKEND_PORT}
NODE_ENV=development

APP_URL=${SCHEME}://localhost:${BACKEND_PORT}
FRONTEND_URL=${SCHEME}://localhost:${VITE_PORT}

DATABASE_URL="${DATABASE_URL}"

MASTER_SECRET=${MASTER_SECRET}

INSECURE_MODE=$( [ "$USE_HTTPS" = true ] && echo "false" || echo "true" )

HTTPS_ENABLED=${USE_HTTPS}
HTTPS_KEY_PATH=../../certs/localhost-key.pem
HTTPS_CERT_PATH=../../certs/localhost.pem

ALLOWED_ORIGIN_PATTERNS=^https:\/\/[\w-]+\.bluelight-hub-app\.pages\.dev$

# Web-Push (Story 1.1, ADR-011) — Dev-Keypair, wird nach pnpm install befüllt
VAPID_PUBLIC_KEY=${EXISTING_VAPID_PUBLIC}
VAPID_PRIVATE_KEY=${EXISTING_VAPID_PRIVATE}
VAPID_SUBJECT=${VAPID_SUBJECT_VALUE}
EOF
  echo "Backend .env generiert"

  # Frontend .env generieren
  cat > "$FRONTEND_ENV" <<EOF
# Auto-generiert von worktree-setup.sh (Offset: $OFFSET)
VITE_API_URL=${VITE_API_URL}
VITE_PORT=${VITE_PORT}
VITE_INSECURE_MODE=$( [ "$USE_HTTPS" = true ] && echo "false" || echo "true" )

# Web-Push (Story 1.1, ADR-011) — muss zum Backend-VAPID_PUBLIC_KEY passen
VITE_VAPID_PUBLIC_KEY=${EXISTING_VAPID_PUBLIC}
EOF
  echo "Frontend .env generiert"
fi

# --- Docker (PostgreSQL) ---
echo ""
echo "Starte PostgreSQL-Container..."
COMPOSE_PROJECT_NAME="$PROJECT_NAME" \
  DATABASE_PORT="$DATABASE_PORT" \
  docker compose -f "$REPO_ROOT/docker-compose.yml" up -d postgres

echo "Warte auf PostgreSQL..."
# Warte bis pg_isready erfolgreich ist (max 30 Versuche)
RETRIES=30
until COMPOSE_PROJECT_NAME="$PROJECT_NAME" \
  docker compose -f "$REPO_ROOT/docker-compose.yml" \
  exec -T postgres pg_isready -U bluelight >/dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  if [ "$RETRIES" -le 0 ]; then
    echo "FEHLER: PostgreSQL nicht bereit nach 30 Versuchen"
    exit 1
  fi
  sleep 1
done
echo "PostgreSQL bereit"

# --- pnpm install ---
echo ""
echo "pnpm install..."
cd "$REPO_ROOT"
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# --- VAPID-Keypair (Web-Push, Story 1.1 / ADR-011) ---
# Generieren, wenn noch keins existiert. Public-Key wandert zusätzlich ins Frontend,
# damit der PushSubscriptionManager beim Boot eine konsistente Identität hat.
CURRENT_VAPID_PUBLIC=$(grep '^VAPID_PUBLIC_KEY=' "$BACKEND_ENV" 2>/dev/null | cut -d'=' -f2- | tr -d '"' || true)
CURRENT_VAPID_PRIVATE=$(grep '^VAPID_PRIVATE_KEY=' "$BACKEND_ENV" 2>/dev/null | cut -d'=' -f2- | tr -d '"' || true)
if [ -z "$CURRENT_VAPID_PUBLIC" ] || [ -z "$CURRENT_VAPID_PRIVATE" ]; then
  echo ""
  echo "Generiere VAPID-Keypair für Web-Push..."
  VAPID_JSON=$(pnpm --filter @bluelight-hub/backend --silent exec web-push generate-vapid-keys --json)
  VAPID_PUBLIC=$(echo "$VAPID_JSON" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>process.stdout.write(JSON.parse(d).publicKey))')
  VAPID_PRIVATE=$(echo "$VAPID_JSON" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>process.stdout.write(JSON.parse(d).privateKey))')
  if [ -z "$VAPID_PUBLIC" ] || [ -z "$VAPID_PRIVATE" ]; then
    echo "FEHLER: VAPID-Keypair konnte nicht generiert werden"
    exit 1
  fi
  # macOS/BSD und GNU sed kompatibel ersetzen
  sed -i.bak "s|^VAPID_PUBLIC_KEY=.*|VAPID_PUBLIC_KEY=${VAPID_PUBLIC}|" "$BACKEND_ENV" && rm -f "$BACKEND_ENV.bak"
  sed -i.bak "s|^VAPID_PRIVATE_KEY=.*|VAPID_PRIVATE_KEY=${VAPID_PRIVATE}|" "$BACKEND_ENV" && rm -f "$BACKEND_ENV.bak"
  if grep -q '^VITE_VAPID_PUBLIC_KEY=' "$FRONTEND_ENV" 2>/dev/null; then
    sed -i.bak "s|^VITE_VAPID_PUBLIC_KEY=.*|VITE_VAPID_PUBLIC_KEY=${VAPID_PUBLIC}|" "$FRONTEND_ENV" && rm -f "$FRONTEND_ENV.bak"
  else
    printf '\n# Web-Push (Story 1.1, ADR-011) — muss zum Backend-VAPID_PUBLIC_KEY passen\nVITE_VAPID_PUBLIC_KEY=%s\n' "$VAPID_PUBLIC" >> "$FRONTEND_ENV"
  fi
  echo "VAPID-Keypair gesetzt (Public-Key auch im Frontend)"
fi

# --- Shared Package Build ---
echo ""
echo "Shared Package bauen..."
pnpm --filter @bluelight-hub/shared build

# --- Prisma ---
# node_modules/.bin in PATH aufnehmen, damit Prisma tsx findet (Seed-Command)
export PATH="$REPO_ROOT/packages/backend/node_modules/.bin:$REPO_ROOT/node_modules/.bin:$PATH"

echo ""
echo "Prisma generate..."
cd "$REPO_ROOT/packages/backend"
pnpx prisma generate

echo "Prisma migrate deploy..."
pnpx prisma migrate deploy

echo "Prisma seed..."
pnpx tsx prisma/seed.ts

# --- Fertig ---
echo ""
echo "=== Setup abgeschlossen ==="
echo ""
echo "Starte die Entwicklung mit:"
echo "  pnpm dev:web             # Backend + Frontend (ohne Tauri, empfohlen für Worktrees)"
echo "  pnpm -r dev              # Alle Services inkl. Tauri (nur Hauptrepo)"
echo ""
echo "Teardown mit:"
echo "  bash scripts/worktree-teardown.sh           # Container stoppen"
echo "  bash scripts/worktree-teardown.sh --volumes  # + Volumes löschen"
