import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Controller, Get, Logger, VERSION_NEUTRAL } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipTransform } from './modules/common/decorators/skip-transform.decorator';
import { trimTrailingSlash } from '@/shared/utils/url.util';

const packageJson = (() => {
  try {
    const file = readFileSync(resolve(__dirname, '..', 'package.json'), 'utf8');
    return JSON.parse(file) as { version?: string };
  } catch {
    return {} as { version?: string };
  }
})();

/**
 * Haupt-Controller für die Anwendung, der grundlegende API-Informationen bereitstellt.
 * Dieser Controller stellt den Root-Endpunkt zur Verfügung, der Metadaten über die API liefert.
 */
@Controller({
  version: VERSION_NEUTRAL,
})
export class AppController {
  private readonly logger: Logger;
  private readonly url: string;

  /**
   * Konstruktor des AppControllers.
   * Initialisiert die Basis-URL der Anwendung und den Logger für diese Klasse.
   *
   * @param configService - Service zum Abrufen von Konfigurationswerten aus der Umgebung
   * @param logger - Logger-Service für diese Klasse
   */
  constructor(private readonly configService: ConfigService) {
    this.logger = new Logger(AppController.name);
    const rawUrl = this.configService.get<string>('APP_URL', 'http://localhost:3090');
    this.url = trimTrailingSlash(rawUrl);
    this.logger.debug(`AppController initialisiert mit URL: ${this.url}`);
  }

  @Get()
  @SkipTransform()
  getRoot() {
    return {
      message: 'Bluelight Hub API',
      version: packageJson.version,
      endpoints: {
        api: `${this.url}/api`,
      },
    };
  }
}
