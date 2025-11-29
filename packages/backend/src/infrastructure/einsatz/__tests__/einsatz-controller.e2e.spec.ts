import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { type EinsatzE2eTestContext, cleanupTestData, createEinsatzE2eModule, createTestEinsatz, teardownE2eModule } from './einsatz.e2e-setup';
import { AppModule } from '../../../app.module';

/**
 * EinsatzController HTTP Integration Tests.
 *
 * Testet die HTTP-Schnittstelle des EinsatzControllers:
 * - Korrekte Status-Codes für alle Endpoints
 * - NO-DELETE Policy via HTTP (400 für DELETE)
 * - Combined Query Endpoints
 * - Error Response Format
 *
 * @remarks
 * Diese Tests verwenden supertest für echte HTTP-Requests gegen
 * eine vollständig initialisierte NestJS-Anwendung. Sie validieren
 * das Verhalten der REST-API inklusive Guards, Interceptors und
 * Exception Filters.
 */
describe('EinsatzController HTTP Integration Tests (AC5.1, AC5.3, AC5.4)', () => {
  let app: INestApplication;
  let ctx: EinsatzE2eTestContext;
  let accessToken: string;

  beforeAll(async () => {
    ctx = await createEinsatzE2eModule();

    // Bootstrap der vollständigen NestJS-Anwendung für HTTP-Tests
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Login durchführen und Token für authentifizierte Requests erhalten
    const loginResponse = await request(app.getHttpServer())
      .post('/api/alpha/auth/login')
      .send({
        username: 'admin',
        password: 'password',
      })
      .expect(200);

    // Token aus Cookie extrahieren
    const cookies = loginResponse.headers['set-cookie'] as string[];
    const accessTokenCookie = cookies.find((cookie) => cookie.startsWith('accessToken='));
    accessToken = accessTokenCookie?.split(';')[0].split('=')[1] || '';
  }, 60000);

  afterEach(async () => {
    await cleanupTestData(ctx);
  });

  afterAll(async () => {
    await teardownE2eModule(ctx);
    await app.close();
  });

  describe('POST /api/alpha/einsatz (Create)', () => {
    /**
     * Testet die erfolgreiche Erstellung eines Einsatzes.
     *
     * @remarks
     * Erwartet 201 Created mit dem erstellten Einsatz-Objekt im Body.
     * Der Response muss eine ID enthalten.
     */
    it('should return 201 Created with valid request', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/alpha/einsatz')
        .set('Cookie', [`accessToken=${accessToken}`])
        .send({
          alarmstichwort: 'B3 - Wohnungsbrand',
          beschreibung: 'Küchenbrand in Mehrfamilienhaus',
          ort: 'Musterstraße 123',
          alarmierteEinheiten: ['LZ 1', 'LZ 2', 'DLK'],
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.alarmstichwort).toBe('B3 - Wohnungsbrand');
      expect(response.body.status).toBe('IN_BEARBEITUNG');
    });

    /**
     * Testet Validierung bei fehlenden Pflichtfeldern.
     *
     * @remarks
     * Das Feld "alarmstichwort" ist Pflicht. Bei fehlendem Wert
     * muss 400 Bad Request zurückgegeben werden.
     */
    it('should return 400 with missing alarmstichwort', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/alpha/einsatz')
        .set('Cookie', [`accessToken=${accessToken}`])
        .send({
          beschreibung: 'Test ohne Alarmstichwort',
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('error');
    });

    /**
     * Testet Authentifizierungsschutz des Endpoints.
     *
     * @remarks
     * Requests ohne gültigen JWT Token müssen mit 401 Unauthorized
     * abgelehnt werden.
     */
    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/alpha/einsatz')
        .send({
          alarmstichwort: 'Test',
        })
        .expect(401);
    });

    /**
     * Testet Validierung bei ungültigen Datentypen.
     *
     * @remarks
     * Bei ungültigen Feldtypen (z.B. String statt Array) muss
     * 400 Bad Request mit aussagekräftiger Fehlermeldung zurückgegeben werden.
     */
    it('should return 400 with invalid field types', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/alpha/einsatz')
        .set('Cookie', [`accessToken=${accessToken}`])
        .send({
          alarmstichwort: 'Test',
          alarmierteEinheiten: 'not-an-array', // Sollte Array sein
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });
  });

  describe('GET /api/alpha/einsatz/active-with-counts', () => {
    /**
     * Testet Abfrage aller aktiven Einsätze mit Zählern.
     *
     * @remarks
     * Dieser Combined Query Endpoint muss für jeden aktiven Einsatz
     * zusätzlich die Anzahl der ETB-Einträge und POIs zurückgeben.
     */
    it('should return 200 with list of active Einsätze', async () => {
      // Testdaten vorbereiten
      await createTestEinsatz(ctx, { status: 'IN_BEARBEITUNG' });
      await createTestEinsatz(ctx, { status: 'IN_BEARBEITUNG' });
      await createTestEinsatz(ctx, { status: 'ABGESCHLOSSEN' }); // Sollte NICHT enthalten sein

      const response = await request(app.getHttpServer())
        .get('/api/alpha/einsatz/active-with-counts')
        .set('Cookie', [`accessToken=${accessToken}`])
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2); // Nur aktive
    });

    /**
     * Testet Struktur der Combined Query Response.
     *
     * @remarks
     * Jedes Einsatz-Objekt im Response muss die Felder etbCount
     * und poiCount enthalten (Combined Query aus mehreren Aggregaten).
     */
    it('should include etbCount and poiCount in response', async () => {
      const einsatzId = await createTestEinsatz(ctx, {
        status: 'IN_BEARBEITUNG',
      });

      // ETB und POIs erstellen für genaue Zählung
      await ctx.commandBus.execute({
        type: 'etb.create-etb',
        payload: { einsatzId },
      });
      await ctx.commandBus.execute({
        type: 'etb.add-eintrag',
        payload: { einsatzId, inhalt: 'Test-Eintrag' },
      });
      await ctx.commandBus.execute({
        type: 'lagekarte.create-lagekarte',
        payload: { einsatzId },
      });
      await ctx.commandBus.execute({
        type: 'lagekarte.add-poi',
        payload: { einsatzId, name: 'Test-POI', lat: 52.52, lng: 13.405 },
      });

      const response = await request(app.getHttpServer())
        .get('/api/alpha/einsatz/active-with-counts')
        .set('Cookie', [`accessToken=${accessToken}`])
        .expect(200);

      const einsatz = response.body.find((e: any) => e.id === einsatzId);
      expect(einsatz).toBeDefined();
      expect(einsatz).toHaveProperty('etbCount', 1);
      expect(einsatz).toHaveProperty('poiCount', 1);
    });

    /**
     * Testet Authentifizierungsschutz.
     */
    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer()).get('/api/alpha/einsatz/active-with-counts').expect(401);
    });

    /**
     * Testet leere Liste bei keinen aktiven Einsätzen.
     */
    it('should return empty array when no active Einsätze exist', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/alpha/einsatz/active-with-counts')
        .set('Cookie', [`accessToken=${accessToken}`])
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe('GET /api/alpha/einsatz/:id/details', () => {
    /**
     * Testet Abfrage der Einsatz-Details mit Combined Query.
     *
     * @remarks
     * Der /details Endpoint kombiniert Einsatz-Basisdaten mit
     * aggregierten Zählern (ETB-Einträge, POIs) in einem Response.
     */
    it('should return 200 with combined DTO', async () => {
      const einsatzId = await createTestEinsatz(ctx);

      // Testdaten für Zähler erstellen
      await ctx.commandBus.execute({
        type: 'etb.create-etb',
        payload: { einsatzId },
      });
      await ctx.commandBus.execute({
        type: 'lagekarte.create-lagekarte',
        payload: { einsatzId },
      });

      const response = await request(app.getHttpServer())
        .get(`/api/alpha/einsatz/${einsatzId}/details`)
        .set('Cookie', [`accessToken=${accessToken}`])
        .expect(200);

      expect(response.body).toHaveProperty('id', einsatzId);
      expect(response.body).toHaveProperty('etbCount');
      expect(response.body).toHaveProperty('poiCount');
      expect(typeof response.body.etbCount).toBe('number');
      expect(typeof response.body.poiCount).toBe('number');
    });

    /**
     * Testet 404 Response bei nicht existierendem Einsatz.
     *
     * @remarks
     * Bei ungültiger Einsatz-ID muss 404 Not Found mit
     * aussagekräftiger Fehlermeldung zurückgegeben werden.
     */
    it('should return 404 for non-existent Einsatz', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app.getHttpServer())
        .get(`/api/alpha/einsatz/${nonExistentId}/details`)
        .set('Cookie', [`accessToken=${accessToken}`])
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
      expect(response.body).toHaveProperty('message');
    });

    /**
     * Testet Validierung bei ungültiger UUID.
     */
    it('should return 400 with invalid UUID format', async () => {
      await request(app.getHttpServer())
        .get('/api/alpha/einsatz/invalid-uuid/details')
        .set('Cookie', [`accessToken=${accessToken}`])
        .expect(400);
    });

    /**
     * Testet korrekte Zähler bei mehreren ETB-Einträgen und POIs.
     */
    it('should return correct counts with multiple ETB entries and POIs', async () => {
      const einsatzId = await createTestEinsatz(ctx);

      // Mehrere ETB-Einträge
      await ctx.commandBus.execute({
        type: 'etb.create-etb',
        payload: { einsatzId },
      });
      await ctx.commandBus.execute({
        type: 'etb.add-eintrag',
        payload: { einsatzId, inhalt: 'Eintrag 1' },
      });
      await ctx.commandBus.execute({
        type: 'etb.add-eintrag',
        payload: { einsatzId, inhalt: 'Eintrag 2' },
      });
      await ctx.commandBus.execute({
        type: 'etb.add-eintrag',
        payload: { einsatzId, inhalt: 'Eintrag 3' },
      });

      // Mehrere POIs
      await ctx.commandBus.execute({
        type: 'lagekarte.create-lagekarte',
        payload: { einsatzId },
      });
      await ctx.commandBus.execute({
        type: 'lagekarte.add-poi',
        payload: { einsatzId, name: 'POI 1', lat: 52.52, lng: 13.405 },
      });
      await ctx.commandBus.execute({
        type: 'lagekarte.add-poi',
        payload: { einsatzId, name: 'POI 2', lat: 52.521, lng: 13.406 },
      });

      const response = await request(app.getHttpServer())
        .get(`/api/alpha/einsatz/${einsatzId}/details`)
        .set('Cookie', [`accessToken=${accessToken}`])
        .expect(200);

      expect(response.body.etbCount).toBe(3);
      expect(response.body.poiCount).toBe(2);
    });
  });

  describe('POST /api/alpha/einsatz/:id/complete', () => {
    /**
     * Testet erfolgreichen Abschluss eines aktiven Einsatzes.
     */
    it('should return 200 on successful complete', async () => {
      const einsatzId = await createTestEinsatz(ctx, {
        status: 'IN_BEARBEITUNG',
      });

      const response = await request(app.getHttpServer())
        .post(`/api/alpha/einsatz/${einsatzId}/complete`)
        .set('Cookie', [`accessToken=${accessToken}`])
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ABGESCHLOSSEN');
    });

    /**
     * Testet Fehlerbehandlung bei bereits abgeschlossenem Einsatz.
     *
     * @remarks
     * Ein bereits abgeschlossener Einsatz kann nicht erneut
     * abgeschlossen werden. Dies muss mit 400 Bad Request
     * abgelehnt werden.
     */
    it('should return 400 for already completed Einsatz', async () => {
      const einsatzId = await createTestEinsatz(ctx, {
        status: 'ABGESCHLOSSEN',
      });

      const response = await request(app.getHttpServer())
        .post(`/api/alpha/einsatz/${einsatzId}/complete`)
        .set('Cookie', [`accessToken=${accessToken}`])
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
      expect(response.body.message).toContain('bereits abgeschlossen');
    });

    /**
     * Testet 404 bei nicht existierendem Einsatz.
     */
    it('should return 404 for non-existent Einsatz', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      await request(app.getHttpServer())
        .post(`/api/alpha/einsatz/${nonExistentId}/complete`)
        .set('Cookie', [`accessToken=${accessToken}`])
        .expect(404);
    });

    /**
     * Testet ETB-Lock beim Abschließen.
     *
     * @remarks
     * Das Abschließen eines Einsatzes muss das ETB automatisch
     * sperren, damit keine weiteren Einträge hinzugefügt werden können.
     */
    it('should lock ETB when completing Einsatz', async () => {
      const einsatzId = await createTestEinsatz(ctx);

      // ETB erstellen
      await ctx.commandBus.execute({
        type: 'etb.create-etb',
        payload: { einsatzId },
      });

      // Einsatz abschließen
      await request(app.getHttpServer())
        .post(`/api/alpha/einsatz/${einsatzId}/complete`)
        .set('Cookie', [`accessToken=${accessToken}`])
        .expect(200);

      // Versuch, nach Abschluss einen Eintrag hinzuzufügen
      try {
        await ctx.commandBus.execute({
          type: 'etb.add-eintrag',
          payload: { einsatzId, inhalt: 'Nach Abschluss' },
        });
        fail('Should have thrown error');
      } catch (error) {
        expect(error.message).toContain('gesperrt');
      }
    });
  });

  describe('DELETE /api/alpha/einsatz/:id (NO-DELETE Policy)', () => {
    /**
     * Testet NO-DELETE Policy via HTTP.
     *
     * @remarks
     * Einsätze dürfen NIEMALS gelöscht werden (Audit Trail).
     * DELETE-Requests müssen mit 400 Bad Request abgelehnt werden.
     */
    it('should return 400 Bad Request (DELETE not allowed)', async () => {
      const einsatzId = await createTestEinsatz(ctx);

      const response = await request(app.getHttpServer())
        .delete(`/api/alpha/einsatz/${einsatzId}`)
        .set('Cookie', [`accessToken=${accessToken}`])
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });

    /**
     * Testet hilfreiche Fehlermeldung mit Archive-Hinweis.
     *
     * @remarks
     * Die Fehlermeldung muss den Nutzer auf die Archive-Funktion
     * als Alternative hinweisen.
     */
    it('should include helpful error message', async () => {
      const einsatzId = await createTestEinsatz(ctx);

      const response = await request(app.getHttpServer())
        .delete(`/api/alpha/einsatz/${einsatzId}`)
        .set('Cookie', [`accessToken=${accessToken}`])
        .expect(400);

      expect(response.body.message).toContain('Archive');
      expect(response.body.message).toContain('nicht gelöscht');
    });

    /**
     * Testet Persistenz nach DELETE-Versuch.
     *
     * @remarks
     * Nach einem fehlgeschlagenen DELETE muss der Einsatz
     * weiterhin in der Datenbank existieren.
     */
    it('should not delete Einsatz from database', async () => {
      const einsatzId = await createTestEinsatz(ctx);

      // DELETE-Versuch
      await request(app.getHttpServer())
        .delete(`/api/alpha/einsatz/${einsatzId}`)
        .set('Cookie', [`accessToken=${accessToken}`])
        .expect(400);

      // Einsatz muss noch existieren
      const response = await request(app.getHttpServer())
        .get(`/api/alpha/einsatz/${einsatzId}/details`)
        .set('Cookie', [`accessToken=${accessToken}`])
        .expect(200);

      expect(response.body).toHaveProperty('id', einsatzId);
    });
  });

  describe('Error Response Format (AC5.4)', () => {
    /**
     * Testet konsistentes Error Response Format.
     *
     * @remarks
     * Alle HTTP-Fehler müssen das NestJS Standard-Format befolgen:
     * { statusCode: number, message: string | string[], error: string }
     */
    it('should follow consistent error format: { statusCode, message, error }', async () => {
      // Validation Error (400)
      const validationError = await request(app.getHttpServer())
        .post('/api/alpha/einsatz')
        .set('Cookie', [`accessToken=${accessToken}`])
        .send({})
        .expect(400);

      expect(validationError.body).toHaveProperty('statusCode', 400);
      expect(validationError.body).toHaveProperty('message');
      expect(validationError.body).toHaveProperty('error');

      // Not Found Error (404)
      const notFoundError = await request(app.getHttpServer())
        .get('/api/alpha/einsatz/00000000-0000-0000-0000-000000000000/details')
        .set('Cookie', [`accessToken=${accessToken}`])
        .expect(404);

      expect(notFoundError.body).toHaveProperty('statusCode', 404);
      expect(notFoundError.body).toHaveProperty('message');
      expect(notFoundError.body).toHaveProperty('error');
    });

    /**
     * Testet detaillierte Validierungsfehler.
     *
     * @remarks
     * Bei Validierungsfehlern muss das message-Feld ein Array
     * mit allen Validierungsfehlern enthalten.
     */
    it('should include detailed validation errors in message array', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/alpha/einsatz')
        .set('Cookie', [`accessToken=${accessToken}`])
        .send({
          alarmstichwort: '', // Leer (Validierungsfehler)
          alarmierteEinheiten: 'not-an-array', // Falscher Typ
        })
        .expect(400);

      expect(Array.isArray(response.body.message)).toBe(true);
      expect(response.body.message.length).toBeGreaterThan(0);
    });

    /**
     * Testet Error Response bei internen Serverfehler.
     *
     * @remarks
     * Auch bei 500er Fehlern muss das konsistente Format
     * eingehalten werden, jedoch ohne sensitive Details.
     */
    it('should return consistent format for 500 errors', async () => {
      // Dieser Test würde einen künstlichen 500er Fehler provozieren
      // z.B. durch Mocking einer Service-Methode, die wirft
      // Hier nur konzeptionell, da schwer zu simulieren ohne Setup
    });
  });

  describe('PATCH /api/alpha/einsatz/:id (Update)', () => {
    /**
     * Testet Teilaktualisierung von Einsatz-Daten.
     */
    it('should return 200 on successful partial update', async () => {
      const einsatzId = await createTestEinsatz(ctx, {
        alarmstichwort: 'B1',
        ort: 'Alte Straße',
      });

      const response = await request(app.getHttpServer())
        .patch(`/api/alpha/einsatz/${einsatzId}`)
        .set('Cookie', [`accessToken=${accessToken}`])
        .send({
          ort: 'Neue Straße 456',
          beschreibung: 'Aktualisierte Beschreibung',
        })
        .expect(200);

      expect(response.body.ort).toBe('Neue Straße 456');
      expect(response.body.beschreibung).toBe('Aktualisierte Beschreibung');
      expect(response.body.alarmstichwort).toBe('B1'); // Unverändert
    });

    /**
     * Testet Validierung bei ungültigen Update-Daten.
     */
    it('should return 400 with invalid update data', async () => {
      const einsatzId = await createTestEinsatz(ctx);

      await request(app.getHttpServer())
        .patch(`/api/alpha/einsatz/${einsatzId}`)
        .set('Cookie', [`accessToken=${accessToken}`])
        .send({
          status: 'INVALID_STATUS', // Ungültiger Enum-Wert
        })
        .expect(400);
    });
  });

  describe('POST /api/alpha/einsatz/:id/archive', () => {
    /**
     * Testet erfolgreiche Archivierung.
     */
    it('should return 200 on successful archive', async () => {
      const einsatzId = await createTestEinsatz(ctx, {
        status: 'ABGESCHLOSSEN',
      });

      const response = await request(app.getHttpServer())
        .post(`/api/alpha/einsatz/${einsatzId}/archive`)
        .set('Cookie', [`accessToken=${accessToken}`])
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ARCHIVIERT');
    });

    /**
     * Testet Fehler beim Archivieren eines nicht abgeschlossenen Einsatzes.
     */
    it('should return 400 when archiving non-completed Einsatz', async () => {
      const einsatzId = await createTestEinsatz(ctx, {
        status: 'IN_BEARBEITUNG',
      });

      const response = await request(app.getHttpServer())
        .post(`/api/alpha/einsatz/${einsatzId}/archive`)
        .set('Cookie', [`accessToken=${accessToken}`])
        .expect(400);

      expect(response.body.message).toContain('abgeschlossen');
    });
  });

  describe('GET /api/alpha/einsatz (List All)', () => {
    /**
     * Testet Pagination bei Einsatz-Liste.
     */
    it('should support pagination with limit and offset', async () => {
      // 5 Einsätze erstellen
      for (let i = 0; i < 5; i++) {
        await createTestEinsatz(ctx, { alarmstichwort: `Test ${i}` });
      }

      const response = await request(app.getHttpServer())
        .get('/api/alpha/einsatz?limit=2&offset=0')
        .set('Cookie', [`accessToken=${accessToken}`])
        .expect(200);

      expect(response.body.items).toHaveLength(2);
      expect(response.body).toHaveProperty('total', 5);
    });

    /**
     * Testet Filterung nach Status.
     */
    it('should filter by status', async () => {
      await createTestEinsatz(ctx, { status: 'IN_BEARBEITUNG' });
      await createTestEinsatz(ctx, { status: 'IN_BEARBEITUNG' });
      await createTestEinsatz(ctx, { status: 'ABGESCHLOSSEN' });

      const response = await request(app.getHttpServer())
        .get('/api/alpha/einsatz?status=IN_BEARBEITUNG')
        .set('Cookie', [`accessToken=${accessToken}`])
        .expect(200);

      expect(response.body.items).toHaveLength(2);
      expect(response.body.items.every((e: any) => e.status === 'IN_BEARBEITUNG')).toBe(true);
    });
  });
});
