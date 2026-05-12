import { Inject, Injectable, Optional } from '@nestjs/common';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import PDFDocument from 'pdfkit';
import type { EigenschutzVorfallPdfInput, IEigenschutzVorfallPdfRenderer } from '@/application/eigenschutz/ports/i-eigenschutz-vorfall-pdf-renderer.port';
import type { EigenschutzVorfall } from '@domain/eigenschutz/aggregates/eigenschutz-vorfall.aggregate';
import type { BeteiligterProps } from '@domain/eigenschutz/value-objects/beteiligter.vo';
import type { ILogger } from '@domain/ports/i-logger.port';
import { LOGGER } from '@infrastructure/di-tokens';
import { redactId } from '@/shared/utils/pii-redact.util';

/**
 * Konstruktor-Optionen für den PDF-Renderer (Story 5.4 AC2).
 *
 * `compress: false` ist ausschließlich für Renderer-Specs gedacht — String-
 * Substring-Asserts laufen dann gegen den uncompressed Stream. Production
 * verwendet immer den Default `compress: true`.
 */
export interface EigenschutzVorfallPdfRendererOptions {
  readonly compress?: boolean;
}

const REDACT_LENGTH = 8;

// Layout-Konstanten — A4 mit margin: 50 ⇒ usable width 495 pt (595 - 2*50).
const PAGE_MARGIN = 50;
const PAGE_WIDTH = 595.28;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * PAGE_MARGIN;
// Reserve am unteren Seitenrand für den persistenten Footer (Permission-Zeile
// + Seitenzahl). 60 pt deckt zwei Textzeilen + Trennlinie sicher ab.
const FOOTER_RESERVED_HEIGHT = 60;
// A4-Höhe 842 pt minus Margin und Footer-Reserve — Schwelle für manuelle
// Seitenumbrüche vor Blöcken, die eigene Höhe nicht im Voraus kennen.
// pdfkit umbricht innerhalb von `text(...)` automatisch, aber Vektor-
// Primitive (rect/lineTo) ignorieren die Margin-Grenze.
const PAGE_BREAK_THRESHOLD = 700;

// Corporate-Design-Tokens (zurückhaltend, druckfreundlich, keine Org-Farben —
// Bluelight-Hub ist neutraler Hub für mehrere weiße HiOrgs).
const COLOR_PRIMARY = '#0f3a5f'; // tiefes Marineblau für Hauptakzente
const COLOR_PRIMARY_SOFT = '#e5edf3'; // sehr helles Blau für Section-Hintergründe
const COLOR_TEXT = '#1a1a1a';
const COLOR_MUTED = '#666666';
const COLOR_BORDER = '#cccccc';
const COLOR_WARN = '#a02020'; // Schema-Drift / Datenfehler

// Risikoklasse-Tokens (Ampel-Semantik aus risikoklasse-berechnung.ts).
// Die Hintergrundfarbe ist eine pastellige Tinte, damit Druckkosten und
// Kontrast in Schwarz-Weiß-Druck akzeptabel bleiben.
const RISIKO_BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  ROT: { bg: '#fde2e2', fg: '#a01818', label: 'ROT' },
  GELB: { bg: '#fff4d6', fg: '#8a6500', label: 'GELB' },
  GRUEN: { bg: '#e0f3e3', fg: '#1f6f2c', label: 'GRÜN' },
};

