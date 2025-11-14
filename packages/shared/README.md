# Bluelight Hub – Shared (OpenAPI TypeScript Client)

## Überblick

- Enthält den generierten TypeScript-Fetch-Client aus der Backend-Swagger-Definition
- Dient als einzige Quelle für API-Aufrufe im Frontend (keine handgeschriebenen Helpers)

## Wichtig

- Dateien unter `client/` werden automatisch generiert. Nicht manuell bearbeiten.
- Änderungen am Backend-Schema/Swagger erfordern eine Regeneration.

## API-Client generieren

1) Backend lokal starten (Swagger unter `http://localhost:3090/api-json` erreichbar)
2) Ausführen: `pnpm --filter @bluelight-hub/shared generate-api`
3) Linter formatiert den Output automatisch

## Build/CI

- Build: `pnpm --filter @bluelight-hub/shared build`
- CI nutzt `build:ci` und überspringt die Regeneration (Client sollte vorab generiert sein)

## Verwendung im Frontend

- Import über das Paket: `@bluelight-hub/shared`
- Beispiel:
  ```ts
  import { api } from '@/api';
  const res = await api.einsatz().einsatzControllerFindAllVAlpha({ page: 1, limit: 20 });
  ```

## Troubleshooting

- Falsche Typen/Signaturen: prüfen, ob Backend läuft und Client aktuell ist (Regeneration durchführen)
