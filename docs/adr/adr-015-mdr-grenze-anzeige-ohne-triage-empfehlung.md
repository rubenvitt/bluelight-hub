# ADR-015: MDR-Grenze — Patienten-Dashboard ist Anzeige-Tool ohne Triage-Empfehlung

## Status

Akzeptiert (2026-05-19) — Vormerkung aus PRD `_bmad-output/planning-artifacts/prd.md` formalisiert; Pflicht-Architekturprinzip für Issue #417 (Patienten-Dashboard im Einsatz) und alle nachfolgenden Patienten-, MANV- und klinischen Stories.

## Kontext

Mit dem Patienten-Dashboard im Einsatz (Issue #417) erweitert Bluelight Hub seinen Funktionsumfang um Sichtungs- und Behandlungsstatus von Patienten am Behandlungsplatz (BHP). Damit bewegt sich das System in die Nähe der **Medizinprodukte-Verordnung (Medical Devices Regulation, EU 2017/745, MDR)** und der ihr zugrundeliegenden Risikoklassen.

### Regulatorischer Rahmen

Software fällt unter die MDR, sobald sie eine **medizinische Zweckbestimmung** im Sinne von Art. 2 Nr. 1 MDR erfüllt — typischerweise „Diagnose, Verhütung, Überwachung, Vorhersage, Prognose, Behandlung oder Linderung von Krankheiten". Die Klassifizierung erfolgt nach Anhang VIII MDR.

Für klinische Software ist **Regel 11** (Anhang VIII, Abschnitt 6.3) entscheidend:

> „Software, die dazu bestimmt ist, Informationen zu liefern, die zu Entscheidungen für diagnostische oder therapeutische Zwecke herangezogen werden, gehört zur Klasse IIa, es sei denn, diese Entscheidungen haben Auswirkungen, die [...] den Tod oder eine irreversible Verschlechterung des Gesundheitszustandes einer Person verursachen können — in diesem Fall gehört sie zur Klasse III."

Triage-Algorithmen (mSTaRT, PRIOR, SIEVE, START etc.) liefern genau solche „Informationen für therapeutische Entscheidungen". Im MANV-Kontext wirken diese Entscheidungen unmittelbar auf Behandlungs- und Transportprioritäten lebenskritisch verletzter Personen. Eine MDR-Klassifizierung läge realistisch bei **mindestens Klasse IIa, mit Argumenten für Klasse III** (irreversible Verschlechterung bei Fehlsichtung).

### Konsequenzen einer MDR-Klassifizierung

- **Konformitätsbewertungsverfahren** durch eine Benannte Stelle (Anhang IX/X MDR) — typisch 12-18 Monate, sechsstelliger Initialaufwand, jährliche Re-Audits.
- **Qualitätsmanagementsystem** nach ISO 13485 — vollständige Prozess-Dokumentation aller Entwicklungsschritte, Risiko-Management nach ISO 14971, klinische Bewertung.
- **Post-Market-Surveillance** und Vigilance-System mit Meldepflichten an BfArM.
- **UDI-Pflicht** (Unique Device Identification) für jede Software-Version mit Datenbank-Eintrag in EUDAMED.
- **Klinische Bewertung** und ggf. klinische Prüfung der Triage-Algorithmen vor Inverkehrbringung.

Für eine ehrenamtlich getragene HiOrg-Plattform mit Open-Vendor-Anspruch ist diese Hürde **prohibitiv**. Kein Kreisverband eines DRK-, JUH-, MHD-, ASB- oder DLRG-Verbands würde ein Klasse-IIa-Medizinprodukt anschaffen, betreiben, validieren und in den Versorgungsalltag integrieren — schon gar nicht in den ersten 6-12 Monaten nach MVP-Release.

### Marktbeobachtung

Bestehende Wettbewerber wählen unterschiedliche Pfade:

| Produkt | MDR-Status (Stand 2026-05) | Konsequenz |
|---|---|---|
| **NIDAmanv** (medDV / RKiSH-Welt) | CE-zertifiziertes Medizinprodukt | Vollwertige Triage-Algorithmen, aber proprietäre Hardware, hohe Beschaffungshürde, RD-zentrisch |
| **Fireboard** (Fireboard GmbH) | Kein Medizinprodukt — Stabsführungs-Software | Keine Triage-Empfehlung, dafür HiOrg-/BOS-tauglich, aber stab-zentrisch nicht BHP-zentrisch |
| **CommandX** (Eurocommand) | CE-zertifiziertes Medizinprodukt | Vollwertige Triage, aber Klinik-/Großschadens-Fokus, weniger Field-First |
| **IVENA-MANV-App** | Nicht-medizinisch (Klinik-Kapazitäts-Interface) | Schnittstelle zur Klinikseite, keine Triage |

Die Marktlücke „BHP-first, HiOrg-tauglich, unter MDR-Schwelle" ist real und groß. Bluelight Hub positioniert sich bewusst in dieser Lücke.

### Verifizierte Auslegungs-Grundlagen

- Erwägungsgrund 19 MDR macht klar, dass die Zweckbestimmung des Herstellers maßgeblich ist (nicht nur die tatsächliche Verwendung).
- **MDCG 2019-11** (Medical Device Coordination Group, „Guidance on Qualification and Classification of Software in Regulation (EU) 2017/745"): Software, die Daten **lediglich speichert, archiviert, kommuniziert, durchsucht oder ohne medizinische Bedeutung darstellt**, fällt **nicht** unter die MDR. Maßgeblich ist, ob die Software „medizinische Entscheidungen" generiert oder unterstützt.
- **BfArM-Orientierungshilfe „Medical Apps"** stützt die Linie: reine Dokumentations- und Anzeige-Apps ohne Empfehlungsalgorithmus sind keine Medizinprodukte.
- BSI/Anwaltsberatung-Vorbehalt: Eine endgültige Einstufung erfolgt erst, wenn die Funktionalität konkret realisiert ist; die hier dokumentierte Linie ist eine **Konstruktions-Disziplin**, kein Rechtsgutachten.

## Entscheidung

Das Patienten-Dashboard und alle Folgemodule im klinischen/sanitätsdienstlichen Pfad sind als **reines Anzeige-, Erfassungs- und Dokumentations-Werkzeug ohne algorithmische medizinische Empfehlung** konstruiert. Diese Grenze ist verbindlich und wird als Architekturprinzip in CLAUDE.md sowie in jeder einschlägigen UX-/Komponenten-Spezifikation referenziert.

### Was im Kernprodukt verboten ist

- **Triage-Algorithmen** jeder Art (mSTaRT, PRIOR, SIEVE, START, jSTaRT, CareFlight, SALT etc.) — weder im Backend noch im Frontend, weder als Vorschlag noch als Default-Wert.
- **Algorithmische Reevaluierungs-Auslösung auf medizinischer Basis** — z. B. „Patient sollte aufgrund von Vitalwerten X reevaluiert werden". Zeit-basierte Erinnerungen sind explizit erlaubt (siehe unten).
- **Krankenhauswahl-Empfehlung** — Auswahl der Zielklinik bleibt Entscheidung des Disponenten; die UI darf Klinik-Kapazitäten anzeigen (IVENA-Schnittstelle perspektivisch), aber keine Reihenfolge oder Präferenz vorschlagen.
- **Score-Berechnungen, die wie Vorschläge wirken** — keine APGAR-Scores, keine Glasgow-Coma-Scale-Auto-Berechnung, keine Early-Warning-Scores. Vitalwerte dürfen erfasst und angezeigt werden, aber nicht zu einem aggregierten Empfehlungs-Score verdichtet.
- **AI-gestützte Bildanalyse oder Textinterpretation** für Diagnose- oder Triage-Zwecke — auch nicht „nur als zweite Meinung".
- **Sprachliche Empfehlungen in der UI** wie „sollte", „empfohlen", „kritisch viel/wenig", „besser zuerst" — UX-Spec Schritt 12 dokumentiert eine MDR-Sprach-Allowlist als Konsistenz-Test (`mdr-language.spec.ts`).

### Was explizit erlaubt ist

- **Anzeige strukturierter Daten** — Sichtungskategorien (SK I-IV + Tote), Behandlungsstatus, Transportstatus, KPI-Aggregationen, Patientenlisten, Lagebilder.
- **Erfassung medizinischer Beobachtungen** — Sichtung, Vitalwerte (Atemfrequenz, Bewusstsein, Bewegung als reine Beobachtungen), Behandlungs-Verlauf — solange die Erfassung als reine Dokumentation der Beobachtung des Anwenders erfolgt.
- **Zeit-basierte Erinnerungen** — „Patient #003 (SK Gelb) nicht aktualisiert seit 24 min" als zeitliche Tatsache. Die Schwellen sind Default-konfigurierbar (z. B. SK I: 5 min, SK II: 15 min), aber sie bewerten keinen medizinischen Zustand — sie spiegeln nur die letzte UI-Aktivität.
- **Operative Schwellen-Indikatoren** — „SK-I-Anteil > 30 %" als organisatorische Auffälligkeit (Lagebild-Signal an die Einsatzleitung), nicht als medizinische Empfehlung. Auch hier zeitlich/zählerisch formuliert, nicht „Lage kritisch".
- **Audit-Trail-Vollständigkeit** — Jede Sichtungsentscheidung des LNA wird als Event aufgezeichnet, mit Benutzer-Referenz, Zeitstempel und vorherigem/neuem Zustand. Das ist **Anzeige der menschlichen Entscheidung**, nicht algorithmische Erzeugung.
- **ETB-Verzahnung** — Patientenereignisse als ETB-Einträge (ADR-005), reine Protokoll-Funktion.
- **Push-Benachrichtigungen** für organisatorische Ereignisse (FüKW-Backend verfügbar, neue Standalone-Session bereit zum Anhängen, kritische operative Schwelle erreicht — nicht „Patient X verschlechtert sich").

### Vorgehen bei Grenzfällen

Wenn in einer zukünftigen Story ein Pattern auftaucht, das auch nur entfernt nach „Empfehlung" aussieht, gilt:

1. **Default: ablehnen, neu formulieren** — kann die Information als reine Tatsache (Zahl, Zeit, Zustand) gezeigt werden, ohne dass die UI eine Handlungsanweisung gibt?
2. **Sprach-Audit konsultieren** — `mdr-language.spec.ts` muss grün bleiben (siehe Umsetzungshinweise).
3. **Im Zweifelsfall eskalieren** — Story-PRD pausiert, ADR-Erweiterung oder neue ADR erforderlich; ggf. fachjuristische Beratung einholen, bevor der Code im Repo landet.
4. **Pfadtrennung Post-Vision** — falls Triage-Algorithmen langfristig fachlich gewünscht sind, werden sie als **separates Modul mit eigener MDR-Konformitätsbewertung** entwickelt — niemals als Erweiterung des Kern-Dashboards. Diese Erweiterung wäre eine neue ADR und ein neuer Produkt-Pfad.

## Konsequenzen

### Positiv

- **Niedrige Beschaffungshürde für HiOrgs.** Keine Klasse-IIa-Hürde, kein QMS nach ISO 13485 nötig, keine Benannte-Stelle-Audits. Pilot-Verbände können das Dashboard ohne medizinprodukterechtliche Vorbereitung einsetzen.
- **Schnelle Time-to-Pilot.** MVP-Release ohne klinische Bewertung und ohne UDI-Eintrag möglich.
- **Klare Architektur-Linie** für alle UX-, Komponenten- und Sprach-Entscheidungen — die MDR-Disziplin ist als UX-Pattern und Konsistenz-Test verankert, nicht als Disclaimer im Footer.
- **Open-Vendor-Argument** gegenüber NIDA-/CommandX-Welt: keine proprietären Triage-Algorithmen, keine Hardware-Bindung, transparentes Datenmodell.
- **Schützt Würde der menschlichen Entscheidung.** LNA und OrgL bleiben die fachlich verantwortlichen Akteure; die Software stellt ihnen Information bereit, ersetzt sie nicht.

### Negativ

- **Verzicht auf algorithmische Triage-Hilfe.** Erfahrungsgemäß kann mSTaRT-Unterstützung bei wenig geübten Sichtungs-Helfern Fehlerquoten senken. Diesen Wert geben wir bewusst auf.
- **Konkurrenz-Argumentation:** Mitbewerber können „aber wir haben mSTaRT integriert" als Verkaufsargument anführen. Mitigation: das Wert-Versprechen verschiebt sich auf „field-first, offline-first, BHP-zentrisch, niedrige Hürde" — nicht auf algorithmische Tiefe.
- **Sprach-Disziplin als Daueraufgabe.** Jeder neue UI-String muss gegen die MDR-Sprach-Allowlist geprüft werden — Konsistenz-Test als CI-Gate ist Pflicht, sonst driftet die Linie.
- **Klärungsbedarf bei Beobachtungs-Erfassung.** Vitalwerte erfassen ist erlaubt; daraus ableitende Visualisierungen (z. B. ein Trend-Diagramm mit roter Schwellenlinie) können schon „Empfehlung" implizieren. Story-Level-Bewertung notwendig.
- **Nicht justiziabel ohne anwaltliche Begutachtung.** Diese ADR ist eine Konstruktions-Disziplin, kein Rechtsgutachten. Vor erstem Pilot-Vertrag mit einer HiOrg ist eine schriftliche Zweckbestimmungs-Erklärung sinnvoll, idealerweise anwaltlich gegen-gelesen.

## Alternativen

### 1. Vollwertiges Medizinprodukt mit Klasse-IIa-Zertifizierung

Abgelehnt. Würde 12-18 Monate Zertifizierung, sechsstelligen Initialaufwand und jährliche Audits erfordern. Für eine ehrenamtlich getragene HiOrg-Plattform unverhältnismäßig. NIDAmanv und CommandX haben diesen Pfad gewählt — mit der Folge, dass sie für kleine Kreisverbände schwer zugänglich sind. Das ist genau die Marktlücke, die wir besetzen wollen.

### 2. Triage-Empfehlung mit „nur als Hinweis"-Disclaimer

Abgelehnt. Disclaimer schützen nicht vor MDR-Klassifizierung (Erwägungsgrund 19 stellt auf Zweckbestimmung ab, nicht auf Disclaimer). Außerdem ist ein „nur als Hinweis"-Hint im Stress-Kontext eines MANV faktisch eine Empfehlung — die kognitive Hürde, ihn zu ignorieren, ist hoch.

### 3. Klasse-I-Software (keine Konformitätsbewertung durch Benannte Stelle nötig)

Abgelehnt. Klasse I kommt nur für nicht-aktive, nicht-invasive Software ohne therapeutische Bedeutung in Frage — Triage-Software fällt fast immer in Klasse IIa oder höher. Eine künstliche Reduktion auf Klasse I durch Funktions-Beschneidung würde dieselben Funktionen verbieten wie unsere ADR, aber mit zusätzlichem regulatorischem Overhead (Eigen-Erklärung, technische Dokumentation nach Anhang II/III MDR, post-market-surveillance).

### 4. Separates klinisches Add-On-Modul mit MDR-Zertifizierung

Vorerst abgelehnt, langfristig offen. Falls Pilot-Verbände dezidiert nach algorithmischer Triage-Hilfe fragen, kann ein **getrenntes Modul** als optionales Add-On entwickelt werden, das eine eigene MDR-Konformitätsbewertung durchläuft. Voraussetzung: separates Produkt, separater Vertrieb, separates QMS, separate UDI. Das Kern-Dashboard bleibt unverändert MDR-frei. Diese Trennung wäre ein eigener Architektur- und Geschäftsentscheid mit neuer ADR.

## Umsetzungshinweise

### Sprach-Allowlist als CI-Gate

UX-Spec Schritt 12 definiert eine MDR-konforme Beobachtungs-Sprache. Die Allowlist wird als Konsistenz-Test in jedem klinischen Feature verankert:

```typescript
// packages/frontend/src/features/patient/__tests__/mdr-language.spec.ts
// Scannt UI-Strings nach verbotenen Wortstämmen:
// 'sollte', 'empfohlen', 'kritisch wenig|viel', 'besser zuerst',
// 'bitte reevaluieren', 'priorität sollte', 'empfehlen wir', ...
```

Test ist Pflicht im CI-Gate `features/patient/*` und allen nachfolgenden klinischen Features.

### Architektur-Layering

Die MDR-Disziplin ist eine **Sprach- und UX-Disziplin**, nicht eine Backend-Schicht. Das Backend darf jede Information persistieren (Vitalwerte, Beobachtungen, Reevaluierungs-Zeitstempel). Die Grenze wird **in der UI** gezogen — Anzeigen statt Empfehlen.

Dennoch gilt: Wenn eine Backend-Query auftaucht, deren einziger Zweck es ist, eine Empfehlung zu berechnen (z. B. „nächster zu reevaluierender Patient nach Vitalwert-Trend"), ist das ein Warnzeichen. Solche Queries gehören nicht ins Kern-Backend.

### CLAUDE.md-Verweis

CLAUDE.md wird im Abschnitt „Kritische Regeln" um einen Verweis auf diese ADR erweitert (Editier-Schritt im Rahmen der Token-/Patienten-Story).

### Story-Vorprüfung

Vor jeder neuen klinischen Story (Patient, MANV, klinische Beobachtung, Triage-nah) ist diese ADR explizit zu konsultieren. Story-PRD muss bestätigen, dass:

1. Keine algorithmische Empfehlung erzeugt wird.
2. Die UI-Sprache der Beobachtungs-Linie folgt.
3. Bei Grenzfällen die UX-Spec Schritt 12 Konsistenz-Test grün bleibt.
4. ETB-Events keinen Empfehlungs-Charakter haben.

### Pilot-Vertrag

Vor erstem Pilot-Vertrag mit einer HiOrg empfehlenswert:

- Schriftliche Zweckbestimmungs-Erklärung („Dokumentations- und Anzeige-Werkzeug, kein Medizinprodukt nach MDR")
- Anwaltliche Gegenlesung der Zweckbestimmungs-Formulierung
- Klar benannter Verzicht auf Triage-Empfehlung in der Pilot-Begleitdokumentation
- Hinweis auf MDR-Bewertung als Verantwortung des Herstellers (nicht der HiOrg)

## Referenzen

- [Issue #417 — Patienten-Dashboard im Einsatz](https://github.com/rubenvitt/bluelight-hub/issues/417)
- [PRD: Patienten-Dashboard](../../\_bmad-output/planning-artifacts/prd.md) — Vormerkung MDR-Grenze
- [UX Design Specification](../../\_bmad-output/planning-artifacts/ux-design-specification.md) — Abschnitte „MDR-konforme Beobachtungs-Sprache" + Konsistenz-Test
- [ADR-005: ETB-Eintrag-Kontext als Discriminated Union](./adr-005-etb-eintrag-kontext-discriminated-union.md) — Patienten-Events landen als ETB-Einträge
- [Verordnung (EU) 2017/745 (MDR)](https://eur-lex.europa.eu/eli/reg/2017/745/oj) — insbesondere Art. 2, Anhang VIII Regel 11, Erwägungsgrund 19
- [MDCG 2019-11](https://health.ec.europa.eu/system/files/2020-09/md_mdcg_2019_11_guidance_qualification_classification_software_en_0.pdf) — Auslegungs-Leitfaden Software
- [BfArM-Orientierungshilfe „Medical Apps"](https://www.bfarm.de/DE/Medizinprodukte/_artikel/Orientierungshilfe-Medical-Apps.html)
- [SiKoKo-Glossar 2025](https://www.bbk.bund.de/) — Sichtungs-Begrifflichkeit
- [DIN 13050:2021-10](https://www.beuth.de/de/norm/din-13050/337090797) — Rettungswesen-Begriffe

> **Hinweis:** Diese ADR ist eine technisch-organisatorische Konstruktions-Disziplin. Sie ersetzt keine Rechtsberatung. Bei konkreten Beschaffungs- oder Vertrags-Szenarien ist eine fachjuristische Begutachtung empfohlen.