/**
 * pdfkit-basierte Implementierung des `IEigenschutzVorfallPdfRenderer`
 * (Story 5.4, FR34/AR13).
 *
 * Self-contained: liest ausschließlich aus dem Aggregate + dem darin
 * eingebetteten `kontextSnapshot`. Keine Live-Joins, keine Repository-
 * Aufrufe, keine I/O.
 *
 * **PII-Hygiene:** alle technischen Identifier (User-IDs, Einsatz-ID,
 * Vorfall-ID) werden via `redactId(id, 8)` redacted und niemals klar
 * geschrieben. Klar-Personennamen aus dem Freitext-Pfad der Beteiligten
 * (`kind: 'freitext'`, `name`/`rolle`) sind als Bestandteil des Unfallkassen-
 * Pflichtformats erlaubt und werden bewusst klar gerendert (PO-Decision
 * Code-Review 2026-05-07, D2). Eingaben sind vom Aggregate validiert.
 *
 * **Redesign 2026-05-12 (G5):** Visuelles Polish — Brand-Header mit
 * farbigem Akzentbalken, persistenter Seitenfuß mit Seitenzahl, farbcodierte
 * Risiko-Badges, Unfallkasse-Pill, zweispaltiges Metadaten-Grid.
 * Text-Asserts aus dem bestehenden Test-Vertrag (Story 5.4 AC2 Tests 4, 5,
 * 6, 7, 8) sowie NFR-P5 (p95 < 5 s, Worst-Case 100 Gefährdungen) bleiben
 * eingehalten — die optischen Verbesserungen rendern primär mit
 * Vektor-Primitiven (rect/lineTo), die billig sind und kaum auf Wallclock
 * durchschlagen.
 */
@Injectable()
export class EigenschutzVorfallPdfRenderer implements IEigenschutzVorfallPdfRenderer {
  constructor(
    @Optional() private readonly options: EigenschutzVorfallPdfRendererOptions = {},
    @Optional() @Inject(LOGGER) private readonly logger?: ILogger,
  ) {}

