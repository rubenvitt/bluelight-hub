import { LagekarteApplicationModule } from '@/application/lagekarte/lagekarte-application.module';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ThrottlerModule } from '@nestjs/throttler';
import { milliseconds } from 'date-fns';
import { GeocodingController } from './controllers/geocoding.controller';

import { LagekarteController, LagekarteCqrsController } from './controllers/lagekarte.controller';
import { PoiController } from './controllers/poi.controller';

import { LagekarteRepository } from './repositories/lagekarte.repository';
import { PoiRepository } from './repositories/poi.repository';
import { GeocodingService } from './services/geocoding.service';
import { MgrsConverterService } from './services/mgrs-converter.service';

/**
 * Lagekarte Module (Hexagonal Architecture)
 *
 * Stellt POI-Management und Geocoding-Funktionalität für Einsatz-Lagekarten bereit.
 * Nutzt Nominatim-API für Geocoding (Rate-Limited auf 1 req/s).
 *
 * **Architektur (Clean Architecture):**
 * - Controller injizieren Handler aus LagekarteApplicationModule
 * - Alle Business-Logik in Application Layer (CQRS Handlers)
 * - Infrastructure via LagekarteInfrastructureModule (importiert durch Application Module)
 *
 * **DEPRECATED Services:**
 * - LagekarteRepository: Nur noch für PoiController (DEPRECATED)
 * - PoiRepository: Nur noch für PoiController (DEPRECATED)
 * - Werden in Story 5-2 vollständig entfernt wenn PoiController entfernt wird
 *
 * @module LagekarteModule
 */
@Module({
  imports: [
    CqrsModule, // Provides CommandBus/QueryBus for Controllers
    LagekarteApplicationModule, // CQRS Handlers (Command, Query, Event Handlers)
    PrismaModule,
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: milliseconds({ seconds: 1 }), // 1 second
        limit: 1, // 1 request per TTL (Nominatim policy: 1 req/s)
      },
    ]),
  ],
  controllers: [LagekarteController, LagekarteCqrsController, PoiController, GeocodingController],
  providers: [
    // Infrastructure Services (shared with legacy endpoints)
    GeocodingService,
    MgrsConverterService,
    // DEPRECATED: Alte Repositories nur noch für PoiController (wird in Story 5-2 entfernt)
    LagekarteRepository,
    PoiRepository,
  ],
  exports: [
    // Public API: Geocoding/MGRS Services können von anderen Modulen genutzt werden
    GeocodingService,
    MgrsConverterService,
    // DEPRECATED: Alte Repositories werden nicht mehr exportiert (keine neuen Dependencies erlaubt)
    // LagekarteRepository, PoiRepository werden in Story 5-2 entfernt
  ],
})
export class LagekarteModule {}
