# Endpoints

## Root / Meta

### GET /
**Description:** Root-Endpunkt mit API-Metadaten
**Auth Required:** No
**Version:** VERSION_NEUTRAL

**Response:**
- Success (200):
```json
{
  "message": "Bluelight Hub API",
  "version": "1.0.0-alpha.32",
  "endpoints": {
    "api": "http://localhost:3000/api"
  }
}
```

---

## Authentication

### POST /api/auth/unified
**Description:** Unified Login & Auto-Register - kombiniert Login und automatische Registrierung
**Auth Required:** No
**Rate Limit:** 5 Requests / Minute
**Version:** VERSION_NEUTRAL

**Request:**
- Body:
```json
{
  "username": "string (required)",
  "password": "string (optional, nur für Admins)"
}
```

**Response:**
- Success (200): Tokens werden als HTTP-Only Cookies gesetzt (`accessToken`, `refreshToken`)
```json
{
  "user": {
    "id": "string (cuid)",
    "username": "string",
    "fullName": "string | null",
    "role": "USER | ADMIN | SUPER_ADMIN"
  },
  "isNewUser": "boolean"
}
```
- Error (401): Ungültige Credentials
- Error (429): Zu viele Anfragen

**Example Request:**
```http
POST /api/auth/unified
Content-Type: application/json

{
  "username": "max.mustermann"
}
```

---

### GET /api/auth/check
**Description:** Authentifizierungsstatus prüfen (immer 200, auch ohne Auth)
**Auth Required:** No (prüft optional vorhandene Tokens)
**Rate Limit:** 10 Requests / Minute
**Version:** VERSION_NEUTRAL

**Response:**
- Success (200):
```json
{
  "user": {
    "id": "string | null",
    "username": "string | null",
    "fullName": "string | null",
    "role": "USER | ADMIN | SUPER_ADMIN | null"
  },
  "authenticated": "boolean",
  "isAdminAuthenticated": "boolean (optional)"
}
```

**Note:** Bei abgelaufenem Access Token wird automatisch Token-Refresh versucht (via Refresh Token aus Cookie).

---

### POST /api/auth/refresh
**Description:** Access-Token erneuern mit Refresh-Token
**Auth Required:** Yes (JwtRefreshGuard - `refreshToken` Cookie)
**Version:** VERSION_NEUTRAL

**Request:**
- Cookie: `refreshToken` (automatisch via JwtRefreshGuard)

**Response:**
- Success (200): Neue Tokens werden als HTTP-Only Cookies gesetzt
```json
{
  "message": "Token refreshed successfully"
}
```
- Error (401): Ungültiges oder abgelaufenes Refresh-Token

---

### POST /api/auth/logout
**Description:** Benutzer abmelden (löscht alle Auth-Cookies)
**Auth Required:** No
**Version:** VERSION_NEUTRAL

**Response:**
- Success (200):
```json
{
  "message": "Logged out successfully"
}
```

---

### GET /api/auth/users
**Description:** Öffentliche Benutzerliste für Login-Screen
**Auth Required:** No
**Version:** VERSION_NEUTRAL

**Response:**
- Success (200):
```json
{
  "users": [
    {
      "username": "string",
      "fullName": "string | null"
    }
  ]
}
```

---

### POST /api/auth/admin/login
**Description:** Admin-Rechte aktivieren (für bereits angemeldeten User)
**Auth Required:** Yes (JwtAuthGuard)
**Version:** VERSION_NEUTRAL

**Request:**
- Cookie: `accessToken` (automatisch via JwtAuthGuard)
- Body:
```json
{
  "password": "string (required)"
}
```

**Response:**
- Success (200): `adminToken` wird als HTTP-Only Cookie gesetzt
```json
{
  "user": {
    "id": "string",
    "username": "string",
    "role": "ADMIN | SUPER_ADMIN"
  }
}
```
- Error (401): Ungültiges Passwort
- Error (403): Benutzer hat keine Admin-Rechte

---

### GET /api/auth/admin/status
**Description:** Admin-Setup-Status prüfen
**Auth Required:** Yes (JwtAuthGuard)
**Version:** VERSION_NEUTRAL

**Response:**
- Success (200):
```json
{
  "adminExists": "boolean",
  "setupAvailable": "boolean"
}
```
- Error (401): Keine gültige Authentifizierung

