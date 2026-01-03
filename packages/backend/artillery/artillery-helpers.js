/**
 * Artillery Helper Functions für JWT Cookie-basierte Authentication
 *
 * Dieser Processor-Handler kümmert sich um die Authentifizierung von Virtual Users,
 * indem er einen Login durchführt und die erhaltenen Cookies für alle weiteren
 * Requests des Users speichert.
 *
 * Bluelight Hub verwendet Passwordless Auth für normale User:
 * - POST /api/auth/unified mit nur { username } reicht für Authentication
 * - Cookies werden automatisch als HTTP-Only gesetzt (accessToken, refreshToken)
 */

const http = require('node:http');

// Counter für eindeutige Virtual User IDs
let vuCounter = 0;

/**
 * Führt einen Passwordless Login via POST /api/auth/unified durch
 *
 * @param {string} username - Der Benutzername für den Login (wird automatisch erstellt wenn nicht vorhanden)
 * @returns {Promise<string>} Cookie-String im Format "accessToken=...; refreshToken=..."
 */
function performLogin(username) {
  return new Promise((resolve, reject) => {
    // Passwordless Auth - nur username erforderlich
    const postData = JSON.stringify({
      username: username,
    });

    const options = {
      hostname: 'localhost',
      port: 3091,
      path: '/api/auth/unified',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        // Extract cookies from Set-Cookie headers
        const cookies = res.headers['set-cookie'];

        if (!cookies || cookies.length === 0) {
          reject(new Error(`Login failed for user ${username}: No cookies received. Status: ${res.statusCode}, Body: ${data}`));
          return;
        }

        // Parse cookies to get only the cookie name=value pairs (without domain, path, etc.)
        const cookieString = cookies
          .map((cookie) => {
            const parts = cookie.split(';');
            return parts[0].trim(); // Get only "name=value" part
          })
          .join('; ');

        resolve(cookieString);
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Login request failed for user ${username}: ${error.message}`));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Artillery Processor-Funktion: Setzt Auth-Header für jeden Request eines Virtual Users
 *
 * Diese Funktion wird von Artillery vor jedem Request aufgerufen (wenn in der YAML konfiguriert).
 * Sie führt beim ersten Aufruf einen Passwordless Login durch und cached die Cookies.
 *
 * @param {Object} requestParams - Die Request-Parameter, die an Artillery übergeben werden
 * @param {Object} context - Der Kontext des Virtual Users (persistiert über Requests hinweg)
 * @param {Object} ee - Event Emitter für Artillery-Events
 * @param {Function} next - Callback-Funktion zum Fortfahren
 */
async function setAuthHeader(requestParams, context, _ee, next) {
  try {
    // Login nur beim ersten Request durchführen
    if (!context.vars.authCookies) {
      // Eindeutiger Username pro Virtual User - Passwordless Auth erstellt automatisch neue User
      vuCounter++;
      const username = `perf_test_vu_${vuCounter}_${Date.now()}`;

      const cookies = await performLogin(username);
      context.vars.authCookies = cookies;
      context.vars.username = username;
    }

    // Cookies für jeden Request setzen
    requestParams.headers = requestParams.headers || {};
    requestParams.headers.Cookie = context.vars.authCookies;

    return next();
  } catch (error) {
    // Bei Auth-Fehlern trotzdem fortfahren, aber ohne Cookies
    // Artillery zählt diese Requests dann als Fehler
    console.error('Authentication failed:', error.message);
    return next();
  }
}

/**
 * Speichert erstellte Einsatz-ID für spätere Scenarios (z.B. Complete, Details)
 *
 * @param {Object} requestParams - Request Parameter
 * @param {Object} response - HTTP Response
 * @param {Object} context - Virtual User Kontext
 * @param {Object} ee - Event Emitter
 * @param {Function} next - Callback
 */
function captureEinsatzId(_requestParams, response, context, _ee, next) {
  try {
    const body = JSON.parse(response.body);
    if (body.data?.id) {
      // Speichere ID für spätere Verwendung
      context.vars.createdEinsatzId = body.data.id;
      context.vars.createdEtbId = body.data.etbId || null;
    }
  } catch (error) {
    console.error('Failed to capture Einsatz ID:', error.message);
  }
  return next();
}

/**
 * Wählt eine zufällige Einsatz-ID aus den im Kontext gespeicherten IDs
 *
 * @param {Object} context - Virtual User Kontext
 * @param {Object} events - Event Emitter
 * @param {Function} done - Callback
 */
function selectRandomEinsatzId(context, _events, done) {
  // Fallback auf eine Platzhalter-ID wenn keine erstellt wurde
  if (!context.vars.createdEinsatzId) {
    context.vars.selectedEinsatzId = 'test-einsatz-id';
    context.vars.selectedEtbId = 'test-etb-id';
  } else {
    context.vars.selectedEinsatzId = context.vars.createdEinsatzId;
    context.vars.selectedEtbId = context.vars.createdEtbId || context.vars.createdEinsatzId;
  }
  return done();
}

/**
 * Generiert realistische Einsatz-Payloads basierend auf Test-Fixtures
 *
 * @param {Object} context - Virtual User Kontext
 * @param {Object} events - Event Emitter
 * @param {Function} done - Callback
 */
function generateEinsatzPayload(context, _events, done) {
  const alarmstichwörter = [
    'B1 Kleinbrand',
    'B2 Brand klein',
    'B3 Brand mittel',
    'B4 Brand groß',
    'H1 Hilfeleistung klein',
    'H2 Hilfeleistung mittel',
    'TH1 Technische Hilfe',
    'TH2 Verkehrsunfall',
    'RD Rettungsdienst',
    'NOTF Notfall',
  ];

  const orte = ['Teststadt', 'Musterheim', 'Beispieldorf', 'Probehausen', 'Demowil'];
  const strassen = ['Hauptstraße', 'Bahnhofstraße', 'Schulstraße', 'Kirchplatz', 'Marktplatz', 'Industrieweg', 'Am Rathaus'];

  context.vars.einsatzPayload = {
    alarmstichwort: alarmstichwörter[Math.floor(Math.random() * alarmstichwörter.length)],
    einsatzort: {
      ort: orte[Math.floor(Math.random() * orte.length)],
      strasse: `${strassen[Math.floor(Math.random() * strassen.length)]} ${Math.floor(Math.random() * 100) + 1}`,
    },
    beschreibung: `Performance Test Einsatz - VU ${context.vars.username || 'unknown'}`,
  };

  return done();
}

/**
 * Generiert realistische ETB-Eintrag Payloads
 *
 * @param {Object} context - Virtual User Kontext
 * @param {Object} events - Event Emitter
 * @param {Function} done - Callback
 */
function generateEtbEintragPayload(context, _events, done) {
  const kategorien = ['INFORMATION', 'LAGEMELDUNG', 'EINSATZBEFEHL', 'PERSONALMELDUNG', 'RESSOURCENMELDUNG'];
  const texte = [
    'Einsatzkräfte vor Ort eingetroffen',
    'Erkundung läuft',
    'Lage unter Kontrolle',
    'Verstärkung angefordert',
    'Einsatzleitung übernommen',
    'Absperrung eingerichtet',
    'Rettungsdienst alarmiert',
    'Polizei verständigt',
    'THW angefordert',
    'Brandbekämpfung eingeleitet',
  ];

  context.vars.etbEintragPayload = {
    text: texte[Math.floor(Math.random() * texte.length)],
    kategorie: kategorien[Math.floor(Math.random() * kategorien.length)],
  };

  return done();
}

module.exports = {
  setAuthHeader,
  captureEinsatzId,
  selectRandomEinsatzId,
  generateEinsatzPayload,
  generateEtbEintragPayload,
};