  generate(input: EigenschutzVorfallPdfInput): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      try {
        const compress = this.options.compress ?? true;
        const chunks: Buffer[] = [];
        const doc = new PDFDocument({
          size: 'A4',
          compress,
          bufferPages: true,
          // Reserviere unteren Footer-Bereich, damit pdfkit automatische
          // Seitenumbrüche oberhalb der Footer-Zone vornimmt. `margin`
          // (skalar) und `margins` (Objekt) schließen sich aus — wir
          // nutzen `margins`, weil der Footer-Reserve unten asymmetrisch ist.
          margins: {
            top: PAGE_MARGIN,
            bottom: PAGE_MARGIN + FOOTER_RESERVED_HEIGHT,
            left: PAGE_MARGIN,
            right: PAGE_MARGIN,
          },
        });

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err: Error) => reject(err));

        this.renderBrandHeader(doc, input);
        this.renderVorfallMetadaten(doc, input.vorfall);
        this.renderSnapshotHeader(doc, input.vorfall.kontextSnapshot);
        this.renderGefaehrdungsblock(doc, input.vorfall.kontextSnapshot);
        this.renderPsaProfilBlock(doc, input.vorfall.kontextSnapshot);
        this.renderSicherheitsregelnBlock(doc, input.vorfall.kontextSnapshot);

        // Persistenten Footer + Seitenzahlen über alle Seiten hinweg legen.
        this.renderPersistentFooter(doc, input);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Header & Branding
  // ────────────────────────────────────────────────────────────────────────

  private renderBrandHeader(doc: PDFKit.PDFDocument, input: EigenschutzVorfallPdfInput): void {
    const einsatzRedact = safeRedact(input.vorfall.einsatzId);
    const vorfallRedact = safeRedact(input.vorfall.id.value);

    // Linker Akzentbalken (4 pt breit, volle Header-Höhe) signalisiert
    // Dokumentcharakter und gibt der Seite optisches Gewicht.
    const headerTop = PAGE_MARGIN;
    const headerHeight = 56;
    doc.save();
    doc.rect(PAGE_MARGIN, headerTop, 4, headerHeight).fill(COLOR_PRIMARY);
    doc.restore();

    const textLeft = PAGE_MARGIN + 16;

    doc
      .fillColor(COLOR_PRIMARY)
      .font('Helvetica-Bold')
      .fontSize(20)
      .text('Vorfall-Meldung Eigenschutz', textLeft, headerTop + 4, {
        width: CONTENT_WIDTH - 16,
      });

    doc
      .fillColor(COLOR_MUTED)
      .font('Helvetica')
      .fontSize(10)
      .text(`Einsatz ${einsatzRedact}  ·  Vorfall ${vorfallRedact}`, textLeft, headerTop + 32, {
        width: CONTENT_WIDTH - 16,
      });

    // Rechte Spalte: Dokumenttyp + Erzeugungsdatum (Quick-Scan-Marker für
    // Sachbearbeiter:innen der Unfallkasse).
    const rightColX = PAGE_MARGIN + CONTENT_WIDTH - 180;
    doc
      .fillColor(COLOR_MUTED)
      .font('Helvetica')
      .fontSize(8)
      .text('UNFALLKASSEN-MELDUNG', rightColX, headerTop + 6, {
        width: 180,
        align: 'right',
      });
    doc
      .fillColor(COLOR_TEXT)
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(formatDateTime(input.erzeugtAm), rightColX, headerTop + 20, {
        width: 180,
        align: 'right',
      });
    doc
      .fillColor(COLOR_MUTED)
      .font('Helvetica')
      .fontSize(8)
      .text('Erzeugungszeitpunkt', rightColX, headerTop + 34, {
        width: 180,
        align: 'right',
      });

    // Untere Trennlinie unterhalb des Header-Bereichs.
    const lineY = headerTop + headerHeight + 4;
    doc
      .strokeColor(COLOR_BORDER)
      .lineWidth(0.5)
      .moveTo(PAGE_MARGIN, lineY)
      .lineTo(PAGE_MARGIN + CONTENT_WIDTH, lineY)
      .stroke();

    doc.fillColor(COLOR_TEXT).font('Helvetica');
    doc.y = lineY + 14;
    doc.x = PAGE_MARGIN;
  }

  // ────────────────────────────────────────────────────────────────────────
  // Section-Header (wiederverwendbarer Block-Titel mit farbigem Akzent)
  // ────────────────────────────────────────────────────────────────────────

  private renderSectionTitle(doc: PDFKit.PDFDocument, title: string): void {
    this.ensureRoom(doc);
    const y = doc.y;
    // Schmaler vertikaler Akzent (3 pt), 14 pt hoch.
    doc.save();
    doc.rect(PAGE_MARGIN, y + 2, 3, 14).fill(COLOR_PRIMARY);
    doc.restore();

    doc
      .fillColor(COLOR_PRIMARY)
      .font('Helvetica-Bold')
      .fontSize(13)
      .text(title, PAGE_MARGIN + 10, y, { width: CONTENT_WIDTH - 10 });

    doc.fillColor(COLOR_TEXT).font('Helvetica').fontSize(10);
    doc.moveDown(0.3);
    doc.x = PAGE_MARGIN;
  }

  // ────────────────────────────────────────────────────────────────────────
  // Vorfall-Metadaten — zweispaltiges Label/Wert-Grid + Unfallkasse-Pill
  // ────────────────────────────────────────────────────────────────────────

  private renderVorfallMetadaten(doc: PDFKit.PDFDocument, vorfall: EigenschutzVorfall): void {
    this.renderSectionTitle(doc, 'Vorfall-Daten');

    // Hintergrund-Karte für Metadaten-Grid.
    const cardTop = doc.y;
    const labelColWidth = 140;
    const valueColWidth = CONTENT_WIDTH - labelColWidth - 20;

    interface Row {
      label: string;
      value: string;
      muted?: boolean;
    }
    const rows: Row[] = [
      { label: 'Wann (gemeldet)', value: formatDateTime(vorfall.wann) },
      { label: 'Vorfallzeit', value: formatDateTime(vorfall.vorfallZeit) },
      { label: 'Wo', value: formatWo(vorfall) },
      { label: 'Was', value: vorfall.was },
      {
        label: 'Maßnahmen',
        value: vorfall.massnahmen && vorfall.massnahmen.trim().length > 0 ? vorfall.massnahmen : '—',
        muted: !vorfall.massnahmen || vorfall.massnahmen.trim().length === 0,
      },
      {
        label: 'Erfasst durch',
        value: `Nutzer-ID ${safeRedact(vorfall.erfasstVonUserId)}`,
      },
    ];

    // Schätze Card-Höhe konservativ (für Hintergrund-Rect).
    // Setze die Font-Metriken auf 10 pt, damit `heightOfString` korrekt misst.
    doc.font('Helvetica').fontSize(10);
    let cursor = cardTop + 10;
    for (const row of rows) {
      const valueHeight = doc.heightOfString(row.value, { width: valueColWidth });
      cursor += Math.max(14, valueHeight) + 4;
    }
    // +Pill-Zeile + Beteiligte-Header
    cursor += 22;
    const cardHeight = cursor - cardTop;

    doc.save();
    doc.roundedRect(PAGE_MARGIN, cardTop, CONTENT_WIDTH, cardHeight, 4).fillAndStroke(COLOR_PRIMARY_SOFT, COLOR_BORDER);
    doc.restore();

    let y = cardTop + 10;
    for (const row of rows) {
      doc
        .fillColor(COLOR_MUTED)
        .font('Helvetica')
        .fontSize(9)
        .text(row.label, PAGE_MARGIN + 12, y + 1, { width: labelColWidth - 8 });
      doc
        .fillColor(row.muted ? COLOR_MUTED : COLOR_TEXT)
        .font('Helvetica')
        .fontSize(10)
        .text(row.value, PAGE_MARGIN + labelColWidth + 4, y, { width: valueColWidth });
      const valueHeight = doc.heightOfString(row.value, { width: valueColWidth });
      y += Math.max(14, valueHeight) + 4;
    }

    // Unfallkasse-relevant: Pill-Badge mit klarer Ja/Nein-Semantik.
    const pillLabel = vorfall.unfallkasseRelevant ? 'Unfallkasse-relevant: ja' : 'Unfallkasse-relevant: nein';
    this.renderPill(doc, PAGE_MARGIN + 12, y, pillLabel, {
      bg: vorfall.unfallkasseRelevant ? '#fde2e2' : '#e0f3e3',
      fg: vorfall.unfallkasseRelevant ? '#a01818' : '#1f6f2c',
    });

    doc.x = PAGE_MARGIN;
    doc.y = cardTop + cardHeight + 10;

    // Beteiligte-Liste — separater Block direkt unter der Karte.
    doc.fillColor(COLOR_TEXT).font('Helvetica-Bold').fontSize(10).text('Beteiligte:', PAGE_MARGIN, doc.y, { width: CONTENT_WIDTH });
    doc.moveDown(0.2);

    const beteiligte = vorfall.beteiligte;
    if (beteiligte.length === 0) {
      doc.fillColor(COLOR_MUTED).font('Helvetica-Oblique').fontSize(10).text('  Keine Beteiligten erfasst.', PAGE_MARGIN, doc.y);
    } else {
      doc.font('Helvetica').fontSize(10).fillColor(COLOR_TEXT);
      for (const entry of beteiligte) {
        doc.text(`  •  ${formatBeteiligter(entry)}`, PAGE_MARGIN, doc.y, { width: CONTENT_WIDTH });
      }
    }
    doc.moveDown(0.8);
    doc.fillColor(COLOR_TEXT).font('Helvetica');
  }

  // ────────────────────────────────────────────────────────────────────────
  // Snapshot-Header
  // ────────────────────────────────────────────────────────────────────────

  private renderSnapshotHeader(doc: PDFKit.PDFDocument, snapshot: Record<string, unknown>): void {
    if (isEmptySnapshot(snapshot)) {
      this.renderSectionTitle(doc, 'Kontext-Snapshot');
      doc.fillColor(COLOR_MUTED).font('Helvetica-Oblique').fontSize(10).text('Kontext-Snapshot nicht verfügbar (Vorfall vor Story 5.2 erfasst).', PAGE_MARGIN, doc.y, {
        width: CONTENT_WIDTH,
      });
      doc.fillColor(COLOR_TEXT).font('Helvetica');
      doc.moveDown(0.8);
      return;
    }

    const snapshotAt = readString(snapshot.snapshotAt);
    const heading = snapshotAt ? `Stand zum Vorfall-Zeitpunkt · ${formatDateTimeFromIso(snapshotAt)}` : 'Stand zum Vorfall-Zeitpunkt';
    this.renderSectionTitle(doc, heading);
  }

  // ────────────────────────────────────────────────────────────────────────
  // Gefährdungsbeurteilung — pro Item: Titel + Risiko-Badge + Beschreibung
  // ────────────────────────────────────────────────────────────────────────

  private renderGefaehrdungsblock(doc: PDFKit.PDFDocument, snapshot: Record<string, unknown>): void {
    if (isEmptySnapshot(snapshot)) return;
    this.renderSubsectionTitle(doc, 'Gefährdungsbeurteilung (zum Vorfall-Zeitpunkt)');

    const gefRaw = snapshot.gefaehrdungsbeurteilung;
    if (gefRaw !== undefined && (gefRaw === null || typeof gefRaw !== 'object' || Array.isArray(gefRaw))) {
      this.logger?.warn?.('EigenschutzVorfallPdfRenderer: gefaehrdungsbeurteilung hat unerwartete Form — Schema-Drift erkannt');
      this.renderDriftBanner(doc, 'Gefährdungsbeurteilung: Daten-Format nicht lesbar (Schema-Drift)');
      return;
    }
    const gef = gefRaw as Record<string, unknown> | undefined;
    if (!gef) {
      this.renderMutedNote(doc, 'Keine Gefährdungsbeurteilung im Snapshot.');
      return;
    }
    if (gef.items !== undefined && !Array.isArray(gef.items)) {
      this.logger?.warn?.('EigenschutzVorfallPdfRenderer: gefaehrdungsbeurteilung.items ist kein Array — Schema-Drift erkannt');
      this.renderDriftBanner(doc, 'Gefährdungs-Items: Daten-Format nicht lesbar (Schema-Drift)');
      return;
    }
    const items = Array.isArray(gef.items) ? (gef.items as ReadonlyArray<Record<string, unknown>>) : [];
    if (items.length === 0) {
      this.renderMutedNote(doc, 'Keine Gefährdungs-Items im Snapshot.');
      return;
    }

    for (const item of items) {
      this.ensureRoom(doc);
      const title = readString(item.title) ?? '(ohne Titel)';
      const risikoklasse = readString(item.risikoklasse);

      // Zeile 1: Bullet + Titel + Risiko-Badge (rechts).
      const rowTop = doc.y;
      doc
        .fillColor(COLOR_TEXT)
        .font('Helvetica-Bold')
        .fontSize(10.5)
        .text(`•  ${title}`, PAGE_MARGIN, rowTop, { width: CONTENT_WIDTH - 110 });

      if (risikoklasse && RISIKO_BADGE[risikoklasse]) {
        const badge = RISIKO_BADGE[risikoklasse];
        this.renderPill(doc, PAGE_MARGIN + CONTENT_WIDTH - 90, rowTop, badge.label, {
          bg: badge.bg,
          fg: badge.fg,
        });
      }

      doc.font('Helvetica').fontSize(9.5);

      const description = readString(item.description);
      if (description) {
        doc.fillColor(COLOR_TEXT).text(description, PAGE_MARGIN + 16, doc.y, { width: CONTENT_WIDTH - 16 });
      }
      const eintritt = readString(item.eintritt);
      const schaden = readString(item.schaden);
      const risikoLine: string[] = [];
      if (eintritt) risikoLine.push(`Eintritt: ${eintritt}`);
      if (schaden) risikoLine.push(`Schaden: ${schaden}`);
      if (risikoklasse && !RISIKO_BADGE[risikoklasse]) {
        // Falls Risikoklasse außerhalb der bekannten Tokens liegt, als Text mitführen.
        risikoLine.push(`Risikoklasse: ${risikoklasse}`);
      }
      if (risikoLine.length > 0) {
        doc.fillColor(COLOR_MUTED).text(risikoLine.join('  ·  '), PAGE_MARGIN + 16, doc.y, { width: CONTENT_WIDTH - 16 });
      }
      const massnahmen = readString(item.schutzmassnahmen);
      if (massnahmen) {
        doc.fillColor(COLOR_TEXT).text(`Schutzmaßnahmen: ${massnahmen}`, PAGE_MARGIN + 16, doc.y, { width: CONTENT_WIDTH - 16 });
      }
      doc.moveDown(0.35);
    }
    doc.fillColor(COLOR_TEXT).font('Helvetica');
    doc.moveDown(0.4);
  }

  // ────────────────────────────────────────────────────────────────────────
  // Aktive PSA-Profile
  // ────────────────────────────────────────────────────────────────────────

  private renderPsaProfilBlock(doc: PDFKit.PDFDocument, snapshot: Record<string, unknown>): void {
    if (isEmptySnapshot(snapshot)) return;
    this.renderSubsectionTitle(doc, 'Aktive PSA-Profile waren');

    const profile = snapshot.aktivePsaProfile;
    if (profile !== undefined && !Array.isArray(profile)) {
      // Defense-in-Depth: Schema-Drift in DB-JSONB darf den PDF-Pfad nicht killen.
      this.logger?.warn?.('EigenschutzVorfallPdfRenderer: aktivePsaProfile ist kein Array — Schema-Drift erkannt');
      this.renderDriftBanner(doc, 'PSA-Profile: Daten-Format nicht lesbar (Schema-Drift)');
      return;
    }
    const list = Array.isArray(profile) ? (profile as ReadonlyArray<Record<string, unknown>>) : [];
    if (list.length === 0) {
      this.renderMutedNote(doc, 'Keine aktiven PSA-Profile im Snapshot.');
      return;
    }
    for (const entry of list) {
      this.ensureRoom(doc);
      const name = readString(entry.profil) ?? '(unbekannt)';
      const gueltigVon = readString(entry.gueltigVon);
      const seit = gueltigVon ? formatDateTimeFromIso(gueltigVon) : '—';
      doc.fillColor(COLOR_TEXT).font('Helvetica-Bold').fontSize(10).text(`•  Profil ${name}`, PAGE_MARGIN, doc.y, { width: CONTENT_WIDTH, continued: true });
      doc.font('Helvetica').fillColor(COLOR_MUTED).fontSize(9.5).text(`   ·  seit ${seit}`, { width: CONTENT_WIDTH });
    }
    doc.fillColor(COLOR_TEXT).font('Helvetica');
    doc.moveDown(0.4);
  }

  // ────────────────────────────────────────────────────────────────────────
  // Sicherheitsregeln (zugewiesen zum Vorfall-Zeitpunkt)
  // ────────────────────────────────────────────────────────────────────────

  private renderSicherheitsregelnBlock(doc: PDFKit.PDFDocument, snapshot: Record<string, unknown>): void {
    if (isEmptySnapshot(snapshot)) return;
    this.renderSubsectionTitle(doc, 'Sicherheitsregeln (zugewiesen zum Vorfall-Zeitpunkt)');

    const regeln = snapshot.sicherheitsregeln;
    if (regeln !== undefined && !Array.isArray(regeln)) {
      this.logger?.warn?.('EigenschutzVorfallPdfRenderer: sicherheitsregeln ist kein Array — Schema-Drift erkannt');
      this.renderDriftBanner(doc, 'Sicherheitsregeln: Daten-Format nicht lesbar (Schema-Drift)');
      return;
    }
    const list = Array.isArray(regeln) ? (regeln as ReadonlyArray<Record<string, unknown>>) : [];
    if (list.length === 0) {
      this.renderMutedNote(doc, 'Keine zugeordneten Sicherheitsregeln im Snapshot.');
      return;
    }
    for (const regel of list) {
      this.ensureRoom(doc);
      const titel = readString(regel.titel) ?? '(ohne Titel)';
      doc.fillColor(COLOR_TEXT).font('Helvetica-Bold').fontSize(10.5).text(`•  ${titel}`, PAGE_MARGIN, doc.y, { width: CONTENT_WIDTH });

      const inhalt = readString(regel.inhalt);
      if (inhalt) {
        // Trim-Spec aus Story 5.4 AC4 #6 (200 Zeichen + Ellipsis).
        const trimmed = inhalt.length > 200 ? `${inhalt.slice(0, 200)}…` : inhalt;
        doc
          .font('Helvetica')
          .fontSize(9.5)
          .fillColor(COLOR_TEXT)
          .text(trimmed, PAGE_MARGIN + 16, doc.y, { width: CONTENT_WIDTH - 16 });
      }
      // Quittungspflicht ist nicht direkt im V1-Schema — `einsatzweit === false`
      // entspricht einer einheitsspezifischen Zuweisung (faktisch Quittungspflicht
      // im Eigenschutz-Kontext). Default-Annahme: jede zugewiesene Regel ist
      // quittungspflichtig. Disclaimer am Block-Ende klärt das gegenüber der
      // Unfallkasse (PO-Decision Code-Review 2026-05-07, D1).
      const einsatzweit = typeof regel.einsatzweit === 'boolean' ? (regel.einsatzweit as boolean) : false;
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(COLOR_MUTED)
        .text(`Quittungspflicht: ${einsatzweit ? 'nein (einsatzweit)' : 'ja'}`, PAGE_MARGIN + 16, doc.y, { width: CONTENT_WIDTH - 16 });
      doc.moveDown(0.3);
    }

    doc.moveDown(0.1);
    doc
      .font('Helvetica-Oblique')
      .fontSize(8)
      .fillColor(COLOR_MUTED)
      .text(
        'Hinweis: Der Quittungspflicht-Marker ist aus dem Geltungsbereich der Regel ' +
          'abgeleitet (einsatzweit ⇒ keine Einzelquittung) und stellt keine verbindliche ' +
          'Compliance-Aussage dar. Maßgeblich ist der jeweilige Regel-Versionsstand zum ' +
          'Vorfall-Zeitpunkt.',
        PAGE_MARGIN,
        doc.y,
        { width: CONTENT_WIDTH },
      );
    doc.fillColor(COLOR_TEXT).font('Helvetica').fontSize(10);
    doc.moveDown(0.4);
  }

  // ────────────────────────────────────────────────────────────────────────
  // Persistenter Footer + Seitenzahlen (zum Schluss über bufferPages legen)
  // ────────────────────────────────────────────────────────────────────────

  private renderPersistentFooter(doc: PDFKit.PDFDocument, input: EigenschutzVorfallPdfInput): void {
    const erzeugtAm = formatDateTime(input.erzeugtAm);
    const callerRedact = safeRedact(input.erzeugtVonUserId);
    const einsatzRedact = safeRedact(input.vorfall.einsatzId);
    const permissionLine = `Erzeugt am ${erzeugtAm}  ·  Nutzer-ID ${callerRedact}  ·  ` + `Permission eigenschutz:vorfall:export  ·  Einsatz ${einsatzRedact}`;

    const range = doc.bufferedPageRange();
    const total = range.count;
    const pageBottomY = doc.page?.height ? doc.page.height - PAGE_MARGIN - 40 : 760;

    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      // Trennlinie über dem Footer.
      doc
        .strokeColor(COLOR_BORDER)
        .lineWidth(0.5)
        .moveTo(PAGE_MARGIN, pageBottomY)
        .lineTo(PAGE_MARGIN + CONTENT_WIDTH, pageBottomY)
        .stroke();

      doc
        .fillColor(COLOR_MUTED)
        .font('Helvetica')
        .fontSize(7.5)
        .text(permissionLine, PAGE_MARGIN, pageBottomY + 6, {
          width: CONTENT_WIDTH - 80,
          align: 'left',
          lineBreak: false,
          ellipsis: true,
        });
      doc
        .fillColor(COLOR_MUTED)
        .font('Helvetica')
        .fontSize(7.5)
        .text(`Seite ${i - range.start + 1} / ${total}`, PAGE_MARGIN + CONTENT_WIDTH - 80, pageBottomY + 6, {
          width: 80,
          align: 'right',
          lineBreak: false,
        });
    }
    doc.fillColor(COLOR_TEXT).font('Helvetica');
  }

  // ────────────────────────────────────────────────────────────────────────
  // Render-Primitive (Pill, Subsection-Titel, Drift-Banner, Muted-Note)
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Erzwingt einen Seitenumbruch, wenn der aktuelle Cursor zu nah an der
   * Footer-Reserve liegt. pdfkit umbricht innerhalb von `text(...)`
   * automatisch, aber direkt gezeichnete Vektor-Primitive (rect/lineTo)
   * ignorieren die Margin-Grenze — daher diese manuelle Schwelle vor
   * Bullet-Blöcken und Section-Titeln.
   */
  private ensureRoom(doc: PDFKit.PDFDocument): void {
    if (doc.y > PAGE_BREAK_THRESHOLD) {
      doc.addPage();
    }
  }

  private renderPill(doc: PDFKit.PDFDocument, x: number, y: number, label: string, colors: { bg: string; fg: string }): void {
    const padX = 8;
    const padY = 3;
    doc.font('Helvetica-Bold').fontSize(9);
    const textWidth = doc.widthOfString(label);
    const pillWidth = textWidth + padX * 2;
    const pillHeight = 14;
    doc.save();
    doc.roundedRect(x, y, pillWidth, pillHeight, 7).fill(colors.bg);
    doc.restore();
    doc.fillColor(colors.fg).text(label, x + padX, y + padY, { width: textWidth, lineBreak: false });
    doc.fillColor(COLOR_TEXT).font('Helvetica');
  }

  private renderSubsectionTitle(doc: PDFKit.PDFDocument, title: string): void {
    this.ensureRoom(doc);
    doc.fillColor(COLOR_PRIMARY).font('Helvetica-Bold').fontSize(11).text(title, PAGE_MARGIN, doc.y, { width: CONTENT_WIDTH });
    doc.moveDown(0.2);
    doc.fillColor(COLOR_TEXT).font('Helvetica').fontSize(10);
  }

  private renderDriftBanner(doc: PDFKit.PDFDocument, message: string): void {
    const y = doc.y;
    doc.save();
    doc.roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, 18, 3).fillAndStroke('#fde2e2', COLOR_WARN);
    doc.restore();
    doc
      .fillColor(COLOR_WARN)
      .font('Helvetica-Bold')
      .fontSize(9.5)
      .text(message, PAGE_MARGIN + 10, y + 4, { width: CONTENT_WIDTH - 20, lineBreak: false });
    doc.fillColor(COLOR_TEXT).font('Helvetica').fontSize(10);
    doc.y = y + 22;
    doc.x = PAGE_MARGIN;
    doc.moveDown(0.4);
  }

  private renderMutedNote(doc: PDFKit.PDFDocument, message: string): void {
    doc.fillColor(COLOR_MUTED).font('Helvetica-Oblique').fontSize(10).text(`  ${message}`, PAGE_MARGIN, doc.y, { width: CONTENT_WIDTH });
    doc.fillColor(COLOR_TEXT).font('Helvetica');
    doc.moveDown(0.4);
  }
}