---

### POST /api/auth/admin/setup
**Description:** Admin-Passwort einrichten (erfordert Admin-Rolle ohne Passwort)
**Auth Required:** Yes (JwtAuthGuard)
**Version:** VERSION_NEUTRAL

**Request:**
- Body:
```json
{
  "password": "string (required, min. 8 Zeichen)"
}
```

**Response:**
- Success (201): `adminToken` wird als HTTP-Only Cookie gesetzt
```json
{
  "user": {
    "id": "string",
    "username": "string",
    "role": "ADMIN | SUPER_ADMIN"
  }
}
```
- Error (409): Admin-Setup bereits durchgeführt
- Error (401): Keine Authentifizierung

---

### GET /api/auth/admin/verify
**Description:** Admin-Token verifizieren
**Auth Required:** Yes (AdminJwtAuthGuard - `adminToken` Cookie)
**Version:** VERSION_NEUTRAL

**Response:**
- Success (200):
```json
{
  "valid": true
}
```
- Error (401): Admin-Token fehlt oder ungültig

---

### POST /api/auth/admin/logout
**Description:** Admin abmelden (entfernt nur `adminToken`, behält normale Session)
**Auth Required:** No
**Version:** VERSION_NEUTRAL

**Response:**
- Success (200):
```json
{
  "message": "Admin logged out successfully"
}
```

---

## User Management (Users)

### GET /api/alpha/users
**Description:** Basis-Benutzerinformationen aller Benutzer
**Auth Required:** Yes (JwtAuthGuard)
**Version:** alpha

**Response:**
- Success (200):
```json
{
  "data": [
    {
      "id": "string (cuid)",
      "username": "string"
    }
  ]
}
```

---

### GET /api/alpha/users/:id
**Description:** Detaillierte Benutzerinformationen abrufen
**Auth Required:** Yes (JwtAuthGuard)
**Version:** alpha

**Response:**
- Success (200):
```json
{
  "data": {
    "id": "string",
    "username": "string",
    "fullName": "string | null",
    "role": "USER | ADMIN | SUPER_ADMIN",
    "createdAt": "string (ISO 8601)",
    "updatedAt": "string (ISO 8601)"
  }
}
```
- Error (404): Benutzer nicht gefunden

---

## User Management (Admin)

### GET /api/alpha/admin/users
**Description:** Alle Benutzer auflisten (Admin-Only)
**Auth Required:** Yes (AdminJwtAuthGuard)
**Version:** alpha

**Response:**
- Success (200):
```json
{
  "data": [
    {
      "id": "string",
      "username": "string",
      "fullName": "string | null",
      "role": "USER | ADMIN | SUPER_ADMIN",
      "locked": "boolean",
      "lockReason": "string | null",
      "createdAt": "string (ISO 8601)",
      "updatedAt": "string (ISO 8601)"
    }
  ]
}
```
- Error (401): Keine gültige Admin-Authentifizierung

---

### POST /api/alpha/admin/users
**Description:** Neuen Benutzer erstellen
**Auth Required:** Yes (AdminJwtAuthGuard)
**Version:** alpha

**Request:**
- Body:
```json
{
  "username": "string (required, unique)",
  "fullName": "string (optional)",
  "password": "string (optional, nur für Admins)",
  "role": "USER | ADMIN | SUPER_ADMIN (optional, default: USER)"
}
```

**Response:**
- Success (201):
```json
{
  "data": {
    "id": "string",
    "username": "string",
    "fullName": "string | null",
    "role": "USER | ADMIN | SUPER_ADMIN",
    "createdAt": "string (ISO 8601)"
  }
}
```
- Error (400): Ungültige Eingabedaten
- Error (409): Benutzername bereits vergeben

---

### PATCH /api/alpha/admin/users/:id
**Description:** Benutzer aktualisieren
**Auth Required:** Yes (AdminJwtAuthGuard)
**Version:** alpha

**Request:**
- Body (alle Felder optional):
```json
{
  "username": "string (optional)",
  "fullName": "string (optional)",
  "password": "string (optional)",
  "role": "USER | ADMIN | SUPER_ADMIN (optional)"
}
```

