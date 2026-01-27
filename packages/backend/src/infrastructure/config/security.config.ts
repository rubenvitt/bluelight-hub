import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import type { HelmetOptions } from 'helmet';

/**
 * Sicherheitskonfiguration für die Anwendung.
 * Definiert Helmet-Optionen und andere sicherheitsrelevante Einstellungen.
 */

/**
 * Helmet-Konfiguration für sichere HTTP-Header
 *
 * Diese Konfiguration setzt verschiedene Sicherheits-Header,
 * um die Anwendung gegen gängige Webangriffe zu schützen.
 * Enthält CSP, HSTS, X-Frame-Options und weitere Schutzmaßnahmen.
 *
 * @constant {HelmetOptions}
 */
export const helmetConfig: HelmetOptions = {
  // Content Security Policy - Verhindert XSS-Angriffe
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Für Swagger UI
      scriptSrc: ["'self'", "'unsafe-inline'"], // Für Swagger UI
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  // Cross-Origin-Embedder-Policy
  crossOriginEmbedderPolicy: false, // Für Swagger UI deaktiviert
  // DNS Prefetch Control
  dnsPrefetchControl: { allow: false },
  // Frameguard - Verhindert Clickjacking
  frameguard: { action: 'deny' },
  // Hide Powered By - Versteckt X-Powered-By Header
  hidePoweredBy: true,
  // HSTS - HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 Jahr
    includeSubDomains: true,
    preload: true,
  },
  // IE No Open - Verhindert IE Downloads zu öffnen
  ieNoOpen: true,
  // No Sniff - Verhindert MIME-Type Sniffing
  noSniff: true,
  // Origin Agent Cluster
  originAgentCluster: true,
  // Permitted Cross Domain Policies
  permittedCrossDomainPolicies: false,
  // Referrer Policy
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
};

/**
 * CORS-Konfiguration für verschiedene Umgebungen
 *
 * Definiert Cross-Origin Resource Sharing Einstellungen
 * für Development- und Production-Umgebungen.
 *
 * @constant
 */
/**
 * Dynamische Origin-Validierung für Tauri, Development und konfigurierbare Patterns
 *
 * Unterstützte Umgebungsvariablen:
 * - ALLOWED_ORIGINS: Komma-separierte Liste expliziter Origins
 *   Beispiel: "https://example.com,https://app.example.com"
 * - ALLOWED_ORIGIN_PATTERNS: Komma-separierte Liste von Regex-Patterns
 *   Beispiel: "[\w-]+\.bluelight-hub-app\.pages\.dev$,[\w-]+\.vercel\.app$"
 * - Wildcard "*" in ALLOWED_ORIGINS erlaubt alle Origins (NUR für Entwicklung!)
 */
const corsOriginHandler = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
  // Standard-Patterns für Tauri und Development
  const builtInPatterns = [
    /^https?:\/\/localhost(:\d+)?$/, // localhost mit beliebigem Port
    /^https?:\/\/127\.0\.0\.1(:\d+)?$/, // 127.0.0.1 mit beliebigem Port
    /^tauri:\/\/localhost/, // Tauri v1
    /^https:\/\/tauri\.localhost/, // Tauri v2
    /^https?:\/\/\[::1\](:\d+)?$/, // IPv6 localhost
  ];

  // Zusätzliche explizite Origins aus Umgebungsvariablen
  const envOrigins =
    process.env.ALLOWED_ORIGINS?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) || [];

  // Wildcard-Check: "*" erlaubt alle Origins
  if (envOrigins.includes('*')) {
    callback(null, true);
    return;
  }

  // Zusätzliche Patterns aus Umgebungsvariablen (Regex-Strings)
  const envPatternStrings =
    process.env.ALLOWED_ORIGIN_PATTERNS?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) || [];
  const envPatterns: RegExp[] = [];
  for (const patternStr of envPatternStrings) {
    try {
      envPatterns.push(new RegExp(patternStr));
    } catch {
      console.warn(`[CORS] Ungültiges Pattern ignoriert: ${patternStr}`);
    }
  }

  // Alle Patterns kombinieren
  const allPatterns = [...builtInPatterns, ...envPatterns];

  // Prüfe ob Origin erlaubt ist
  const isAllowed = !origin || envOrigins.includes(origin) || allPatterns.some((pattern) => pattern.test(origin));

  callback(null, isAllowed);
};

export const corsConfig = {
  development: {
    origin: corsOriginHandler,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-Server-Access-Token'],
    exposedHeaders: ['X-Total-Count'],
  } satisfies CorsOptions,
  production: {
    origin: corsOriginHandler, // Gleiche Handler für Production wegen Tauri
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-Server-Access-Token'],
    exposedHeaders: ['X-Total-Count'],
  } satisfies CorsOptions,
};
