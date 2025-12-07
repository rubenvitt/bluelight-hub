import { Module } from '@nestjs/common';
import { PrismaLagekarteRepository } from './repositories/prisma-lagekarte.repository';
import { PrismaEinsatzRepository } from './einsatz/repositories/prisma-einsatz.repository';
import { NominatimGeocodingAdapter } from './geocoding/nominatim-geocoding.adapter';
import { PrismaModule } from '@/prisma/prisma.module';
import { PrismaOutboxRepository } from '@/infrastructure/outbox/prisma-outbox.repository';
import { EventSerializer } from '@/infrastructure/outbox/event-serializer';
import { EINSATZ_REPOSITORY, OUTBOX_REPOSITORY, LAGEKARTE_REPOSITORY } from '@infrastructure/di-tokens';

/**
 * NestJS Module für Lagekarte Infrastructure Layer.
 *
 * Dieses Modul registriert die Infrastructure-Implementierungen
 * der Domain Repository Ports und Service Ports (Hexagonal Architecture Pattern).
 *
 * **Dependency Injection Strategy:**
 * - ILagekarteRepository wird als Symbol Token bereitgestellt (LAGEKARTE_REPOSITORY)
 * - IGeocodingPort wird als String Token bereitgestellt (TODO: Symbol Migration)
 * - PrismaLagekarteRepository ist die konkrete Repository-Implementierung
 * - NominatimGeocodingAdapter ist die konkrete Geocoding-Implementierung
 * - Application Layer kann die Interfaces injizieren via @Inject(LAGEKARTE_REPOSITORY)
 *
 * **Warum Symbol Token statt String Token:**
 * - Type Safety: TypeScript kann Symbol Types validieren
 * - Keine Namenskollisionen: Jedes Symbol ist einzigartig
 * - Bessere IDE-Unterstützung: Autocomplete und Refactoring
 * - Konsistent mit modernen DI Best Practices
 *
 * **Warum Nominatim statt Google Maps:**
 * - Kostenlos und Open Source (keine API-Keys, keine Kosten)
 * - DRK-konform (keine Drittanbieter-Datenschutzprobleme)
 * - Gut genug für deutsche Einsatzadressen (OSM-Datenqualität hoch)
 * - Kein Vendor-Lock-in (kann jederzeit zu anderem Provider wechseln)
 * - Rate-Limiting (1 req/s) ist für MVP/Development akzeptabel
 *
 * **Module Dependencies:**
 * - PrismaModule: Stellt PrismaService für Repository zur Verfügung
 * - EventSerializer: Serialisiert Domain Events für Outbox Pattern (Story 4-4)
 * - PrismaOutboxRepository: Persistiert Events in outbox_events Tabelle (Story 4-4)
 *
 * **Transactional Outbox Pattern (Story 4-4):**
 * - PrismaLagekarteRepository nutzt PrismaOutboxRepository für atomare Event-Persistierung
 * - Events werden mit Aggregate in einer Transaktion committed
 * - Garantiert: Keine Event-Loss durch Transaction Rollback
 *
 * @example
 * ```typescript
 * // In Application Layer Command Handler:
 * @Injectable()
 * export class CreateLagekarteCommandHandler {
 *   constructor(
 *     @Inject(LAGEKARTE_REPOSITORY)
 *     private readonly lagekarteRepository: ILagekarteRepository,
 *     @Inject('IGeocodingPort')
 *     private readonly geocodingPort: IGeocodingPort
 *   ) {}
 * }
 * ```
 */
@Module({
  imports: [PrismaModule], // Import PrismaModule für PrismaService
  providers: [
    // Outbox Infrastructure (Story 4-4)
    EventSerializer,
    PrismaOutboxRepository,
    {
      provide: OUTBOX_REPOSITORY,
      useClass: PrismaOutboxRepository,
    },

    {
      provide: LAGEKARTE_REPOSITORY, // Symbol Token
      useClass: PrismaLagekarteRepository, // Konkrete Implementation
    },
    {
      provide: EINSATZ_REPOSITORY, // Symbol Token (Interface-Name)
      useClass: PrismaEinsatzRepository, // Vollständige Implementation mit Outbox Pattern
    },
    {
      provide: 'IGeocodingPort', // String Token (Interface-Name)
      useClass: NominatimGeocodingAdapter, // Konkrete Implementation
    },
  ],
  exports: [LAGEKARTE_REPOSITORY, EINSATZ_REPOSITORY, 'IGeocodingPort', OUTBOX_REPOSITORY], // Export für andere Module
})
export class LagekarteInfrastructureModule {}