**Response:**
- Success (200):
```json
{
  "data": {
    "id": "string",
    "username": "string",
    "fullName": "string | null",
    "role": "USER | ADMIN | SUPER_ADMIN",
    "updatedAt": "string (ISO 8601)"
  }
}
```
- Error (404): Benutzer nicht gefunden
- Error (409): Benutzername bereits vergeben

---

### DELETE /api/alpha/admin/users/:id
**Description:** Benutzer löschen oder herabstufen
**Auth Required:** Yes (AdminJwtAuthGuard)
**Version:** alpha

**Request:**
- Body (optional):
```json
{
  "downgradeAdmin": "boolean (optional, default: false)"
}
```

**Response:**
- Success (200):
```json
{
  "data": {
    "id": "string",
    "message": "User deleted successfully"
  }
}
```
- Error (404): Benutzer nicht gefunden
- Error (400): Letzter SUPER_ADMIN kann nicht gelöscht werden

**Note:** Wenn `downgradeAdmin: true`, wird Admin zu USER herabgestuft statt gelöscht.

---

### PUT /api/alpha/admin/users/:id/lock
**Description:** Benutzer manuell sperren
**Auth Required:** Yes (AdminJwtAuthGuard)
**Version:** alpha

**Request:**
- Body (optional):
```json
{
  "reason": "string (optional)"
}
```

**Response:**
- Success (200):
```json
{
  "data": {
    "id": "string",
    "locked": true,
    "lockReason": "string | null"
  }
}
```
- Error (400): Benutzer bereits gesperrt oder letzter SUPER_ADMIN

---

### PUT /api/alpha/admin/users/:id/unlock
**Description:** Benutzer entsperren
**Auth Required:** Yes (AdminJwtAuthGuard)
**Version:** alpha

**Response:**
- Success (200):
```json
{
  "data": {
    "id": "string",
    "locked": false
  }
}
```
- Error (400): Benutzer ist nicht gesperrt

---

## Einsatz (Mission)

### POST /api/alpha/einsatz
**Description:** Neuen Einsatz erstellen mit automatisch generiertem Namen
**Auth Required:** Yes (JwtAuthGuard)
**Version:** alpha

**Request:**
- Body (alle Felder optional):
```json
{
  "einsatzort": "string (optional)",
  "keyword": "string (optional)",
  "bemerkung": "string (optional)",
  "status": "OFFEN | IN_BEARBEITUNG | ABGESCHLOSSEN | ARCHIVIERT (optional, default: OFFEN)"
}
```

**Response:**
- Success (200):
```json
{
  "data": {
    "id": "string (cuid)",
    "name": "string (auto-generated, z.B. 'Einsatz #1')",
    "einsatzort": "string | null",
    "keyword": "string | null",
    "bemerkung": "string | null",
    "status": "OFFEN | IN_BEARBEITUNG | ABGESCHLOSSEN | ARCHIVIERT",
    "createdAt": "string (ISO 8601)",
    "updatedAt": "string (ISO 8601)",
    "createdBy": "string (user ID)",
    "lastUpdatedBy": "string (user ID)"
  }
}
```
- Error (400): Validierungsfehler

**Idempotency:** Cache-basierte Duplikatserkennung (1 Minute TTL)

---

### GET /api/alpha/einsatz
**Description:** Paginierte Liste aller Einsätze (ohne archivierte, außer explizit angefordert)
**Auth Required:** Yes (JwtAuthGuard)
**Version:** alpha

**Query Parameters:**
- `status`: `OFFEN | IN_BEARBEITUNG | ABGESCHLOSSEN | ARCHIVIERT` (optional, Komma-separiert)
- `includeArchived`: `boolean` (optional, default: false)
- `page`: `number` (optional, default: 1)
- `limit`: `number` (optional, default: 10)
- `orderBy`: `createdAt | updatedAt | name | status` (optional, default: createdAt)
- `orderDirection`: `asc | desc` (optional, default: desc)

**Response:**
- Success (200):
```json
{
  "data": [
    {
      "id": "string",
      "name": "string",
      "einsatzort": "string | null",
      "keyword": "string | null",
      "bemerkung": "string | null",
      "status": "OFFEN | IN_BEARBEITUNG | ABGESCHLOSSEN | ARCHIVIERT",
      "createdAt": "string (ISO 8601)",
      "updatedAt": "string (ISO 8601)"
    }
  ],
  "pagination": {
    "total": "number",
    "page": "number",
    "limit": "number",
    "totalPages": "number"
  }
}
```

