import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import * as process from 'node:process';
import * as packageJson from '../package.json';
import { AppModule } from './app.module';
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
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: true,
    rawBody: true,
  });

  app.set('trust proxy', trustProxy);

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
    .setDescription('BlueLight Hub API for the BlueLight Hub application')
    .setVersion(packageJson.version)
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
}

bootstrap();
