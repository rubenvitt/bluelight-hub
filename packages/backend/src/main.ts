import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import type { HttpsOptions } from '@nestjs/common/interfaces/external/https-options.interface';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response, NextFunction } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import * as process from 'node:process';
import * as packageJson from '../package.json';
import { AppModule } from './app.module';
import { validateInsecureMode } from './infrastructure/config/bootstrap-validation';
import { PerformanceInterceptor } from './infrastructure/http/interceptors/performance.interceptor';
import { TransformInterceptor } from './infrastructure/http/interceptors/transform.interceptor';
import { corsConfig, helmetConfig } from './infrastructure/config/security.config';

require('@dotenvx/dotenvx').config();

/**
 * Bootstrap-Funktion zum Initialisieren und Starten der NestJS-Anwendung.
 * Konfiguriert API-Versionierung, Swagger-Dokumentation, CORS und Validierungs-Pipes.
 *
 * @returns {Promise<void>} Promise, das aufgelöst wird, wenn die Anwendung gestartet ist
 */
async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const trustProxy = process.env.TRUSTED_PROXIES?.split(',').map((value) => value.trim()) || false;
  logger.log(`TRUSTED_PROXIES: ${trustProxy}`);

  // HTTPS Configuration
  const httpsEnabled = process.env.HTTPS_ENABLED === 'true';
  let httpsOptions: HttpsOptions | undefined;

  if (httpsEnabled) {
    const keyPath = process.env.HTTPS_KEY_PATH;
    const certPath = process.env.HTTPS_CERT_PATH;

    if (keyPath && certPath) {
      try {
        const fs = require('node:fs');
        const path = require('node:path');
        // Resolve paths relative to process.cwd() (usually packages/backend)
        const absoluteKeyPath = path.resolve(process.cwd(), keyPath);
        const absoluteCertPath = path.resolve(process.cwd(), certPath);

        if (fs.existsSync(absoluteKeyPath) && fs.existsSync(absoluteCertPath)) {
          httpsOptions = {
            key: fs.readFileSync(absoluteKeyPath),
            cert: fs.readFileSync(absoluteCertPath),
          };
          logger.log('🔐 HTTPS Enabled', 'Bootstrap');
        } else {
          logger.warn(`⚠️ HTTPS Enabled but cert files not found at ${absoluteKeyPath} or ${absoluteCertPath}`, 'Bootstrap');
        }
      } catch (error) {
        logger.error('❌ Failed to load HTTPS certificates', error, 'Bootstrap');
      }
    }
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: true,
    rawBody: true,
    httpsOptions,
  });

  app.set('trust proxy', trustProxy);

  // PNA (Private Network Access) Header for Cloudflare Pages -> Localhost connection
  // Robust implementation handling Preflight (OPTIONS) manually to satisfy strict browser PNA policies
  // PLATZIERUNG: MUSS zwingend vor BodyParser und anderer Middleware stehen!
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;

    // 1. Erlaube den spezifischen Origin (WICHTIG: Kein '*' erlaubt bei PNA!)
    // Wir reflektieren hier den Origin, wenn vorhanden.
    // Sicherheit: In Produktion sollte hier idealerweise gegen eine Whitelist geprüft werden (siehe corsConfig),
    // aber für den PNA-Fix (Dev/Preview -> Localhost) ist Reflected Origin oft notwendig.
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin);
    }

    // 2. PNA Header setzen - das Kernstück für Localhost-Zugriff von Public
    res.header('Access-Control-Allow-Private-Network', 'true');

    // 3. Credentials erlauben (Cookies, Auth Header etc.)
    res.header('Access-Control-Allow-Credentials', 'true');

    // 4. Preflight (OPTIONS) direkt behandeln und beenden
    if (req.method === 'OPTIONS') {
      res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, PATCH, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Server-Access-Token');
      // Wichtig: Den Preflight hier direkt mit 204 beenden, damit keine weitere Logik stört
      res.status(204).send();
      return;
    }

    next();
  });

  app.enableVersioning({
    type: VersioningType.URI,
    prefix: 'v-',
    defaultVersion: 'alpha',
  });

  app.setGlobalPrefix('api', {
    exclude: ['/'],
  });

  const config = new DocumentBuilder()
    .setTitle('BlueLight Hub API')
    .setDescription(
      `BlueLight Hub API for the BlueLight Hub application.

## Server-Access-Token (X-Server-Access-Token)

Alle API-Endpunkte (außer /health und /setup) erfordern einen gültigen Server-Access-Token im Header:

\`\`\`
X-Server-Access-Token: <plaintext_token>
\`\`\`

**Multi-Token Support:**
- Mehrere aktive Tokens gleichzeitig möglich
- Jedes Token hat einen eindeutigen Namen zur Identifikation
- \`lastUsedAt\` wird bei jeder erfolgreichen Validierung aktualisiert
- Tokens können individuell deaktiviert/reaktiviert/rotiert werden

**Token-Namenskonventionen (Best Practices):**
- \`Desktop Hauptwache\` - für Desktop-App der Hauptwache
- \`Mobile SEG Nord\` - für Mobile App der SEG Nord
- \`Integration Server\` - für automatisierte Systeme
- Bei Rotation: Datum im Namen (z.B. "Desktop HW 2026-01")`,
    )
    .setVersion(packageJson.version)
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-Server-Access-Token',
        in: 'header',
        description: 'Server-Access-Token für die Server-Authentifizierung. Mehrere aktive Tokens werden unterstützt. lastUsedAt wird bei jeder Nutzung aktualisiert.',
      },
      'server-access-token',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Admin JWT Token für geschützte Endpoints',
        in: 'header',
      },
      'admin-jwt',
    )
    .build();

  // Get config service to determine environment
  const configService = app.get(ConfigService);
  const isProduction = configService.get('NODE_ENV') === 'production';
  const appUrl = configService.get('APP_URL', 'http://localhost:3091');

  const document = SwaggerModule.createDocument(app, config);
  document.servers = [
    {
      url: appUrl,
      description: isProduction ? 'Production Server' : 'Development Server',
    },
  ];

  SwaggerModule.setup('api', app, document, {});

  // Apply Helmet middleware for security headers
  app.use(helmet(helmetConfig));

  // Apply cookie parser middleware
  app.use(cookieParser());

  // Increase body size limit for file uploads (screenshots)
  app.useBodyParser('json', { limit: '10mb' });
  app.useBodyParser('urlencoded', { limit: '10mb', extended: true });

  // Configure CORS based on environment

  const corsOptions = isProduction ? corsConfig.production : corsConfig.development;
  app.enableCors(corsOptions);

  // Serve static files (for uploaded screenshots)
  // Use ENV-configured path or default (relative to dist/src/main.js)
  const uploadsBase = configService.get<string>('UPLOADS_PATH') || '../../uploads';
  const uploadsPath = require('node:path').resolve(__dirname, uploadsBase);
  logger.log(`Serving static files from: ${uploadsPath}`);
  app.useStaticAssets(uploadsPath, { prefix: '/uploads' });

  // Enable validation pipes globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Enable interceptors globally
  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(new PerformanceInterceptor(), new TransformInterceptor(reflector));

  const port = configService.get('BACKEND_PORT') || configService.get('PORT') || 3091;

  await app.listen(port);
  const url = await app.getUrl();
  Logger.log(`Application is running in ${isProduction ? 'production' : 'development'} mode`, 'Bootstrap');
  Logger.log(`Application is running on: ${url}`);

  // INSECURE_MODE Validierung - Security Check VOR App-Start abschliessen
  // Wirft Exception wenn INSECURE_MODE in Production aktiviert ist
  validateInsecureMode(configService.get<string>('INSECURE_MODE'), isProduction);
}

bootstrap();