**Note:** Archivierte Einsätze werden gemäß **No-Delete Policy** standardmäßig ausgeschlossen.

---

### GET /api/alpha/einsatz/:id
**Description:** Einzelnen Einsatz abrufen
**Auth Required:** Yes (JwtAuthGuard)
**Version:** alpha

**Response:**
- Success (200):
```json
{
  "data": {
    "id": "string",
    "name": "string",
    "einsatzort": "string | null",
    "keyword": "string | null",
    "bemerkung": "string | null",
    "status": "OFFEN | IN_BEARBEITUNG | ABGESCHLOSSEN | ARCHIVIERT",
    "createdAt": "string (ISO 8601)",
    "updatedAt": "string (ISO 8601)",
    "createdBy": "string",
    "lastUpdatedBy": "string"
  }
}
```
- Error (404): Einsatz nicht gefunden

---

### PATCH /api/alpha/einsatz/:id
**Description:** Einsatz aktualisieren
**Auth Required:** Yes (JwtAuthGuard)
**Version:** alpha

**Request:**
- Body (alle Felder optional):
```json
{
  "einsatzort": "string (optional)",
  "keyword": "string (optional)",
  "bemerkung": "string (optional)",
  "status": "OFFEN | IN_BEARBEITUNG | ABGESCHLOSSEN | ARCHIVIERT (optional)"
}
```

**Response:**
- Success (200):
```json
{
  "data": {
    "id": "string",
    "name": "string (auto-updated)",
    "einsatzort": "string | null",
    "keyword": "string | null",
    "bemerkung": "string | null",
    "status": "OFFEN | IN_BEARBEITUNG | ABGESCHLOSSEN | ARCHIVIERT",
    "updatedAt": "string (ISO 8601)",
    "lastUpdatedBy": "string"
  }
}
```
- Error (404): Einsatz nicht gefunden

**Idempotency:** Cache-basierte Duplikatserkennung (1 Minute TTL)

---

### PATCH /api/alpha/einsatz/:id/archive
**Description:** Einsatz archivieren (Soft-Delete gemäß No-Delete Policy)
**Auth Required:** Yes (JwtAuthGuard)
**Version:** alpha

**Response:**
- Success (200):
```json
{
  "data": {
    "id": "string",
    "status": "ARCHIVIERT",
    "updatedAt": "string (ISO 8601)"
  }
}
```
- Error (404): Einsatz nicht gefunden

**Security:** Einsätze werden NIEMALS physisch gelöscht (No-Delete Policy)!

---

### GET /api/alpha/einsatz/:id/completeness
**Description:** Vollständigkeits-Check für Einsatz
**Auth Required:** Yes (JwtAuthGuard)
**Version:** alpha

**Query Parameters:**
- `refresh`: `boolean` (optional, default: false) - Cache-Refresh erzwingen

**Response:**
- Success (200):
```json
{
  "data": {
    "score": "number (0-100)",
    "missingFields": ["string"],
    "completedFields": ["string"],
    "totalFields": "number",
    "completedCount": "number"
  }
}
```
- Error (404): Einsatz nicht gefunden

---

### GET /api/alpha/einsatz/:id/navigation/previous
**Description:** ID des vorherigen Einsatzes (basierend auf createdAt)
**Auth Required:** Yes (JwtAuthGuard)
**Version:** alpha

**Response:**
- Success (200):
```json
{
  "data": {
    "id": "string | null"
  }
}
```
- Error (404): Einsatz nicht gefunden

---

### GET /api/alpha/einsatz/:id/navigation/next
**Description:** ID des nächsten Einsatzes (basierend auf createdAt)
**Auth Required:** Yes (JwtAuthGuard)
**Version:** alpha

**Response:**
- Success (200):
```json
{
  "data": {
    "id": "string | null"
  }
}
```
- Error (404): Einsatz nicht gefunden

---

### GET /api/alpha/einsatz/stats/status-counts
**Description:** Status-Statistiken (Anzahl Einsätze pro Status)
**Auth Required:** Yes (JwtAuthGuard)
**Version:** alpha

**Query Parameters:**
- `includeArchived`: `boolean` (optional, default: false)

