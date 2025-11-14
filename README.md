# BlueLight Hub

<!-- Coverage temporarily disabled -->
<!-- [![codecov](https://codecov.io/gh/rubenvitt/bluelight-hub/graph/badge.svg?token=I5Z3C0FSLL)](https://codecov.io/gh/rubenvitt/bluelight-hub) -->

[![GitHub Actions](https://github.com/rubenvitt/bluelight-hub/actions/workflows/test.yml/badge.svg)](https://github.com/rubenvitt/bluelight-hub/actions/workflows/test.yml)
[![doccov](https://backend-docs.bluelight-hub.rubeen.dev/images/coverage-badge-documentation.svg)](https://backend-docs.bluelight-hub.rubeen.dev)

## Übersicht

BlueLight Hub ist eine moderne Anwendung, die mit einer Monorepo-Struktur entwickelt wurde. Die Anwendung besteht aus
einem Frontend (Vite/React mit Tauri-Integration) und einem Backend (
NestJS), die über ein gemeinsames Modul kommunizieren.

<!-- Coverage temporarily disabled -->
<!-- ## Charts

### Coverage

![Coverage](https://codecov.io/gh/rubenvitt/bluelight-hub/graphs/sunburst.svg?token=I5Z3C0FSLL) -->

## Projektstruktur

```
bluelight-hub/
├── packages/
│   ├── frontend/     # Vite/React mit Tauri Integration
│   ├── backend/      # NestJS-Backend
│   └── shared/       # Gemeinsame Typen und Schnittstellen
├── docs/             # Projektdokumentation
└── ...
```

### Paketspezifische READMEs

- Frontend (React/Vite/Tauri): [packages/frontend/README.md](packages/frontend/README.md)
- Backend (NestJS/Prisma): [packages/backend/README.md](packages/backend/README.md)
- Shared (OpenAPI TypeScript Client): [packages/shared/README.md](packages/shared/README.md)

## Voraussetzungen

- Node.js (LTS Version)
- pnpm (v10.5.2 oder höher)
- Weitere Abhängigkeiten je nach Modul (siehe unten)

## Installation

1. Repository klonen:

   ```bash
   git clone https://github.com/rubenvitt/bluelight-hub.git
   cd bluelight-hub
   ```

2. Abhängigkeiten installieren:

   ```bash
   pnpm install
   ```

3. Umgebungsvariablen konfigurieren:
    - Kopiere `.env.example` zu `.env` (falls vorhanden)
    - Passe die Konfiguration nach Bedarf an

## Entwicklung

Starte den Entwicklungsmodus für alle Pakete:

```bash
pnpm dev
```

Oder starte Pakete individuell:

```bash
# Nur Frontend
pnpm --filter @bluelight-hub/frontend dev

# Nur Backend
pnpm --filter @bluelight-hub/backend dev
```

## API-Client generieren

Das Frontend nutzt ausschließlich den generierten OpenAPI-Client aus `packages/shared/client/`.

1. Backend starten (Swagger verfügbar unter `http://localhost:3090/api-json`)
2. Client generieren:

```bash
pnpm --filter @bluelight-hub/shared generate-api
```

## Authentication

Die Anwendung verwendet JWT-basierte Authentifizierung mit httpOnly-Cookies für erhöhte Sicherheit.

### Unified Auth System

BlueLight Hub nutzt ein vereinheitlichtes Authentifizierungssystem, das Login und Registrierung in einem einzigen
Endpunkt kombiniert:

- **Automatische Registrierung**: Neue Benutzer werden automatisch angelegt, wenn sie sich zum ersten Mal anmelden
- **Passwortlose Benutzer**: Normale Benutzer haben kein Passwort - nur Admin-Accounts verwenden Passwörter
- **Rate Limiting**: 5 Anfragen pro Minute zum Schutz vor Brute-Force-Angriffen

### Auth-Endpoints

- `POST /api/auth/unified` - Unified Authentication (Login/Auto-Registrierung)
    - Request: `{ username: string }`
    - Response: `{ user: UserResponseDto, isNewUser: boolean }`
    - Verhalten:
        - Existierender Benutzer → Login
        - Neuer Benutzername → Automatische Registrierung
- `POST /api/auth/refresh` - Token-Refresh
    - Request: Keine (Refresh-Token wird aus Cookie gelesen)
    - Response: `{ success: true }`
- `POST /api/auth/admin/login` - Admin-Login (mit Passwort)
    - Request: `{ password: string }`
    - Response: `{ user: UserResponseDto }`

### Cookie-Handling

Alle Auth-Endpoints setzen JWT-Tokens als httpOnly-Cookies:

- **accessToken**: Kurzlebiger Access-Token (15 Minuten)
- **refreshToken**: Langlebiger Refresh-Token (7 Tage)

Cookie-Eigenschaften:

- `httpOnly: true` - Schutz vor XSS-Angriffen
- `sameSite: strict` - CSRF-Schutz
- `secure: true` - Nur über HTTPS (in Production)

### Frontend-Integration

```typescript
// Unified Auth - Login oder automatische Registrierung
const response = await api.auth.unifiedAuth({
    username: 'benutzername',
});

// Response enthält:
// - user: Benutzerdaten
// - isNewUser: true bei neuer Registrierung, false bei Login
if (response.isNewUser) {
    console.log('Willkommen! Ihr Account wurde erstellt.');
} else {
    console.log('Willkommen zurück!');
}

// Tokens werden automatisch als httpOnly-Cookies gesetzt
// Authenticated Requests werden automatisch mit Cookies gesendet
const userData = await api.users.getCurrentUser();
```

## Tests

> ⚠️ **WICHTIG: Test-Infrastruktur entfernt**
>
> Stand: 2025-01-28 - Alle Tests wurden temporär entfernt (siehe [PR #257](https://github.com/rubenvitt/bluelight-hub/pull/257))
>
> - `pnpm test` funktioniert nicht mehr
> - `pnpm test:cov` funktioniert nicht mehr
> - `pnpm test:ui` funktioniert nicht mehr
>
> **Migration für Entwickler:**
> - Wenn Sie Tests lokal laufen hatten, müssen diese neu implementiert werden
> - Zukünftige Test-Strategie: TBD
> - Bei Fragen zur Test-Strategie siehe Issue [#XXX](https://github.com/rubenvitt/bluelight-hub/issues/XXX)

## Docker

Das Projekt unterstützt Docker für die Entwicklung und Bereitstellung:

```bash
# Starte mit Docker Compose
docker-compose up
```

## Lizenz

Dieses Projekt steht unter der Lizenz, die in [LICENSE.md](LICENSE.md) zu finden ist.
