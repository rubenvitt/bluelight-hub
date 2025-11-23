import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventEmitterPublisher } from './event-emitter-publisher';
import { LagekarteEventLoggerHandler } from './handlers/lagekarte-event-logger.handler';

/**
 * NestJS Module für Lagekarte Event Infrastructure.
 *
 * Dieses Modul registriert:
 * - IEventPublisher Provider (EventEmitterPublisher als Implementierung)
 * - Event Handler für Lagekarte Events (LagekarteEventLoggerHandler)
 *
 * **Dependency Injection:**
 * IEventPublisher wird als String-Token registriert, damit Command Handler
 * via @Inject('IEventPublisher') injizieren können.
 *
 * **Export:**
 * IEventPublisher wird exportiert, damit andere Module (z.B. LagekarteApplicationModule)
 * den EventPublisher injizieren können.
 */
@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [
    {
      provide: 'IEventPublisher',
      useClass: EventEmitterPublisher,
    },
    LagekarteEventLoggerHandler,
  ],
  exports: ['IEventPublisher'],
})
export class LagekarteEventsModule {}