**Response:**
- Success (200):
```json
{
  "data": {
    "OFFEN": "number",
    "IN_BEARBEITUNG": "number",
    "ABGESCHLOSSEN": "number",
    "ARCHIVIERT": "number (nur wenn includeArchived=true)"
  }
}
```

---

## Einsatztagebuch (ETB)

### POST /api/etb
**Description:** Neues ETB für einen Einsatz erstellen
**Auth Required:** Yes (JwtAuthGuard)
**Rate Limit:** 100 Requests / Minute
**Version:** (nicht versioniert)

**Request:**
- Body:
```json
{
  "einsatzId": "string (required, cuid)"
}
```

**Response:**
- Success (201):
```json
{
  "id": "string (cuid)",
  "einsatzId": "string",
  "createdAt": "string (ISO 8601)",
  "createdBy": "string (user ID)"
}
```
- Error (400): Ungültige Eingaben
- Error (409): Für diesen Einsatz existiert bereits ein ETB

---

### GET /api/etb/:einsatzId
**Description:** ETB anhand der Einsatz-ID abrufen (mit paginierten Einträgen)
**Auth Required:** Yes (JwtAuthGuard)
**Rate Limit:** 100 Requests / Minute
**Version:** (nicht versioniert)

**Query Parameters:**
- `page`: `number` (optional, default: 1)
- `limit`: `number` (optional, default: 50)
- `orderBy`: `createdAt | updatedAt` (optional, default: createdAt)
- `orderDirection`: `asc | desc` (optional, default: desc)

**Response:**
- Success (200):
```json
{
  "id": "string",
  "einsatzId": "string",
  "eintraege": {
    "data": [
      {
        "id": "string",
        "zeitpunkt": "string (ISO 8601)",
        "kategorie": "ALARMIERUNG | ANFAHRT | LAGEERKUNDUNG | MASSNAHMEN | SONSTIGES",
        "inhalt": "string",
        "verfasser": {
          "id": "string",
          "username": "string"
        },
        "version": "number",
        "createdAt": "string (ISO 8601)",
        "updatedAt": "string (ISO 8601)"
      }
    ],
    "pagination": {
      "total": "number",
      "page": "number",
      "limit": "number",
      "totalPages": "number"
    }
  }
}
```
- Error (404): ETB nicht gefunden

---

### POST /api/etb/:id/eintraege
**Description:** Neuen ETB-Eintrag erstellen
**Auth Required:** Yes (JwtAuthGuard)
**Rate Limit:** 20 Requests / Minute
**Version:** (nicht versioniert)

**Request:**
- Body:
```json
{
  "zeitpunkt": "string (ISO 8601, optional, default: now)",
  "kategorie": "ALARMIERUNG | ANFAHRT | LAGEERKUNDUNG | MASSNAHMEN | SONSTIGES (required)",
  "inhalt": "string (required)",
  "textbausteinId": "string (optional, cuid - alternative zu inhalt)"
}
```

**Response:**
- Success (201):
```json
{
  "id": "string",
  "zeitpunkt": "string (ISO 8601)",
  "kategorie": "ALARMIERUNG | ANFAHRT | LAGEERKUNDUNG | MASSNAHMEN | SONSTIGES",
  "inhalt": "string",
  "verfasser": {
    "id": "string",
    "username": "string"
  },
  "version": 1,
  "createdAt": "string (ISO 8601)"
}
```
- Error (404): ETB nicht gefunden
- Error (400): Validierungsfehler

---

### PUT /api/etb/eintraege/:id
**Description:** ETB-Eintrag aktualisieren (erstellt neue Version)
**Auth Required:** Yes (JwtAuthGuard)
**Rate Limit:** 20 Requests / Minute
**Version:** (nicht versioniert)

**Request:**
- Body (alle Felder optional):
```json
{
  "zeitpunkt": "string (ISO 8601, optional)",
  "kategorie": "ALARMIERUNG | ANFAHRT | LAGEERKUNDUNG | MASSNAHMEN | SONSTIGES (optional)",
  "inhalt": "string (optional)"
}
```

**Response:**
- Success (200):
```json
{
  "id": "string",
  "zeitpunkt": "string (ISO 8601)",
  "kategorie": "ALARMIERUNG | ANFAHRT | LAGEERKUNDUNG | MASSNAHMEN | SONSTIGES",
  "inhalt": "string",
  "version": "number (incremented)",
  "updatedAt": "string (ISO 8601)",
  "updatedBy": {
    "id": "string",
    "username": "string"
  }
}
```
- Error (404): Eintrag nicht gefunden

