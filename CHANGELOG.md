## Performance

- **Deutlich schnellere CI-Pipeline**: Frontend-Tests laufen nun parallel in drei Shards statt nacheinander – die Testzeit wurde von ~8 Minuten auf ~3 Minuten pro Shard reduziert. Backend-Unit-Tests ebenfalls parallelisiert und von 20+ Minuten auf unter 15 Minuten beschleunigt.

- **Performance-Messungen präziser**: Performance-Tests laufen jetzt isoliert von CPU-lastigen Unit-Tests, um Timing-Verfälschungen zu vermeiden und verlässliche Baseline-Messungen zu gewährleisten.

## Sicherheit & Stabilität

- **Wichtiges Sicherheitsupdate**: DOMPurify auf Version 3.4.0 aktualisiert – behebt Cross-Site-Scripting (XSS) und Prototype-Pollution-Sicherheitslücken.

- **Lagekarten-Anzeige verbessert**: MapLibre GL auf Version 5.23.0 aktualisiert – behebt einen Fehler, bei dem Beschriftungen von Polygon-Gefahrenzonen falsch positioniert wurden.

- **Modernere Technologie-Basis**: TypeScript auf Version 6.0.3 aktualisiert – die letzte JavaScript-basierte Version vor dem großen Rewrite in TypeScript 7.

- **Stabilere Dependencies**: 28 sichere Abhängigkeits-Updates ohne Breaking Changes durchgeführt, darunter NestJS, React Query, React Router, Vite und weitere Kernbibliotheken.

## Dokumentation & Projektausrichtung

- **Zielgruppe präzisiert**: Die Dokumentation wurde aktualisiert und stellt nun klar, dass Bluelight Hub speziell für **weiße Hilfsorganisationen** (DRK, JUH, MHD, ASB, DLRG) im Sanitätsdienst und Katastrophenschutz entwickelt wird – nicht für Feuerwehr, Polizei oder Bundeswehr. Die fachliche Ausrichtung auf Betreuungsdienst, MANV und Sanitätswachendienst ist jetzt deutlicher dokumentiert.

- **Neues Modul geplant: Eigenschutz**: Das Produktkonzept für ein Eigenschutz-Modul wurde dokumentiert. Es soll Sicherheitsbeauftragte im Stab bei der Gefährdungsbeurteilung (5×5-Risikomatrix), PSA-Verwaltung, Sicherheitsregeln und Vorfallmeldungen während laufender Einsätze digital unterstützen.

## Gefahrenzonen auf der Lagekarte

Die Lagekarte bietet nun die Möglichkeit, Gefahrenzonen direkt auf der Karte zu zeichnen und zu verwalten. Gefahrenzonen werden farblich nach ihrer Warnstufe (KEINE, NIEDRIG, MITTEL, HOCH, AKUT) dargestellt und sind mit der Gefahrenmatrix verknüpft.

- Gefahrenzonen können als Polygon oder Kreis direkt auf der Karte gezeichnet werden (Tastenkürzel: `g`)
- Beim Zeichnen wird direkt der Gefahrentyp und das bedrohte Schutzobjekt ausgewählt
- Die Warnstufe wird automatisch aus der Gefahrenmatrix übernommen
- Zonen werden in Echtzeit zwischen allen Teilnehmern synchronisiert
- Klick auf eine Zone zeigt Details und erlaubt das Bearbeiten oder Löschen
- Rückgängig-Funktion für versehentlich gelöschte Zonen (Tastenkürzel: `Cmd+Z`, 30 Sekunden Zeit)

## Gefahrenmatrix & Lagekarte im Split-View

Die neue Split-View-Ansicht zeigt Gefahrenmatrix und Lagekarte gleichzeitig und verbindet beide Ansichten nahtlos miteinander.

- Split-View mit Tastenkürzel `Cmd+Shift+G` aktivierbar (ab 1280px Breite)
- Klick auf eine Matrixzelle zeigt die zugehörigen Zonen auf der Karte
- Klick auf eine Zone auf der Karte springt zur entsprechenden Matrixzelle
- Kleine Badges in der Matrix zeigen an, wie viele Zonen räumlich verortet sind
- Warnung bei Matrixzellen mit Warnstufe, aber ohne Verortung auf der Karte
- Automatische Anpassung bei kleinen Bildschirmen

## AKUT-Warnungen in Echtzeit

Bei kritischen Gefahrenlagen werden alle Teilnehmer sofort über AKUT-Bewertungen informiert.

- Sofortige Benachrichtigung mit Ton bei AKUT-Warnstufe in der Gefahrenmatrix
- Dreistufige Eskalation: Toast-Benachrichtigung → Bestätigungs-Dialog → Audio-Signal
- Ton kann optional deaktiviert werden
- Änderungen werden in Echtzeit über alle Clients synchronisiert

## Gefahren-Werkzeuge

Alle Werkzeuge für Gefahrenzonen, GAMS-Symbole und Gefahren-Zeichnungen sind jetzt in einer einheitlichen Seitenleiste zusammengefasst.

- Neue zentrale Seitenleiste für alle Gefahren-Werkzeuge (Zonen / GAMS / Symbole)
- Öffnen über Warn-Icon in der Karten-Toolbar
- Übersichtlichere Bedienung durch Tabs statt einzelner Buttons

## Onboarding & Hilfestellung

Neue Nutzer erhalten eine interaktive Tour durch die Gefahrenzonen-Funktionen.

- Vierstufige Einführung erklärt das Zusammenspiel von Matrix und Karte
- Navigation mit Tastatur und Maus möglich
- Tour wird beim ersten Öffnen der Split-View automatisch angezeigt

## Dokumentation & Entwicklung

- Umfassende Projektdokumentation aktualisiert (Datenmodell, Testing, DevOps, Integrationen)
- Neue Architekturentscheidung zur Verknüpfung von Gefahrenzonen und Matrix (ADR-010)
- Design-System-Dokumentation erweitert
- Performance-Verbesserungen auf der Lagekarte bei vielen taktischen Zeichen
- Fehlerhafte Console-Logs aus Drittbibliothek entfernt
- Docker-Build-Prozess korrigiert

## Workspace-Navigation & Sidebar

Die Sidebar wurde grundlegend überarbeitet und in zwei klare Bereiche unterteilt: **Navigation** (scrollbar, oben) und **Schnellaktionen** (fixiert, unten). Die Command Palette ist nun kompakt am unteren Rand verankert und zeigt in schmaler Ansicht nur das Icon plus ⌘K-Shortcut.

**Modulübersicht:** Ein neuer Button (Raster-Icon) in der Sidebar-Aktionen-Zone öffnet die Modulübersicht direkt – vorher nur über Umwege erreichbar.

**Einsatzwechsel:** Der Einsatz-Switcher wurde aus der Sidebar entfernt. Wechsel zwischen aktiven Einsätzen erfolgt jetzt ausschließlich über die Command Palette in einer eigenen Gruppe „Einsätze". Der aktuelle Einsatz wird dabei ausgeblendet; bei nur einem aktiven Einsatz bleibt die Gruppe versteckt.

**Visuelle Verbesserungen:**

- Aktive Module erhalten einen farbigen Rand (border-left) in der jeweiligen Modulfarbe
- Sub-Seiten werden durch einen farbigen Container gerahmt
- Navigation-Items kompakter gestaltet (mehr Dichte, weniger Leerraum)
- Touch-Targets auf Mobilgeräten automatisch auf mindestens 44×44 px vergrößert
- Badge-Hinweise für unquittierte Befehle aus der Navigation entfernt – die Info bleibt in der Modulübersicht sichtbar

## ETB (Elektronisches Tagebuch)

**Schnelleinstieg:** Ein neuer Primary-Button „ETB-Eintrag" in den Sidebar-Schnellaktionen ermöglicht direkten Zugriff auf das ETB. Globaler Shortcut: **Cmd+Shift+E**. Der Button wurde visuell an andere Primary-Create-Buttons angeglichen (Plus-Icon ohne Kreis, optimierte Abstände).

## Einsatz-Verwaltung

**Command Palette:** Die bisherigen Sidebar-Schnellaktionen „Externe einladen", „Audio-Einstellungen" und „Einsatz beenden" sind jetzt über die Command Palette im neuen Modul „Einsatz" erreichbar. „Einsatz beenden" ist als destruktive Aktion markiert. Die Funktion „Person wählen" wurde entfernt – die Zuordnung erfolgt automatisch über den AssignmentGate.

## Alarmierung

Die Bluelight Hub Desktop & Web App erhält ein komplett neues Alarmierungs-Feature für Einsatzkräfte im Katastrophenschutz:

- **Alarmierungen erstellen und verwalten**: Erfassen Sie Alarmierungen für Fahrzeuge, Personen und Einheiten mit automatischer Zeiterfassung der vier kritischen Zeitpunkte (Alarmiert, Ausgerückt, Vor Ort, Wieder Frei)
- **Automatische FMS-Integration**: Zeitpunkte werden automatisch aus FMS-Statusmeldungen (Status 1-4) übernommen und können bei Bedarf manuell korrigiert werden
- **Reaktionszeit-Tracking**: Übersichtliche Darstellung der Reaktionszeiten mit farbcodierter Anzeige für schnelle Einschätzung der Einsatzbereitschaft
- **Nachalarmierung**: Nachträgliches Hinzufügen weiterer Empfänger zu bestehenden Alarmierungen mit vollständiger Nachvollziehbarkeit
- **Timeline-Ansicht**: Chronologische Übersicht aller Alarmierungs-Events und -Änderungen im Einsatzverlauf
- **Live-Updates**: Echtzeit-Synchronisation zwischen allen geöffneten Fenstern über WebSocket-Verbindungen
- **ETB-Integration**: Alle Alarmierungs-Vorgänge werden automatisch im Elektronischen Tagebuch (ETB) dokumentiert

## Administration

- **Verbesserte Rollenzuweisung**: Administratoren und Super-Administratoren erhalten bei der Erstellung automatisch die operative Rolle "Führungskraft" statt der Standardrolle
- **Fensterübergreifende Synchronisation**: Änderungen an Benutzerverwaltung, Berechtigungen und Sperr-Status werden in der Desktop-App sofort über alle geöffneten Fenster hinweg aktualisiert

## Dokumentation

- Ausführliche Architektur-Dokumentation zum Alarmierungs-Feature mit detaillierter Beschreibung des Domain-Models, der vier Zeitpunkte und der FMS-Integration
- Neuer Architecture Decision Record (ADR-009) zur Trennung zwischen manueller Zeiterfassung und automatischer FMS-Population

## Funkverkehr

### Kanalplan

- Neue Seite zur Verwaltung von Funkkanälen pro Einsatz mit Unterstützung für TMO-Sprechgruppen, DMO-Kanäle und analoge Frequenzen
- Funkkanäle können per Drag & Drop sortiert werden
- Kräfte (Fahrzeuge, Personen, Einheiten) lassen sich Kanälen mit Rufnamen zuordnen
- Status-Verwaltung: Kanäle können aktiviert, deaktiviert oder archiviert werden
- PDF-Export des Kanalplans für die Einsatzdokumentation

### Funkprotokoll

- Funksprüche werden im Einsatztagebuch als separate Kategorie "Kommunikation" erfasst
- Virtualisierte Darstellung für flüssige Performance bei vielen Einträgen
- Zwei Anzeigemodi: Kompakte Tabellenansicht und Chat-Bubble-Darstellung
- Filterung nach Kanal, Priorität, Zeitraum, Absender und Volltext
- Notfall-Funksprüche lösen automatisch visuelle Warnmeldungen für alle Einsatzteilnehmer aus

### Live-Updates

- Echtzeit-Synchronisation über WebSockets: Änderungen am Kanalplan und neue Funksprüche erscheinen sofort bei allen Teilnehmern
- Automatische Wiederverbindung bei Netzwerkunterbrechungen

## Einsatztagebuch

- Einträge können jetzt mit einem Ereigniszeitpunkt versehen werden, der vom Erfassungszeitpunkt abweicht
- Einträge mit Zeitpunkt in der Zukunft (>60s) werden abgelehnt
- Funksprüche werden als ETB-Einträge mit zusätzlichem Kontext (Kanal, Priorität) gespeichert

## Benutzeroberfläche

- Neue einheitliche Formular-Komponenten mit verbesserter Barrierefreiheit und Fokus-Hervorhebung
- Empfänger-Suche zeigt jetzt sofort die Top-20 Ergebnisse beim Öffnen, ohne Mindesteingabe
- Checkbox-, Radio-Button- und Eingabefeld-Komponenten mit konsistentem Design und größerer Klickfläche

## Technische Verbesserungen

- Stabilere automatisierte Tests durch zuverlässigere Zeitpunkt-Validierung
- Optimierte API-Responses mit korrekter Datenstruktur in Frontend-Abfragen

## Fahrzeugverwaltung

- **Neue Kartenansicht**: Die Fahrzeuge-Seite wurde komplett überarbeitet und zeigt nun alle Fahrzeuge in einer übersichtlichen Kachelansicht im Statustableau-Stil
- **FMS-Filter**: Schnelles Filtern der Fahrzeuge nach FMS-Status über neue Tab-Navigation
- **Detailansicht**: Fahrzeugdetails öffnen sich jetzt in einem praktischen Seitenpanel, ohne die Übersicht zu verlassen
- **BOS-konforme Darstellung**: FMS-Statusbezeichnungen und Farbcodierung entsprechen nun dem offiziellen BOS-Standard (Blaulicht-Organisationen)
- **Responsives Design**: Die Kartenansicht passt sich automatisch an verschiedene Bildschirmgrößen an

## Verbesserungen

- Das Zeichen-Panel schließt sich nun automatisch nach der Verwendung

## Zeichenverwaltung

- **Verbesserte Beschriftung von Zeichen**: Labels können nun direkt beim Erstellen von Zeichen im Baukasten vergeben werden und werden korrekt auf der Karte angezeigt
- **Besseres Feedback beim Platzieren**: Nach dem Platzieren von Zeichen auf der Karte erscheint eine Erfolgsmeldung. Falls die Lagekarte noch nicht geladen ist, wird eine verständliche Fehlermeldung angezeigt
- **Unplatzierte Zeichen hervorheben**: Der Bereich für noch nicht platzierte Zeichen ist nun deutlicher als Warnung gestaltet. Im Zeichen-Button der Toolbar wird zudem die Anzahl unplatzierter Zeichen angezeigt
- **Schreibschutz für referenzierte Zeichen**: Die Beschriftung von referenzierten Zeichen kann nicht mehr versehentlich bearbeitet werden

## Sonstiges

- GitHub Sponsors Button für das Projekt aktiviert

## Taktische Zeichen

- **Automatische Zeichen-Erstellung**: Beim Anlegen neuer Einheiten und Fahrzeuge werden jetzt automatisch taktische Zeichen basierend auf Standardvorlagen erstellt
- **Zeichen-Verwaltung**: Taktische Zeichen können pro Einheit und Fahrzeug eingesehen und individuell angepasst werden
- **Verknüpfte Anzeige**: In der Zeichen-Detailansicht werden nun zugehörige Einheiten und Fahrzeuge angezeigt
- **Automatische Bereinigung**: Beim Löschen von Einheiten oder Fahrzeugen werden die zugehörigen taktischen Zeichen automatisch mit entfernt

## Technische Verbesserungen

- Aktualisierung verschiedener Tauri-Plugins auf neuere Versionen für verbesserte Stabilität

## Administration

- Neue Admin-Oberfläche zur Konfiguration von Standard-Zeichen für Einsätze
- Verwaltung von Zeichen über Baukasten und Katalog-Ansicht
- Verbesserte Dark-Mode-Unterstützung in der Sidebar und Zeichen-Vorschau

## Lagekarte & Zeichen

- **Verbesserte Zeichen-Verwaltung**: Zeichen werden jetzt erst beim Klick auf die Karte erstellt und direkt platziert. Das verhindert verwaiste, nicht platzierte Zeichen. In der Sidebar werden unplatzierte Zeichen angezeigt und können nachträglich platziert oder gelöscht werden.
- In den Zeichen-Metadaten werden Benutzer-IDs nun in lesbare Benutzernamen aufgelöst.

## Entwicklung & Tests

- Test-Abdeckung für die Zeichen-Platzierung auf der Karte deutlich verbessert (25 zusätzliche Testfälle).
- Dependency-Updates: Vite 8.0.8, Vitest 4.1.4, NestJS 11.1.19, oxlint 1.59.0 und weitere Entwicklungs-Abhängigkeiten aktualisiert.

## Lagekarte

### Zeichen-Detail-Panel

- Neues Detail-Panel für taktische Zeichen mit umfassenden Informationen und Bearbeitungsmöglichkeiten
- Panel bleibt nicht-modal – die Karte kann weiterhin bedient werden, während Details angezeigt werden
- Sechs übersichtliche Sektionen: Grunddaten, Position, Darstellung, Zeitstempel, Notizen und erweiterte Eigenschaften
- Zeichen können direkt aus dem Panel bearbeitet und gelöscht werden

### Zeichen-Platzierung

- Ghost-Marker zeigt Vorschau beim Platzieren neuer Zeichen
- Optimistische Cache-Updates für flüssigeres Arbeiten – platzierte Zeichen erscheinen sofort auf der Karte
- Verbesserter Zeichen-Katalog und Baukasten mit optimierter Bedienoberfläche

### Kartenoberfläche

- Bessere Platzausnutzung: Lagekarte nutzt verfügbaren Bildschirmplatz optimal aus (~84px mehr Kartenfläche auf Desktop)
- Map-Controls (Zoom +/-) weichen automatisch zur Seite, wenn Detail-Panels geöffnet sind
- Schnellaktionen in der Sidebar bleiben dauerhaft sichtbar am unteren Rand fixiert
- Kompakteres Sidebar-Layout mit reduziertem Spacing
- Flüssigere Animationen durch konsistente Transform-basierte Übergänge
- Mobile-Optimierung durch dynamische Viewport-Einheiten

## Abhängigkeiten

- TanStack-Bibliotheken aktualisiert (React Query, React Router, React Form, React Store)

## Zeichen-Katalog

- Der Zeichen-Katalog wird nun beim Start der Anwendung automatisch mit 149 DV-102-konformen taktischen Zeichen befüllt (Schwerpunkt: Hilfsorganisationen, THW, Feuerwehr)
- Zeichen können jetzt über Tags durchsucht werden – die Suche findet auch Teilübereinstimmungen
- Sortierung erfolgt automatisch nach Kategorie, Organisation und Name für bessere Übersichtlichkeit

## Technische Updates

- React auf Version 19.2.5 aktualisiert
- Prisma-Datenbankschicht auf Version 7.7.0 aktualisiert
- NestJS-Komponenten auf aktuelle Versionen aktualisiert

## Taktische Zeichen (DV 102)

Das Bluelight Hub unterstützt jetzt taktische Zeichen nach DIN 14035 (DV 102) – direkt auf der Lagekarte.

- **Zeichen-Katalog**: Durchsuchbare Bibliothek mit vordefinierten taktischen Zeichen, nach Kategorien sortiert
- **Zeichen-Baukasten**: Geführter 4-Schritt-Editor zum individuellen Erstellen eigener taktischer Zeichen
- **Lagekarten-Integration**: Zeichen werden als Symbole mit Beschriftung direkt auf der Karte angezeigt
- **Drag & Drop**: Taktische Zeichen können per Maus auf der Karte verschoben und neu positioniert werden
- **Kräfte-Verknüpfung**: Einheiten und Fahrzeuge können automatisch mit passenden taktischen Zeichen verknüpft werden
- **Live-Vorschau**: Änderungen an Zeichen werden in Echtzeit im Editor angezeigt
- **Echtzeit-Synchronisation**: Änderungen an taktischen Zeichen werden sofort an alle Nutzer übertragen

## Technische Verbesserungen

- Dependency-Updates für @headlessui/react und axios

## Lagekarte – Zeichenwerkzeuge

- **Neue Zeichenmodi**: Pfeile, Ellipsen und taktische Symbole können jetzt direkt auf der Karte platziert werden
- **Symbol-Bibliothek**: Kategorisierte taktische Symbole für schnellen Zugriff während der Lageerstellung
- **Vorlagen für Formen**: Vordefinierte Zeichenvorlagen für häufig verwendete Elemente
- **Pfeil-Darstellung**: Pfeile werden automatisch mit Pfeilspitzen in korrekter Ausrichtung gerendert, Größe passt sich der Strichstärke an
- **Schneller Punkt-Modus**: Mehrere Markierungen können ohne Moduswechsel nacheinander gesetzt werden
- **Gruppierung**: Mehrere Elemente können gemeinsam ausgewählt und bearbeitet werden
- **Sperrmodus**: Neue Sperr-Funktion verhindert versehentliches Bearbeiten oder Verschieben von Kartenelementen
- **Ellipsen-Bearbeitung**: Proportionales Skalieren beim Ändern der Größe
- **Tastatursteuerung**: ESC-Taste hebt Auswahl auf und kehrt zum normalen Modus zurück
- **Werkzeugleiste**: Übersichtlichere 2-Spalten-Ansicht mit Kategorie-Trennern

## Lagekarte

- **Echtzeit-Kollaboration:** Zeichnungen und Markierungen auf der Lagekarte werden jetzt in Echtzeit zwischen allen Teilnehmern synchronisiert. Änderungen sind sofort für alle sichtbar.
- **Automatische Speicherung:** Der Zustand der Lagekarte wird automatisch gespeichert und beim erneuten Öffnen wiederhergestellt.
- **Verbesserte Stabilität:** Behobene Rendering-Probleme beim Löschen von Elementen und bei der Darstellung von Schraffur-Mustern. Die Karte läuft nun stabiler, auch bei intensiver Nutzung.
- **Kollaborations-Anzeige:** Neuer Indikator zeigt den Verbindungsstatus und aktive Kollaborateure an.

## Lagekarte

**Neue Zeichenwerkzeuge**

- Kreis, Rechteck und Ausbreitungskegel können jetzt per Klick und Ziehen gezeichnet werden
- GAMS-Gefahrenzonen: 4 konzentrische Kreise lassen sich durch Aufziehen oder manuelle Eingabe erstellen
- Vereinfachte Bearbeitung von Kreisen und Sektoren mit einem Resize-Punkt statt vieler Eckpunkte

**Präzise Positionierung**

- Neue Snapping-Funktion zum exakten Ausrichten an bestehenden Punkten (Ein-/Ausschalten mit S-Taste)
- Visueller Indikator zeigt an, wenn Snapping aktiv ist

**Messungen**

- Flächen, Längen und Koordinaten werden während des Zeichnens live angezeigt
- Verbesserte Genauigkeit bei allen Geo-Berechnungen durch Turf.js-Integration
- Präzisere Auswahl von OSM-Features nach Fläche bei überlappenden Objekten

## Lagekarte – Zeichenwerkzeuge

Die Lagekarte verfügt jetzt über umfassende Zeichenfunktionen zur Erstellung und Bearbeitung von Karten-Objekten:

- **Zeichenwerkzeuge**: Punkte, Linien, Polygone, Freihand-Zeichnung und Text-Beschriftungen können direkt auf der Karte erstellt werden
- **OSM-Markierung**: Gebäude und andere Objekte aus OpenStreetMap können per Klick markiert und übernommen werden. Multi-Geometrien werden automatisch in Einzelobjekte aufgeteilt, um ungewollte großflächige Einfärbungen zu vermeiden
- **Undo/Redo**: Alle Zeichenaktionen können rückgängig gemacht und wiederhergestellt werden
- **Kontinuierliches Zeichnen**: Nach Erstellung eines Objekts bleibt das Werkzeug aktiv, um direkt weitere Objekte zu zeichnen
- **Automatisches Speichern**: Alle Änderungen werden automatisch gespeichert
- **Feature-Limit**: Die Anzahl der Zeichenobjekte ist auf ein Maximum begrenzt, um die Performance zu gewährleisten

## Lagekarte – Styling & Darstellung

- **Farben und Stile**: Alle Zeichenobjekte können individuell eingefärbt werden (Linienfarbe, Füllfarbe, Strichstärke)
- **Schraffur-Muster**: Polygone können mit verschiedenen Schraffur-Mustern gefüllt werden (Horizontal, Vertikal, Diagonal, Kreuz, Gepunktet) – Dichte, Winkel und Farbe sind konfigurierbar
- **Füllung-Toggle**: Farbfüllung kann unabhängig von der Schraffur ein- und ausgeschaltet werden
- **Text-Beschriftungen**: Zeichenobjekte können mit Text versehen werden
- **Einklappbare Werkzeugleiste**: Die Zeichenwerkzeuge können über einen Stift-Button ein- und ausgeklappt werden, um mehr Platz auf der Karte zu schaffen
- **Tastenkürzel-Leiste**: Eine kontextabhängige Leiste am unteren Kartenrand zeigt verfügbare Tastenkombinationen und Bedienhinweise für den aktuellen Modus

## Technische Verbesserungen

- Optimierte Rendering-Performance durch Konsolidierung von 8 Schraffur-Layern auf 2 datengetriebene Layer
- Parametrische Schraffur-Muster-Generierung für flexible Darstellung
- Verbesserte Event-Behandlung im Freihand-Modus für flüssigeres Zeichnen
- Migration bestehender Zeichendaten auf neue Schraffur-Konfiguration

## Lagekarte

**Neue Warnebenen**

- NINA-Warnungen (KATWARN, BIWAPP, MOWAS, Hochwasser, Polizei) werden nun als farbige Polygone auf der Karte angezeigt
- DWD-Wetterwarnungen als neues Wetter-Overlay verfügbar
- Jede Warnquelle kann einzeln ein- und ausgeblendet werden

**Erweiterte Karteninteraktion**

- Klick auf Warn-Polygone zeigt vollständige Details (Beschreibung, Handlungsempfehlungen, betroffene Gebiete)
- Bei mehreren überlappenden Warnungen werden alle Treffer im Popup angezeigt
- Navigation zwischen mehreren Warnungen am gleichen Standort mit Vor/Zurück-Buttons
- Details-Panel öffnet direkt den Link zur jeweiligen Warnquelle

**Basis-Kartenlayer**

- Wechsel zwischen OpenStreetMap, Topographischer Karte und Satellitenansicht
- Fullscreen-Modus lässt sich nun per Tastenkürzel umschalten (nicht nur aktivieren)

## Sicherheit

- Verbesserte Absicherung gegen HTML-Injection bei der Anzeige von NINA-Warntexten
- HTML-Tags in Warnmeldungen werden nun sicher entfernt und korrekt als Text dargestellt

## Entwicklungsumgebung

**Worktree-Isolation für parallele Entwicklung**

- Mehrere Entwickler können nun gleichzeitig an verschiedenen Features arbeiten, ohne sich gegenseitig zu stören
- Automatische Port-Zuweisung verhindert Konflikte beim lokalen Development
- Neue `/worktree` Kommandos vereinfachen das Setup von isolierten Arbeitsumgebungen
- `dev:web` Script ermöglicht die Entwicklung ohne Tauri (nur Backend + Frontend)

**Vereinfachte Docker-Konfiguration**

- Dev Container Setup optimiert für schnelleres Onboarding
- Setup-Scripts automatisieren die Umgebungskonfiguration
- Ports jetzt konfigurierbar über Umgebungsvariablen

## Technische Verbesserungen

- Vite auf Version 8.0.5 aktualisiert für bessere Performance und Sicherheit
- Behobene Konfigurationsprobleme beim Laden von Umgebungsvariablen
- Verbesserte Prisma Seed-Ausführung in Worktree-Umgebungen

## Lagekarte

Die Lagekarte wurde von Leaflet auf MapLibre GL JS migriert und erhält dadurch WebGL-basiertes Rendering mit deutlich besserer Performance. Die Karte nutzt jetzt Vektor-Kacheln statt Raster-Kacheln und profitiert von moderner GPU-Beschleunigung.

**Hinweis:** In diesem Release wurden die Zeichenwerkzeuge, Layer (POIs, Zeichnungen, Fahrzeuge), ETB-Integration und Export-Funktionen temporär entfernt, um die Migration abzuschließen. Diese Funktionen werden in kommenden Releases auf Basis der neuen Technologie wieder implementiert.

## Gefahrenmatrix

Die neue Gefahrenmatrix ist jetzt verfügbar und ermöglicht die systematische Bewertung von Gefahren im Einsatz:

- **Vollbildansicht** mit `Cmd+E` Tastenkürzel für bessere Übersicht im Einsatz
- **Interaktive Matrix** mit 13 Gefahrentypen (A–E, 5A–5E) und drei Schutzzielen (Mensch, Sachwerte, Umwelt)
- **Intelligente Validierung**: Ungültige Kombinationen (z.B. "Angstreaktion" bei Sachwerten) sind automatisch deaktiviert
- **Hilfe-Dialog** mit Erklärungen zu allen Gefahrentypen
- **Legende** mit Übersicht der Warnstufen und Eigenschutz-Hinweisen
- **Visuelle Hervorhebung** von besonders kritischen Gefahren (Absturz, Brand, Durchbruch, Ertrinken) durch rote Kennzeichnung
- **Echtzeit-Updates** über das Event-System – Änderungen werden automatisch synchronisiert

