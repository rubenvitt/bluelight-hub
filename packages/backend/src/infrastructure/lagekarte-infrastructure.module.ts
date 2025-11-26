import { Module } from '@nestjs/common';
import { PrismaLagekarteRepository } from './repositories/prisma-lagekarte.repository';
import { PrismaEinsatzRepositoryAdapter } from './repositories/prisma-einsatz.repository';
import { NominatimGeocodingAdapter } from './geocoding/nominatim-geocoding.adapter';
import { PrismaModule } from '@/prisma/prisma.module';
import { PrismaOutboxRepository } from '@/infrastructure/outbox/prisma-outbox.repository';
import { EventSerializer } from '@/infrastructure/outbox/event-serializer';

/**
 * NestJS Module für Lagekarte Infrastructure Layer.
 *
 * Dieses Modul registriert die Infrastructure-Implementierungen
 * der Domain Repository Ports und Service Ports (Hexagonal Architecture Pattern).
 *
 * **Dependency Injection Strategy:**
 * - ILagekarteRepository wird als String Token bereitgestellt
 * - IGeocodingPort wird als String Token bereitgestellt
 * - PrismaLagekarteRepository ist die konkrete Repository-Implementierung
 * - NominatimGeocodingAdapter ist die konkrete Geocoding-Implementierung
 * - Application Layer kann die Interfaces injizieren via @Inject()
 *
 * **Warum String Token statt Class Token:**
 * - Domain Layer kennt NUR das Interface (ILagekarteRepository, IGeocodingPort)
 * - Domain Layer kann NICHT auf Infrastructure Class referenzieren
 * - String Token entkoppelt Domain von Infrastructure
 * - Ermöglicht austauschbare Implementierungen:
 *   - Repository: Prisma, TypeORM, In-Memory
 *   - Geocoding: Nominatim, Google Maps, Here.com, Mock
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
 *     @Inject('ILagekarteRepository')
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
      provide: 'ILagekarteRepository', // String Token (Interface-Name)
      useClass: PrismaLagekarteRepository, // Konkrete Implementation
    },
    {
      provide: 'IEinsatzRepository', // String Token (Interface-Name)
      useClass: PrismaEinsatzRepositoryAdapter, // Minimal-Implementation für Lagekarte-Abhängigkeit
    },
    {
      provide: 'IGeocodingPort', // String Token (Interface-Name)
      useClass: NominatimGeocodingAdapter, // Konkrete Implementation
    },
  ],
  exports: ['ILagekarteRepository', 'IEinsatzRepository', 'IGeocodingPort'], // Export für andere Module
})
export class LagekarteInfrastructureModule {}