**Note:** Updates erstellen neue Versionshistorie-Einträge (Audit-Trail).

---

### GET /api/etb/eintraege/:id/history
**Description:** Versionshistorie eines ETB-Eintrags abrufen
**Auth Required:** Yes (JwtAuthGuard)
**Rate Limit:** 100 Requests / Minute
**Version:** (nicht versioniert)

**Query Parameters:**
- `page`: `number` (optional, default: 1)
- `limit`: `number` (optional, default: 20)

**Response:**
- Success (200):
```json
{
  "data": [
    {
      "version": "number",
      "zeitpunkt": "string (ISO 8601)",
      "kategorie": "ALARMIERUNG | ANFAHRT | LAGEERKUNDUNG | MASSNAHMEN | SONSTIGES",
      "inhalt": "string",
      "changedBy": {
        "id": "string",
        "username": "string"
      },
      "changedAt": "string (ISO 8601)"
    }
  ],
  "pagination": {
    "total": "number",
    "page": "number",
    "limit": "number"
  }
}
```
- Error (404): Eintrag nicht gefunden

---

### DELETE /api/etb/eintraege/:id
**Description:** ETB-Eintrag soft löschen
**Auth Required:** Yes (JwtAuthGuard)
**Rate Limit:** 20 Requests / Minute
**Version:** (nicht versioniert)

**Response:**
- Success (204): No Content
- Error (404): Eintrag nicht gefunden

**Note:** Soft-Delete - Eintrag wird als gelöscht markiert, aber nicht physisch entfernt.

---

### GET /api/etb/textbausteine
**Description:** Alle verfügbaren Textbausteine abrufen
**Auth Required:** Yes (JwtAuthGuard)
**Rate Limit:** 100 Requests / Minute
**Version:** (nicht versioniert)

**Response:**
- Success (200):
```json
{
  "textbausteine": [
    {
      "id": "string (cuid)",
      "kategorie": "ALARMIERUNG | ANFAHRT | LAGEERKUNDUNG | MASSNAHMEN | SONSTIGES",
      "text": "string",
      "aktiv": "boolean"
    }
  ]
}
```

---

## Lagekarte

### GET /api/alpha/einsatz/:einsatzId/lagekarte
**Description:** Lagekarte abrufen oder lazy erstellen (mit initialem POI aus einsatz.einsatzort)
**Auth Required:** Yes (JwtAuthGuard)
**Version:** alpha

**Response:**
- Success (200):
```json
{
  "data": {
    "id": "string (cuid)",
    "einsatzId": "string",
    "state": "object (GeoJSON FeatureCollection) | null",
    "createdAt": "string (ISO 8601)",
    "updatedAt": "string (ISO 8601)"
  }
}
```
- Error (404): Einsatz nicht gefunden

**Note:** Lazy Creation - Lagekarte wird automatisch erstellt, wenn sie noch nicht existiert.

---

### POST /api/alpha/einsatz/:einsatzId/lagekarte
**Description:** Lagekarte-State speichern (GeoJSON Zeichnungen)
**Auth Required:** Yes (JwtAuthGuard)
**Version:** alpha

**Request:**
- Body:
```json
{
  "state": {
    "type": "FeatureCollection",
    "features": []
  }
}
```

**Response:**
- Success (200):
```json
{
  "data": {
    "id": "string",
    "einsatzId": "string",
    "state": "object (GeoJSON FeatureCollection)",
    "updatedAt": "string (ISO 8601)"
  }
}
```
- Error (404): Lagekarte nicht gefunden

---

### DELETE /api/alpha/einsatz/:einsatzId/lagekarte
**Description:** Lagekarte löschen (CASCADE: POIs werden automatisch mitgelöscht)
**Auth Required:** Yes (JwtAuthGuard)
**Version:** alpha

**Response:**
- Success (200):
```json
{
  "data": {
    "message": "Lagekarte deleted successfully"
  }
}
```
- Error (404): Lagekarte nicht gefunden

---

### POST /api/alpha/einsatz/:einsatzId/lagekarte/screenshot
**Description:** Screenshot der Lagekarte hochladen (für ETB-Integration)
**Auth Required:** Yes (JwtAuthGuard)
**Version:** alpha

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `file`: Binary (PNG oder JPEG, max 10MB)