Das Sicherheit-Modul ist jetzt in der Navigation verfügbar (Eigenschutz und Hygiene folgen in späteren Releases).

## 🔧 Technische Verbesserungen

**Type-Safety & Code-Qualität**

- Verbesserte Typ-Sicherheit im gesamten Frontend durch Entfernung unnötiger Type-Casts
- Zentralisierte Behandlung dynamischer Navigation über neue `DynamicLink`-Komponente
- Aktualisierte API-Client-Generierung mit korrekten TypeScript-Typen für alle DTOs
- Optimierte Erinnerungen-, Lagekarte- und Alarm-Komponenten durch präzisere Typdefinitionen

## 📦 Dependency-Updates

- NestJS auf Version 11.1.18 aktualisiert
- TanStack React Query auf Version 5.96.2 aktualisiert
- TanStack Router Plugin auf Version 1.167.12 aktualisiert
- React Leaflet Cluster auf Version 4.1.3 aktualisiert (verbesserte Karten-Performance)
- React Hook Form auf Version 7.72.1 aktualisiert
- Prometheus-Integration auf Version 6.1.0 aktualisiert
- Verschiedene Build-Tools und Type-Definitionen aktualisiert

## Admin Panel Redesign

Das Admin Panel wurde komplett überarbeitet und bietet nun eine moderne, übersichtliche Benutzeroberfläche:

- **Neue Sidebar-Navigation** mit responsivem Design – auf mobilen Geräten als ausklappbares Menü verfügbar
- **Breadcrumb-Navigation** zeigt den aktuellen Standort innerhalb der Anwendung an
- **Überarbeitetes Dashboard** mit Kennzahlen-Karten (KPIs) für schnellen Überblick über Benutzer, Fahrzeuge und Personen
- **Schnellaktionen** direkt vom Dashboard: Benutzer, Einladungen, Fahrzeuge und Personen können nun mit einem Klick erstellt werden
- **Status-Übersicht** zeigt auf einen Blick die Anzahl aktiver Kräfte und Integrationen

## Tabellen & Datenansichten

Alle Admin-Tabellen wurden modernisiert und vereinheitlicht:

- Einheitliches Design für Benutzer-, Einladungscodes-, Qualifikationen-, Rollendefinitionen-, Fahrzeugtypen-, Fahrzeuge-, Personen- und Befehlsgeber-Vorschläge-Tabellen
- Verbesserte Suchfunktion in allen Tabellen
- Übersichtlichere Sortierung und Filterung
- Aussagekräftige Leer-Zustände mit Hinweisen, wenn noch keine Daten vorhanden sind

## Fehlerbehebungen

- **Formulare im Admin-Bereich** funktionieren wieder korrekt – behobenes Problem mit Modal-Dialogen
- **Einladungs-API** arbeitet nun zuverlässig mit korrekten Datenformaten und angepasster Seitengröße

## Fahrzeugverwaltung

- **Bidirektionale Fahrzeug-Zuordnung**: Fahrzeuge können jetzt direkt aus der Einheiten-Ansicht zugewiesen werden. Ein neues Panel ermöglicht die flexible Zuweisung von Fahrzeugen zu Einheiten und umgekehrt.
- **Fahrzeug-Badges in Einheitskarten**: Zugewiesene Fahrzeuge werden jetzt direkt in der Einheitskarte angezeigt (bis zu 3 Fahrzeuge sichtbar, weitere über Overflow-Indikator).
- **Automatische Ist-Stärke-Berechnung**: Die Ist-Stärke einer Einheit berücksichtigt jetzt automatisch sowohl manuell zugewiesene Personen als auch Fahrzeugbesatzungen (ohne Duplikate).
- **Fahrzeugbesatzung in Personenzuweisung**: Im Personenzuweisungs-Panel werden jetzt auch Personen angezeigt, die über Fahrzeuge zugeordnet sind. Diese werden automatisch aus der manuellen Zuweisungsliste gefiltert.

## Einsatzverwaltung

- **Taktische Einheitenverwaltung**: Einheiten können jetzt während eines Einsatzes erstellt, bearbeitet und hierarchisch organisiert werden. Personal und Fahrzeuge lassen sich den Einheiten direkt zuweisen
- **Fahrzeugzuweisung zu Einheiten**: Auf der Fahrzeuge-Seite können Fahrzeuge nun über ein Dropdown-Menü taktischen Einheiten zugeordnet werden
- **Einsatzort-Anzeige korrigiert**: Adressen werden nun korrekt formatiert dargestellt statt als "[object Object]" oder JSON-String

## Dependency Updates

- TanStack-Bibliotheken aktualisiert (Pacer, React Form, React Router)

## Backend-Stabilität

- Behebung eines internen Fehlers bei der Verarbeitung von Einladungscode-Events (Erstellen, Verwenden, Widerrufen)

## Operative Rollen & Zugriffsverwaltung

Bluelight Hub unterstützt jetzt verschiedene operative Rollen für Einsatzkräfte: **Führungskraft (FK)**, **Einsatzkraft (EK)** und **Externe**. Die Rolle bestimmt, welche Einsätze ein Nutzer sehen und bearbeiten kann.

- **Führungskräfte** haben vollen Zugriff auf alle Einsätze und können neue Einsätze erstellen, bearbeiten und verwalten
- **Einsatzkräfte** sehen alle Einsätze in der Übersicht, müssen aber eine Beitrittsanfrage stellen, um Details zu öffnen und mitzuwirken
- **Externe** sehen nur Einsätze, zu denen sie explizit eingeladen wurden

Die aktuelle Rolle wird im Einsatz-Dashboard als farbcodiertes Badge angezeigt. Bei eingeschränkten Rollen (EK/Externe) erscheint ein kontextueller Hinweis.

## Beitrittsanfragen für Einsatzkräfte

Einsatzkräfte können jetzt Zugang zu Einsätzen anfragen, wenn sie diese in der Liste sehen. Führungskräfte erhalten die Anfragen und können sie genehmigen oder ablehnen. Nach Genehmigung erhält die Einsatzkraft vollen Zugriff auf den Einsatz.

## Externe einladen

Führungskräfte können externe Personen direkt zu einem Einsatz einladen. Der neue Dialog zeigt alle Nutzer mit der Rolle "Externe" an und ermöglicht die gezielte Einladung. Eingeladene Externe sehen den Einsatz automatisch in ihrer Liste. Die Einladung kann jederzeit widerrufen werden.

## Stammpersonen-Verwaltung

- Benutzerkonten können jetzt mit Stammpersonen verknüpft werden
- In der Benutzerverwaltung werden operative Rollen und verknüpfte Stammpersonen angezeigt und können gefiltert werden
- Die Stammpersonen-Tabelle zeigt nun, ob eine Stammperson mit einem Benutzerkonto verknüpft ist
- Beim Einsatz-Beitritt wird die verknüpfte Stammperson automatisch vorausgewählt
- Stammpersonen können direkt aus der Tabelle zur Detailseite verlinkt werden

## Dependency Updates

Aktualisierung von 8 Abhängigkeiten, darunter axios, Prisma, Recharts und TanStack Router auf die neuesten Versionen.

## ETB (Elektronisches Tagebuch)

- **Behobener Fehler**: Das ETB wurde nach Abschluss eines Einsatzes kurzzeitig noch als bearbeitbar angezeigt, obwohl es bereits gesperrt war. Die Anzeige aktualisiert sich nun sofort korrekt.

## ETB (Einsatztagebuch)

- **Automatische ETB-Sperrung**: Das ETB wird nun sofort gesperrt, wenn ein Einsatz beendet wird – ohne Verzögerung. Die manuelle Sperrfunktion wurde entfernt, da sie redundant war.

## Dependency-Updates

- Aktualisierung verschiedener TanStack-Bibliotheken (Pacer, React Query, React Router, React Store) für verbesserte Stabilität und Performance
- Aktualisierung von React Hook Form, Vite, Vitest und weiteren Entwicklungs-Dependencies

## Adressverwaltung

- **Neue Adresssuche**: Adressen können jetzt über eine integrierte Suche gefunden werden. Die Suche nutzt Photon/Komoot-Daten für präzise Ergebnisse.

- **PLZ-Autovervollständigung**: Bei der Eingabe einer Postleitzahl wird der zugehörige Ort automatisch vorgeschlagen und kann mit einem Klick übernommen werden. Dies beschleunigt die Erfassung von Einsatzorten erheblich.

- **Verbesserte Formulare**: Die Adresseingabe im Einsatz-Formular wurde überarbeitet und bietet jetzt die neuen Such- und Autovervollständigungsfunktionen.

## Fehlerbehebungen & Stabilität

- **Adresssuche**: Behobene Sicherheitslücke (ReDoS) in der Fehlerverarbeitung, verbesserte Cache-Verwaltung und Behebung eines Problems, bei dem leere PLZ-Suchen zu inkonsistenten Formularinhalten führten.

## Elektronisches Tage-Buch (ETB)

**Breaking Change:** ETB-Einträge sind nun unveränderlich und können nicht mehr bearbeitet werden. Stattdessen müssen fehlerhafte Einträge durch Korrektureinträge ersetzt werden. Dies gewährleistet eine lückenlose Nachvollziehbarkeit aller Änderungen im Einsatztagebuch.

### Neue Funktionen

- **Korrektureinträge:** Fehlerhafte ETB-Einträge können nun korrigiert werden. Das System erstellt automatisch einen neuen Korrektur-Eintrag und verknüpft ihn mit dem ursprünglichen Eintrag, sodass die vollständige Änderungshistorie erhalten bleibt.

### Entfernte Funktionen

- Die Bearbeitungsfunktion für ETB-Einträge wurde entfernt. Nutzen Sie stattdessen die neue Korrekturfunktion, um fehlerhafte Einträge zu korrigieren.

## 🎨 Design-System & Benutzeroberfläche

- **Dark Mode Unterstützung**: Die gesamte Benutzeroberfläche wurde auf ein modernes Design-Token-System (Ring-1) migriert. Damit ist die Grundlage für automatisches Umschalten zwischen hellem und dunklem Modus geschaffen.
- **Einheitliches Erscheinungsbild**: Alle Farben, Abstände und Animationen folgen jetzt einem zentralen Design-System für ein konsistenteres Nutzererlebnis über alle Bereiche der Anwendung hinweg (Einsätze, ETB, Lagekarte, Kräfteübersicht, Verwaltung).

## 🛠️ Technische Verbesserungen

- **Schnellere Build-Zeiten**: Die Entwicklungs-Werkzeuge wurden auf eine moderne, Rust-basierte Toolchain (OXC) umgestellt, was die Ladezeiten beim Entwickeln und Bauen der Anwendung spürbar verkürzt.
- **Verbesserte Code-Qualität**: Strengere Prüfungen der Software-Architektur stellen sicher, dass die Anwendung auch langfristig wartbar und erweiterbar bleibt.

## Berechtigungen & Zugriffskontrolle

- **Rollenbasierte Navigation**: Die Navigationsmenüs passen sich jetzt automatisch an die Rolle des Benutzers an. Bereiche, für die keine Berechtigung besteht, werden ausgeblendet
- **Benutzerverwaltung für Administratoren**: Administratoren können nun gezielt Berechtigungen an Benutzer vergeben und entziehen
- **Verbesserte Fehlermeldungen**: Beim Versuch, auf nicht autorisierte Bereiche zuzugreifen, wird eine aussagekräftige Fehlerseite angezeigt
- **Einsatzrollen-Prüfung**: Zugriff auf Workspace-Seiten wird jetzt basierend auf der zugewiesenen Einsatzrolle eingeschränkt

## Integrationen

- **Integrations-Übersicht für Administratoren**: Neue Administrations-Seite zur Verwaltung aller verbundenen Dienste (z.B. HiOrg-Server)
- **Verbindungen trennen und aktualisieren**: Administratoren können Integrationen jetzt direkt trennen oder aktualisieren
- Behebung eines Fehlers, bei dem das Trennen einer HiOrg-Verbindung zu einem Serverfehler führte, wenn keine Zugangsdaten hinterlegt waren

## Technische Verbesserungen

- Verbesserte Code-Architektur durch Umstrukturierung interner Schnittstellen
- Optimierte API-Dokumentation und -Client-Generierung

## Befehle & Berechtigungen

- **Neuer Befehl-Workspace**: Vollständig überarbeitete Befehlsansicht mit rollenbasierter Zugriffskontrolle und Weitergabe-Statusübersicht
- **Verbesserte Sicherheit**: EMPFÄNGER können nur noch ihre eigenen Befehle einsehen – keine unbefugte Einsicht in fremde Befehle mehr möglich
- **Bessere Navigation**: Deep-Links zu spezifischen Befehlen funktionieren jetzt zuverlässig und scrollen automatisch zum richtigen Eintrag

## Dependency-Updates

- TanStack-Bibliotheken (React Query, Router, Devtools, Virtual) auf neueste Versionen aktualisiert
- NestJS-Framework von 11.1.16 auf 11.1.17 aktualisiert
- Tailwind CSS von 4.2.1 auf 4.2.2 aktualisiert
- PDFKit von 0.17.2 auf 0.18.0 aktualisiert
- dotenvx von 1.54.1 auf 1.57.0 aktualisiert
- jsdom von 28.1.0 auf 29.0.1 aktualisiert (Major Update)
- Sicherheitsupdate: rustls-webpki von 0.103.9 auf 0.103.10
- Diverse Entwicklungstools aktualisiert (Biome, TypeScript-ESLint, baseline-browser-mapping)

## Infrastruktur

- GitHub Actions aktualisiert (pnpm/action-setup v5, actions/create-github-app-token v3)

## Einsatz-Arbeitsbereich

Das neue **Einsatz-Workspace-Modul** ermöglicht strukturiertes Arbeiten in aktiven Einsätzen:

- Kontextbezogener Arbeitsbereich mit Einsatz-Header und automatischer Fokus-Steuerung
- Zugriff nur für zugewiesene Nutzer – Zuweisung ist vor Betreten des Workspace verpflichtend
- Arbeitsbereich wird sitzungsübergreifend gespeichert (pro Server, Nutzer, Rolle und Einsatz)
- Verbesserte Navigation mit Sidebar-Status-Hinweisen und Suchparameter-Erhaltung
- Offline- und Blockier-Zustände werden explizit angezeigt

## Lageübersicht

Neue **priorisierte Lageübersicht** für operative Kräfte und Führung:

- Tonbasierte Situationsdarstellung mit Prioritäts-Panels
- Status-Änderungen mit Zeitstempel und Quellen-Attribution
- Deep-Linking von Übersichts-Elementen zu spezifischen Arbeitsbereichen
- Verfeinerte UI-Komponenten mit konsistentem Design-Token-System

## ETB (Elektronisches Tagebuch)

### Eingabe & Validierung

- Neuer **ETB Composer Workspace** mit semantischem Lade-Skeleton (300ms Schwellwert)
- Live-Region Status-Ansagen für Barrierefreiheit
- Feldvalidierung beim Verlassen (Blur):
  - Text: Pflichtfeld, max. 2000 Zeichen
  - Absender/Empfänger: max. 100 Zeichen
- WCAG 2.1 AA-konforme Fehlermeldungen mit `aria-invalid` und `aria-live`

### Kontinuität & Synchronisation

- **Synchronisationsstatus-Anzeige** in der Seitenleiste (ersetzt Toast-Benachrichtigungen)
- **Entwurfs-Wiederaufnahme**: Ungespeicherte ETB-Einträge werden automatisch im Browser gespeichert
- Auto-Save bei Formular-Änderungen mit Abbruch bei leerem Text
- Navigation-Guards warnen vor ungespeicherten Änderungen (Browser + Router)
- **Bearbeitungshistorie**: Fokus-Rückkehr nach Modal-Schließen, Tastatur-Navigation in Tabellen
- Leerzustände für Such- und Filter-Ergebnisse
- Fehler- und Erfolgs-Toasts bei Eintrags-Updates
- Behoben: Timer-Leck in Highlight-Store verursachte instabile Performance-Tests
- Behoben: Entwurfs-Speicherung wird bei leerem Text korrekt abgebrochen

## Authentifizierung

- **Zentralisierter Auth-Session-Flow** mit dediziertem CLI-Entrypoint für Einladungen
- Auth-Kontext-Zusammenfassung auf `/app/einsaetze`
- Verbesserte Session-Behandlung für Frontend-Server-basierte Flows
- Behoben: Doppelte Auth-Context-Exporte, die das Laden verhinderten
- Behoben: 5xx-Codes werden korrekt im Frontend-Handler behandelt

## Design & Benutzeroberfläche

- **Aufgefrischtes Design-System** (Ring 1) mit überarbeiteten Theme-Tokens
- Vereinheitlichte Auth-Oberflächen und Komponenten-Styling
- Straffere Workspace-Sidebar-Abstände und Sticky-Offset
- Vereinfachtes Combobox-Focus-Styling
- Dokumentierte Design-Tokens

## Entwicklung & Tooling

- Pnpm aktualisiert: 10.28.0 → 10.32.1
- Vite aktualisiert: 7.3.1 → 8.0.1
- Claude-Befehl für strukturierte GitHub-Issue-Erstellung hinzugefügt
- Vite-Plugin zu `@vitejs/plugin-react` gewechselt mit nativer `tsconfigPaths`-Unterstützung
- Behoben: Vite DevTools entfernt (blockierte CI-Builds durch Port 9999)
- Erweiterte Test-Coverage für Workspace-Shell, Command-Palette und Performance-Gates
- Aufgeteilte Coverage- und Performance-Gates in CI-Pipeline
- 12 Dependencies aktualisiert (Biome, lint-staged, Jest, Vitest, TanStack, TypeScript-ESLint u.a.)

## 📦 Abhängigkeiten & Infrastruktur

- **TanStack-Bibliotheken aktualisiert**: React Router, React Form, React Store, React Virtual und DevTools auf neueste Versionen aktualisiert für verbesserte Performance und Stabilität
- **Prisma-Datenbank-Adapter aktualisiert**: Prisma Client und PostgreSQL-Adapter auf Version 7.5.0 aktualisiert
- **Recharts-Bibliothek aktualisiert**: Diagramm-Komponente auf Version 3.8.0 aktualisiert
- **dotenvx-ops aktualisiert**: Umgebungsvariablen-Management auf Version 0.35.1 aktualisiert

## 🔧 Entwickler-Verbesserungen

- **OpenAPI-SDK neu generiert**: Frontend-API-Client wurde mit der neuesten Swagger-Spezifikation aktualisiert und die Dokumentation für versionierte Endpunkte erweitert
- **Test-Stabilität verbessert**: Frontend-Tests nutzen jetzt zuverlässigere Mocks für localStorage und sessionStorage
- **AI-Assistenz-Workflows erweitert**: Neue strukturierte Vorlagen für GitHub-Issue-Erstellung und erweiterte Skill-Packs für Entwickler-Workflows hinzugefügt

## Teilnehmerverwaltung

- Fehler bei der Datenbankmigration für bestehende Teilnehmer behoben, um Datenkonsistenz sicherzustellen

## Technische Verbesserungen

- **Router-Bibliothek:** Aktualisierung der TanStack Router-Abhängigkeiten für verbesserte Stabilität und Kompatibilität

## 🐛 Fehlerbehebungen

### Backend

- Behebung von Regressionstests im Backend-System
- Korrektur von zirkulären Imports für stabilere Testausführung

### Frontend

- Behebung von Testfehlern in Erinnerungs-Modulen durch verbesserte Mock-Strategie
- Robustere Verarbeitung von DRK-QR-Code-Eingaben
- Aktualisierung der Barrierefreiheits-Tests für Dialoge

## ⬆️ Aktualisierungen

### TanStack-Bibliotheken

- React DevTools auf Version 0.9.10 aktualisiert
- React Form auf Version 1.28.4 aktualisiert
- React Router und Router DevTools auf Version 1.166.2 aktualisiert
- React Virtual auf Version 3.13.21 aktualisiert

## Sicherheit & Konfiguration

- **Vereinfachtes Secret-Management**: Alle App-Secrets werden nun zentral über `MASTER_SECRET` verwaltet. Administratoren können den Status einsehen, Secrets aktualisieren und Cleanup-Prozesse durchführen
- **Verbesserte Admin-Oberfläche**: Das Admin-UI zeigt nun Runtime-Konfiguration und Secret-Status übersichtlich an

## Entwickler-Tools

- **OpenCode-Integration**: Unterstützung für OpenCode-spezifische Commit-Workflows und Dokumentation hinzugefügt
- **Aktualisierte Pact-Dokumentation**: Contract-Testing-Anleitungen für bessere Zusammenarbeit zwischen Teams überarbeitet

## Abhängigkeiten

- PostgreSQL-Treiber auf Version 8.20.0 aktualisiert
- React Icons auf Version 5.6.0 aktualisiert
- class-validator auf Version 0.15.1 aktualisiert
- dotenvx auf Version 1.53.0 aktualisiert
- Verschiedene Docker-Actions für verbesserte Build-Pipeline aktualisiert

## Authentifizierung & Navigation

- **Verbesserte Weiterleitungen nach Login**: Nach der Anmeldung werden Sie nun zur ursprünglich angeforderten Seite weitergeleitet – inklusive Suchparameter und Anker-Links
- **Stabilere Authentifizierungs-Prüfungen**: Behoben wurden mehrere Timing-Probleme beim Laden der App, die zu unnötigen Weiterleitungen oder hängenden Ladebildschirmen führen konnten
- **Zuverlässigere Admin-Bereich-Navigation**: Der Zugriff auf Admin-Funktionen ist nun robuster gegen Race-Conditions beim Neuladen

## ETB (Elektronisches Tagebuch)

- **Optimiertes Eingabeformular**: Die ETB-Eingabe fokussiert sich nun vollständig auf den workflow-basierten Erfassungsprozess. Die alternative Inline-Ansicht wurde entfernt für eine konsistentere Nutzererfahrung

## Stabilität & Zuverlässigkeit

- **Verbesserte Test-Abdeckung**: Die Frontend-Tests laufen nun zuverlässiger in der CI-Umgebung, was eine höhere Code-Qualität gewährleistet

## Sicherheit

- **Zugriffskontrolle für Einsatz-Erinnerungen verbessert**: Nur noch berechtigte Einsatzteilnehmer können Erinnerungsräumen beitreten. Unberechtigte Zugriffsversuche werden blockiert und entsprechend gemeldet.

## Abhängigkeiten

- Sicherheitsupdate für Datei-Upload-Komponente (multer 2.1.1)

## Einsatz-Verwaltung

- **Berechtigung für Einsatz-Änderungen**: Nur Einsatz-Ersteller, aktive Mitglieder und Führungskräfte können jetzt Einsätze bearbeiten – unbefugte Zugriffe werden verhindert
- **Beitritts-Dialog**: Der automatische Beitritts-Dialog wird nun korrekt aktualisiert, wenn zwischen verschiedenen Einsätzen gewechselt wird
- **ETB-Zugriff**: ETB-Daten werden erst geladen, nachdem die Teilnahme am Einsatz bestätigt wurde

## Erinnerungen

- **API-Anbindung modernisiert**: Die Erinnerungskonfiguration nutzt jetzt durchgängig die neue, typsichere API-Schnittstelle

## Einrichtung & Benutzerverwaltung

- **Robustere Benutzeranlage**: Fehler bei doppelten Benutzernamen während der Ersteinrichtung werden jetzt sauber abgefangen und mit klaren Meldungen angezeigt

## 🔒 Sicherheit & Konfiguration

- **Verbesserte CORS-Sicherheit**: Die Handhabung von Cross-Origin-Anfragen wurde überarbeitet und gehärtet. Ursprünge werden nun zentral geprüft und nur noch explizit erlaubte Domains zugelassen.

- **Robustere Konfigurationsverwaltung**: Die Laufzeit-Konfiguration arbeitet nun zuverlässiger mit Fallback-Werten aus Umgebungsvariablen. Beim Start ohne Master-Secret werden Legacy-Konfigurationen korrekt geladen.

- **Verbesserte Authentifizierung**: JWT-Token-Handling wurde stabilisiert und die Server-Zugriffsprüfung in Tests nachgezogen.

## 🚗 Fahrzeugverwaltung

- **Fehlerbehandlung bei inaktiven Fahrzeugtypen**: Bei der temporären Fahrzeugerfassung werden inaktive Fahrzeugtypen nun korrekt abgelehnt und eine passende Fehlermeldung angezeigt.

## 🛠️ Entwicklung & Wartung

- **Repository-Hygiene**: Backup- und Merge-Artefakte (`.bak`, `.orig`, `.rej`) werden nun automatisch ignoriert und ein Hygiene-Check verhindert deren versehentliches Commit.

## Fahrzeugverwaltung

- Fahrzeugtypen können nun zentral in der Admin-Oberfläche verwaltet werden
- Fahrzeuge (Funkrufnamen) können jetzt als Empfänger für Befehle ausgewählt werden

## Stabilität & Performance

- **ETB-Snapshots**: Verbesserte Performance-Tests für zuverlässigere Snapshot-Aktualisierungen im ETB-Modul

## Technische Verbesserungen

- **Datenverwaltung**: Aktualisierung der internen Store-Verwaltung für verbesserte Kompatibilität und Wartbarkeit

## 🔧 Technische Verbesserungen

### Audio-Wiedergabe

- Aktualisierung der Audio-Bibliothek (Rodio) auf Version 0.22.1 für verbesserte Stabilität und Kompatibilität der Tonausgabe in der Desktop-Anwendung

### Performance-Tests

- Optimierung der Leistungstests für zuverlässigere Ergebnisse in verschiedenen Ausführungsumgebungen

## 📦 Dependency-Updates

### Frontend-Bibliotheken

- TailwindCSS auf Version 4.2.1 aktualisiert
- TanStack-Bibliotheken aktualisiert (Router, Form, Store, Virtual und weitere)
- React Hook Form auf Version 7.71.2 aktualisiert
- Axios auf Version 1.13.6 aktualisiert

### Backend-Bibliotheken

- Prisma-Client und Adapter auf Version 7.4.1 aktualisiert
- PostgreSQL-Treiber (pg) auf Version 8.19.0 aktualisiert
- Multer auf Version 2.1.0 aktualisiert

## Interne Verbesserungen

- **Backend-Stabilität**: Fehlerbehandlung bei Befehlsausführung verbessert – verhindert Serverabstürze bei fehlenden Handler-Rückgaben
- **Abhängigkeiten aktualisiert**: NestJS-Pakete auf Version 11.1.14 aktualisiert, tailwind-merge auf 3.5.0

## Befehlsmanagement

- **Komplettes Befehlsmanagement für Einsatzführung**: Erstellen, Zustellung und Quittierung von Führungsbefehlen mit Kanban- und Tabellenansicht, Detail-Panel, Filtern und Echtzeit-Updates
- **Empfänger-Verwaltung**: Mehrere Freitext-Empfänger pro Befehl möglich, Empfänger-Suche und optimierte Combobox-Auswahl
- **Quittierung und Korrektur**: Befehle können quittiert und nachträglich korrigiert werden, mit vollständiger Historie und Statusverfolgung
- **Kommentare**: Kommentarfunktion für Befehle zur besseren Dokumentation und Kommunikation
- **Kritikalitäts-System**: Befehle mit Prioritätskennzeichnung und entsprechenden Badges
- **CSV-Export**: Export von Befehlen für Dokumentationszwecke

## DSGVO & Datenschutz

- **Automatische Anonymisierung**: DSGVO-konforme Anonymisierung und Löschung von Befehlen nach Aufbewahrungsfrist mit Cron-Jobs
- **Aufbewahrungsfristen**: Konfigurierbare Aufbewahrungsrichtlinien für Einsatzdaten
- **Monitoring**: Prometheus-Metriken und Circuit Breaker für Aufbewahrungsmodul

## Einsatz-Teilnehmer

- **Verknüpfung mit Einsatzpersonen**: Teilnehmer werden jetzt mit Einsatzpersonen verknüpft statt Freitext-Funkrufnamen – automatisches Ausfüllen von Personendaten im ETB und bei Erinnerungen
- **Duplikat-Schutz**: Verhindert mehrfache Teilnahme derselben Person am gleichen Einsatz
- **Person-Picker**: Komfortable Auswahl von Personen beim Beitritt zum Einsatz

## Einsatz-Rollen

- **Rollen-System**: ETB-Event-Handler für Rollenverwaltung mit Benachrichtigungen bei Rollenänderungen

## Metriken & Monitoring

- **Metriken-Dashboard**: Übersicht über Befehlsstatistiken und System-Performance
- **WebSocket-Verbindung**: Dynamische WebSocket-URL aus Server-Konfiguration – behebt Verbindungsprobleme im Hosting
- **Benachrichtigungen**: Echtzeit-Benachrichtigungen für Befehlserstellung, Quittierung und Anonymisierung

## Sicherheit

- **Export-Parameter-Validierung**: Härtung gegen manipulierte Query-Parameter – verhindert doppelte Parameter und ungültige IDs

## CI/CD

- **Parallele Test-Ausführung**: Backend-Datenbank-Tests werden auf drei parallele Runner verteilt für schnellere CI-Durchläufe
- **Stabilere Snapshots**: Deterministische OpenAPI-Snapshot-Generierung verhindert fehlgeschlagene Builds