function safeRedact(id: string | null | undefined): string {
  return redactId(id, REDACT_LENGTH) ?? '—';
}

function formatDateTime(date: Date): string {
  return format(date, 'dd.MM.yyyy HH:mm', { locale: de });
}

function formatDateTimeFromIso(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return formatDateTime(date);
}

function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function isEmptySnapshot(snapshot: Record<string, unknown> | null | undefined): boolean {
  if (!snapshot || typeof snapshot !== 'object') return true;
  return Object.keys(snapshot).length === 0;
}

function formatWo(vorfall: EigenschutzVorfall): string {
  const wo = vorfall.wo;
  if (wo === null) return '—';
  const props = wo.toJSON();
  if (props.kind === 'coordinate') {
    const lat = props.latitude.toFixed(5);
    const lon = props.longitude.toFixed(5);
    const hint = props.addressHint ? ` (${props.addressHint})` : '';
    return `Lat: ${lat}, Lon: ${lon}${hint}`;
  }
  return props.text;
}

function formatBeteiligter(entry: BeteiligterProps): string {
  if (entry.kind === 'einsatzPerson') {
    const rolle = entry.rolle ? ` (${entry.rolle})` : '';
    return `EinsatzPerson-ID ${safeRedact(entry.einsatzPersonId)}${rolle}`;
  }
  const rolle = entry.rolle ? ` (${entry.rolle})` : '';
  return `${entry.name}${rolle}`;
}