**Response:**
- Success (200):
```json
{
  "data": {
    "url": "/uploads/lagekarte/{einsatzId}_{timestamp}.png"
  }
}
```
- Error (400): Ungültiges File-Format oder zu groß
- Error (404): Einsatz nicht gefunden

**Security:** MIME-Type Validierung, Filename Sanitization, 10MB Limit

---

### DELETE /api/alpha/einsatz/:einsatzId/lagekarte/screenshot/:filename
**Description:** Screenshot löschen (für ETB-Fehler-Cleanup)
**Auth Required:** Yes (JwtAuthGuard)
**Version:** alpha

**Response:**
- Success (200):
```json
{
  "data": {
    "message": "Screenshot deleted successfully"
  }
}
```
- Error (404): Screenshot nicht gefunden
- Error (403): Screenshot gehört zu anderem Einsatz
- Error (400): Ungültiger Filename

**Security:** Filename-Validierung verhindert Path Traversal

---

## POI (Points of Interest)

### GET /api/alpha/einsatz/:einsatzId/lagekarte/pois
**Description:** Alle POIs einer Lagekarte abrufen
**Auth Required:** Yes (JwtAuthGuard)
**Version:** alpha

**Response:**
- Success (200):
```json
{
  "data": [
    {
      "id": "string (cuid)",
      "lagekarteId": "string",
      "type": "EINSATZORT | EINSATZABSCHNITT | EINSATZLEITUNG | FAHRZEUG | EINHEIT | GEFAHRENQUELLE | SPERRBEREICH | VERSORGUNGSPUNKT | BEREITSTELLUNGSRAUM | BEHANDLUNGSPLATZ | SAMMELSTELLE | UNTERKUNFT | SONSTIGES",
      "name": "string",
      "beschreibung": "string | null",
      "adresse": "string | null",
      "latitude": "number",
      "longitude": "number",
      "createdAt": "string (ISO 8601)"
    }
  ]
}
```
- Error (404): Einsatz nicht gefunden

**Note:** Lazy Creation - Lagekarte wird automatisch erstellt, wenn sie noch nicht existiert.

---

### POST /api/alpha/einsatz/:einsatzId/lagekarte/pois
**Description:** POI erstellen (mit optionalem Geocoding via Nominatim)
**Auth Required:** Yes (JwtAuthGuard)
**Version:** alpha

**Request:**
- Body:
```json
{
  "lagekarteId": "string (required, cuid)",
  "type": "EINSATZORT | EINSATZABSCHNITT | ... (required)",
  "name": "string (required)",
  "beschreibung": "string (optional)",
  "adresse": "string (optional, wird geocoded)",
  "latitude": "number (optional, required wenn adresse fehlt)",
  "longitude": "number (optional, required wenn adresse fehlt)"
}
```

**Response:**
- Success (200):
```json
{
  "data": {
    "id": "string",
    "lagekarteId": "string",
    "type": "EINSATZORT | ...",
    "name": "string",
    "beschreibung": "string | null",
    "adresse": "string | null",
    "latitude": "number",
    "longitude": "number",
    "createdAt": "string (ISO 8601)"
  }
}
```
- Error (404): Lagekarte nicht gefunden
- Error (400): Validierungsfehler

**Note:** Wenn `adresse` angegeben, wird automatisches Geocoding via Nominatim durchgeführt.

---

### GET /api/alpha/einsatz/:einsatzId/lagekarte/pois/:poiId
**Description:** Einzelnen POI abrufen
**Auth Required:** Yes (JwtAuthGuard)
**Version:** alpha

**Response:**
- Success (200):
```json
{
  "data": {
    "id": "string",
    "lagekarteId": "string",
    "type": "EINSATZORT | ...",
    "name": "string",
    "beschreibung": "string | null",
    "adresse": "string | null",
    "latitude": "number",
    "longitude": "number",
    "createdAt": "string (ISO 8601)"
  }
}
```
- Error (404): POI nicht gefunden

---

### PUT /api/alpha/einsatz/:einsatzId/lagekarte/pois/:poiId
**Description:** POI aktualisieren (mit optionalem Re-Geocoding)
**Auth Required:** Yes (JwtAuthGuard)
**Version:** alpha