## Infrastruktur & Betrieb

- Korrigierte Fehler bei leerer `TRUSTED_PROXIES` Umgebungsvariable, der zu Abstürzen der API führen konnte
- Behebung eines Problems bei der automatischen Docker-Image-Versionierung während des Release-Prozesses

## CI/CD & Deployment

- Docker-Images werden nun mit der korrekten Release-Version getaggt statt mit der Build-Nummer
- Datei-Upload-Pfade in Docker-Umgebungen werden jetzt korrekt aufgelöst

## v1.0.0-alpha.54

_Veröffentlicht am 16. Februar 2026_

### Infrastruktur & Deployment

- **Verbesserte Docker-Build-Stabilität**: Behebung von Problemen beim Erstellen des Production-Images, die dazu führten, dass benötigte Abhängigkeiten fehlten
- **Frühere Fehlererkennung**: Docker-Builds werden jetzt automatisch in Pull Requests getestet, um Deployment-Probleme frühzeitig zu erkennen

## v1.0.0-alpha.53

**Veröffentlicht am:** 15. Februar 2026

### Docker & Deployment

- **Verbesserte Docker-Image-Verwaltung**: Docker-Images werden nun mit zusätzlichen Branch-Tags versehen (alpha, beta, latest), um die Bereitstellung und Versionsverwaltung zu vereinfachen
- **Fehler bei Produktions-Deployment behoben**: Dependencies werden nun korrekt in Docker-Container kopiert, sodass alle benötigten Module verfügbar sind

## v1.0.0-alpha.52

**Veröffentlicht am 15. Februar 2026**

### Infrastruktur

- Behebung eines Fehlers bei der Datenbank-Migration in Docker-Containern

## v1.0.0-alpha.51

**Veröffentlicht am 14. Februar 2026**

### Infrastruktur

- Verbesserungen an der Docker-Build-Konfiguration für stabilere Deployments

## v1.0.0-alpha.50

**Veröffentlicht am:** 14. Februar 2026

### Fehlerbehebungen

- Das API-Root-Endpunkt bleibt nun während des Setup-Modus erreichbar, was eine bessere Diagnose von Verbindungsproblemen ermöglicht

### Entwickler-Verbesserungen

- Verbessertes Verhalten der Git-Hooks in Worktree-Umgebungen
- Optimierte Pre-Commit-Prüfungen für generierte Dateien

### Abhängigkeiten

- Aktualisierung auf TanStack Router 1.159.10
- Aktualisierung auf TanStack React Form 1.28.2
- Diverse kleinere Dependency-Updates

## v1.0.0-alpha.49

**Veröffentlicht am:** 14. Februar 2026

### Technische Verbesserungen

- Optimierung der Release-Pipeline zur Vermeidung paralleler Veröffentlichungen

## v1.0.0-alpha.48

### Entwickler-Erfahrung

- **Schnellere CI-Pipeline bei Pull Requests**: Die Build-Pipeline wurde optimiert und erkennt nun automatisch, wenn nur Dokumentation geändert wurde – in diesen Fällen werden zeitintensive Build-Schritte übersprungen, was die Feedback-Zeiten deutlich verkürzt
- **KI-generierte Release Notes**: Release Notes werden nun automatisch mit Claude erstellt und sind benutzerfreundlicher, thematisch gruppiert und leichter verständlich statt als reine Commit-Liste

## Version [v1.0.0-alpha.47](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.46...v1.0.0-alpha.47) – Veröffentlicht am 2026-02-14

## ✨ Neue Funktionen

Die folgenden neuen Features wurden hinzugefügt:

- [`ded435e5`](https://github.com/rubenvitt/bluelight-hub/commit/ded435e5) (erinnerung): Add Quick-Create Erinnerung feature (Story 1.1)

- [`89ee06c1`](https://github.com/rubenvitt/bluelight-hub/commit/89ee06c1) (erinnerung): Add custom time selection for reminders (Story 1.2)

- [`855eb097`](https://github.com/rubenvitt/bluelight-hub/commit/855eb097) (erinnerung): Add edit functionality for reminders (Story 1.3)

- [`13846917`](https://github.com/rubenvitt/bluelight-hub/commit/13846917) (erinnerung): Add delete functionality for reminders (Story 1.4)

- [`dd209e0e`](https://github.com/rubenvitt/bluelight-hub/commit/dd209e0e) (erinnerung): Add trigger alarm feature (Story 1.5 Backend)

- [`dcae3c4d`](https://github.com/rubenvitt/bluelight-hub/commit/dcae3c4d) (erinnerung): Add optional Story 1.5 features

- [`74eaa4b0`](https://github.com/rubenvitt/bluelight-hub/commit/74eaa4b0) (erinnerung): Add Alarm-Intensivierung bei Nicht-Reaktion (Story 2.3)

- [`c4d4d5cf`](https://github.com/rubenvitt/bluelight-hub/commit/c4d4d5cf) (erinnerung): Story 2.4 Alarm-Intensivierung Stufe 2 (Urgent)

- [`d64977d9`](https://github.com/rubenvitt/bluelight-hub/commit/d64977d9) (erinnerung): Story 2.8 Web Audio Fallback + Code Review Fixes

- [`3854a3bf`](https://github.com/rubenvitt/bluelight-hub/commit/3854a3bf) (erinnerung): Story 3.2 Echtzeit-Updates via WebSocket

- [`f0619a29`](https://github.com/rubenvitt/bluelight-hub/commit/f0619a29) (erinnerung): Story 3.3 Erinnerung einer Person zuweisen

- [`62669dae`](https://github.com/rubenvitt/bluelight-hub/commit/62669dae) (erinnerung): Story 3.4 Bestehende Erinnerung zuweisen

- [`ebd51c92`](https://github.com/rubenvitt/bluelight-hub/commit/ebd51c92) (erinnerung): Story 3.6 Filter + Code Review Fixes + Backend Assign

- [`03e97690`](https://github.com/rubenvitt/bluelight-hub/commit/03e97690) (reminders): implement seen assignments logic and setup LFS for mp3

- [`0937bb37`](https://github.com/rubenvitt/bluelight-hub/commit/0937bb37) (erinnerung): implement escalation system with configurable timeouts

- [`54aeeeb8`](https://github.com/rubenvitt/bluelight-hub/commit/54aeeeb8) (erinnerung): implement multi-level escalation chain (Story 4.8)

- [`e047b514`](https://github.com/rubenvitt/bluelight-hub/commit/e047b514) (backend): add escalation persistence fields

- [`03856394`](https://github.com/rubenvitt/bluelight-hub/commit/03856394) (erinnerung): implement Story 4.9 Statistik &amp; 4.10 Rückläufer

- [`f167b835`](https://github.com/rubenvitt/bluelight-hub/commit/f167b835) (backend): add PR template and event registry architecture test

- [`9bbc4aef`](https://github.com/rubenvitt/bluelight-hub/commit/9bbc4aef) (backend): implement Story 5.0 ETB-Integration preparation

- [`d11d66b7`](https://github.com/rubenvitt/bluelight-hub/commit/d11d66b7) (backend): implement Story 5.0 ETB-Integration preparation

- [`1dd62d1a`](https://github.com/rubenvitt/bluelight-hub/commit/1dd62d1a) (etb): implement Story 5.5 ETB shows Erinnerung timeline

- [`cec4ffb6`](https://github.com/rubenvitt/bluelight-hub/commit/cec4ffb6) (erinnerungsvorlage): implement Story 6.1 + disable useImportType rule

- [`cf7d6ec7`](https://github.com/rubenvitt/bluelight-hub/commit/cf7d6ec7) (erinnerung): implement Stories 6.2-6.6

- [`ac5da78c`](https://github.com/rubenvitt/bluelight-hub/commit/ac5da78c) (epics-6-9): implement Epics 6-9 with Notizen, Kategorien, Statistiken

- [`b11254d4`](https://github.com/rubenvitt/bluelight-hub/commit/b11254d4) (erinnerung): add statistics, analysis, and export features

- [`918a1db2`](https://github.com/rubenvitt/bluelight-hub/commit/918a1db2) (erinnerung): add Pinnwand UI and fix export/escalation

## 🐛 Fehlerbehebungen

Diese Probleme wurden behoben:

- [`a6e89a25`](https://github.com/rubenvitt/bluelight-hub/commit/a6e89a25) (erinnerung): Fix validation timing and error message display

- [`ed651e79`](https://github.com/rubenvitt/bluelight-hub/commit/ed651e79) (erinnerung): Add missing ErinnerungAktualisiert event serialization

- [`bc2bf3e6`](https://github.com/rubenvitt/bluelight-hub/commit/bc2bf3e6) (erinnerung): Fix delete - add event serializer + umlauts

- [`af415c49`](https://github.com/rubenvitt/bluelight-hub/commit/af415c49) (erinnerung): Fix HIGH and MEDIUM issues from code review

- [`306fb11e`](https://github.com/rubenvitt/bluelight-hub/commit/306fb11e) (erinnerung): Fix HIGH and MEDIUM issues from code review

- [`6eb152c4`](https://github.com/rubenvitt/bluelight-hub/commit/6eb152c4) (erinnerung): Fix Timer Service deduplication race condition

- [`de0a3154`](https://github.com/rubenvitt/bluelight-hub/commit/de0a3154) (erinnerung): Fix Backend Issues B1-B5 für Story 2.1 Snooze Feature

- [`a76c441c`](https://github.com/rubenvitt/bluelight-hub/commit/a76c441c) (erinnerung): Fix Snooze 400 Error - fehlende Event Registration

- [`402e867c`](https://github.com/rubenvitt/bluelight-hub/commit/402e867c) (erinnerung): fix reminder assignment sync and notifications

- [`48c1b1c6`](https://github.com/rubenvitt/bluelight-hub/commit/48c1b1c6) (backend): fix dependency injection imports and provider registration

- [`e1ff983d`](https://github.com/rubenvitt/bluelight-hub/commit/e1ff983d) (backend): fix DI imports and biome config for AC1 rule

- [`7a813fe9`](https://github.com/rubenvitt/bluelight-hub/commit/7a813fe9) (etb): fix timeline hook to extract data from wrapped response

- [`bf814959`](https://github.com/rubenvitt/bluelight-hub/commit/bf814959) (etb): fix timeline event type keys to match backend

- [`5f2c12de`](https://github.com/rubenvitt/bluelight-hub/commit/5f2c12de) (frontend): fix timeline metadata extraction and test labels

- [`2aaeab40`](https://github.com/rubenvitt/bluelight-hub/commit/2aaeab40) (backend): add missing event adapters and whitelist

- [`2aa0263b`](https://github.com/rubenvitt/bluelight-hub/commit/2aa0263b) (ci): fix frontend build error and remove unused biome suppressions

- [`1352ddde`](https://github.com/rubenvitt/bluelight-hub/commit/1352ddde) (security): fix incomplete multi-char sanitization
  (Zugehörige Issues: [`#53`](https://github.com/rubenvitt/bluelight-hub/issues/), [`#55`](https://github.com/rubenvitt/bluelight-hub/issues/))

- [`24439804`](https://github.com/rubenvitt/bluelight-hub/commit/24439804) (release): Fix Biome Formatierung in .releaserc.js

- [`43a08a30`](https://github.com/rubenvitt/bluelight-hub/commit/43a08a30) (release): Fix Tauri-Build und Docker-Build in Release Pipeline

## ♻ Refactoring

Struktur- oder Code-Verbesserungen:

- [`105b1e70`](https://github.com/rubenvitt/bluelight-hub/commit/105b1e70) (tauri): Fix Code Review Issues für Story 1.9 System-Tray

- [`aa7c7f7d`](https://github.com/rubenvitt/bluelight-hub/commit/aa7c7f7d) (erinnerung): Fix Frontend Issues + Backend Typos für Story 2.5

- [`1d33f9f3`](https://github.com/rubenvitt/bluelight-hub/commit/1d33f9f3) (erinnerung): Fix Code Review Issues for Story 2.6 Pflicht-Notiz

- [`8c41d7d5`](https://github.com/rubenvitt/bluelight-hub/commit/8c41d7d5) (biome): consolidate biome config into root and add architecture rules

## 🔧 Tool Verbesserungen

Verbesserungen an den Werkzeugen:

- [`6e860d23`](https://github.com/rubenvitt/bluelight-hub/commit/6e860d23) (release): Fix doppelte Release Notes und aktiviere GitHub-Kommentare

- [`a6eb17df`](https://github.com/rubenvitt/bluelight-hub/commit/a6eb17df) (docker): Dediziertes Migrations-Image und Production-Dockerfile fixen
  (Zugehörige Issues: [`#358`](https://github.com/rubenvitt/bluelight-hub/issues/))

## Version [v1.0.0-alpha.46](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.45...v1.0.0-alpha.46) – Veröffentlicht am 2026-01-25

## ✨ Neue Funktionen

Die folgenden neuen Features wurden hinzugefügt:

- [`056f6819`](https://github.com/rubenvitt/bluelight-hub/commit/056f6819) (einsatz): Implement findNextId and findPreviousId navigation

# [1.0.0-alpha.46](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.45...v1.0.0-alpha.46) (2026-01-25)

### Features

- enable https for local development ([ef3892e](https://github.com/rubenvitt/bluelight-hub/commit/ef3892e245939044b7fbdfdca564831e200efea9))
- **security:** remove deprecated X-XSS-Protection header ([b5b89d6](https://github.com/rubenvitt/bluelight-hub/commit/b5b89d685e4d5771f980b658c6aa93a5f7699a81))

## Version [v1.0.0-alpha.45](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.44...v1.0.0-alpha.45) – Veröffentlicht am 2026-01-17

## ✨ Neue Funktionen

Die folgenden neuen Features wurden hinzugefügt:

- [`f020b578`](https://github.com/rubenvitt/bluelight-hub/commit/f020b578) (etb): Add absender/empfaenger with auto-fill feature

- [`8df918e9`](https://github.com/rubenvitt/bluelight-hub/commit/8df918e9) (etb): Add auto-show Beitritts-Dialog in SingleEinsatzLayout

- [`5e7bb47f`](https://github.com/rubenvitt/bluelight-hub/commit/5e7bb47f) (etb): Add GetAllTeilnehmer query and improve auto-fill UX

## 🐛 Fehlerbehebungen

Diese Probleme wurden behoben:

- [`e0fa76a2`](https://github.com/rubenvitt/bluelight-hub/commit/e0fa76a2) (etb): Fix ETB response structure and add Funkrufname UI

- [`8383d0bf`](https://github.com/rubenvitt/bluelight-hub/commit/8383d0bf) (etb): Remove @SkipTransform to fix response wrapping

- [`a3288cae`](https://github.com/rubenvitt/bluelight-hub/commit/a3288cae) (etb): Fix metadata tests for new constructor signature

# [1.0.0-alpha.45](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.44...v1.0.0-alpha.45) (2026-01-17)

## Version [v1.0.0-alpha.44](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.43...v1.0.0-alpha.44) – Veröffentlicht am 2026-01-16

## ✨ Neue Funktionen

Die folgenden neuen Features wurden hinzugefügt:

- [`a8eec0fc`](https://github.com/rubenvitt/bluelight-hub/commit/a8eec0fc) (storage): Implement persistent server storage with tauri-plugin-store

## 🐛 Fehlerbehebungen

Diese Probleme wurden behoben:

- [`87c3309e`](https://github.com/rubenvitt/bluelight-hub/commit/87c3309e) (prisma): Fix prisma generate failing without DATABASE_URL

- [`d4f206c2`](https://github.com/rubenvitt/bluelight-hub/commit/d4f206c2) (test): Fix database-test.helper mock imports

- [`fc6402a0`](https://github.com/rubenvitt/bluelight-hub/commit/fc6402a0) (test): Fix database-test.helper mock imports

- [`d5c79574`](https://github.com/rubenvitt/bluelight-hub/commit/d5c79574) (test): Fix E2E tests failing with PostgreSQL 25P02 error

- [`c1ae4092`](https://github.com/rubenvitt/bluelight-hub/commit/c1ae4092) (test): Fix Prisma 7.x compatibility in OAuth e2e tests

- [`35526971`](https://github.com/rubenvitt/bluelight-hub/commit/35526971) (build): Exclude test files from shared package TypeScript build

- [`ea5d9ca9`](https://github.com/rubenvitt/bluelight-hub/commit/ea5d9ca9) (build): Use dedicated tsconfig.build.json for shared package

- [`96987025`](https://github.com/rubenvitt/bluelight-hub/commit/96987025) (di): Fix HibpService dependency injection and add CodeQL workflow

- [`c88029a7`](https://github.com/rubenvitt/bluelight-hub/commit/c88029a7) (auth): Add PasswordModule import to fix DI in tests

## 🔒 Sicherheitsverbesserungen

Sicherheitsrelevante Änderungen:

- [`b8e69a70`](https://github.com/rubenvitt/bluelight-hub/commit/b8e69a70) (auth): Implement NIST SP 800-63B-4 password policy

## 🧹 Codebereinigungen

Aufräumarbeiten und kleinere Verbesserungen:

- [`92a5532e`](https://github.com/rubenvitt/bluelight-hub/commit/92a5532e) (lint): Fix all Biome lint errors for CI pipeline

- [`e878182d`](https://github.com/rubenvitt/bluelight-hub/commit/e878182d) (lint): Fix remaining Biome lint errors

## 🔧 Tool Verbesserungen

Verbesserungen an den Werkzeugen:

- [`d6c76a5f`](https://github.com/rubenvitt/bluelight-hub/commit/d6c76a5f) (deps): Update dev dependencies to latest versions

- [`8adc6e0e`](https://github.com/rubenvitt/bluelight-hub/commit/8adc6e0e) (deps): Update frontend dependencies and migrate dotenvx

- [`7c879d60`](https://github.com/rubenvitt/bluelight-hub/commit/7c879d60) (deps): Update backend dependencies to latest versions

- [`c35db03d`](https://github.com/rubenvitt/bluelight-hub/commit/c35db03d) (deps): Update Tauri plugins and dependencies to latest versions

- [`7120fcb3`](https://github.com/rubenvitt/bluelight-hub/commit/7120fcb3) (config): Ignore generated Prisma client files

## 💥 Breaking Changes

Bitte beachtet folgende Änderungen, die möglicherweise Anpassungen erfordern:

- [`34a0963a`](https://github.com/rubenvitt/bluelight-hub/commit/34a0963a) (db): Migrate Prisma v6 to v7 with adapter pattern

# [1.0.0-alpha.44](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.43...v1.0.0-alpha.44) (2026-01-16)

- 💥(db): Migrate Prisma v6 to v7 with adapter pattern ([34a0963](https://github.com/rubenvitt/bluelight-hub/commit/34a0963a5d5f8930e80b302deeeb7a0128d156d1))

### BREAKING CHANGES

- Prisma v7 uses adapter pattern instead of query engine.
  All @prisma/client imports now resolve to generated client.

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>

## Version [v1.0.0-alpha.43](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.42...v1.0.0-alpha.43) – Veröffentlicht am 2026-01-16

## ✨ Neue Funktionen

Die folgenden neuen Features wurden hinzugefügt:

- [`6424913e`](https://github.com/rubenvitt/bluelight-hub/commit/6424913e) (storage): Implement persistent server storage with tauri-plugin-store

## 🐛 Fehlerbehebungen

Diese Probleme wurden behoben:

- [`fad4995b`](https://github.com/rubenvitt/bluelight-hub/commit/fad4995b) (prisma): Fix prisma generate failing without DATABASE_URL

- [`9ef30edd`](https://github.com/rubenvitt/bluelight-hub/commit/9ef30edd) (test): Fix database-test.helper mock imports

- [`14f24a29`](https://github.com/rubenvitt/bluelight-hub/commit/14f24a29) (test): Fix database-test.helper mock imports

- [`211a5d4e`](https://github.com/rubenvitt/bluelight-hub/commit/211a5d4e) (test): Fix E2E tests failing with PostgreSQL 25P02 error

- [`1e450fe2`](https://github.com/rubenvitt/bluelight-hub/commit/1e450fe2) (test): Fix Prisma 7.x compatibility in OAuth e2e tests

## 🧹 Codebereinigungen

Aufräumarbeiten und kleinere Verbesserungen:

- [`42a9f88a`](https://github.com/rubenvitt/bluelight-hub/commit/42a9f88a) (lint): Fix all Biome lint errors for CI pipeline

- [`fab33a38`](https://github.com/rubenvitt/bluelight-hub/commit/fab33a38) (lint): Fix remaining Biome lint errors

## 🔧 Tool Verbesserungen

Verbesserungen an den Werkzeugen:

- [`98daaa5f`](https://github.com/rubenvitt/bluelight-hub/commit/98daaa5f) (deps): Update dev dependencies to latest versions

- [`3977a369`](https://github.com/rubenvitt/bluelight-hub/commit/3977a369) (deps): Update frontend dependencies and migrate dotenvx

- [`091fe48b`](https://github.com/rubenvitt/bluelight-hub/commit/091fe48b) (deps): Update backend dependencies to latest versions

- [`5ed26259`](https://github.com/rubenvitt/bluelight-hub/commit/5ed26259) (deps): Update Tauri plugins and dependencies to latest versions

- [`32e126e4`](https://github.com/rubenvitt/bluelight-hub/commit/32e126e4) (config): Ignore generated Prisma client files

## 💥 Breaking Changes

Bitte beachtet folgende Änderungen, die möglicherweise Anpassungen erfordern:

- [`4a090856`](https://github.com/rubenvitt/bluelight-hub/commit/4a090856) (db): Migrate Prisma v6 to v7 with adapter pattern

# [1.0.0-alpha.43](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.42...v1.0.0-alpha.43) (2026-01-16)

- 💥(db): Migrate Prisma v6 to v7 with adapter pattern ([4a09085](https://github.com/rubenvitt/bluelight-hub/commit/4a0908565f4b5c68fd8f4c4d32164054c57ca9cf))

### BREAKING CHANGES

- Prisma v7 uses adapter pattern instead of query engine.
  All @prisma/client imports now resolve to generated client.

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>

## Version [v1.0.0-alpha.42](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.41...v1.0.0-alpha.42) – Veröffentlicht am 2026-01-15

## 🐛 Fehlerbehebungen

Diese Probleme wurden behoben:

- [`1e96c450`](https://github.com/rubenvitt/bluelight-hub/commit/1e96c450) (ui): Fix layout issues in button and color mode menu

# [1.0.0-alpha.42](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.41...v1.0.0-alpha.42) (2026-01-15)

## Version [v1.0.0-alpha.41](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.40...v1.0.0-alpha.41) – Veröffentlicht am 2026-01-14

## 🐛 Fehlerbehebungen

Diese Probleme wurden behoben:

- [`f1912e71`](https://github.com/rubenvitt/bluelight-hub/commit/f1912e71) (auth): Disable password manager autofill in login combobox
  (Zugehörige Issues: [`#309`](https://github.com/rubenvitt/bluelight-hub/issues/))

# [1.0.0-alpha.41](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.40...v1.0.0-alpha.41) (2026-01-14)

## Version [v1.0.0-alpha.40](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.39...v1.0.0-alpha.40) – Veröffentlicht am 2026-01-14

## ✨ Neue Funktionen

Die folgenden neuen Features wurden hinzugefügt:

- [`48b1f40a`](https://github.com/rubenvitt/bluelight-hub/commit/48b1f40a) (auth): Add server access token system for initial setup

- [`c9ed2c85`](https://github.com/rubenvitt/bluelight-hub/commit/c9ed2c85) (backend): Implement differentiated health endpoint (Story 1.4)

- [`662c1a4a`](https://github.com/rubenvitt/bluelight-hub/commit/662c1a4a) (auth): Add multi-server config foundation
  (Zugehörige Issues: [`#284`](https://github.com/rubenvitt/bluelight-hub/issues/))

- [`4464b9af`](https://github.com/rubenvitt/bluelight-hub/commit/4464b9af) (invite-code): Complete Story 1.7 - Invite-Code verwalten

- [`f8b5cde5`](https://github.com/rubenvitt/bluelight-hub/commit/f8b5cde5) (backend): implement invite codes

- [`227b21cc`](https://github.com/rubenvitt/bluelight-hub/commit/227b21cc) (admin): Implement Task 1 - Query Keys &amp; API Hook for Invite Management

- [`5f363d2a`](https://github.com/rubenvitt/bluelight-hub/commit/5f363d2a) (admin): Add InviteStatusBadge atom component

- [`88710011`](https://github.com/rubenvitt/bluelight-hub/commit/88710011) (admin-invites): Implement UI molecules for invite code management

- [`ce0f89c1`](https://github.com/rubenvitt/bluelight-hub/commit/ce0f89c1) (admin): Implement InviteCodeTable organism

- [`df1eb719`](https://github.com/rubenvitt/bluelight-hub/commit/df1eb719) (admin): Add Invite-Codes navigation link to AdminDashboard

- [`4246895a`](https://github.com/rubenvitt/bluelight-hub/commit/4246895a) (admin): Add /admin/invites route definition

- [`ba66db66`](https://github.com/rubenvitt/bluelight-hub/commit/ba66db66) (storage): Add Rust storage commands with Mutex-based state

- [`2a98106c`](https://github.com/rubenvitt/bluelight-hub/commit/2a98106c) (storage): Implement TauriStorageAdapter with Tauri invoke

- [`52919cca`](https://github.com/rubenvitt/bluelight-hub/commit/52919cca) (storage): Implement WebStorageAdapter with localStorage fallback

- [`806221ba`](https://github.com/rubenvitt/bluelight-hub/commit/806221ba) (storage): Add storage adapter factory with singleton pattern

- [`bef14edc`](https://github.com/rubenvitt/bluelight-hub/commit/bef14edc) (server): Create ServerConfig types and TanStack Store foundation

- [`61dd46d7`](https://github.com/rubenvitt/bluelight-hub/commit/61dd46d7) (server): Implement server CRUD actions (add/set/remove)

- [`c50b1633`](https://github.com/rubenvitt/bluelight-hub/commit/c50b1633) (server): Implement store hydration and useLoadServers hook

- [`ace7da33`](https://github.com/rubenvitt/bluelight-hub/commit/ace7da33) (server): Implement connection status tracking

- [`24db540a`](https://github.com/rubenvitt/bluelight-hub/commit/24db540a) (server): Add custom hooks for UI integration

- [`b5c4f46d`](https://github.com/rubenvitt/bluelight-hub/commit/b5c4f46d) (auth): Add Exchange Invite DTOs for Story 2.3

- [`08926c5d`](https://github.com/rubenvitt/bluelight-hub/commit/08926c5d) (auth): Implement ExchangeInviteHandler with Result pattern

- [`b286b2f4`](https://github.com/rubenvitt/bluelight-hub/commit/b286b2f4) (auth): Add exchange-invite endpoint to AuthController

- [`4677c28e`](https://github.com/rubenvitt/bluelight-hub/commit/4677c28e) (api): Generate API client with exchange-invite endpoint

- [`0628f87d`](https://github.com/rubenvitt/bluelight-hub/commit/0628f87d) (frontend): Add Tauri deep link plugin support

- [`8bde213a`](https://github.com/rubenvitt/bluelight-hub/commit/8bde213a) (frontend): Add DeepLinkService with event handling

- [`3f360cab`](https://github.com/rubenvitt/bluelight-hub/commit/3f360cab) (frontend): Add useExchangeInvite mutation hook

- [`eeeb8fff`](https://github.com/rubenvitt/bluelight-hub/commit/eeeb8fff) (frontend): Add Deep Link UI components (Loading, Error)

- [`2573751c`](https://github.com/rubenvitt/bluelight-hub/commit/2573751c) (frontend): Integrate Deep Link handler with navigation

- [`a8fb4be6`](https://github.com/rubenvitt/bluelight-hub/commit/a8fb4be6) (server): Add URL params types and validation schema

- [`eaa96372`](https://github.com/rubenvitt/bluelight-hub/commit/eaa96372) (server): Implement URL params parsing service

- [`7a533fce`](https://github.com/rubenvitt/bluelight-hub/commit/7a533fce) (server): Add URL param validation to root route

- [`64161a3d`](https://github.com/rubenvitt/bluelight-hub/commit/64161a3d) (server): Add useUrlParams hook with exchange logic

- [`509a1640`](https://github.com/rubenvitt/bluelight-hub/commit/509a1640) (server): Add URL params UI integration

- [`51656be4`](https://github.com/rubenvitt/bluelight-hub/commit/51656be4) (server): Add required server name validation with auto-fill

- [`488e7c0d`](https://github.com/rubenvitt/bluelight-hub/commit/488e7c0d) (server): Add back button on setup page when servers exist

- [`6c110aa7`](https://github.com/rubenvitt/bluelight-hub/commit/6c110aa7) (server): Implement multi-server configuration feature

- [`925870a7`](https://github.com/rubenvitt/bluelight-hub/commit/925870a7) (admin): Implement access token management (Story 4.1)

- [`bdb6337b`](https://github.com/rubenvitt/bluelight-hub/commit/bdb6337b) (admin): Implement token lifecycle management (Stories 4.2-4.6)

- [`8aa3e62b`](https://github.com/rubenvitt/bluelight-hub/commit/8aa3e62b) (general): add not committed files

- [`12e02354`](https://github.com/rubenvitt/bluelight-hub/commit/12e02354) (admin): Add default expiry (7 days) for invite codes

## 🐛 Fehlerbehebungen

Diese Probleme wurden behoben:

- [`93b0e0cd`](https://github.com/rubenvitt/bluelight-hub/commit/93b0e0cd) (auth): Fix token storage race condition and error handling

- [`d19ce476`](https://github.com/rubenvitt/bluelight-hub/commit/d19ce476) (invite-code): Fix missing LOGGER provider in module

- [`04f3cddb`](https://github.com/rubenvitt/bluelight-hub/commit/04f3cddb) (admin): Fix HTML validation error in InviteCodeTable skeleton

- [`26e7a389`](https://github.com/rubenvitt/bluelight-hub/commit/26e7a389) (invite-code): Add missing InviteCodeCreatedEvent serializer

- [`61f0fb8d`](https://github.com/rubenvitt/bluelight-hub/commit/61f0fb8d) (shared): Fix ESM imports in Backend tests and Frontend schemas

- [`8b46b465`](https://github.com/rubenvitt/bluelight-hub/commit/8b46b465) (server): Fix lastUsedAt null handling in useServerList hook

- [`742a59ab`](https://github.com/rubenvitt/bluelight-hub/commit/742a59ab) (server): Fix TypeScript errors in unit tests

- [`5dad6a87`](https://github.com/rubenvitt/bluelight-hub/commit/5dad6a87) (server): Replace deprecated Zod validators with refine()
  (Zugehörige Issues: [`#3`](https://github.com/rubenvitt/bluelight-hub/issues/))

- [`5f10998c`](https://github.com/rubenvitt/bluelight-hub/commit/5f10998c) (auth): Fix exchange-invite HTTP status code to 200 OK

- [`c84f137d`](https://github.com/rubenvitt/bluelight-hub/commit/c84f137d) (auth): Fix race condition and transaction rollback (Issues #2 &amp; #3)
  (Zugehörige Issues: [`#2`](https://github.com/rubenvitt/bluelight-hub/issues/), [`#3`](https://github.com/rubenvitt/bluelight-hub/issues/), [`#2`](https://github.com/rubenvitt/bluelight-hub/issues/), [`#3`](https://github.com/rubenvitt/bluelight-hub/issues/))

- [`42540bee`](https://github.com/rubenvitt/bluelight-hub/commit/42540bee) (frontend): Fix TypeScript errors in DeepLinkService

- [`07fbc9f3`](https://github.com/rubenvitt/bluelight-hub/commit/07fbc9f3) (frontend): Fix Tauri deep-link plugin API usage

- [`969e5eac`](https://github.com/rubenvitt/bluelight-hub/commit/969e5eac) (frontend): Fix API client import path across codebase

- [`f0865b2e`](https://github.com/rubenvitt/bluelight-hub/commit/f0865b2e) (frontend): Fix API client import and test wrapper scope

- [`89defe5d`](https://github.com/rubenvitt/bluelight-hub/commit/89defe5d) (frontend): Fix ReactElement import in mutations tests

- [`bcef1b57`](https://github.com/rubenvitt/bluelight-hub/commit/bcef1b57) (frontend): Fix TypeScript errors in Deep Link integration

- [`11956709`](https://github.com/rubenvitt/bluelight-hub/commit/11956709) (frontend): Add method overloads for DeepLinkService.off()

- [`191cf97e`](https://github.com/rubenvitt/bluelight-hub/commit/191cf97e) (deep-link): Fix critical code review issues (Story 2.4)

- [`4bdc8e07`](https://github.com/rubenvitt/bluelight-hub/commit/4bdc8e07) (server): Fix TypeScript errors in UI components

- [`c085bcce`](https://github.com/rubenvitt/bluelight-hub/commit/c085bcce) (server): Fix TanStack Form validation API pattern

- [`10d76edf`](https://github.com/rubenvitt/bluelight-hub/commit/10d76edf) (server): Fix critical code review issues for Story 2.5
  (Zugehörige Issues: [`#1`](https://github.com/rubenvitt/bluelight-hub/issues/), [`#2`](https://github.com/rubenvitt/bluelight-hub/issues/), [`#3`](https://github.com/rubenvitt/bluelight-hub/issues/), [`#4`](https://github.com/rubenvitt/bluelight-hub/issues/), [`#5`](https://github.com/rubenvitt/bluelight-hub/issues/), [`#6`](https://github.com/rubenvitt/bluelight-hub/issues/))

- [`9924e9e5`](https://github.com/rubenvitt/bluelight-hub/commit/9924e9e5) (server): Fix Code Review Issues for Story 2.7
  (Zugehörige Issues: [`#1`](https://github.com/rubenvitt/bluelight-hub/issues/), [`#2`](https://github.com/rubenvitt/bluelight-hub/issues/), [`#3`](https://github.com/rubenvitt/bluelight-hub/issues/), [`#4`](https://github.com/rubenvitt/bluelight-hub/issues/), [`#5`](https://github.com/rubenvitt/bluelight-hub/issues/), [`#6`](https://github.com/rubenvitt/bluelight-hub/issues/), [`#7`](https://github.com/rubenvitt/bluelight-hub/issues/))

- [`c19c891d`](https://github.com/rubenvitt/bluelight-hub/commit/c19c891d) (frontend): Add missing format-last-used.ts to git

- [`70347135`](https://github.com/rubenvitt/bluelight-hub/commit/70347135) (backend): Fix E2E tests for SetupPendingGuard requirements

- [`2d506234`](https://github.com/rubenvitt/bluelight-hub/commit/2d506234) (admin): Add API versioning to admin controllers

- [`475fd9f2`](https://github.com/rubenvitt/bluelight-hub/commit/475fd9f2) (admin): Fix Story 4.6 code review issues

- [`19ff89f8`](https://github.com/rubenvitt/bluelight-hub/commit/19ff89f8) (auth): Make accessToken validation optional in AdminJwtStrategy

## 🔒 Sicherheitsverbesserungen

Sicherheitsrelevante Änderungen:

- [`93749c11`](https://github.com/rubenvitt/bluelight-hub/commit/93749c11) (security): Fix CodeQL security vulnerabilities

## 🧹 Codebereinigungen

Aufräumarbeiten und kleinere Verbesserungen:

- [`29f7bb5b`](https://github.com/rubenvitt/bluelight-hub/commit/29f7bb5b) (frontend): Cleanup unused imports in DeepLinkService

## ♻ Refactoring

Struktur- oder Code-Verbesserungen:

- [`5baaf964`](https://github.com/rubenvitt/bluelight-hub/commit/5baaf964) (frontend): Code Review Fixes for Story 1.7a

- [`cd6977d0`](https://github.com/rubenvitt/bluelight-hub/commit/cd6977d0) (storage): Code review fixes for Story 2.1

- [`7844e666`](https://github.com/rubenvitt/bluelight-hub/commit/7844e666) (auth): Use milliseconds() for cookie maxAge readability

## 🔧 Tool Verbesserungen

Verbesserungen an den Werkzeugen:

- [`921d4b6b`](https://github.com/rubenvitt/bluelight-hub/commit/921d4b6b) (ci): Add GitGuardian config to exclude test files

# [1.0.0-alpha.40](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.39...v1.0.0-alpha.40) (2026-01-14)

## Version [v1.0.0-alpha.39](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.38...v1.0.0-alpha.39) – Veröffentlicht am 2026-01-05

## 🐛 Fehlerbehebungen

Diese Probleme wurden behoben:

- [`4045ab91`](https://github.com/rubenvitt/bluelight-hub/commit/4045ab91) (ci): Fix macOS artifact upload path for cross-compilation

# [1.0.0-alpha.39](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.38...v1.0.0-alpha.39) (2026-01-05)

## Version [v1.0.0-alpha.38](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.37...v1.0.0-alpha.38) – Veröffentlicht am 2026-01-05

## ✨ Neue Funktionen

Die folgenden neuen Features wurden hinzugefügt:

- [`4ce80d84`](https://github.com/rubenvitt/bluelight-hub/commit/4ce80d84) (frontend): Add dynamic system status badges
  (Zugehörige Issues: [`#301`](https://github.com/rubenvitt/bluelight-hub/issues/))

## 🐛 Fehlerbehebungen

Diese Probleme wurden behoben:

- [`733c5f14`](https://github.com/rubenvitt/bluelight-hub/commit/733c5f14) (frontend): Fix MSI version format for Tauri builds

- [`e2650c6f`](https://github.com/rubenvitt/bluelight-hub/commit/e2650c6f) (frontend): Fix MSI version format for Tauri builds

# [1.0.0-alpha.38](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.37...v1.0.0-alpha.38) (2026-01-05)

## Version [v1.0.0-alpha.37](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.36...v1.0.0-alpha.37) – Veröffentlicht am 2026-01-05

## ✨ Neue Funktionen

Die folgenden neuen Features wurden hinzugefügt:

- [`429d79e3`](https://github.com/rubenvitt/bluelight-hub/commit/429d79e3) (geo-coordinate): Add GeoJSON serialization methods (Story 0-3)

- [`70fa8fb6`](https://github.com/rubenvitt/bluelight-hub/commit/70fa8fb6) (kraefte): Implement RollenDefinition + Fahrzeugtyp CRUD

- [`0aad5452`](https://github.com/rubenvitt/bluelight-hub/commit/0aad5452) (kraefte): Complete Fahrzeugtypen CRUD + Story docs (1.2, 1.3)

- [`a39cff90`](https://github.com/rubenvitt/bluelight-hub/commit/a39cff90) (kraefte): Implement FunkStatusConfig Domain Layer (Story 1-4)

- [`8585e31e`](https://github.com/rubenvitt/bluelight-hub/commit/8585e31e) (kraefte): Add StammFahrzeug Query Handlers + Fix bugs (Story 2-1)

- [`77f8d9d8`](https://github.com/rubenvitt/bluelight-hub/commit/77f8d9d8) (kraefte): Add StammPerson Domain Layer (Story 2.2)

- [`8314db44`](https://github.com/rubenvitt/bluelight-hub/commit/8314db44) (kraefte): Implement Stamm-Personen CRUD (Story 2.2)

- [`dbeba43c`](https://github.com/rubenvitt/bluelight-hub/commit/dbeba43c) (frontend): Add temporäres Fahrzeug UI (Story 3-2 Task 5)

- [`1b820a9a`](https://github.com/rubenvitt/bluelight-hub/commit/1b820a9a) (kraefte): Add POST /temporary endpoint for Story 3-2

- [`088b9082`](https://github.com/rubenvitt/bluelight-hub/commit/088b9082) (kraefte): Add FMS-Status UI components (Story 3.3 Task 7)

- [`17b34f60`](https://github.com/rubenvitt/bluelight-hub/commit/17b34f60) (kraefte): Add Infrastructure Layer for EinsatzPerson

- [`e260274b`](https://github.com/rubenvitt/bluelight-hub/commit/e260274b) (kraefte): Add ETB auto-creation for person registration (Story 4-1)

- [`8b3ae8a7`](https://github.com/rubenvitt/bluelight-hub/commit/8b3ae8a7) (kraefte): Add PersonHinzufuegenDialog component (Story 4-1)

- [`06ae06f4`](https://github.com/rubenvitt/bluelight-hub/commit/06ae06f4) (kraefte): Add StammPersonen autocomplete to PersonHinzufuegenDialog

- [`49e3f254`](https://github.com/rubenvitt/bluelight-hub/commit/49e3f254) (kraefte): Implement QR code person registration (Story 4-2)

- [`72d1719c`](https://github.com/rubenvitt/bluelight-hub/commit/72d1719c) (kraefte): Add Tauri barcode-scanner support and improve QR detection

- [`aa71befc`](https://github.com/rubenvitt/bluelight-hub/commit/aa71befc) (kraefte): Add person-to-vehicle assignment frontend

- [`896c36e0`](https://github.com/rubenvitt/bluelight-hub/commit/896c36e0) (kraefte): Story 5.1 - Rollenbesetzung mit Qualifikation

- [`fee8af4f`](https://github.com/rubenvitt/bluelight-hub/commit/fee8af4f) (kraefte): Story 5.2 - Rolle freigeben mit Soft-Delete
  (Zugehörige Issues: [`#1`](https://github.com/rubenvitt/bluelight-hub/issues/), [`#2`](https://github.com/rubenvitt/bluelight-hub/issues/))

- [`79953978`](https://github.com/rubenvitt/bluelight-hub/commit/79953978) (kraefte): Epic 6 - Taktische Übersicht Dashboard

- [`82317c2f`](https://github.com/rubenvitt/bluelight-hub/commit/82317c2f) (kraefte): Story 6.2 - Fullscreen &amp; Compact Modus

- [`eaa09074`](https://github.com/rubenvitt/bluelight-hub/commit/eaa09074) (kraefte): TD2-Person-Picker + RollenDefinitionenPicker

- [`83f20e56`](https://github.com/rubenvitt/bluelight-hub/commit/83f20e56) (integrations): Add HiOrg-Server OAuth2 integration

- [`cf2d053a`](https://github.com/rubenvitt/bluelight-hub/commit/cf2d053a) (integrations): Add inline Qualifikation-Mapping during HiOrg import

- [`1d0cb204`](https://github.com/rubenvitt/bluelight-hub/commit/1d0cb204) (lagekarte): Add GeoJSON POIs endpoint for Kraefte on map

- [`0cea3b31`](https://github.com/rubenvitt/bluelight-hub/commit/0cea3b31) (lagekarte): Add Fahrzeuge als POIs auf Lagekarte (Story 8.1)
  (Zugehörige Issues: [`#808080`](https://github.com/rubenvitt/bluelight-hub/issues/))

- [`2624cab9`](https://github.com/rubenvitt/bluelight-hub/commit/2624cab9) (lagekarte): Integrate FahrzeugPoiLayer in LagekarteView

## 🐛 Fehlerbehebungen

Diese Probleme wurden behoben:

- [`1e4f4981`](https://github.com/rubenvitt/bluelight-hub/commit/1e4f4981) (tests): Remove useless catch clauses in qualifikation handler tests

- [`77cc0013`](https://github.com/rubenvitt/bluelight-hub/commit/77cc0013) (frontend): Fix useEffect dependency in EditQualifikationDialog

- [`bcedfe2d`](https://github.com/rubenvitt/bluelight-hub/commit/bcedfe2d) (kraefte): Fix CRITICAL and HIGH review issues (Story 1.1 R11)

- [`a3abad70`](https://github.com/rubenvitt/bluelight-hub/commit/a3abad70) (kraefte): Fix Story 1.3 code review issues (4 fixes)

- [`169ed914`](https://github.com/rubenvitt/bluelight-hub/commit/169ed914) (frontend): Fix Qualifikationen API response + validation

- [`831b936d`](https://github.com/rubenvitt/bluelight-hub/commit/831b936d) (kraefte): Fix Code Review issues for Story 3.2 (Temporäres Fahrzeug)

- [`a4b5d4dc`](https://github.com/rubenvitt/bluelight-hub/commit/a4b5d4dc) (kraefte): Fix empty position object validation in UpdateFmsStatusDto

- [`8ab6b694`](https://github.com/rubenvitt/bluelight-hub/commit/8ab6b694) (kraefte): Fix idempotency in EinsatzFahrzeug.updateFmsStatus

- [`bb86cd7c`](https://github.com/rubenvitt/bluelight-hub/commit/bb86cd7c) (kraefte): Fix Story 3.3 Code Review Round 3 Issues

- [`a78338b7`](https://github.com/rubenvitt/bluelight-hub/commit/a78338b7) (kraefte): Fix Logger DI in UpdateFmsStatusHandler (AC3)

- [`2f885436`](https://github.com/rubenvitt/bluelight-hub/commit/2f885436) (kraefte): Fix Story 4.1 Code Review Issues (Round 1)

- [`6ca7f135`](https://github.com/rubenvitt/bluelight-hub/commit/6ca7f135) (kraefte): Fix Story 4.1 Code Review Issues (Round 2 + 3)

- [`50aba091`](https://github.com/rubenvitt/bluelight-hub/commit/50aba091) (kraefte): Fix video play() interrupted error in QrScannerTab

- [`57362bd1`](https://github.com/rubenvitt/bluelight-hub/commit/57362bd1) (kraefte): Fix QrScannerTab infinite loop and Tauri compatibility

- [`bcff96fe`](https://github.com/rubenvitt/bluelight-hub/commit/bcff96fe) (kraefte): Fix barcode-scanner for desktop Tauri

- [`73732508`](https://github.com/rubenvitt/bluelight-hub/commit/73732508) (kraefte): Fix critical memory leaks and race condition in QR scanner

- [`ecdb7668`](https://github.com/rubenvitt/bluelight-hub/commit/ecdb7668) (kraefte): Fix API response extraction in useEinsatzPersonen

- [`69db01b7`](https://github.com/rubenvitt/bluelight-hub/commit/69db01b7) (repo): sync einsatz detail cache responses

- [`d6284fb4`](https://github.com/rubenvitt/bluelight-hub/commit/d6284fb4) (kraefte): Fix domain validation and event timestamps (D1-D3)

- [`932f6632`](https://github.com/rubenvitt/bluelight-hub/commit/932f6632) (kraefte): Fix Backend BLOCKER Issues (C2+C3) - Story 4.3

- [`860d5e87`](https://github.com/rubenvitt/bluelight-hub/commit/860d5e87) (kraefte): Fix handler pattern violation (A1)

- [`7db87eb3`](https://github.com/rubenvitt/bluelight-hub/commit/7db87eb3) (kraefte): Fix input validation order in removeFromFahrzeug (D1)

- [`fef1561a`](https://github.com/rubenvitt/bluelight-hub/commit/fef1561a) (validation): Fix @IsCuid decorator for CUID2 format

- [`4af470dd`](https://github.com/rubenvitt/bluelight-hub/commit/4af470dd) (kraefte): Fix domain validation and event timestamps (D1-D3)

- [`2bf299e4`](https://github.com/rubenvitt/bluelight-hub/commit/2bf299e4) (kraefte): Fix Story 5.1 Review Issues - ETB Handler Registration

- [`852bd0f8`](https://github.com/rubenvitt/bluelight-hub/commit/852bd0f8) (integrations): Fix ConfigService DI in AesEncryptionAdapter

- [`b17b5955`](https://github.com/rubenvitt/bluelight-hub/commit/b17b5955) (integrations): Fix HiOrgTokenRefreshService DI imports

- [`2139ea5b`](https://github.com/rubenvitt/bluelight-hub/commit/2139ea5b) (integrations): Fix import type for ILogger breaking DI at runtime
  (Zugehörige Issues: [`#3`](https://github.com/rubenvitt/bluelight-hub/issues/))

- [`4dba6e7f`](https://github.com/rubenvitt/bluelight-hub/commit/4dba6e7f) (tests): Fix ADMIN_JWT_SECRET missing in CI for E2E tests

- [`06eb881b`](https://github.com/rubenvitt/bluelight-hub/commit/06eb881b) (tests): Add global test secrets to jest.setup.ts

- [`a6678812`](https://github.com/rubenvitt/bluelight-hub/commit/a6678812) (tests): Add INTEGRATION_ENCRYPTION_KEY to test secrets

## 🔒 Sicherheitsverbesserungen

Sicherheitsrelevante Änderungen:

- [`60f086e5`](https://github.com/rubenvitt/bluelight-hub/commit/60f086e5) (kraefte): Fix security + AC3 compliance (Story 1.1 R12)

- [`2cd2947a`](https://github.com/rubenvitt/bluelight-hub/commit/2cd2947a) (kraefte): Add stricter rate limits for mutation endpoints

- [`10f78ba5`](https://github.com/rubenvitt/bluelight-hub/commit/10f78ba5) (kraefte): Add ParseCuidPipe validation to route params (C1)

- [`c959246b`](https://github.com/rubenvitt/bluelight-hub/commit/c959246b) (kraefte): Fix ReDoS vulnerability in QR validation regex

## ♻ Refactoring

Struktur- oder Code-Verbesserungen:

- [`8d7c031e`](https://github.com/rubenvitt/bluelight-hub/commit/8d7c031e) (kraefte): Refactor Prisma error meta handling pattern

- [`2a1d675b`](https://github.com/rubenvitt/bluelight-hub/commit/2a1d675b) (kraefte): Remove dead code in CreateRollenDefinitionHandler

- [`00053ace`](https://github.com/rubenvitt/bluelight-hub/commit/00053ace) (kraefte): Add einsatzId CUID2 validation in commands (A2)

- [`e7d0920a`](https://github.com/rubenvitt/bluelight-hub/commit/e7d0920a) (outbox): Update event count and format (I1 partial)

- [`7ad05c56`](https://github.com/rubenvitt/bluelight-hub/commit/7ad05c56) (api-client): Regenerate WeisePersonZuFahrzeugZuDto

- [`24884e1a`](https://github.com/rubenvitt/bluelight-hub/commit/24884e1a) (kraefte): TD2.1 - Migrate Admin Controllers to @ApiWrappedResponse

- [`e432bd65`](https://github.com/rubenvitt/bluelight-hub/commit/e432bd65) (frontend): Update Headless UI v2 + TanStack Pacer APIs

- [`fe6d0784`](https://github.com/rubenvitt/bluelight-hub/commit/fe6d0784) (backend): Move config adapters and add logger to handlers

## 🔧 Tool Verbesserungen

Verbesserungen an den Werkzeugen:

- [`7fcff634`](https://github.com/rubenvitt/bluelight-hub/commit/7fcff634) (shared): Generate API clients for Rollen + Fahrzeugtypen

- [`dc2b93b2`](https://github.com/rubenvitt/bluelight-hub/commit/dc2b93b2) (husky): Remove deprecated shebang and source lines from pre-commit

- [`6a777450`](https://github.com/rubenvitt/bluelight-hub/commit/6a777450) (config): Swap backend/frontend ports for consistency

- [`4961fd4c`](https://github.com/rubenvitt/bluelight-hub/commit/4961fd4c) (ide): Update IntelliJ run configurations for Jest 30

- [`c15e3146`](https://github.com/rubenvitt/bluelight-hub/commit/c15e3146) (config): Add alternative AI tool configurations

# [1.0.0-alpha.37](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.36...v1.0.0-alpha.37) (2026-01-05)

## Version [v1.0.0-alpha.36](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.35...v1.0.0-alpha.36) – Veröffentlicht am 2025-12-09

## 🔧 Tool Verbesserungen

Verbesserungen an den Werkzeugen:

- [`25403f7f`](https://github.com/rubenvitt/bluelight-hub/commit/25403f7f) (ci): Fix semantic-release success handler bug

# [1.0.0-alpha.36](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.35...v1.0.0-alpha.36) (2025-12-09)

## Version [v1.0.0-alpha.35](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.34...v1.0.0-alpha.35) – Veröffentlicht am 2025-12-09

## ✨ Neue Funktionen

Die folgenden neuen Features wurden hinzugefügt:

- [`c07e650d`](https://github.com/rubenvitt/bluelight-hub/commit/c07e650d) (domain): Implement Result&lt;T&gt; pattern for domain layer error handling

- [`3ac19021`](https://github.com/rubenvitt/bluelight-hub/commit/3ac19021) (domain): Implement ValueObject&lt;TProps&gt; base class for DDD

- [`c5d68231`](https://github.com/rubenvitt/bluelight-hub/commit/c5d68231) (domain): Implement EntityId&lt;TAggregateType&gt; with nanoid validation

- [`be9d6829`](https://github.com/rubenvitt/bluelight-hub/commit/be9d6829) (domain): Add DomainEvent base class with auto-generated eventId

- [`84539ea7`](https://github.com/rubenvitt/bluelight-hub/commit/84539ea7) (domain): Add AggregateRoot&lt;TId&gt; base class with events

- [`f1ce3d83`](https://github.com/rubenvitt/bluelight-hub/commit/f1ce3d83) (domain): Implement 4 Domain Events for Einsatz Aggregate

- [`132c0cad`](https://github.com/rubenvitt/bluelight-hub/commit/132c0cad) (domain): Implement complete Einsatz aggregate with business logic

- [`598e1a53`](https://github.com/rubenvitt/bluelight-hub/commit/598e1a53) (domain): Implement all 6 Value Objects for ETB Aggregate

- [`b19fc56d`](https://github.com/rubenvitt/bluelight-hub/commit/b19fc56d) (domain): Implement ETB Aggregate with Business Logic

- [`7955b763`](https://github.com/rubenvitt/bluelight-hub/commit/7955b763) (domain): Fix ETB Repository &amp; Aggregate type safety

- [`5a610648`](https://github.com/rubenvitt/bluelight-hub/commit/5a610648) (domain): Implement 5 Lagekarte Value Objects with MGRS support

- [`d7ad42f6`](https://github.com/rubenvitt/bluelight-hub/commit/d7ad42f6) (domain): Implement Poi Entity for Lagekarte

- [`a95ac2d1`](https://github.com/rubenvitt/bluelight-hub/commit/a95ac2d1) (domain): Implement 3 Lagekarte Domain Events with unit tests

- [`82a7fd05`](https://github.com/rubenvitt/bluelight-hub/commit/82a7fd05) (domain): Implement LagekarteAggregate with POI management

- [`1ea7c3a0`](https://github.com/rubenvitt/bluelight-hub/commit/1ea7c3a0) (domain): Define ILagekarteRepository and IGeocodingPort interfaces

- [`45421eca`](https://github.com/rubenvitt/bluelight-hub/commit/45421eca) (domain): Implement Permission Value Object mit Wildcard Matching

- [`7bcc7195`](https://github.com/rubenvitt/bluelight-hub/commit/7bcc7195) (domain): Implement UserRole VO with RBAC hierarchy

- [`aab5a5fb`](https://github.com/rubenvitt/bluelight-hub/commit/aab5a5fb) (domain): Implement 5 User Domain Events

- [`9c1558dd`](https://github.com/rubenvitt/bluelight-hub/commit/9c1558dd) (domain): Implement UserAggregate with RBAC Business Logic

- [`2e845f5f`](https://github.com/rubenvitt/bluelight-hub/commit/2e845f5f) (infrastructure): Add PostgreSQL triggers for NO-DELETE policy

- [`6b98ee91`](https://github.com/rubenvitt/bluelight-hub/commit/6b98ee91) (application): Implement AddPoiCommand with Handler and Tests

- [`e4194c97`](https://github.com/rubenvitt/bluelight-hub/commit/e4194c97) (application): Implement RemovePoiCommand with tests

- [`f200360b`](https://github.com/rubenvitt/bluelight-hub/commit/f200360b) (application): Implement UpdatePoiPositionCommand and Handler

- [`61086afb`](https://github.com/rubenvitt/bluelight-hub/commit/61086afb) (application): Complete Lagekarte Command Layer Integration

- [`9e9571fd`](https://github.com/rubenvitt/bluelight-hub/commit/9e9571fd) (lagekarte): Add beschreibung support to LagekarteAggregate.addPoi()

- [`faf15c62`](https://github.com/rubenvitt/bluelight-hub/commit/faf15c62) (application): Setup Lagekarte Application Layer structure and DTOs

- [`547d5020`](https://github.com/rubenvitt/bluelight-hub/commit/547d5020) (lagekarte): Implement LagekarteMapper and PoiMapper for Query Layer

- [`2fe773a7`](https://github.com/rubenvitt/bluelight-hub/commit/2fe773a7) (lagekarte): Implement GetLagekarteQuery and Handler

- [`0c5f4cbb`](https://github.com/rubenvitt/bluelight-hub/commit/0c5f4cbb) (application): Implement GetPoisQuery and Handler

- [`9b96e288`](https://github.com/rubenvitt/bluelight-hub/commit/9b96e288) (application): Implement GetLagekarteExistsQuery with Handler

- [`8e7a4337`](https://github.com/rubenvitt/bluelight-hub/commit/8e7a4337) (application): Integrate Query Handlers in Lagekarte Module

- [`a6de42c6`](https://github.com/rubenvitt/bluelight-hub/commit/a6de42c6) (lagekarte): Add integration tests for Query Layer handlers

- [`8708abda`](https://github.com/rubenvitt/bluelight-hub/commit/8708abda) (lagekarte): Add PrismaLagekarteRepository integration tests

- [`b2af93ae`](https://github.com/rubenvitt/bluelight-hub/commit/b2af93ae) (infrastructure): Register NominatimGeocodingAdapter in DI container

- [`5841dbac`](https://github.com/rubenvitt/bluelight-hub/commit/5841dbac) (lagekarte): Add comprehensive unit tests for LagekarteCqrsController

- [`b3a05945`](https://github.com/rubenvitt/bluelight-hub/commit/b3a05945) (etb): Implement ETB Application Layer with CQRS pattern

- [`47eb30c4`](https://github.com/rubenvitt/bluelight-hub/commit/47eb30c4) (etb): Implementiere vollständige E2E Test-Infrastruktur

- [`39478dad`](https://github.com/rubenvitt/bluelight-hub/commit/39478dad) (einsatz): Implementiere Unit Tests für Command Handler

- [`d0c8d4d9`](https://github.com/rubenvitt/bluelight-hub/commit/d0c8d4d9) (einsatz): Add GetEinsatzByIdQuery handler with full test coverage

- [`0179526a`](https://github.com/rubenvitt/bluelight-hub/commit/0179526a) (einsatz): Register EinsatzInfrastructureModule + Integration Tests

- [`d6972f35`](https://github.com/rubenvitt/bluelight-hub/commit/d6972f35) (auth): Refactor AuthController zu CQRS Pattern

- [`2475a42a`](https://github.com/rubenvitt/bluelight-hub/commit/2475a42a) (einsatz): Add GetStatusCountsQuery and Handler for Einsatz statistics

- [`fc9bfa2c`](https://github.com/rubenvitt/bluelight-hub/commit/fc9bfa2c) (einsatz): Add ETB and POI counts display to dashboard components

- [`974f267f`](https://github.com/rubenvitt/bluelight-hub/commit/974f267f) (tests): Add Outbox Pattern Integration Tests (AC1.1-1.7)

- [`7d6b8c62`](https://github.com/rubenvitt/bluelight-hub/commit/7d6b8c62) (application): Add TransactionalCommandHandler for Outbox Pattern

- [`ca2968b3`](https://github.com/rubenvitt/bluelight-hub/commit/ca2968b3) (infrastructure): Add Prisma Error Mapper Service

- [`e05db15b`](https://github.com/rubenvitt/bluelight-hub/commit/e05db15b) (exception): Add DomainExceptionFilter for HTTP mapping

- [`b7320ced`](https://github.com/rubenvitt/bluelight-hub/commit/b7320ced) (einsatz): Add findEligibleForArchival method to IEinsatzRepository

- [`622a008a`](https://github.com/rubenvitt/bluelight-hub/commit/622a008a) (cli): Add CLI command for bulk archival of old Einsätze

- [`3b844380`](https://github.com/rubenvitt/bluelight-hub/commit/3b844380) (auth): Migrate to TanStack-Native Feature Architecture

- [`eb53f412`](https://github.com/rubenvitt/bluelight-hub/commit/eb53f412) (einsatz): Add includeArchived filter and fix archival policy

## 🐛 Fehlerbehebungen

Diese Probleme wurden behoben:

- [`2f281e7e`](https://github.com/rubenvitt/bluelight-hub/commit/2f281e7e) (backend): Fix review findings for Story 1-1 domain layer setup

- [`6951a95e`](https://github.com/rubenvitt/bluelight-hub/commit/6951a95e) (lagekarte): Fix integration tests by using valid POI categories

- [`b59d49c8`](https://github.com/rubenvitt/bluelight-hub/commit/b59d49c8) (test): Fix PrismaLagekarteMapper test API usage

- [`24288cca`](https://github.com/rubenvitt/bluelight-hub/commit/24288cca) (lagekarte): Fix AC3 category filter &amp; AC4 enums

- [`a68ce70d`](https://github.com/rubenvitt/bluelight-hub/commit/a68ce70d) (events): Fix EventEmitter2 DI injection in EventEmitterPublisher

- [`0527fa19`](https://github.com/rubenvitt/bluelight-hub/commit/0527fa19) (etb): Add kategorie field to CQRS layer with proper DDD architecture

- [`d738d633`](https://github.com/rubenvitt/bluelight-hub/commit/d738d633) (etb): Fix missing etbId in updateEintrag mutation call

- [`09d962ac`](https://github.com/rubenvitt/bluelight-hub/commit/09d962ac) (etb): Fix missing etbId in EditEtbEntryModal and EtbPage

- [`efc3fb54`](https://github.com/rubenvitt/bluelight-hub/commit/efc3fb54) (etb): Fix UpdateEintragDto data structure - use newText only

- [`55f8d73a`](https://github.com/rubenvitt/bluelight-hub/commit/55f8d73a) (domain): Fix UserId validation for Nanoid format &amp; DI import types

- [`84aa0ceb`](https://github.com/rubenvitt/bluelight-hub/commit/84aa0ceb) (etb): Behandle 409 Conflict in useCreateEtb Hook korrekt

- [`4dea9e1e`](https://github.com/rubenvitt/bluelight-hub/commit/4dea9e1e) (etb): Remove IEventPublisher from tests (Outbox Pattern)

- [`465d0e61`](https://github.com/rubenvitt/bluelight-hub/commit/465d0e61) (lagekarte): Add IEventPublisher mocks to handler unit tests

- [`d3e069f7`](https://github.com/rubenvitt/bluelight-hub/commit/d3e069f7) (tests): Fix UserId and EtbAutoCreation unit tests for CUID2 migration

- [`c1600fd9`](https://github.com/rubenvitt/bluelight-hub/commit/c1600fd9) (lagekarte): Remove automatic ETB creation from export handler

- [`780da73e`](https://github.com/rubenvitt/bluelight-hub/commit/780da73e) (lagekarte): Add 404 handling to useLagekarte hook

- [`732e5b83`](https://github.com/rubenvitt/bluelight-hub/commit/732e5b83) (error-handler): Suppress 404 toast globally

- [`48b3c43c`](https://github.com/rubenvitt/bluelight-hub/commit/48b3c43c) (einsatz): Fix DI type imports in all handlers

- [`46c61d0b`](https://github.com/rubenvitt/bluelight-hub/commit/46c61d0b) (auth): Fix logout endpoint - extract JWT from cookie instead of header

- [`a37dd9a7`](https://github.com/rubenvitt/bluelight-hub/commit/a37dd9a7) (einsatz): Fix useActiveEinsaetzeWithCounts response parsing

- [`e217049a`](https://github.com/rubenvitt/bluelight-hub/commit/e217049a) (api): Fix active-with-counts response mismatch causing console errors

- [`e858595c`](https://github.com/rubenvitt/bluelight-hub/commit/e858595c) (tests): Fix Jest coverage configuration and outbox test schema

- [`8ab46c75`](https://github.com/rubenvitt/bluelight-hub/commit/8ab46c75) (einsatz): Fix E2E tests - App-Konfiguration und URL-Pfade korrigiert

- [`81a83fb8`](https://github.com/rubenvitt/bluelight-hub/commit/81a83fb8) (backend): Fix DI type imports &amp; add missing Einsatz endpoints

- [`36b6bd03`](https://github.com/rubenvitt/bluelight-hub/commit/36b6bd03) (backend): Add biome-ignore comments for DI imports

- [`cfbf8eae`](https://github.com/rubenvitt/bluelight-hub/commit/cfbf8eae) (outbox): Fix AC4.1 violation - remove eventEmitter from EinsatzService

- [`eee59cfa`](https://github.com/rubenvitt/bluelight-hub/commit/eee59cfa) (backend): Fix import type DI errors for Injectable Classes

- [`4b3fac1a`](https://github.com/rubenvitt/bluelight-hub/commit/4b3fac1a) (handlers): Fix TypeScript error in ArchiveOldEinsaetzeHandler

- [`cad7bba7`](https://github.com/rubenvitt/bluelight-hub/commit/cad7bba7) (di): Migrate IEinsatzRepository from string to Symbol DI token

- [`582a4004`](https://github.com/rubenvitt/bluelight-hub/commit/582a4004) (di): Fix DI error in GetTextbausteineHandler

- [`1298370f`](https://github.com/rubenvitt/bluelight-hub/commit/1298370f) (frontend): Fix remaining import path issues

- [`71856d95`](https://github.com/rubenvitt/bluelight-hub/commit/71856d95) (frontend): Fix TanStack Form useStore API usage

- [`f06a1ec2`](https://github.com/rubenvitt/bluelight-hub/commit/f06a1ec2) (frontend): Fix linter warnings in SingleEinsatzLayout

- [`6684f9bd`](https://github.com/rubenvitt/bluelight-hub/commit/6684f9bd) (frontend): Extract .data from wrapped API responses

- [`48de8e20`](https://github.com/rubenvitt/bluelight-hub/commit/48de8e20) (frontend): Restore EtbPage to features/etb/ui/pages/

- [`a430a70b`](https://github.com/rubenvitt/bluelight-hub/commit/a430a70b) (frontend): Fix import error in use-toolbar-positioning hook

- [`f234e84c`](https://github.com/rubenvitt/bluelight-hub/commit/f234e84c) (infrastructure): Fix domain event clearing in repositories

- [`3970b6ba`](https://github.com/rubenvitt/bluelight-hub/commit/3970b6ba) (ci): Fix DATABASE_URL propagation for integration tests

- [`654da3e0`](https://github.com/rubenvitt/bluelight-hub/commit/654da3e0) (backend): Fix complete-einsatz tests to use Result Pattern

- [`76694c55`](https://github.com/rubenvitt/bluelight-hub/commit/76694c55) (tests): Migrate tests to Result Pattern and add database guards

- [`02579708`](https://github.com/rubenvitt/bluelight-hub/commit/02579708) (tests): Fix integration tests for Result Pattern migration

- [`4e84e51f`](https://github.com/rubenvitt/bluelight-hub/commit/4e84e51f) (tests): Fix ETB_REPOSITORY DI token in etb-auto-creation test

- [`ce788c28`](https://github.com/rubenvitt/bluelight-hub/commit/ce788c28) (tests): Fix outbox integration test architecture

- [`d0b26d1f`](https://github.com/rubenvitt/bluelight-hub/commit/d0b26d1f) (tests): Fix integration test issues for CI

- [`eb85dc63`](https://github.com/rubenvitt/bluelight-hub/commit/eb85dc63) (tests): Fix remaining einsatz-controller.e2e.spec failures

- [`17f396c2`](https://github.com/rubenvitt/bluelight-hub/commit/17f396c2) (einsatz): Return 404 for non-existent Einsatz in complete endpoint

- [`e2b1b950`](https://github.com/rubenvitt/bluelight-hub/commit/e2b1b950) (tests): Fix test assertions for handler and e2e tests

## 🔒 Sicherheitsverbesserungen

Sicherheitsrelevante Änderungen:

- [`8611124b`](https://github.com/rubenvitt/bluelight-hub/commit/8611124b) (deps): Update glob and js-yaml to fix security vulnerabilities

- [`1f9eecfc`](https://github.com/rubenvitt/bluelight-hub/commit/1f9eecfc) (application): Sanitize error messages to prevent ID disclosure

- [`803e8709`](https://github.com/rubenvitt/bluelight-hub/commit/803e8709) (lagekarte): Fix 3 MEDIUM security issues in Query Layer

- [`a2ef4ad1`](https://github.com/rubenvitt/bluelight-hub/commit/a2ef4ad1) (lagekarte): Fix regex sanitization bypass vulnerability Replaced tag-matching regex /&lt;[^&gt;]\*&gt;/g with single-character replacement /[&lt;&gt;]/g to prevent nested bypass attacks like &#x27;&lt;scr&lt;script&gt;ipt&gt;&#x27; as flagged by CodeQL. Refs: CWE-20, CWE-80, CWE-116

## 🧹 Codebereinigungen

Aufräumarbeiten und kleinere Verbesserungen:

- [`473c4c2c`](https://github.com/rubenvitt/bluelight-hub/commit/473c4c2c) (cleanup): Remove old 3-Tier architecture services

## ♻ Refactoring

Struktur- oder Code-Verbesserungen:

- [`f1d8c579`](https://github.com/rubenvitt/bluelight-hub/commit/f1d8c579) (lagekarte): Standardize Result.ok(undefined) pattern

- [`5c86cf60`](https://github.com/rubenvitt/bluelight-hub/commit/5c86cf60) (lagekarte): Refactor commands to use Result&lt;T&gt; factory pattern

- [`2d19a833`](https://github.com/rubenvitt/bluelight-hub/commit/2d19a833) (application): Extract coordinate conversion to shared helper

- [`62ecf732`](https://github.com/rubenvitt/bluelight-hub/commit/62ecf732) (lagekarte): Replace non-null assertions with safe unwrapping

- [`0850f091`](https://github.com/rubenvitt/bluelight-hub/commit/0850f091) (lagekarte): Extract validation logic to shared validators

- [`dff63c6f`](https://github.com/rubenvitt/bluelight-hub/commit/dff63c6f) (lagekarte): Extract test helper code duplication

- [`b9572469`](https://github.com/rubenvitt/bluelight-hub/commit/b9572469) (lagekarte): Refactor Controller to use CommandBus/QueryBus

- [`70331677`](https://github.com/rubenvitt/bluelight-hub/commit/70331677) (lagekarte): Fix Response DTOs and add @HttpCode(204)

- [`5a0e8b78`](https://github.com/rubenvitt/bluelight-hub/commit/5a0e8b78) (einsatz): Refactor string validation with centralized validators

- [`54cc44ca`](https://github.com/rubenvitt/bluelight-hub/commit/54cc44ca) (etb): Refactor EtbCreatedEvent emission to Aggregate

- [`1db0b2e0`](https://github.com/rubenvitt/bluelight-hub/commit/1db0b2e0) (etb): Handle 404 gracefully in useEtb hook

- [`a4e1fbfc`](https://github.com/rubenvitt/bluelight-hub/commit/a4e1fbfc) (einsatz): Refactor EinsatzController to CQRS pattern

- [`8f60cdea`](https://github.com/rubenvitt/bluelight-hub/commit/8f60cdea) (frontend): Enhance useEinsatzDetails with retry &amp; error handling

- [`c55aa15b`](https://github.com/rubenvitt/bluelight-hub/commit/c55aa15b) (einsatz): Migrate CreateEinsatzHandler to Outbox Pattern

- [`b22d72aa`](https://github.com/rubenvitt/bluelight-hub/commit/b22d72aa) (einsatz): Migrate handlers to TransactionalCommandHandler

- [`040130f6`](https://github.com/rubenvitt/bluelight-hub/commit/040130f6) (repository): Remove duplicate PrismaEinsatzRepository implementation

- [`2d6ad981`](https://github.com/rubenvitt/bluelight-hub/commit/2d6ad981) (einsatz): Remove redundant clearDomainEvents() from Command Handlers

- [`0e121774`](https://github.com/rubenvitt/bluelight-hub/commit/0e121774) (einsatz): Migrate UpdateEinsatzStatusHandler to domain exceptions

- [`0c537f43`](https://github.com/rubenvitt/bluelight-hub/commit/0c537f43) (backend): Delete old services and migrate controllers to CQRS

- [`8d9e0040`](https://github.com/rubenvitt/bluelight-hub/commit/8d9e0040) (einsatz): Migrate GetAllEinsaetzeQueryHandler to IEinsatzRepository

- [`5a700fc0`](https://github.com/rubenvitt/bluelight-hub/commit/5a700fc0) (einsatz): Migrate old DTOs to Application Layer

- [`9b7899c5`](https://github.com/rubenvitt/bluelight-hub/commit/9b7899c5) (lagekarte): Migrate PoiPlacementControl to CQRS POI categories

- [`8b3b7ea0`](https://github.com/rubenvitt/bluelight-hub/commit/8b3b7ea0) (lagekarte): Remove legacy POI type mapping from usePoiForm

- [`13368bd0`](https://github.com/rubenvitt/bluelight-hub/commit/13368bd0) (events): Introduce EVENT_NAMES constants for event names

- [`06797c40`](https://github.com/rubenvitt/bluelight-hub/commit/06797c40) (di): Migrate string-literal DI tokens to Symbol-based DI_TOKENS

- [`ead9da56`](https://github.com/rubenvitt/bluelight-hub/commit/ead9da56) (application): Replace HTTP exceptions with Result pattern (AC3)

- [`779af1b0`](https://github.com/rubenvitt/bluelight-hub/commit/779af1b0) (cleanup): Remove duplicate einsatz/events (use domain/events)

- [`a93e652f`](https://github.com/rubenvitt/bluelight-hub/commit/a93e652f) (arch): Complete hexagonal architecture migration with Biome fixes

- [`58c6e298`](https://github.com/rubenvitt/bluelight-hub/commit/58c6e298) (lagekarte): Migrate to feature-based architecture

- [`0fd8b0aa`](https://github.com/rubenvitt/bluelight-hub/commit/0fd8b0aa) (frontend): Update imports to use @/shared/\* paths

- [`cd439eda`](https://github.com/rubenvitt/bluelight-hub/commit/cd439eda) (frontend): Migrate @atoms/ and @molecules/ aliases to full paths

- [`71264cb7`](https://github.com/rubenvitt/bluelight-hub/commit/71264cb7) (frontend): Remove empty legacy directory stores/persistence

- [`a2c68a73`](https://github.com/rubenvitt/bluelight-hub/commit/a2c68a73) (frontend): Migrate guards to features/auth/guards/

- [`8e7d054b`](https://github.com/rubenvitt/bluelight-hub/commit/8e7d054b) (frontend): Migrate einsatz schemas to features/einsatz/schemas/

- [`47594c2f`](https://github.com/rubenvitt/bluelight-hub/commit/47594c2f) (frontend): Remove useUsers duplicate, use features/auth

- [`b7e15fab`](https://github.com/rubenvitt/bluelight-hub/commit/b7e15fab) (frontend): Migrate lagekarte utils to features/lagekarte/

- [`7dc7a3be`](https://github.com/rubenvitt/bluelight-hub/commit/7dc7a3be) (frontend): Migrate einsatz hooks to features/einsatz/

- [`28eef11e`](https://github.com/rubenvitt/bluelight-hub/commit/28eef11e) (frontend): Migrate queryKeys.ts to feature-specific query keys

- [`da451b21`](https://github.com/rubenvitt/bluelight-hub/commit/da451b21) (frontend): Consolidate utils/ into feature and shared directories

- [`e68492f4`](https://github.com/rubenvitt/bluelight-hub/commit/e68492f4) (frontend): Split lagekarte API hooks into separate files

- [`4d23e809`](https://github.com/rubenvitt/bluelight-hub/commit/4d23e809) (frontend): Migrate Einsatz UI components to features/einsatz/ui

- [`3fb89ab7`](https://github.com/rubenvitt/bluelight-hub/commit/3fb89ab7) (frontend): Migrate admin UI to features/admin/ui/

- [`a129b117`](https://github.com/rubenvitt/bluelight-hub/commit/a129b117) (frontend): Clean up legacy component directories and empty folders

- [`b88b9043`](https://github.com/rubenvitt/bluelight-hub/commit/b88b9043) (frontend): Consolidate shared UI components to shared/ui/

- [`553c4cea`](https://github.com/rubenvitt/bluelight-hub/commit/553c4cea) (frontend): Move index.page to features, remove components/

- [`8610c1c0`](https://github.com/rubenvitt/bluelight-hub/commit/8610c1c0) (frontend): Restructure shared/utils into cleaner modules

- [`73cc6894`](https://github.com/rubenvitt/bluelight-hub/commit/73cc6894) (backend): Fix architecture violations - Domain/Application layers

## 🔧 Tool Verbesserungen

Verbesserungen an den Werkzeugen:

- [`68117c55`](https://github.com/rubenvitt/bluelight-hub/commit/68117c55) (backend): Fix Jest test:domain script and Biome config

- [`5fc30694`](https://github.com/rubenvitt/bluelight-hub/commit/5fc30694) (frontend): Migrate ports to standard range (3091 Vite, 3090 API)

- [`0070d9bd`](https://github.com/rubenvitt/bluelight-hub/commit/0070d9bd) (infra): Migrate Database &amp; Prisma Studio ports to 30xx range

- [`0526740d`](https://github.com/rubenvitt/bluelight-hub/commit/0526740d) (backend): Migrate backend port from 3000 to 3090

- [`723db221`](https://github.com/rubenvitt/bluelight-hub/commit/723db221) (backend): Exclude example files from Jest coverage

- [`22366bb3`](https://github.com/rubenvitt/bluelight-hub/commit/22366bb3) (backend): Add Biome ignore comment for entity-id.ts static method

- [`48543d8f`](https://github.com/rubenvitt/bluelight-hub/commit/48543d8f) (domain): Fix TypeScript compilation errors from code review

- [`86029ce4`](https://github.com/rubenvitt/bluelight-hub/commit/86029ce4) (lagekarte): Register LagekarteInfrastructureModule and fix DI

- [`039fdd3a`](https://github.com/rubenvitt/bluelight-hub/commit/039fdd3a) (di): Register ArchiveOldEinsaetzeHandler in EinsatzApplicationModule

- [`488a14c7`](https://github.com/rubenvitt/bluelight-hub/commit/488a14c7) (git-hooks): Add circular dependency check to pre-commit

- [`a5f47166`](https://github.com/rubenvitt/bluelight-hub/commit/a5f47166) (ci): Add test:unit script for running tests without database

- [`5b82934f`](https://github.com/rubenvitt/bluelight-hub/commit/5b82934f) (tests): Lower coverage threshold to 79% for CI stability

- [`d24c180b`](https://github.com/rubenvitt/bluelight-hub/commit/d24c180b) (tests): Skip flaky performance consistency test on CI Shared runners have unpredictable performance characteristics (GC pauses, noisy neighbors, cold starts) that cause false positives in the max/avg ratio assertion. Test runs locally only.

- [`7c21dea6`](https://github.com/rubenvitt/bluelight-hub/commit/7c21dea6) (ci): Remove unused Claude workflow configurations

- [`547accca`](https://github.com/rubenvitt/bluelight-hub/commit/547accca) (ci): Use native ARM64 runners for multi-arch Docker builds

- [`36852174`](https://github.com/rubenvitt/bluelight-hub/commit/36852174) (ci): Fix release workflow with native ARM64 runners

- [`f2d20161`](https://github.com/rubenvitt/bluelight-hub/commit/f2d20161) (ci): Always generate Prisma client in build action

# [1.0.0-alpha.35](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.34...v1.0.0-alpha.35) (2025-12-09)

## Version [v1.0.0-alpha.34](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.33...v1.0.0-alpha.34) – Veröffentlicht am 2025-11-11

## ✨ Neue Funktionen

Die folgenden neuen Features wurden hinzugefügt:

## 🔧 Tool Verbesserungen

Verbesserungen an den Werkzeugen:

- [`c8bfbde`](https://github.com/rubenvitt/bluelight-hub/commit/c8bfbde) (config): Erweitere CodeRabbit ignore patterns für AI-Verzeichnisse

# [1.0.0-alpha.34](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.33...v1.0.0-alpha.34) (2025-11-11)

## Version [v1.0.0-alpha.33](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.32...v1.0.0-alpha.33) – Veröffentlicht am 2025-11-10

## ✨ Neue Funktionen

Die folgenden neuen Features wurden hinzugefügt:

- [`6a0363d`](https://github.com/rubenvitt/bluelight-hub/commit/6a0363d) (shared): Generate complete API client from OpenAPI spec

# [1.0.0-alpha.33](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.32...v1.0.0-alpha.33) (2025-11-10)

## Version [v1.0.0-alpha.32](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.31...v1.0.0-alpha.32) – Veröffentlicht am 2025-11-09

## ✨ Neue Funktionen

Die folgenden neuen Features wurden hinzugefügt:

- [`b520904`](https://github.com/rubenvitt/bluelight-hub/commit/b520904) (etb): Implement ETB entry form with user management integration

- [`9adb53c`](https://github.com/rubenvitt/bluelight-hub/commit/9adb53c) (etb): Add history tracking and enhanced table view with auto-creation

- [`572fa30`](https://github.com/rubenvitt/bluelight-hub/commit/572fa30) (etb): Add deleter username display and rate limiting

- [`a41872e`](https://github.com/rubenvitt/bluelight-hub/commit/a41872e) (auth): Password Strength Indicator für Admin-Setup
  (Zugehörige Issues: [`#198`](https://github.com/rubenvitt/bluelight-hub/issues/))

- [`44bb79e`](https://github.com/rubenvitt/bluelight-hub/commit/44bb79e) (frontend): Integriere zxcvbn für Passwort-Stärke-Bewertung
  (Zugehörige Issues: [`#230`](https://github.com/rubenvitt/bluelight-hub/issues/))

- [`b2e206e`](https://github.com/rubenvitt/bluelight-hub/commit/b2e206e) (user-management): Add soft delete and manual lock functionality

- [`50fce92`](https://github.com/rubenvitt/bluelight-hub/commit/50fce92) (frontend): Implement Lagekarte view with OSM tiles integration

- [`8cbece9`](https://github.com/rubenvitt/bluelight-hub/commit/8cbece9) (backend): Implement Lagekarte POI-Management System

- [`64eeae5`](https://github.com/rubenvitt/bluelight-hub/commit/64eeae5) (backend): Implement Lagekarte controllers and integration tests

- [`fee248b`](https://github.com/rubenvitt/bluelight-hub/commit/fee248b) (lagekarte): Implement PoiLayer component for POI markers

- [`04d8dfb`](https://github.com/rubenvitt/bluelight-hub/commit/04d8dfb) (lagekarte): Implement multi-POI marker system for Lagekarte

- [`877226b`](https://github.com/rubenvitt/bluelight-hub/commit/877226b) (lagekarte): Implement POI placement system

- [`c1c06c8`](https://github.com/rubenvitt/bluelight-hub/commit/c1c06c8) (lagekarte): Implement drawing tools for hazard/restricted areas

- [`7bb8c63`](https://github.com/rubenvitt/bluelight-hub/commit/7bb8c63) (lagekarte): Implement text tool in drawing toolbar

- [`6575a95`](https://github.com/rubenvitt/bluelight-hub/commit/6575a95) (lagekarte): Flexbox-Layout für Map-Werkzeuge implementiert

- [`dc01200`](https://github.com/rubenvitt/bluelight-hub/commit/dc01200) (lagekarte): Add text content change handler for drawing markers

- [`fce2f23`](https://github.com/rubenvitt/bluelight-hub/commit/fce2f23) (lagekarte): Install leaflet.markercluster library with CSS imports

- [`036e267`](https://github.com/rubenvitt/bluelight-hub/commit/036e267) (lagekarte): Add ClusteredPoiLayer with MarkerClusterGroup

- [`742583e`](https://github.com/rubenvitt/bluelight-hub/commit/742583e) (lagekarte): Configure MarkerClusterGroup clustering options

- [`8455a61`](https://github.com/rubenvitt/bluelight-hub/commit/8455a61) (lagekarte): Add custom Tailwind cluster icons with dynamic sizing

- [`8bf1c21`](https://github.com/rubenvitt/bluelight-hub/commit/8bf1c21) (lagekarte): Integrate ClusteredPoiLayer in LagekarteView

- [`f85fdb3`](https://github.com/rubenvitt/bluelight-hub/commit/f85fdb3) (lagekarte): Add debounced auto-save for Lagekarte state

- [`46f16ac`](https://github.com/rubenvitt/bluelight-hub/commit/46f16ac) (lagekarte): Enable offline-first mode for Lagekarte queries/mutations

- [`8a682cd`](https://github.com/rubenvitt/bluelight-hub/commit/8a682cd) (lagekarte): Add Last-Write-Wins conflict handling warning

- [`e4414ae`](https://github.com/rubenvitt/bluelight-hub/commit/e4414ae) (lagekarte): Add Offline-Download toolbar button

- [`16e5ecc`](https://github.com/rubenvitt/bluelight-hub/commit/16e5ecc) (lagekarte): Add Offline-Region-Modal with zoom controls

- [`126f06e`](https://github.com/rubenvitt/bluelight-hub/commit/126f06e) (lagekarte): Implement Bounding-Box-Selection for Offline-Download

- [`7cf39e3`](https://github.com/rubenvitt/bluelight-hub/commit/7cf39e3) (offline-download): Implement tile count calculation

- [`76c29aa`](https://github.com/rubenvitt/bluelight-hub/commit/76c29aa) (offline-download): Add storage quota check

- [`5b04b91`](https://github.com/rubenvitt/bluelight-hub/commit/5b04b91) (offline-download): Implement tile download utility

- [`22ea69e`](https://github.com/rubenvitt/bluelight-hub/commit/22ea69e) (offline-download): Integrate tile download with progress bar

- [`b14402f`](https://github.com/rubenvitt/bluelight-hub/commit/b14402f) (offline-lagekarte): Complete Tasks 9-12 for offline tile functionality

- [`46cd7ca`](https://github.com/rubenvitt/bluelight-hub/commit/46cd7ca) (lagekarte): Add ETB screenshot export feature

- [`c461bf6`](https://github.com/rubenvitt/bluelight-hub/commit/c461bf6) (backend): Add ENV-based uploads path configuration

- [`59652e1`](https://github.com/rubenvitt/bluelight-hub/commit/59652e1) (frontend): Add screenshot preview to ETB entry details

- [`113c6bd`](https://github.com/rubenvitt/bluelight-hub/commit/113c6bd) (feature): Add kategorisierungsdokumentation to ETB system

- [`3d29a13`](https://github.com/rubenvitt/bluelight-hub/commit/3d29a13) (etb): Add fullscreen mode to ETB view

- [`073eddd`](https://github.com/rubenvitt/bluelight-hub/commit/073eddd) (tauri): Add automatic window orientation switching

- [`570e77f`](https://github.com/rubenvitt/bluelight-hub/commit/570e77f) (lagekarte): Add Shape-Selection with Click-to-Select
  (Zugehörige Issues: [`#3`](https://github.com/rubenvitt/bluelight-hub/issues/))

- [`62c8b05`](https://github.com/rubenvitt/bluelight-hub/commit/62c8b05) (lagekarte): Add Context-Menu and Keyboard Delete for Shapes

- [`9645805`](https://github.com/rubenvitt/bluelight-hub/commit/9645805) (lagekarte): Add Property Panel for Shape Editing

- [`58e5605`](https://github.com/rubenvitt/bluelight-hub/commit/58e5605) (lagekarte): Add MGRS coordinate conversion utilities

- [`ccaa677`](https://github.com/rubenvitt/bluelight-hub/commit/ccaa677) (lagekarte): Add MGRS coordinate support for POIs

## 🐛 Fehlerbehebungen

Diese Probleme wurden behoben:

- [`bef332c`](https://github.com/rubenvitt/bluelight-hub/commit/bef332c) (etb): Fix incorrect query invalidation when deleting ETB entries

- [`53ca2b1`](https://github.com/rubenvitt/bluelight-hub/commit/53ca2b1) (shared): Fix CI build by compiling TypeScript in build:ci

- [`5f4665b`](https://github.com/rubenvitt/bluelight-hub/commit/5f4665b) (backend): Apply QA-review fixes for Lagekarte POI system

- [`0e5004e`](https://github.com/rubenvitt/bluelight-hub/commit/0e5004e) (lagekarte): Fix POI-Endpoint lazy creation

- [`9d7613a`](https://github.com/rubenvitt/bluelight-hub/commit/9d7613a) (lagekarte): Fix z-index hierarchy for dialogs

- [`086bd65`](https://github.com/rubenvitt/bluelight-hub/commit/086bd65) (lagekarte): Fix Drawing-Tools kritische Fehler

- [`5a0c0f2`](https://github.com/rubenvitt/bluelight-hub/commit/5a0c0f2) (lagekarte): Fix Edit-Mode &amp; Label-Modal

- [`4a4e339`](https://github.com/rubenvitt/bluelight-hub/commit/4a4e339) (lagekarte): Fix TanStack Pacer API usage in auto-save hook

- [`fbc808c`](https://github.com/rubenvitt/bluelight-hub/commit/fbc808c) (offline-lagekarte): Fix leaflet.offline event listeners

- [`98990f1`](https://github.com/rubenvitt/bluelight-hub/commit/98990f1) (offline-lagekarte): Fix map reference for tile downloads

- [`502ee6d`](https://github.com/rubenvitt/bluelight-hub/commit/502ee6d) (offline-lagekarte): Fix event listener warnings

- [`c452ed9`](https://github.com/rubenvitt/bluelight-hub/commit/c452ed9) (offline-lagekarte): Add toast notifications for tile downloads

- [`dfdea6d`](https://github.com/rubenvitt/bluelight-hub/commit/dfdea6d) (frontend): Fix enum type conversion and remove UI clutter

- [`dc40f9f`](https://github.com/rubenvitt/bluelight-hub/commit/dc40f9f) (backend): Add multer dependencies for file upload

- [`50694fa`](https://github.com/rubenvitt/bluelight-hub/commit/50694fa) (backend): Fix TypeScript error in screenshot upload

- [`9d46a1a`](https://github.com/rubenvitt/bluelight-hub/commit/9d46a1a) (lagekarte): Fix ETB-Screenshot-Export Bugs

- [`df17a43`](https://github.com/rubenvitt/bluelight-hub/commit/df17a43) (backend): Fix uploads directory path for monorepo

- [`f118ebe`](https://github.com/rubenvitt/bluelight-hub/commit/f118ebe) (backend): Increase payload size limit for screenshot uploads

- [`3071a5a`](https://github.com/rubenvitt/bluelight-hub/commit/3071a5a) (backend): Fix multer destination callback context issue

- [`efb3046`](https://github.com/rubenvitt/bluelight-hub/commit/efb3046) (frontend): Fix screenshot URL extraction from wrapped API response

- [`065b73b`](https://github.com/rubenvitt/bluelight-hub/commit/065b73b) (tauri): Fix LogicalSize import from correct module

- [`cf3cd26`](https://github.com/rubenvitt/bluelight-hub/commit/cf3cd26) (qa-review): Fix review issues from PR feedback

- [`deb846b`](https://github.com/rubenvitt/bluelight-hub/commit/deb846b) (lagekarte): Fix Drawing-Toolbar position from top-24 to top-40

- [`fe5e2e0`](https://github.com/rubenvitt/bluelight-hub/commit/fe5e2e0) (lagekarte): Fix zwei kritische Bugs in Lagekarte-Feature

- [`f485045`](https://github.com/rubenvitt/bluelight-hub/commit/f485045) (lagekarte): Verbessere Error-Logging bei ETB-Screenshot-Export

- [`1d5d090`](https://github.com/rubenvitt/bluelight-hub/commit/1d5d090) (lagekarte): Fix ETB-Screenshot-Export - API-Client Sync

- [`2774e88`](https://github.com/rubenvitt/bluelight-hub/commit/2774e88) (lagekarte): Fix Edit-Button and Color Display Bugs

- [`f77383f`](https://github.com/rubenvitt/bluelight-hub/commit/f77383f) (lagekarte): Fix Edit/Delete-Buttons und Farb-Update Live-Anzeige

- [`1f13557`](https://github.com/rubenvitt/bluelight-hub/commit/1f13557) (lagekarte): Fix POI-Platzierungs-Crash durch DrawingLayer-Unmount

- [`91bcbd5`](https://github.com/rubenvitt/bluelight-hub/commit/91bcbd5) (lagekarte): Fix alle &quot;wrong listener type: undefined&quot; Errors

- [`499b76f`](https://github.com/rubenvitt/bluelight-hub/commit/499b76f) (lagekarte): Fix verbleibende layer.pm.enable() Errors in DrawingLayer

- [`e8405c4`](https://github.com/rubenvitt/bluelight-hub/commit/e8405c4) (lagekarte): Fix Race Conditions - Stabile Handler &amp; PM-Event-Checks
  (Zugehörige Issues: [`#1`](https://github.com/rubenvitt/bluelight-hub/issues/), [`#2`](https://github.com/rubenvitt/bluelight-hub/issues/))

- [`f32769d`](https://github.com/rubenvitt/bluelight-hub/commit/f32769d) (lagekarte): Fix fehlende PM-Checks in OfflineRegionModal map.off()

- [`2049a31`](https://github.com/rubenvitt/bluelight-hub/commit/2049a31) (lagekarte): Fix Stabilität durch defensive PM-Checks und Modal-Fixes

## 🔒 Sicherheitsverbesserungen

Sicherheitsrelevante Änderungen:

- [`2217793`](https://github.com/rubenvitt/bluelight-hub/commit/2217793) (tauri): Add window resize permissions to capabilities

## ♻ Refactoring

Struktur- oder Code-Verbesserungen:

- [`b7b3d45`](https://github.com/rubenvitt/bluelight-hub/commit/b7b3d45) (etb): Remove duplicate kategorieLabels definition

- [`31d21bc`](https://github.com/rubenvitt/bluelight-hub/commit/31d21bc) (etb): Use Textarea atom props instead of className overrides

- [`9662c65`](https://github.com/rubenvitt/bluelight-hub/commit/9662c65) (etb): Remove duplicate type definition and redundant refetch

- [`483b8cc`](https://github.com/rubenvitt/bluelight-hub/commit/483b8cc) (ui): Make LoadingState height configurable

- [`f5aa90b`](https://github.com/rubenvitt/bluelight-hub/commit/f5aa90b) (backend): Refactor Einsatz-ETB dependency with domain events

- [`b3b1ce3`](https://github.com/rubenvitt/bluelight-hub/commit/b3b1ce3) (ui): Move filter reset to Dialog.Footer for API consistency
  (Zugehörige Issues: [`#227`](https://github.com/rubenvitt/bluelight-hub/issues/))

- [`3d00886`](https://github.com/rubenvitt/bluelight-hub/commit/3d00886) (frontend): Use EinsatzDetailView in einsaetze route

- [`d1a7873`](https://github.com/rubenvitt/bluelight-hub/commit/d1a7873) (api): Replace manual POI interface with generated PoiResponseDto

- [`2160eb7`](https://github.com/rubenvitt/bluelight-hub/commit/2160eb7) (lagekarte): Apply QA code improvements for drawing tools

- [`4f341dd`](https://github.com/rubenvitt/bluelight-hub/commit/4f341dd) (lagekarte): QA refactorings für Marker-Clustering

- [`6ca641a`](https://github.com/rubenvitt/bluelight-hub/commit/6ca641a) (backend): Use absolute paths for uploads directory

- [`330f68b`](https://github.com/rubenvitt/bluelight-hub/commit/330f68b) (backend): Consolidate static file serving with ServeStaticModule

- [`67cf54d`](https://github.com/rubenvitt/bluelight-hub/commit/67cf54d) (docs): Refactor CLAUDE.md and remove all test infrastructure

- [`81e6139`](https://github.com/rubenvitt/bluelight-hub/commit/81e6139) (lagekarte): Refactor POI Placement Control into Atomic Components

- [`c7e03c9`](https://github.com/rubenvitt/bluelight-hub/commit/c7e03c9) (frontend): Redundante Tailwind-Klassen in Label entfernen

- [`b3da781`](https://github.com/rubenvitt/bluelight-hub/commit/b3da781) (lagekarte): Refactor DrawingLayer in Custom Hooks

## 🔧 Tool Verbesserungen

Verbesserungen an den Werkzeugen:

- [`d1be55c`](https://github.com/rubenvitt/bluelight-hub/commit/d1be55c) (config): Add uploads directory to gitignore

# [1.0.0-alpha.32](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.31...v1.0.0-alpha.32) (2025-11-09)

- ♻️(api): Replace manual POI interface with generated PoiResponseDto ([d1a7873](https://github.com/rubenvitt/bluelight-hub/commit/d1a787361ed5e280d49ff0cdfa56387ad625fc99))

### BREAKING CHANGES

- - Manual LagekartePoi interface removed - use generated PoiResponseDto

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>

## Version [v1.0.0-alpha.31](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.30...v1.0.0-alpha.31) – Veröffentlicht am 2025-09-26

## ✨ Neue Funktionen

Die folgenden neuen Features wurden hinzugefügt:

- [`0173652`](https://github.com/rubenvitt/bluelight-hub/commit/0173652) (frontend): Add ETB hooks with TanStack Query integration

## 🔧 Tool Verbesserungen

Verbesserungen an den Werkzeugen:

- [`a5987b9`](https://github.com/rubenvitt/bluelight-hub/commit/a5987b9) (api): Update generated API clients and query keys

# [1.0.0-alpha.31](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.30...v1.0.0-alpha.31) (2025-09-26)

## Version [v1.0.0-alpha.30](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.29...v1.0.0-alpha.30) – Veröffentlicht am 2025-09-26

## ♻ Refactoring

Struktur- oder Code-Verbesserungen:

- [`c991cc7`](https://github.com/rubenvitt/bluelight-hub/commit/c991cc7) (backend): Refactor ETB module with type safety and atomic operations

# [1.0.0-alpha.30](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.29...v1.0.0-alpha.30) (2025-09-26)

## Version [v1.0.0-alpha.29](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.28...v1.0.0-alpha.29) – Veröffentlicht am 2025-09-26

## ✨ Neue Funktionen

Die folgenden neuen Features wurden hinzugefügt:

- [`4d4386c`](https://github.com/rubenvitt/bluelight-hub/commit/4d4386c) (backend): Add ETB (Einsatztagebuch) module with full CRUD operations

- [`2874b41`](https://github.com/rubenvitt/bluelight-hub/commit/2874b41) (backend): Add comprehensive ETB response DTOs with validation

# [1.0.0-alpha.29](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.28...v1.0.0-alpha.29) (2025-09-26)

## Version [v1.0.0-alpha.28](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.27...v1.0.0-alpha.28) – Veröffentlicht am 2025-09-23

## 🔧 Tool Verbesserungen

Verbesserungen an den Werkzeugen:

- [`590bbcf`](https://github.com/rubenvitt/bluelight-hub/commit/590bbcf) (backend): TypeScript-Strenge erhöht &amp; Type-Fehler behoben
  (Zugehörige Issues: [`#214`](https://github.com/rubenvitt/bluelight-hub/issues/))

- [`368c709`](https://github.com/rubenvitt/bluelight-hub/commit/368c709) (backend): Complete TypeScript strict mode migration

# [1.0.0-alpha.28](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.27...v1.0.0-alpha.28) (2025-09-23)

## Version [v1.0.0-alpha.27](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.26...v1.0.0-alpha.27) – Veröffentlicht am 2025-09-23

## ♻ Refactoring

Struktur- oder Code-Verbesserungen:

- [`32622d3`](https://github.com/rubenvitt/bluelight-hub/commit/32622d3) (workspace): Stabilisiere pnpm-Workspace-Ausführung
  (Zugehörige Issues: [`#212`](https://github.com/rubenvitt/bluelight-hub/issues/))

- [`c26c364`](https://github.com/rubenvitt/bluelight-hub/commit/c26c364) (workspace): Stabilisiere pnpm-Workspace-Ausführung

# [1.0.0-alpha.27](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.26...v1.0.0-alpha.27) (2025-09-23)

## Version [v1.0.0-alpha.26](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.25...v1.0.0-alpha.26) – Veröffentlicht am 2025-09-21

## ✨ Neue Funktionen

Die folgenden neuen Features wurden hinzugefügt:

- [`8381717`](https://github.com/rubenvitt/bluelight-hub/commit/8381717) (frontend): erweitere Dialog Component um Varianten und vereinfachte API

## 🐛 Fehlerbehebungen

Diese Probleme wurden behoben:

- [`dba7d73`](https://github.com/rubenvitt/bluelight-hub/commit/dba7d73) (frontend): Fix enum value handling in MobileFilterDialog

## ♻ Refactoring

Struktur- oder Code-Verbesserungen:

- [`4886895`](https://github.com/rubenvitt/bluelight-hub/commit/4886895) (frontend): Migrate SlideInPanel to Dialog.SlideIn variant

# [1.0.0-alpha.26](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.25...v1.0.0-alpha.26) (2025-09-21)

## Version [v1.0.0-alpha.25](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.24...v1.0.0-alpha.25) – Veröffentlicht am 2025-09-19

## ✨ Neue Funktionen

Die folgenden neuen Features wurden hinzugefügt:

- [`c798157`](https://github.com/rubenvitt/bluelight-hub/commit/c798157) (frontend): Add Command Palette with keyboard shortcuts

- [`b1cd850`](https://github.com/rubenvitt/bluelight-hub/commit/b1cd850) (frontend): Add error boundary and improve Command Palette stability

## ♻ Refactoring

Struktur- oder Code-Verbesserungen:

- [`0317e2d`](https://github.com/rubenvitt/bluelight-hub/commit/0317e2d) (frontend): Extract Command Palette hooks into separate modules

- [`7fbc19f`](https://github.com/rubenvitt/bluelight-hub/commit/7fbc19f) (project): Major refactoring and cleanup of code structure

- [`85dcfa6`](https://github.com/rubenvitt/bluelight-hub/commit/85dcfa6) (frontend): Replace custom debounce hook with @tanstack/pacer

# [1.0.0-alpha.25](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.24...v1.0.0-alpha.25) (2025-09-19)

## Version [v1.0.0-alpha.24](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.23...v1.0.0-alpha.24) – Veröffentlicht am 2025-09-19

## 🔒 Sicherheitsverbesserungen

Sicherheitsrelevante Änderungen:

- [`326df75`](https://github.com/rubenvitt/bluelight-hub/commit/326df75) (ci): Add security and rate limiting to Claude workflows

# [1.0.0-alpha.24](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.23...v1.0.0-alpha.24) (2025-09-19)

## Version [v1.0.0-alpha.23](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.22...v1.0.0-alpha.23) – Veröffentlicht am 2025-09-15

## ✨ Neue Funktionen

Die folgenden neuen Features wurden hinzugefügt:

- [`c5d5f04`](https://github.com/rubenvitt/bluelight-hub/commit/c5d5f04) (db): Add ETB database schema with comprehensive models

- [`ce1c954`](https://github.com/rubenvitt/bluelight-hub/commit/ce1c954) (admin): Add user edit functionality with role management

## 🐛 Fehlerbehebungen

Diese Probleme wurden behoben:

- [`94f3621`](https://github.com/rubenvitt/bluelight-hub/commit/94f3621) (frontend): Fix admin user dialog validation and submission issues

## ♻ Refactoring

Struktur- oder Code-Verbesserungen:

- [`53dd442`](https://github.com/rubenvitt/bluelight-hub/commit/53dd442) (db): Refactor ETB migration with improved formatting and constraints

- [`f1f3925`](https://github.com/rubenvitt/bluelight-hub/commit/f1f3925) (frontend): Refactor import statements and improve user role handling

- [`eab9e24`](https://github.com/rubenvitt/bluelight-hub/commit/eab9e24) (backend): Implement repository pattern for user management

# [1.0.0-alpha.23](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.22...v1.0.0-alpha.23) (2025-09-15)

## Version [v1.0.0-alpha.22](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.21...v1.0.0-alpha.22) – Veröffentlicht am 2025-09-14

## ✨ Neue Funktionen

Die folgenden neuen Features wurden hinzugefügt:

- [`4c0de75`](https://github.com/rubenvitt/bluelight-hub/commit/4c0de75) (backend): Design JWT claim schema for admin authentication

- [`865d54b`](https://github.com/rubenvitt/bluelight-hub/commit/865d54b) (backend): Implement JWT authentication system

- [`af7edef`](https://github.com/rubenvitt/bluelight-hub/commit/af7edef) (backend): Prevent duplicate Einsatz seeding

- [`14a93db`](https://github.com/rubenvitt/bluelight-hub/commit/14a93db) (backend): Convert AdminUser to User with role-based system

- [`2b114b5`](https://github.com/rubenvitt/bluelight-hub/commit/2b114b5) (frontend): Implement admin role detection and navigation

- [`393aad7`](https://github.com/rubenvitt/bluelight-hub/commit/393aad7) (auth): Implement authentication system with JWT and admin pages

- [`0bf8a03`](https://github.com/rubenvitt/bluelight-hub/commit/0bf8a03) (frontend): Implement role-based admin navigation system

- [`366e568`](https://github.com/rubenvitt/bluelight-hub/commit/366e568) (backend): Define role-based permissions matrix

- [`1cefe38`](https://github.com/rubenvitt/bluelight-hub/commit/1cefe38) (backend): Implement Multi-Factor Authentication (MFA) system

- [`c0b97c1`](https://github.com/rubenvitt/bluelight-hub/commit/c0b97c1) (backend): Implement MFA with TOTP and WebAuthn

- [`53c911b`](https://github.com/rubenvitt/bluelight-hub/commit/53c911b) (backend): Add MFA database migration and improve API documentation

- [`169c80e`](https://github.com/rubenvitt/bluelight-hub/commit/169c80e) (frontend): Implement MFA flow integration

- [`e61e0b9`](https://github.com/rubenvitt/bluelight-hub/commit/e61e0b9) (frontend): Integrate MFA components in the user interface

- [`558452e`](https://github.com/rubenvitt/bluelight-hub/commit/558452e) (backend): Implement comprehensive audit logging infrastructure

- [`dd5abcd`](https://github.com/rubenvitt/bluelight-hub/commit/dd5abcd) (backend): Implement comprehensive audit interceptor for admin APIs

- [`fbefdbe`](https://github.com/rubenvitt/bluelight-hub/commit/fbefdbe) (backend): Implement NestJS Logging Interceptor for audit logging

- [`4a47eae`](https://github.com/rubenvitt/bluelight-hub/commit/4a47eae) (backend): Add audit log service layer with batch processing

- [`d031e29`](https://github.com/rubenvitt/bluelight-hub/commit/d031e29) (backend): Implement audit log REST API endpoints

- [`4239a78`](https://github.com/rubenvitt/bluelight-hub/commit/4239a78) (frontend): Integrate audit logging context and utilities

- [`d8e61e9`](https://github.com/rubenvitt/bluelight-hub/commit/d8e61e9) (backend): Add archive and cleanup endpoints to audit log controller

- [`2dcf191`](https://github.com/rubenvitt/bluelight-hub/commit/2dcf191) (frontend): Integrate frontend logging context

- [`e89398a`](https://github.com/rubenvitt/bluelight-hub/commit/e89398a) (frontend): Implement Log Viewer UI

- [`e6431ef`](https://github.com/rubenvitt/bluelight-hub/commit/e6431ef) (backend): Add MANAGER role to user schema

- [`34217ba`](https://github.com/rubenvitt/bluelight-hub/commit/34217ba) (backend): Add proper response types for audit log endpoints and use generated API client

- [`8eab372`](https://github.com/rubenvitt/bluelight-hub/commit/8eab372) (backend): Add comprehensive tests for audit module

- [`2193ad5`](https://github.com/rubenvitt/bluelight-hub/commit/2193ad5) (backend): Implementiere umfassende Tests für Audit-System

- [`290136a`](https://github.com/rubenvitt/bluelight-hub/commit/290136a) (admin): Initialize feature branch for admin infrastructure

- [`4ac6588`](https://github.com/rubenvitt/bluelight-hub/commit/4ac6588) (frontend): Add &#x27;Einsatz schließen&#x27; functionality to UserProfile menu

- [`e9bd9ec`](https://github.com/rubenvitt/bluelight-hub/commit/e9bd9ec) (frontend): Add &#x27;Einsatz schließen&#x27; functionality to UserProfile menu

- [`4b5d08f`](https://github.com/rubenvitt/bluelight-hub/commit/4b5d08f) (backend): Implement Session Monitoring Service

- [`87f2371`](https://github.com/rubenvitt/bluelight-hub/commit/87f2371) (backend): Add session monitoring service

- [`8d3d427`](https://github.com/rubenvitt/bluelight-hub/commit/8d3d427) (backend): Add failed login tracking &amp; account lockout feature

- [`2782985`](https://github.com/rubenvitt/bluelight-hub/commit/2782985) (backend): Implement API callbacks for security alerts

- [`bf3a8b8`](https://github.com/rubenvitt/bluelight-hub/commit/bf3a8b8) (backend): Implement security recommendations 1-8 and 10

- [`8812367`](https://github.com/rubenvitt/bluelight-hub/commit/8812367) (frontend): Add account lockout notification with UI blocking

- [`9e152e3`](https://github.com/rubenvitt/bluelight-hub/commit/9e152e3) (backend): Add retry mechanism and circuit breaker for security alerts

- [`fae9950`](https://github.com/rubenvitt/bluelight-hub/commit/fae9950) (backend): Implement sophisticated bot detection using isbot library

- [`8adc6ce`](https://github.com/rubenvitt/bluelight-hub/commit/8adc6ce) (backend): Implement notification channels for security notifications

- [`c7b1ca9`](https://github.com/rubenvitt/bluelight-hub/commit/c7b1ca9) (backend): Add automatic Threat Rules seeding on backend startup
  (Zugehörige Issues: [`#177`](https://github.com/rubenvitt/bluelight-hub/issues/))

- [`fee50a7`](https://github.com/rubenvitt/bluelight-hub/commit/fee50a7) (backend): Implement comprehensive threat detection rules system

- [`c34fcce`](https://github.com/rubenvitt/bluelight-hub/commit/c34fcce) (backend): Add comprehensive security alert system with test coverage

- [`6bfc848`](https://github.com/rubenvitt/bluelight-hub/commit/6bfc848) (security): Add SecurityLog model with hash chain support

- [`13ba8af`](https://github.com/rubenvitt/bluelight-hub/commit/13ba8af) (security): Setup BullMQ queue for security logging

- [`0aecd1f`](https://github.com/rubenvitt/bluelight-hub/commit/0aecd1f) (backend): Implement SecurityLogService with queue integration

- [`dbc7df1`](https://github.com/rubenvitt/bluelight-hub/commit/dbc7df1) (backend): Add hash chain integrity verification for security logs

- [`6dd495f`](https://github.com/rubenvitt/bluelight-hub/commit/6dd495f) (backend): Add SecurityLog REST API with admin controls
  (Zugehörige Issues: [`#42`](https://github.com/rubenvitt/bluelight-hub/issues/))

- [`9c8000c`](https://github.com/rubenvitt/bluelight-hub/commit/9c8000c) (backend): Add security log retention management

- [`51673b1`](https://github.com/rubenvitt/bluelight-hub/commit/51673b1) (backend): Integrate SecurityLog service into auth system

- [`97d674c`](https://github.com/rubenvitt/bluelight-hub/commit/97d674c) (backend): Implement comprehensive security audit logging

- [`6af39c9`](https://github.com/rubenvitt/bluelight-hub/commit/6af39c9) (frontend): Add comprehensive test coverage for security API modules
  (Zugehörige Issues: [`#162`](https://github.com/rubenvitt/bluelight-hub/issues/))

- [`e22e8bb`](https://github.com/rubenvitt/bluelight-hub/commit/e22e8bb) (frontend): Add comprehensive test coverage for security features

- [`468c5bf`](https://github.com/rubenvitt/bluelight-hub/commit/468c5bf) (frontend): Comprehensive test coverage improvements for security pages

- [`0fdf527`](https://github.com/rubenvitt/bluelight-hub/commit/0fdf527) (security): Implement activity log for admin dashboard

- [`860128a`](https://github.com/rubenvitt/bluelight-hub/commit/860128a) (backend): Implement distributed rate limiting with Redis support

- [`c61def7`](https://github.com/rubenvitt/bluelight-hub/commit/c61def7) (frontend): Add dark mode toggle to greeting molecule

- [`1de4116`](https://github.com/rubenvitt/bluelight-hub/commit/1de4116) (frontend): Add comprehensive color mode component architecture

- [`cd77583`](https://github.com/rubenvitt/bluelight-hub/commit/cd77583) (backend): Add user creation tracking to User model

- [`ab55efb`](https://github.com/rubenvitt/bluelight-hub/commit/ab55efb) (backend): Add User model with role-based authentication system

- [`6b6fca6`](https://github.com/rubenvitt/bluelight-hub/commit/6b6fca6) (backend): Implement authentication system with password-less auth

- [`fb42177`](https://github.com/rubenvitt/bluelight-hub/commit/fb42177) (backend): Implement comprehensive JWT authentication system

- [`1195574`](https://github.com/rubenvitt/bluelight-hub/commit/1195574) (backend): Implement JWT authentication with API versioning
  (Zugehörige Issues: [`#122`](https://github.com/rubenvitt/bluelight-hub/issues/))

- [`82b07cd`](https://github.com/rubenvitt/bluelight-hub/commit/82b07cd) (app): Implement frontend authentication with E2E testing

- [`285646c`](https://github.com/rubenvitt/bluelight-hub/commit/285646c) (app): Implement complete login functionality with E2E testing

- [`cb986d5`](https://github.com/rubenvitt/bluelight-hub/commit/cb986d5) (backend): Add admin setup endpoint and user profile API

- [`fcf24b3`](https://github.com/rubenvitt/bluelight-hub/commit/fcf24b3) (backend): Implement admin setup business logic with password hashing

- [`f79cdab`](https://github.com/rubenvitt/bluelight-hub/commit/f79cdab) (backend): Complete admin setup system with full-stack integration
  (Zugehörige Issues: [`#122`](https://github.com/rubenvitt/bluelight-hub/issues/))

- [`47167b5`](https://github.com/rubenvitt/bluelight-hub/commit/47167b5) (auth): Implement secure admin authentication system

- [`5c41ef9`](https://github.com/rubenvitt/bluelight-hub/commit/5c41ef9) (backend): Implement comprehensive user management system

- [`61a3ed4`](https://github.com/rubenvitt/bluelight-hub/commit/61a3ed4) (frontend): Implement comprehensive admin user management system

- [`58ef326`](https://github.com/rubenvitt/bluelight-hub/commit/58ef326) (backend): Add CLI tool for admin password reset

- [`dbc5893`](https://github.com/rubenvitt/bluelight-hub/commit/dbc5893) (auth): Implement unified tabbed authentication interface

- [`6cb3933`](https://github.com/rubenvitt/bluelight-hub/commit/6cb3933) (frontend): Add AdminLayout component with window management

- [`bce651a`](https://github.com/rubenvitt/bluelight-hub/commit/bce651a) (frontend): Implement admin window management with Tauri integration

- [`548090d`](https://github.com/rubenvitt/bluelight-hub/commit/548090d) (backend): Add unified authentication endpoint with auto-registration

- [`ff069f2`](https://github.com/rubenvitt/bluelight-hub/commit/ff069f2) (backend): Add Einsatz module with CRUD operations

- [`3279541`](https://github.com/rubenvitt/bluelight-hub/commit/3279541) (api): Add missing generated API client models

- [`35b6eaa`](https://github.com/rubenvitt/bluelight-hub/commit/35b6eaa) (backend): Add cache manager foundation with NestJS CacheModule

- [`0eaad1c`](https://github.com/rubenvitt/bluelight-hub/commit/0eaad1c) (einsatz): Add archiving workflow with status transition rules

- [`cc40db2`](https://github.com/rubenvitt/bluelight-hub/commit/cc40db2) (backend): Add CacheDuplicateDetectionService for idempotency

- [`6963ced`](https://github.com/rubenvitt/bluelight-hub/commit/6963ced) (frontend): Add Einsatz UI components with atomic design

- [`3116e32`](https://github.com/rubenvitt/bluelight-hub/commit/3116e32) (ui): Implement comprehensive Einsatz UI with atomic design system

- [`6d32b69`](https://github.com/rubenvitt/bluelight-hub/commit/6d32b69) (einsatz): Add navigation between Einsätze with detail view

- [`a61dfa6`](https://github.com/rubenvitt/bluelight-hub/commit/a61dfa6) (frontend): Add system color mode with automatic OS theme detection

- [`824063c`](https://github.com/rubenvitt/bluelight-hub/commit/824063c) (frontend): Add search input and UI state components

## 🐛 Fehlerbehebungen

Diese Probleme wurden behoben:

- [`7210901`](https://github.com/rubenvitt/bluelight-hub/commit/7210901) (backend): Fix test failures after admin auth implementation

- [`5498f91`](https://github.com/rubenvitt/bluelight-hub/commit/5498f91) (frontend): Fix gitignore to track logs pages

- [`d94fdc7`](https://github.com/rubenvitt/bluelight-hub/commit/d94fdc7) (admin): Fix admin authentication and test issues

- [`030869f`](https://github.com/rubenvitt/bluelight-hub/commit/030869f) (backend): Fix remaining unit test failures after audit integration

- [`070f8c2`](https://github.com/rubenvitt/bluelight-hub/commit/070f8c2) (frontend): Fix audit log API parameter mismatches

- [`1fce007`](https://github.com/rubenvitt/bluelight-hub/commit/1fce007) (backend): Add missing audit log permissions to Prisma schema

- [`db5a013`](https://github.com/rubenvitt/bluelight-hub/commit/db5a013) (frontend): Fix audit log table data mapping issue

- [`829c9b7`](https://github.com/rubenvitt/bluelight-hub/commit/829c9b7) (frontend): Fix audit log statistics data mapping

- [`517573f`](https://github.com/rubenvitt/bluelight-hub/commit/517573f) (backend): Fix trace logging implementation and remove console.error from audit interceptor

- [`6fe9727`](https://github.com/rubenvitt/bluelight-hub/commit/6fe9727) (backend): Fix audit log API response type and update frontend hooks

- [`66c3fe0`](https://github.com/rubenvitt/bluelight-hub/commit/66c3fe0) (backend): Fix audit interceptor to use logger instead of console.error

- [`bc05f2e`](https://github.com/rubenvitt/bluelight-hub/commit/bc05f2e) (backend): Fix auth module test for CI environments

- [`27bf7a1`](https://github.com/rubenvitt/bluelight-hub/commit/27bf7a1) (backend): Fix session service tests to use jti instead of id

- [`9f12130`](https://github.com/rubenvitt/bluelight-hub/commit/9f12130) (backend): Fix hardcoded 15-minute window to use configurable value

- [`c88e1e7`](https://github.com/rubenvitt/bluelight-hub/commit/c88e1e7) (frontend): Fix IP rate limit handling and error messages

- [`0b33afc`](https://github.com/rubenvitt/bluelight-hub/commit/0b33afc) (frontend): Fix backend availability check and TypeScript types

- [`e3d8577`](https://github.com/rubenvitt/bluelight-hub/commit/e3d8577) (backend): Remove unused ThreatDetectionRule imports

- [`fed04b8`](https://github.com/rubenvitt/bluelight-hub/commit/fed04b8) (backend): Fix test failures in security and session tests

- [`197141f`](https://github.com/rubenvitt/bluelight-hub/commit/197141f) (backend): Fix all 37 test failures and improve test stability

- [`f502b70`](https://github.com/rubenvitt/bluelight-hub/commit/f502b70) (backend): Fix TypeScript types and remove any types

- [`fe393fd`](https://github.com/rubenvitt/bluelight-hub/commit/fe393fd) (backend): Fix TypeScript types and remove any types

- [`d5f5046`](https://github.com/rubenvitt/bluelight-hub/commit/d5f5046) (backend): Fix timezone-dependent test in suspicious activity service

- [`1b79b4a`](https://github.com/rubenvitt/bluelight-hub/commit/1b79b4a) (backend): Fix health controller test failures and linting errors

- [`1600c1d`](https://github.com/rubenvitt/bluelight-hub/commit/1600c1d) (backend): Fix timezone-related test failures in CI

- [`e6cd2c5`](https://github.com/rubenvitt/bluelight-hub/commit/e6cd2c5) (backend): Fix test failures in retry and circuit breaker utilities

- [`a98fe53`](https://github.com/rubenvitt/bluelight-hub/commit/a98fe53) (backend): Fix PR review issues in test and utility files

- [`38a88d0`](https://github.com/rubenvitt/bluelight-hub/commit/38a88d0) (backend): Fix BullMQ Redis connection for security logging queue

- [`b6088e9`](https://github.com/rubenvitt/bluelight-hub/commit/b6088e9) (backend): Fix SecurityLog integrity verification sorting issue

- [`7d808ed`](https://github.com/rubenvitt/bluelight-hub/commit/7d808ed) (backend): Fix Prisma validation test in CI environment

- [`00b750e`](https://github.com/rubenvitt/bluelight-hub/commit/00b750e) (backend): Fix remaining security logging test failures

- [`39750bb`](https://github.com/rubenvitt/bluelight-hub/commit/39750bb) (backend): Fix resource column display in audit log view
  (Zugehörige Issues: [`#162`](https://github.com/rubenvitt/bluelight-hub/issues/))

- [`170120b`](https://github.com/rubenvitt/bluelight-hub/commit/170120b) (backend): Fix resource extraction for version-prefixed paths

- [`149b49c`](https://github.com/rubenvitt/bluelight-hub/commit/149b49c) (frontend): Fix audit log statistics severity mapping

- [`1b2d8fd`](https://github.com/rubenvitt/bluelight-hub/commit/1b2d8fd) (frontend): Fix negative successful login count in SecurityDashboard

- [`0647a53`](https://github.com/rubenvitt/bluelight-hub/commit/0647a53) (frontend): Fix missing fields in SecurityLog interface

- [`0f5be53`](https://github.com/rubenvitt/bluelight-hub/commit/0f5be53) (backend): Fix suspicious activity service tests by mocking date

- [`25e585a`](https://github.com/rubenvitt/bluelight-hub/commit/25e585a) (backend): Fix time-dependent test failures in auth service

- [`65419f0`](https://github.com/rubenvitt/bluelight-hub/commit/65419f0) (frontend): Fix timezone-dependent tests in security components

- [`2b09cf4`](https://github.com/rubenvitt/bluelight-hub/commit/2b09cf4) (frontend): Add minimal test to fix CI/CD pipeline failure

- [`945d77b`](https://github.com/rubenvitt/bluelight-hub/commit/945d77b) (admin): Fix activity log error handling and add mock data

- [`b18056c`](https://github.com/rubenvitt/bluelight-hub/commit/b18056c) (backend): Fix TypeScript errors in admin module

- [`de0cff0`](https://github.com/rubenvitt/bluelight-hub/commit/de0cff0) (backend): Fix admin login tests to match JWT-based authentication

- [`26b8fc0`](https://github.com/rubenvitt/bluelight-hub/commit/26b8fc0) (frontend): Fix unnecessary conditional check in AdminLogin

- [`6889d38`](https://github.com/rubenvitt/bluelight-hub/commit/6889d38) (frontend): Fix Button component missing type prop

- [`1795378`](https://github.com/rubenvitt/bluelight-hub/commit/1795378) (backend): Fix syntax error in auth-response mapper spec

- [`d54c9f3`](https://github.com/rubenvitt/bluelight-hub/commit/d54c9f3) (backend): Fix TypeScript compilation errors

## 🔒 Sicherheitsverbesserungen

Sicherheitsrelevante Änderungen:

- [`dd6d6ef`](https://github.com/rubenvitt/bluelight-hub/commit/dd6d6ef) (deps): Update pnpm-lock.yaml

- [`f3048fe`](https://github.com/rubenvitt/bluelight-hub/commit/f3048fe) (einsatz): Implement No-Delete Policy with soft-delete pattern

## 🧹 Codebereinigungen

Aufräumarbeiten und kleinere Verbesserungen:

- [`6af2089`](https://github.com/rubenvitt/bluelight-hub/commit/6af2089) (config): Remove and ignore Windsurfrules and Roo files

- [`67bcc0b`](https://github.com/rubenvitt/bluelight-hub/commit/67bcc0b) (backend): Add comprehensive authentication module tests

- [`444cab4`](https://github.com/rubenvitt/bluelight-hub/commit/444cab4) (backend): Reduce audit and ETB log verbosity

- [`0904277`](https://github.com/rubenvitt/bluelight-hub/commit/0904277) (backend): Add comprehensive unit tests for audit module

- [`f8e82fb`](https://github.com/rubenvitt/bluelight-hub/commit/f8e82fb) (backend): Füge umfassende Tests für Audit DTOs und Entities hinzu

- [`4293a1a`](https://github.com/rubenvitt/bluelight-hub/commit/4293a1a) (backend): Füge JSDoc zu admin-auth.spec.ts hinzu

- [`17ac671`](https://github.com/rubenvitt/bluelight-hub/commit/17ac671) (backend): Entferne ungenutzte JwtRefreshStrategy

- [`3d708b8`](https://github.com/rubenvitt/bluelight-hub/commit/3d708b8) (tooling): Remove Rust version from .tool-versions file

- [`242b2fb`](https://github.com/rubenvitt/bluelight-hub/commit/242b2fb) (backend): Remove obsolete integration tests for audit and auth modules

- [`7021db9`](https://github.com/rubenvitt/bluelight-hub/commit/7021db9) (backend): Fix test suite after security logging implementation

- [`08f1119`](https://github.com/rubenvitt/bluelight-hub/commit/08f1119) (backend): Fix undefined &#x27;fail&#x27; function in security schema tests

- [`e5db960`](https://github.com/rubenvitt/bluelight-hub/commit/e5db960) (backend): Fix flaky timing test in auditTestUtils

- [`a5d61f5`](https://github.com/rubenvitt/bluelight-hub/commit/a5d61f5) (backend): Fix test mocks and clean up test suite

- [`eaec2ff`](https://github.com/rubenvitt/bluelight-hub/commit/eaec2ff) (backend): Temporär alle Backend-Tests entfernt für CI/CD-Pipeline-Fix

- [`8b36cd2`](https://github.com/rubenvitt/bluelight-hub/commit/8b36cd2) (docs): Bereinige Agent-Konfigurationen und vereinfache Docs

- [`c63eb02`](https://github.com/rubenvitt/bluelight-hub/commit/c63eb02) (docs): Improve formatting in arc42 concepts documentation

- [`e62cd77`](https://github.com/rubenvitt/bluelight-hub/commit/e62cd77) (frontend): Clean up Tailwind CSS class ordering

## ♻ Refactoring

Struktur- oder Code-Verbesserungen:

- [`eab89e8`](https://github.com/rubenvitt/bluelight-hub/commit/eab89e8) (docs): Move role-based admin docs to architecture section

- [`5171d90`](https://github.com/rubenvitt/bluelight-hub/commit/5171d90) (backend): Reduce audit log verbosity and add trace level support

- [`3dab7f3`](https://github.com/rubenvitt/bluelight-hub/commit/3dab7f3) (backend): Implement streaming exports for large audit log datasets

- [`84d8b0a`](https://github.com/rubenvitt/bluelight-hub/commit/84d8b0a) (backend): Konsolidiere Audit-Interceptoren

- [`cb5ccc6`](https://github.com/rubenvitt/bluelight-hub/commit/cb5ccc6) (backend): Refactor auth.service for better security

- [`910cc60`](https://github.com/rubenvitt/bluelight-hub/commit/910cc60) (frontend): Replace login button with automatic redirect

- [`d468c05`](https://github.com/rubenvitt/bluelight-hub/commit/d468c05) (backend): Refactor AuditInterceptor for enhanced action handling

- [`549b569`](https://github.com/rubenvitt/bluelight-hub/commit/549b569) (backend): Update test cases with UTC handling, exclude performance

- [`de68972`](https://github.com/rubenvitt/bluelight-hub/commit/de68972) (backend): Refactor and Re-enable Audit-Interceptor Test Suite
  (Zugehörige Issues: [`#164`](https://github.com/rubenvitt/bluelight-hub/issues/))

- [`f5b6390`](https://github.com/rubenvitt/bluelight-hub/commit/f5b6390) (backend): Refactor suspicious activity service

- [`7c59041`](https://github.com/rubenvitt/bluelight-hub/commit/7c59041) (backend): Extract date parsing logic into reusable utility functions

- [`ecad36c`](https://github.com/rubenvitt/bluelight-hub/commit/ecad36c) (backend): Replace any types with specific types in rules

- [`7f5dd31`](https://github.com/rubenvitt/bluelight-hub/commit/7f5dd31) (backend): Refactor security alert system for improved maintainability

- [`8e0cc8b`](https://github.com/rubenvitt/bluelight-hub/commit/8e0cc8b) (frontend): Refactor admin API to use centralized helpers

- [`0c253b4`](https://github.com/rubenvitt/bluelight-hub/commit/0c253b4) (frontend): Remove manual API helpers and update CLAUDE.md

- [`4d0ff0c`](https://github.com/rubenvitt/bluelight-hub/commit/4d0ff0c) (husky): Remove redundant test execution logic in commit-msg hook

- [`be30f34`](https://github.com/rubenvitt/bluelight-hub/commit/be30f34) (husky): Comment out test execution logic in commit-msg hook

- [`6212819`](https://github.com/rubenvitt/bluelight-hub/commit/6212819) (auth): Refactor admin auth system for better maintainability

- [`a912768`](https://github.com/rubenvitt/bluelight-hub/commit/a912768) (frontend): Enhance admin auth with centralized utilities

- [`2eb4857`](https://github.com/rubenvitt/bluelight-hub/commit/2eb4857) (arch): Standardize API responses with DTO pattern

- [`b30562f`](https://github.com/rubenvitt/bluelight-hub/commit/b30562f) (auth): Refactor authentication system for better session handling

- [`fd66078`](https://github.com/rubenvitt/bluelight-hub/commit/fd66078) (auth): Refresh-Flow aktualisiert; Admin-Login/Layout; DTO-Updates

- [`d856ddb`](https://github.com/rubenvitt/bluelight-hub/commit/d856ddb) (backend): Use ConfigService and fix package.json import

- [`02a2daa`](https://github.com/rubenvitt/bluelight-hub/commit/02a2daa) (auth): Refactor auth system with improved DTOs and mappers

- [`bd6d3e5`](https://github.com/rubenvitt/bluelight-hub/commit/bd6d3e5) (project): Standardize configuration and improve error handling

- [`284bd60`](https://github.com/rubenvitt/bluelight-hub/commit/284bd60) (shared): Regenerate API client with public users endpoint

- [`58acd7d`](https://github.com/rubenvitt/bluelight-hub/commit/58acd7d) (auth): Centralize query keys and refactor authentication system

- [`d29322e`](https://github.com/rubenvitt/bluelight-hub/commit/d29322e) (auth): Improve logger DI and auth refresh state management

- [`2037519`](https://github.com/rubenvitt/bluelight-hub/commit/2037519) (frontend): Centralize API error handling

- [`e57f159`](https://github.com/rubenvitt/bluelight-hub/commit/e57f159) (auth): Restructure auth system with new mappers and improved UI

- [`83bf94c`](https://github.com/rubenvitt/bluelight-hub/commit/83bf94c) (frontend): Add cn utility and update import paths

- [`33c9eb9`](https://github.com/rubenvitt/bluelight-hub/commit/33c9eb9) (frontend): Continue Tailwind migration with improved components

- [`f8b4626`](https://github.com/rubenvitt/bluelight-hub/commit/f8b4626) (frontend): Improve Button accessibility and TypeScript types

- [`08208f3`](https://github.com/rubenvitt/bluelight-hub/commit/08208f3) (auth): Implement unified authentication with auto-registration

- [`1fc61f3`](https://github.com/rubenvitt/bluelight-hub/commit/1fc61f3) (auth): Refactor to unified authentication form

- [`18be606`](https://github.com/rubenvitt/bluelight-hub/commit/18be606) (all): Update Node.js, fix tests and improve query keys

- [`aa7e184`](https://github.com/rubenvitt/bluelight-hub/commit/aa7e184) (all): Add Biome formatter and centralize config management

- [`f0ae5e9`](https://github.com/rubenvitt/bluelight-hub/commit/f0ae5e9) (tooling): Replace format:check with unified lint:check command

- [`db60efe`](https://github.com/rubenvitt/bluelight-hub/commit/db60efe) (tooling): Complete migration from Prettier/ESLint to Biome

- [`82d58eb`](https://github.com/rubenvitt/bluelight-hub/commit/82d58eb) (backend): Improve type safety and cleanup dependencies

- [`31c1af3`](https://github.com/rubenvitt/bluelight-hub/commit/31c1af3) (backend): Remove type-only imports from services and controllers

- [`afbeae6`](https://github.com/rubenvitt/bluelight-hub/commit/afbeae6) (api): Refactor API client and remove obsolete DTOs

- [`ad82ba5`](https://github.com/rubenvitt/bluelight-hub/commit/ad82ba5) (architecture): Simplify caching and add performance monitoring

- [`d4c3f02`](https://github.com/rubenvitt/bluelight-hub/commit/d4c3f02) (backend): Migrate rate limiter to cache-only implementation

- [`c2f81bf`](https://github.com/rubenvitt/bluelight-hub/commit/c2f81bf) (frontend): Refactor Einsatz hooks with optimistic updates

- [`7f0526f`](https://github.com/rubenvitt/bluelight-hub/commit/7f0526f) (einsatz): Refactor Einsatz system for minimal creation pattern

- [`ae8680f`](https://github.com/rubenvitt/bluelight-hub/commit/ae8680f) (frontend): Refactor dashboard with responsive components

- [`f872fe3`](https://github.com/rubenvitt/bluelight-hub/commit/f872fe3) (ci): Simplify CI pipeline configuration

## 🔧 Tool Verbesserungen

Verbesserungen an den Werkzeugen:

- [`14ada80`](https://github.com/rubenvitt/bluelight-hub/commit/14ada80) (config): Add puppeteer to allowed deprecated versions

- [`2afbb33`](https://github.com/rubenvitt/bluelight-hub/commit/2afbb33) (frontend): Fix linting errors and test failures

- [`0fe18b8`](https://github.com/rubenvitt/bluelight-hub/commit/0fe18b8) (backend): Move environment variables to appropriate locations

- [`278a1b3`](https://github.com/rubenvitt/bluelight-hub/commit/278a1b3) (shared): Regenerate API client after MFA removal

- [`aff8eb8`](https://github.com/rubenvitt/bluelight-hub/commit/aff8eb8) (scripts): Erweitere commit-helper um alle erlaubten Emojis

- [`2434fed`](https://github.com/rubenvitt/bluelight-hub/commit/2434fed) (backend): Exclude DTOs, interfaces and modules from code coverage

- [`02a05da`](https://github.com/rubenvitt/bluelight-hub/commit/02a05da) (config): Add initial &#x60;.coderabbit.yaml&#x60; configuration file

- [`b71a0bd`](https://github.com/rubenvitt/bluelight-hub/commit/b71a0bd) (config): Add initial &#x60;.coderabbit.yaml&#x60; configuration file

- [`fee2ab7`](https://github.com/rubenvitt/bluelight-hub/commit/fee2ab7) (config): Add initial &#x60;.coderabbit.yaml&#x60; configuration file

- [`0b09b44`](https://github.com/rubenvitt/bluelight-hub/commit/0b09b44) (config): Add initial &#x60;.coderabbit.yaml&#x60; configuration file

- [`25e3776`](https://github.com/rubenvitt/bluelight-hub/commit/25e3776) (frontend): Temporär Frontend-Coverage-Anforderungen reduziert

- [`b742352`](https://github.com/rubenvitt/bluelight-hub/commit/b742352) (backend): Add prisma generate to test scripts for CI/CD compatibility

- [`5e71afc`](https://github.com/rubenvitt/bluelight-hub/commit/5e71afc) (frontend): Update vitest configuration to remove setup files

- [`f2c2c52`](https://github.com/rubenvitt/bluelight-hub/commit/f2c2c52) (tsconfig): Update TypeScript configurations across all packages

- [`f8f1899`](https://github.com/rubenvitt/bluelight-hub/commit/f8f1899) (ci): Expand Frontend E2E Tests branch triggers

- [`87b7f3c`](https://github.com/rubenvitt/bluelight-hub/commit/87b7f3c) (github): remove pnpm version from gh workflow

- [`44eda9a`](https://github.com/rubenvitt/bluelight-hub/commit/44eda9a) (ci): Fix GitHub Actions workflow by adding CI-specific build script

- [`1da80d4`](https://github.com/rubenvitt/bluelight-hub/commit/1da80d4) (ci): Fix pnpm not found error in GitHub Actions workflows

- [`bfaa232`](https://github.com/rubenvitt/bluelight-hub/commit/bfaa232) (backend): Fix production build configuration and start script

- [`bebb1e0`](https://github.com/rubenvitt/bluelight-hub/commit/bebb1e0) (ci): Make frontend E2E tests optional in CI pipeline

- [`d677353`](https://github.com/rubenvitt/bluelight-hub/commit/d677353) (ci): Temporarily disable frontend E2E tests

- [`07b83af`](https://github.com/rubenvitt/bluelight-hub/commit/07b83af) (ci): Update Node.js to v20 and remove createdBy field

- [`43f7a7d`](https://github.com/rubenvitt/bluelight-hub/commit/43f7a7d) (ci): Add Qodana code quality checks with various fixes

- [`897565d`](https://github.com/rubenvitt/bluelight-hub/commit/897565d) (ci): Update Qodana action to use main branch

- [`bf7c6b0`](https://github.com/rubenvitt/bluelight-hub/commit/bf7c6b0) (workspace): Move @tanstack/react-devtools to catalog specification

- [`8a4599b`](https://github.com/rubenvitt/bluelight-hub/commit/8a4599b) (ci): Consolidate and improve CI/CD workflows

- [`8d65976`](https://github.com/rubenvitt/bluelight-hub/commit/8d65976) (config): Update development tools configuration

- [`05f2f14`](https://github.com/rubenvitt/bluelight-hub/commit/05f2f14) (ci): Update Node.js versions and GitHub Actions dependencies

- [`033159e`](https://github.com/rubenvitt/bluelight-hub/commit/033159e) (ci): Update Node.js versions to 22/24

- [`b2569e7`](https://github.com/rubenvitt/bluelight-hub/commit/b2569e7) (config): Setup CORS and network for WebSocket/Tauri

- [`45814f4`](https://github.com/rubenvitt/bluelight-hub/commit/45814f4) (ci): Fix Puppeteer Chromium download issues on macOS ARM64

- [`33e836e`](https://github.com/rubenvitt/bluelight-hub/commit/33e836e) (ci): Fix pnpm setup order in CI workflow

- [`bb00d15`](https://github.com/rubenvitt/bluelight-hub/commit/bb00d15) (ci): Standardize pnpm setup across all workflows

- [`7cee2c1`](https://github.com/rubenvitt/bluelight-hub/commit/7cee2c1) (ci): Consolidate E2E tests into main CI workflow

- [`37ef48f`](https://github.com/rubenvitt/bluelight-hub/commit/37ef48f) (ci): Optimize dependency installation across workflows

- [`cbe76e7`](https://github.com/rubenvitt/bluelight-hub/commit/cbe76e7) (ci): Comment out E2E test execution temporarily

- [`2ec6b05`](https://github.com/rubenvitt/bluelight-hub/commit/2ec6b05) (ci): Disable Playwright installation temporarily

- [`f3e28b9`](https://github.com/rubenvitt/bluelight-hub/commit/f3e28b9) (ci): Add cross-platform support and fix macOS builds

- [`c6c32bf`](https://github.com/rubenvitt/bluelight-hub/commit/c6c32bf) (ci): Disable E2E tests temporarily

## 💥 Breaking Changes

Bitte beachtet folgende Änderungen, die möglicherweise Anpassungen erfordern:

- [`eb48b7c`](https://github.com/rubenvitt/bluelight-hub/commit/eb48b7c) (auth): Remove MFA/2FA functionality completely

- [`40e8373`](https://github.com/rubenvitt/bluelight-hub/commit/40e8373) (frontend): Umfangreiche Test-Suite-Bereinigung

- [`9fdc49f`](https://github.com/rubenvitt/bluelight-hub/commit/9fdc49f) (monorepo): Reset to minimal working state

- [`c7a4cee`](https://github.com/rubenvitt/bluelight-hub/commit/c7a4cee) (frontend): Migrate to Chakra UI v3 and TanStack Router

- [`299ad30`](https://github.com/rubenvitt/bluelight-hub/commit/299ad30) (frontend): Migrate from Ant Design to Chakra UI v3

- [`78192f5`](https://github.com/rubenvitt/bluelight-hub/commit/78192f5) (auth): Move JWT tokens from response body to httpOnly cookies

- [`0e3be8d`](https://github.com/rubenvitt/bluelight-hub/commit/0e3be8d) (frontend): Remove deprecated Chakra UI components and legacy files

- [`df694dc`](https://github.com/rubenvitt/bluelight-hub/commit/df694dc) (frontend): Migrate from Chakra UI to Tailwind CSS + Headless UI

# [1.0.0-alpha.22](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.21...v1.0.0-alpha.22) (2025-09-14)

- ♻️(auth): Refactor auth system with improved DTOs and mappers ([02a2daa](https://github.com/rubenvitt/bluelight-hub/commit/02a2daad2d3829c20e36ad7c6ba4cfdff0fe755e))
- ✨(backend): Convert AdminUser to User with role-based system ([14a93db](https://github.com/rubenvitt/bluelight-hub/commit/14a93dba7ad1287d46f8a08b4b655523f74d18e1))
- 💥(auth): Move JWT tokens from response body to httpOnly cookies ([78192f5](https://github.com/rubenvitt/bluelight-hub/commit/78192f56818a3a1d79a88466391402b32fdb501c))
- 💥(auth): Remove MFA/2FA functionality completely ([eb48b7c](https://github.com/rubenvitt/bluelight-hub/commit/eb48b7c025cd2b8c61473db0ba4ccbfd45cf8d91))
- 💥(frontend): Migrate from Ant Design to Chakra UI v3 ([299ad30](https://github.com/rubenvitt/bluelight-hub/commit/299ad301d54d9da810e3db8a774ed6f38ef6a5c0))
- 💥(frontend): Migrate from Chakra UI to Tailwind CSS + Headless UI ([df694dc](https://github.com/rubenvitt/bluelight-hub/commit/df694dc5bdd8d849da16f6dae885e2c474b6b35c))
- 💥(frontend): Migrate to Chakra UI v3 and TanStack Router ([c7a4cee](https://github.com/rubenvitt/bluelight-hub/commit/c7a4cee5d86a515ff76171e3e4368f3f29171f75))
- 💥(frontend): Umfangreiche Test-Suite-Bereinigung ([40e8373](https://github.com/rubenvitt/bluelight-hub/commit/40e837392c285bd892794f886e87527218a01896))
- 🗑(frontend): Remove MFA functionality and implement auth improvements ([63fdd6e](https://github.com/rubenvitt/bluelight-hub/commit/63fdd6e98e117b7270fe61a9f898b0ad702a0f32))

### BREAKING CHANGES

- Complete UI framework migration

* Replace all Chakra UI components with Tailwind CSS utilities
* Implement new Atomic Design component system with Tailwind
* Add Headless UI for accessible complex components
* Create comprehensive atom/molecule/template components
* Update all documentation to reflect Tailwind usage
* Add ADR-013 documenting migration rationale
* Configure Prettier with Tailwind CSS plugin
* Update architectural documentation in arc42

This migration improves:

- Performance: ~60% bundle size reduction
- DX: Faster HMR with utility-first CSS
- Maintainability: Fewer dependencies, simpler updates
- Consistency: Unified styling approach

All existing Chakra UI components must be replaced with new Tailwind-based equivalents.

- Auth response DTOs now use structured user objects
  instead of partial User entities. Frontend must handle new response
  format for admin setup and login endpoints.
- Auth endpoints no longer return tokens in JSON response body.
  Tokens are now exclusively set as httpOnly cookies for enhanced security.

Affected endpoints:

- POST /api/auth/login - Returns only UserResponseDto
- POST /api/auth/register - Returns only UserResponseDto
- POST /api/auth/refresh - Returns { success: true }
- POST /api/auth/admin/login - Returns only UserResponseDto

Security improvements:

- Tokens stored as httpOnly cookies (XSS protection)
- sameSite=strict attribute (CSRF protection)
- secure=true in production (HTTPS only)

Additional changes:

- Removed redundant /api/auth/me endpoint (use /api/auth/check instead)
- Updated all E2E tests for new response format
- Regenerated OpenAPI client types
- Updated README with authentication documentation

* Complete frontend UI library migration that affects all components
  and styling patterns. This introduces a new component architecture and theming system.

Major changes include:

- Replace Ant Design with Chakra UI v3 across all components
- Implement new color mode system with proper provider structure
- Add comprehensive UI component library (provider, toaster, tooltip)
- Refactor color mode hook with enhanced functionality
- Create new index page component with modern architecture
- Update API client with improved caching and JSDoc documentation
- Remove all Ant Design references from rules and documentation
- Update architecture documentation to reflect new UI framework
- Enhance TypeScript configuration for better type safety
- Update auth concept PRD to support self-registration (first user admin)

Affected areas:

- Frontend component architecture (atomic design patterns)
- Color mode and theming system
- API client structure and documentation
- Development rules and guidelines
- Architecture documentation

🔧 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>

- Complete frontend architecture migration from
  minimal React setup to full-featured Chakra UI v3 with TanStack
  Router for type-safe routing.

Major Changes:

- Add Chakra UI v3 with Provider, ColorMode, Toaster, Tooltip components
- Integrate TanStack Router with file-based routing and auto-generation
- Replace manual routing with type-safe route definitions
- Remove deprecated menu-list.ts in favor of UI components
- Update greeting molecule to use Chakra UI components
- Configure vite-tsconfig-paths for better import resolution
- Update TypeScript configuration for new routing patterns

New Dependencies:

- @tanstack/react-router + devtools + vite plugin
- vite-tsconfig-paths for path mapping

Breaking Changes:

- All existing route definitions are now file-based
- Component imports may need updating due to new UI system
- Dark mode implementation changed to Chakra's ColorMode

* Frontend-Test-Coverage temporär deaktiviert

- Entferne 73+ veraltete/fehlerhafte Frontend-Test-Dateien
- Deaktiviere Frontend-Coverage-Kommando temporär
- Erweitere Backend Jest-Konfiguration um Prisma-Mock-Pfade
- Bereinige obsolete Snapshot-Tests für bessere Wartbarkeit
- Fokus auf funktionierende Tests statt flaky Test-Suite

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>

- MFA functionality has been completely removed from the frontend. Users can no longer enable or manage two-factor authentication.

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>

- Multi-factor authentication (MFA/2FA) has been completely
  removed from the application. This includes TOTP and WebAuthn support.

Changes made:

- Removed all MFA-related backend services, controllers, and DTOs
- Removed MFA fields from user model and JWT types
- Removed WebAuthn and TOTP dependencies from package.json
- Simplified login flow to single-step authentication
- Removed MFA UI components and routes from frontend
- Cleaned up AuthContext to remove MFA methods
- Removed MFA environment variables from .env.example
- Removed 2FA settings from admin system page
- Fixed tests to remove MFA-related test cases

Affected areas:

- Backend auth module
- Frontend login flow
- User authentication process
- Admin settings
- Test suites

All tests are now passing after MFA removal.

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>

- AdminUser table renamed to User. Run migration to convert data.

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>

## Version [Unreleased]

## 💥 Breaking Changes

**BREAKING CHANGE: Auth-Endpoints geben keine Tokens mehr im JSON-Body zurück**

Die folgenden Auth-Endpoints liefern künftig keine Access- oder Refresh-Tokens mehr im JSON-Body, sondern setzen sie
ausschließlich als httpOnly-Cookies:

- `POST /api/auth/login` - Gibt jetzt `{ user: UserResponseDto }` zurück (vorher: `{ user, accessToken, refreshToken }`)
- `POST /api/auth/register` - Gibt jetzt `{ user: UserResponseDto }` zurück (vorher:
  `{ user, accessToken, refreshToken }`)
- `POST /api/auth/refresh` - Gibt jetzt `{ success: true }` zurück (vorher: `{ accessToken, refreshToken }`)
- `POST /api/auth/admin/login` - Gibt jetzt `{ user: UserResponseDto }` zurück (vorher:
  `{ user, accessToken, refreshToken }`)

**Migration:**

- Frontend-Clients müssen so angepasst werden, dass sie keine Token-Felder mehr aus dem Response-Body erwarten
- Tokens werden automatisch als httpOnly-Cookies gesetzt und bei nachfolgenden Requests mitgesendet
- Die Cookie-Namen sind `accessToken` und `refreshToken`
- Cookies haben die Attribute: `httpOnly=true`, `sameSite=strict`, `secure=true` (in Production)

## 🔧 Refactoring

**Entfernung des redundanten /auth/me Endpoints**

- Der `/api/auth/me` Endpoint wurde entfernt, da er nicht verwendet wurde
- Stattdessen sollte der `/api/auth/check` Endpoint genutzt werden, der zusätzlich:
  - Nie 401 wirft (immer 200 mit `authenticated: false` bei fehlender Auth)
  - Ein `authenticated` boolean-Flag mitliefert
  - Besser für initiale App-Checks geeignet ist

## Version [v1.0.0-alpha.21](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.20...v1.0.0-alpha.21) – Veröffentlicht am 2025-06-16

## 🔧 Tool Verbesserungen

Verbesserungen an den Werkzeugen:

- [`0cded20`](https://github.com/rubenvitt/bluelight-hub/commit/0cded20) (config): Add linting to PR checks and
  pre-commit hooks

- [`89c8986`](https://github.com/rubenvitt/bluelight-hub/commit/89c8986) (config): Exclude ESLint config files from
  coverage

- [`3d5bbe0`](https://github.com/rubenvitt/bluelight-hub/commit/3d5bbe0) (config): Konfiguriere Coverage-Ausschlüsse für
  Codecov

# [1.0.0-alpha.21](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.20...v1.0.0-alpha.21) (2025-06-16)

## Version [v1.0.0-alpha.20](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.19...v1.0.0-alpha.20) – Veröffentlicht am 2025-06-15

## ✨ Neue Funktionen

Die folgenden neuen Features wurden hinzugefügt:

- [`704b2b5`](https://github.com/rubenvitt/bluelight-hub/commit/704b2b5) (frontend): Implementiere Einsatzübersicht mit
  Auswahlmechanismus

- [`50a0df2`](https://github.com/rubenvitt/bluelight-hub/commit/50a0df2) (frontend): Implementiere Einsatzübersicht mit
  Auswahlmechanismus

- [`cfaa44b`](https://github.com/rubenvitt/bluelight-hub/commit/cfaa44b) (frontend): Implementiere Basis
  Einsätze-Übersicht mit NewEinsatzModal
  (Zugehörige Issues: [`#137`](https://github.com/rubenvitt/bluelight-hub/issues/), [
  `#138`](https://github.com/rubenvitt/bluelight-hub/issues/), [
  `#139`](https://github.com/rubenvitt/bluelight-hub/issues/), [
  `#140`](https://github.com/rubenvitt/bluelight-hub/issues/), [
  `#141`](https://github.com/rubenvitt/bluelight-hub/issues/), [
  `#142`](https://github.com/rubenvitt/bluelight-hub/issues/), [
  `#143`](https://github.com/rubenvitt/bluelight-hub/issues/))

## 🐛 Fehlerbehebungen

Diese Probleme wurden behoben:

- [`e6de68f`](https://github.com/rubenvitt/bluelight-hub/commit/e6de68f) (frontend): Entferne tip prop von Spin
  Komponenten

- [`a09985e`](https://github.com/rubenvitt/bluelight-hub/commit/a09985e) (frontend): Behebe Test-Fehler und aktualisiere
  Snapshots

## ♻ Refactoring

Struktur- oder Code-Verbesserungen:

- [`74edfed`](https://github.com/rubenvitt/bluelight-hub/commit/74edfed) (frontend): Refaktorisiere Einsatzübersicht mit
  Utilities

## 🔧 Tool Verbesserungen

Verbesserungen an den Werkzeugen:

- [`5ea55e9`](https://github.com/rubenvitt/bluelight-hub/commit/5ea55e9) (frontend): Behebe Testfehler nach Ant Design
  Update

- [`9e21845`](https://github.com/rubenvitt/bluelight-hub/commit/9e21845) (frontend): Schließe TypeScript-Typdateien von
  Coverage aus

# [1.0.0-alpha.20](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.19...v1.0.0-alpha.20) (2025-06-15)

## Version [v1.0.0-alpha.19](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.18...v1.0.0-alpha.19) – Veröffentlicht am 2025-05-30

## ♻ Refactoring

Struktur- oder Code-Verbesserungen:

- [`1edb687`](https://github.com/rubenvitt/bluelight-hub/commit/1edb687) (rules): Migrate rules from .roo to .cursor

## 🔧 Tool Verbesserungen

Verbesserungen an den Werkzeugen:

- [`eb0036d`](https://github.com/rubenvitt/bluelight-hub/commit/eb0036d) (build): try to fix ci

- [`fc53fbf`](https://github.com/rubenvitt/bluelight-hub/commit/fc53fbf) (build): try to fix ci

- [`67fdad5`](https://github.com/rubenvitt/bluelight-hub/commit/67fdad5) (build): try to fix ci

# [1.0.0-alpha.19](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.18...v1.0.0-alpha.19) (2025-05-30)

## Version [v1.0.0-alpha.18](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.17...v1.0.0-alpha.18) – Veröffentlicht am 2025-05-29

## ✨ Neue Funktionen

Die folgenden neuen Features wurden hinzugefügt:

- [`c9713f2`](https://github.com/rubenvitt/bluelight-hub/commit/c9713f2) (etb): Überarbeite ETB-Logik, Tests und
  Snapshots für neues AntD+Tailwind-Layout

- [`39e6c37`](https://github.com/rubenvitt/bluelight-hub/commit/39e6c37) (scripts): PRD templates und Anleitung für
  Taskmaster

- [`cb676fd`](https://github.com/rubenvitt/bluelight-hub/commit/cb676fd) (etb): Update ETB DTOs, migrations und Doku -
  Aktualisiere create-etb.dto.ts und EtbEntryDto.ts für neue Felder - Passe
  package.json und pnpm-lock.yaml an - Füge neue Migrationen und Decorators hinzu - Überarbeite
  docs/architecture/08-concepts.adoc entsprechend - Stellt Konsistenz zwischen Backend, Shared
  Models und Dokumentation sicher

- [`9048232`](https://github.com/rubenvitt/bluelight-hub/commit/9048232) (cursor): Add environment configuration file
  for terminal snapshots

- [`7f54337`](https://github.com/rubenvitt/bluelight-hub/commit/7f54337) (backend): Implement CLI seed command and
  OpenAPI client generation

- [`84e395b`](https://github.com/rubenvitt/bluelight-hub/commit/84e395b) (backend): Add error handling infrastructure
  and fix test failures

- [`41e5a4c`](https://github.com/rubenvitt/bluelight-hub/commit/41e5a4c) (backend): Add concurrent operations test suite

- [`a06a853`](https://github.com/rubenvitt/bluelight-hub/commit/a06a853) (backend): JSON-basierte
  Seed-Daten-Import-Funktionalität

## 🐛 Fehlerbehebungen

Diese Probleme wurden behoben:

- [`1c58829`](https://github.com/rubenvitt/bluelight-hub/commit/1c58829) (backend): remove invalid uuid pipe

- [`379ef77`](https://github.com/rubenvitt/bluelight-hub/commit/379ef77) (tests): Testfehler behoben

- [`c1e53ec`](https://github.com/rubenvitt/bluelight-hub/commit/c1e53ec) (backend): resolve test compilation issues

- [`cd2de7a`](https://github.com/rubenvitt/bluelight-hub/commit/cd2de7a) (sql): reinit migration

- [`67db2d5`](https://github.com/rubenvitt/bluelight-hub/commit/67db2d5) (backend): behebe fehlgeschlagene Tests

- [`f06df0a`](https://github.com/rubenvitt/bluelight-hub/commit/f06df0a) (frontend): Fix useThemeStore robustness and
  failing tests - Add type checking for store parameters, protect against
  undefined values, fix test reliability - All 269 frontend tests now pass

- [`1a36f7d`](https://github.com/rubenvitt/bluelight-hub/commit/1a36f7d) (backend): Behebe Worker-Prozess Timer-Leaks in
  Jest Tests

## 🔒 Sicherheitsverbesserungen

Sicherheitsrelevante Änderungen:

- [`43f0790`](https://github.com/rubenvitt/bluelight-hub/commit/43f0790) (security): Exclude API keys from tracking and
  update .gitignore

## ♻ Refactoring

Struktur- oder Code-Verbesserungen:

- [`ef2f086`](https://github.com/rubenvitt/bluelight-hub/commit/ef2f086) (backend): Unify ETB filter logic to single
  QueryBuilder with dynamic conditions and fulltext search support

## 🔧 Tool Verbesserungen

Verbesserungen an den Werkzeugen:

- [`f722c27`](https://github.com/rubenvitt/bluelight-hub/commit/f722c27) (scripts): Add commit enforcement tools

- [`fb0a463`](https://github.com/rubenvitt/bluelight-hub/commit/fb0a463) (scripts): Enforce structured commit messages
  with validation tools

- [`b5a07d8`](https://github.com/rubenvitt/bluelight-hub/commit/b5a07d8) (scripts): Integrate Husky for automatic Git
  hook management

- [`d54025b`](https://github.com/rubenvitt/bluelight-hub/commit/d54025b) (scripts): Update documentation build commands
  for Asciidoctor

- [`8b3b052`](https://github.com/rubenvitt/bluelight-hub/commit/8b3b052) (config): Aktualisiere Cursor
  Environment-Konfiguration

- [`e08814c`](https://github.com/rubenvitt/bluelight-hub/commit/e08814c) (formatting): Improve formatting

- [`268f34e`](https://github.com/rubenvitt/bluelight-hub/commit/268f34e) (pnpm): aktualisiere pnpm prod install

- [`be07719`](https://github.com/rubenvitt/bluelight-hub/commit/be07719) (git): Implementiere Husky Git-Hooks für
  Qualitätssicherung

- [`2ebd15b`](https://github.com/rubenvitt/bluelight-hub/commit/2ebd15b) (git): Implementiere Husky Git-Hooks für
  Qualitätssicherung

- [`724ae7b`](https://github.com/rubenvitt/bluelight-hub/commit/724ae7b) (build): try to fix ci

- [`9b2d6a4`](https://github.com/rubenvitt/bluelight-hub/commit/9b2d6a4) (build): try to fix ci

# [1.0.0-alpha.18](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.17...v1.0.0-alpha.18) (2025-05-29)

## Version [v1.0.0-alpha.17](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.16...v1.0.0-alpha.17) – Veröffentlicht am 2025-04-05

## ✨ Neue Funktionen

Die folgenden neuen Features wurden hinzugefügt:

- [`3438ebf`](https://github.com/rubenvitt/bluelight-hub/commit/3438ebf) (backend): Add database migration support - Add
  migration configuration, script and directory structure

- [`4e0dc51`](https://github.com/rubenvitt/bluelight-hub/commit/4e0dc51) (backend): Add ETB module implementation

- [`0c8ad69`](https://github.com/rubenvitt/bluelight-hub/commit/0c8ad69) (frontend): Add ETB component structure and
  hooks

- [`6565065`](https://github.com/rubenvitt/bluelight-hub/commit/6565065) (frontend): Update ETB page with new components

- [`c7e3b92`](https://github.com/rubenvitt/bluelight-hub/commit/c7e3b92) (api): Standardized API response format and
  added ETB entry number

- [`d8daff2`](https://github.com/rubenvitt/bluelight-hub/commit/d8daff2) (etb): Implement status filter functionality
  for ETB entries

- [`5d69248`](https://github.com/rubenvitt/bluelight-hub/commit/5d69248) (etb): Update ETB module with entry status and
  response DTO

## 🐛 Fehlerbehebungen

Diese Probleme wurden behoben:

- [`be87fa6`](https://github.com/rubenvitt/bluelight-hub/commit/be87fa6) fix(mobile): Schließe mobile Sidebar
  automatisch bei Viewport-Änderung

## 🔒 Sicherheitsverbesserungen

Sicherheitsrelevante Änderungen:

- [`0c2e975`](https://github.com/rubenvitt/bluelight-hub/commit/0c2e975) (etb): Implement filename sanitization to
  prevent path traversal attacks

## 🔧 Tool Verbesserungen

Verbesserungen an den Werkzeugen:

- [`ddf2abc`](https://github.com/rubenvitt/bluelight-hub/commit/ddf2abc) (backend): Add Jest setup file for testing

- [`f95cf27`](https://github.com/rubenvitt/bluelight-hub/commit/f95cf27) (backend): Update configurations for database
  and ETB module

# [1.0.0-alpha.17](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.16...v1.0.0-alpha.17) (2025-04-05)

## Version [v1.0.0-alpha.16](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.15...v1.0.0-alpha.16) – Veröffentlicht am 2025-03-30

## ✨ Neue Funktionen

Die folgenden neuen Features wurden hinzugefügt:

- [`c777202`](https://github.com/rubenvitt/bluelight-hub/commit/c777202) (frontend): Add additional dashboard cards for
  ETB, weather, notes and more

# [1.0.0-alpha.16](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.15...v1.0.0-alpha.16) (2025-03-30)

## Version [v1.0.0-alpha.15](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.14...v1.0.0-alpha.15) – Veröffentlicht am 2025-03-30

## ✨ Neue Funktionen

Die folgenden neuen Features wurden hinzugefügt:

- [`25a7161`](https://github.com/rubenvitt/bluelight-hub/commit/25a7161) (backend/frontend): Implementiere Health-Checks
  und StatusIndicator

## 🧹 Codebereinigungen

Aufräumarbeiten und kleinere Verbesserungen:

- [`ae69440`](https://github.com/rubenvitt/bluelight-hub/commit/ae69440) (cleanup): remove old sequential-thinking file
  and update package.json

# [1.0.0-alpha.15](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.14...v1.0.0-alpha.15) (2025-03-30)

## Version [v1.0.0-alpha.14](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.13...v1.0.0-alpha.14) – Veröffentlicht am 2025-03-12

## ✨ Neue Funktionen

Die folgenden neuen Features wurden hinzugefügt:

- [`bd5f226`](https://github.com/rubenvitt/bluelight-hub/commit/bd5f226) (api/health): Implementiere
  API-Client-Generierung und Health-Monitoring-System

# [1.0.0-alpha.14](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.13...v1.0.0-alpha.14) (2025-03-12)

## Version [v1.0.0-alpha.13](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.12...v1.0.0-alpha.13) – Veröffentlicht am 2025-03-12

## 🔧 Tool Verbesserungen

Verbesserungen an den Werkzeugen:

- [`81ea2f5`](https://github.com/rubenvitt/bluelight-hub/commit/81ea2f5) (backend): enhance health checks and fix
  TypeORM connection status

- [`ba7c481`](https://github.com/rubenvitt/bluelight-hub/commit/ba7c481) (rules): improve glob patterns and descriptions
  format - Remove quotes from glob patterns - Convert inline globs to proper
  YAML array format - Enhance description format documentation in 000-rule - Add detailed examples for proper formatting

# [1.0.0-alpha.13](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.12...v1.0.0-alpha.13) (2025-03-12)

## Version [v1.0.0-alpha.12](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.11...v1.0.0-alpha.12) – Veröffentlicht am 2025-03-03

## ✨ Neue Funktionen

Die folgenden neuen Features wurden hinzugefügt:

- [`b792b8d`](https://github.com/rubenvitt/bluelight-hub/commit/b792b8d) (frontend): wip

- [`1f2660f`](https://github.com/rubenvitt/bluelight-hub/commit/1f2660f) (frontend): Reorganize component structure and
  implement tests

## 🔧 Tool Verbesserungen

Verbesserungen an den Werkzeugen:

- [`a52d1d7`](https://github.com/rubenvitt/bluelight-hub/commit/a52d1d7) (ci): Release-Workflow von Tests abhängig
  machen

- [`cbf1cfc`](https://github.com/rubenvitt/bluelight-hub/commit/cbf1cfc) (ci): Coverage-Reports als GitHub Pages
  veröffentlichen

- [`9b16037`](https://github.com/rubenvitt/bluelight-hub/commit/9b16037) (ci): experiment getting the pipeline green

- [`caf28ed`](https://github.com/rubenvitt/bluelight-hub/commit/caf28ed) (ci): GitHub Pages Deployment auf v3
  aktualisieren

- [`ac2cd50`](https://github.com/rubenvitt/bluelight-hub/commit/ac2cd50) (ci): GitHub Pages Deployment auf v3
  aktualisieren

- [`96d9cab`](https://github.com/rubenvitt/bluelight-hub/commit/96d9cab) (ci): Try to fix ci build

- [`b2eb23f`](https://github.com/rubenvitt/bluelight-hub/commit/b2eb23f) (build): Verbessere Test-Setup und
  Docker-Konfiguration

- [`cd038bd`](https://github.com/rubenvitt/bluelight-hub/commit/cd038bd) (ci): Revert coverage reports back to Codecov

- [`f206f9d`](https://github.com/rubenvitt/bluelight-hub/commit/f206f9d) (ci): Revert coverage reports back to Codecov

- [`e59da98`](https://github.com/rubenvitt/bluelight-hub/commit/e59da98) (frontend): Rename test:coverage script to
  test:cov for consistency

# [1.0.0-alpha.12](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.11...v1.0.0-alpha.12) (2025-03-03)

## Version [v1.0.0-alpha.11](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.10...v1.0.0-alpha.11) – Veröffentlicht am 2025-02-25

## ✨ Neue Funktionen

Die folgenden neuen Features wurden hinzugefügt:

- [`6cc4d10`](https://github.com/rubenvitt/bluelight-hub/commit/6cc4d10) (frontend): Verbessere Einsatztagebuch und
  Datums-Funktionen

# [1.0.0-alpha.11](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.10...v1.0.0-alpha.11) (2025-02-25)

## Version [v1.0.0-alpha.10](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.9...v1.0.0-alpha.10) – Veröffentlicht am 2025-02-24

## 🔧 Tool Verbesserungen

Verbesserungen an den Werkzeugen:

- [`1e8fbee`](https://github.com/rubenvitt/bluelight-hub/commit/1e8fbee) (rules): Reorganize cursor rules and add
  backend architecture docs

- [`b17aedc`](https://github.com/rubenvitt/bluelight-hub/commit/b17aedc) (cleanup): Update MockChecklisten and remove
  unused tools, add new cursor rules

# [1.0.0-alpha.10](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.9...v1.0.0-alpha.10) (2025-02-24)

## Version [v1.0.0-alpha.9](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.8...v1.0.0-alpha.9) – Veröffentlicht am 2025-02-23

## ✨ Neue Funktionen

Die folgenden neuen Features wurden hinzugefügt:

- [`3ce93f6`](https://github.com/rubenvitt/bluelight-hub/commit/3ce93f6) (frontend): Implementiere Mock-Komponenten und
  vereinfache Routing

# [1.0.0-alpha.9](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.8...v1.0.0-alpha.9) (2025-02-23)

## Version [v1.0.0-alpha.8](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.7...v1.0.0-alpha.8) – Veröffentlicht am 2025-02-22

## ♻ Refactoring

Struktur- oder Code-Verbesserungen:

- [`c49a080`](https://github.com/rubenvitt/bluelight-hub/commit/c49a080) (frontend): Restrukturierung der
  Dashboard-Komponenten und Commit-Rules

## 🔧 Tool Verbesserungen

Verbesserungen an den Werkzeugen:

- [`eeffd4e`](https://github.com/rubenvitt/bluelight-hub/commit/eeffd4e) (config): Verbessere Commit-Message Handling

# [1.0.0-alpha.8](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.7...v1.0.0-alpha.8) (2025-02-22)

## Version [v1.0.0-alpha.7](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.6...v1.0.0-alpha.7) – Veröffentlicht am 2025-02-22

## ✨ Neue Funktionen

Die folgenden neuen Features wurden hinzugefügt:

- [`a44a8f8`](https://github.com/rubenvitt/bluelight-hub/commit/a44a8f8) (test): Implementiere Vitest Setup mit Testing
  Library

# [1.0.0-alpha.7](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.6...v1.0.0-alpha.7) (2025-02-22)

## Version [v1.0.0-alpha.6](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.5...v1.0.0-alpha.6) – Veröffentlicht am 2025-02-21

## ♻ Refactoring

Struktur- oder Code-Verbesserungen:

- [`85371dd`](https://github.com/rubenvitt/bluelight-hub/commit/85371dd) (frontend): Refactor sidebar and
  einsatztagebuch components

# [1.0.0-alpha.6](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.5...v1.0.0-alpha.6) (2025-02-21)

## Version [v1.0.0-alpha.5](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.4...v1.0.0-alpha.5) – Veröffentlicht am 2025-02-21

## ✨ Neue Funktionen

Die folgenden neuen Features wurden hinzugefügt:

- [`e2052a6`](https://github.com/rubenvitt/bluelight-hub/commit/e2052a6) (frontend): Implementiere neues Dashboard mit
  Mock-Daten

# [1.0.0-alpha.5](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.4...v1.0.0-alpha.5) (2025-02-21)

## Version [v1.0.0-alpha.4](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.3...v1.0.0-alpha.4) – Veröffentlicht am 2025-02-21

## ✨ Neue Funktionen

Die folgenden neuen Features wurden hinzugefügt:

- [`a12efe2`](https://github.com/rubenvitt/bluelight-hub/commit/a12efe2) (frontend): Implementiere Routing und Pages

# [1.0.0-alpha.4](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.3...v1.0.0-alpha.4) (2025-02-21)

## Version [v1.0.0-alpha.3](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.2...v1.0.0-alpha.3) – Veröffentlicht am 2025-02-21

## ♻ Refactoring

Struktur- oder Code-Verbesserungen:

- [`d59bfc8`](https://github.com/rubenvitt/bluelight-hub/commit/d59bfc8) (frontend): Vereinfache Theme-Handling und
  erweitere Navigation\n\n- Vereinfache Theme-Handling in der Sidebar durch
  direkte Nutzung des theme-Props\n- Füge neue Navigationspunkte hinzu (Checklisten, Wecker, MANV, Kommunikation)\n-
  Verbessere Bezeichnungen in der Navigation für bessere Konsistenz

# [1.0.0-alpha.3](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.2...v1.0.0-alpha.3) (2025-02-21)

## Version [v1.0.0-alpha.2](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.1...v1.0.0-alpha.2) – Veröffentlicht am 2025-02-20

## ♻ Refactoring

Struktur- oder Code-Verbesserungen:

- [`3156258`](https://github.com/rubenvitt/bluelight-hub/commit/3156258) (frontend): Überarbeitung des App Layouts und
  Navigation

# [1.0.0-alpha.2](https://github.com/rubenvitt/bluelight-hub/compare/v1.0.0-alpha.1...v1.0.0-alpha.2) (2025-02-20)

### Features

- implement logger and update cursor
  rules ([9f1d576](https://github.com/rubenvitt/bluelight-hub/commit/9f1d5763c450a24e742a9c24fd73dae94a0b453b))

## Version v1.0.0-alpha.1 – Veröffentlicht am 2025-02-17

## ✨ Neue Funktionen

Die folgenden neuen Features wurden hinzugefügt:

- [`c17667b`](https://github.com/rubenvitt/bluelight-hub/commit/c17667b) (frontend): Router-Integration für
  SPA-Navigation

- [`e379e78`](https://github.com/rubenvitt/bluelight-hub/commit/e379e78) (frontend): Implementiere grundlegende
  Frontend-Struktur

- [`ef116ad`](https://github.com/rubenvitt/bluelight-hub/commit/ef116ad) (ci): Integriere Tauri-Build in
  Release-Workflow

## 🔧 Tool Verbesserungen

Verbesserungen an den Werkzeugen:

- [`4b767fb`](https://github.com/rubenvitt/bluelight-hub/commit/4b767fb) (config): Docker-Konfiguration für Monorepo mit
  SQLite

- [`32c6d55`](https://github.com/rubenvitt/bluelight-hub/commit/32c6d55) (config): Docker-Konfiguration für Monorepo mit
  SQLite 🔧(config): Docker Compose Konfiguration hinzugefügt 🔧(ci):
  Implementiere Semantic Release Workflow

- [`b4a8caa`](https://github.com/rubenvitt/bluelight-hub/commit/b4a8caa) (config): Docker-Konfiguration für Monorepo mit
  SQLite 🔧(config): Docker Compose Konfiguration hinzugefügt 🔧(ci):
  Implementiere Semantic Release Workflow 📦(deps): Generiere pnpm-lock.yaml 🔧(config): Aktiviere Versionierung von
  pnpm-lock.yaml

- [`da51d75`](https://github.com/rubenvitt/bluelight-hub/commit/da51d75) (config): Update repository URL in release
  configuration

# 1.0.0-alpha.1 (2025-02-17)

### Features

- update cursor rules and tauri config\n\n- Update all cursor rules with German descriptions\n- Add health-checks rule
  for application monitoring\n- Update tauri configuration\n- Remove
  temporary commit message
  file ([a857f0b](https://github.com/rubenvitt/bluelight-hub/commit/a857f0b1a89d91dc427a70b4838635c5ea5fa443))