**Request:**
- Body (alle Felder optional):
```json
{
  "type": "EINSATZORT | ... (optional)",
  "name": "string (optional)",
  "beschreibung": "string (optional)",
  "adresse": "string (optional, triggert Re-Geocoding)",
  "latitude": "number (optional)",
  "longitude": "number (optional)"
}
```

**Response:**
- Success (200):
```json
{
  "data": {
    "id": "string",
    "type": "EINSATZORT | ...",
    "name": "string",
    "adresse": "string | null",
    "latitude": "number",
    "longitude": "number",
    "updatedAt": "string (ISO 8601)"
  }
}
```
- Error (404): POI nicht gefunden

**Note:** Wenn neue `adresse` angegeben, wird Re-Geocoding durchgeführt.

---

### DELETE /api/alpha/einsatz/:einsatzId/lagekarte/pois/:poiId
**Description:** POI permanent löschen
**Auth Required:** Yes (JwtAuthGuard)
**Version:** alpha

**Response:**
- Success (200):
```json
{
  "data": {
    "message": "POI deleted successfully"
  }
}
```
- Error (404): POI nicht gefunden

---

## Geocoding

### POST /api/alpha/einsatz/:einsatzId/geocode
**Description:** Adresse zu Koordinaten geocoden (via Nominatim API)
**Auth Required:** Yes (JwtAuthGuard)
**Rate Limit:** 10 Requests / Minute (Controller) + 1 Request / Sekunde (Service)
**Version:** alpha

**Request:**
- Body:
```json
{
  "address": "string (required)"
}
```

**Response:**
- Success (200):
```json
{
  "data": {
    "lat": "number",
    "lon": "number"
  }
}
```
- Success (200) bei Fehler:
```json
{
  "data": null
}
```
- Error (429): Rate-Limit überschritten

**Note:** Gibt `null` zurück bei Geocoding-Fehler (z.B. ungültige Adresse). Frontend muss dann manuelle Koordinaten-Eingabe anbieten.

---

## Health Checks

### GET /api/health
**Description:** Umfassender Gesundheitscheck (Datenbank, Speicher, Disk, CPU, Internet, FüKW)
**Auth Required:** No
**Version:** VERSION_NEUTRAL

**Response:**
- Success (200):
```json
{
  "status": "ok",
  "info": {
    "database": {
      "status": "up"
    },
    "memory_heap": {
      "status": "up"
    },
    "memory_rss": {
      "status": "up"
    },
    "storage": {
      "status": "up"
    },
    "cpu": {
      "status": "up",
      "loadAverage": [0.5, 0.6, 0.7],
      "usedCores": 8
    },
    "internet": {
      "status": "up | down",
      "message": "Internet-Verbindung aktiv"
    },
    "fuekw": {
      "status": "up | down",
      "message": "FüKW-Verbindung aktiv"
    },
    "connection_status": {
      "status": "up",
      "details": {
        "mode": "online | offline | error | checking"
      }
    }
  }
}
```

**Connection Modes:**
- `online`: Vollständige Verbindung (Internet + FüKW)
- `offline`: Lokale Verbindung (nur FüKW, kein Internet)
- `error`: Keine Verbindung
- `checking`: Verbindungsprüfung läuft

---

### GET /api/health/liveness
**Description:** Liveness-Check (prüft nur Datenbankverbindung)
**Auth Required:** No
**Version:** VERSION_NEUTRAL

**Response:**
- Success (200):
```json
{
  "status": "ok",
  "info": {
    "database": {
      "status": "up"
    }
  }
}
```

---

### GET /api/health/readiness
**Description:** Readiness-Check (prüft Speicher und Disk)
**Auth Required:** No
**Version:** VERSION_NEUTRAL

**Response:**
- Success (200):
```json
{
  "status": "ok",
  "info": {
    "memory_heap": {
      "status": "up"
    },
    "storage": {
      "status": "up"
    }
  }
}
```

---

### GET /api/health/db
**Description:** Detaillierter Datenbank-Gesundheitscheck
**Auth Required:** No
**Version:** VERSION_NEUTRAL

**Response:**
- Success (200):
```json
{
  "status": "ok",
  "info": {
    "database": {
      "status": "up"
    },
    "database_connections": {
      "status": "up"
    }
  }
}
```

---
