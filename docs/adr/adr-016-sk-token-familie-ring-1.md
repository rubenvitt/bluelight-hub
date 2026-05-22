# ADR-016: SK-Token-Familie als separates Ring-1-Token-System (nicht Re-Use auf `status-*`)

## Status

Akzeptiert (2026-05-19) — verankert die Patienten-Dashboard-Token-Strategie (Issue #417, UX Design Spec Schritt 6/8) im Ring-1-Vertrag und schließt die Frage „SK-Farben als neue Token-Familie oder als Re-Use bestehender `status-*`-Tokens".

## Kontext

Mit dem Patienten-Dashboard im Einsatz (Issue #417) werden Sichtungskategorien nach **DIN 13050:2021-10** und **SiKoKo-Glossar 2025** als zentrales visuelles Element eingeführt. Die fünf Kategorien sind regulatorisch farbkodiert und im operativen Gebrauch fest etabliert:

| Kategorie | Farbe | Bedeutung |
|---|---|---|
| **SK I — Akut behandlungsbedürftig** | Rot | Lebensbedrohlich, sofortige Therapie |
| **SK II — Dringlich** | Gelb | Behandlungsbedürftig, Aufschub möglich |
| **SK III — Nicht dringlich** | Grün | Spätere ambulante Behandlung |
| **SK IV — Abwartend** | **Blau** | Lebt, ohne realistische Überlebenschance |
| **TOT** | **Schwarz** | Verstorben (separate Kategorie, nicht „SK V") |

Diese Farbsemantik ist in Pilot-HiOrgs (DRK, JUH, MHD, ASB, DLRG) seit Jahrzehnten eingeübt — über Verletztenanhängekarten, Sichtungsbänder, Reißkarten und Lehrmaterial. Eine Abweichung von der etablierten Farbe wäre ein operativer Patientensicherheits-Bug, kein Designentscheid.

### Bestehender Ring-1-Status-Token-Bestand

Ring 1 (`packages/frontend/src/index.tailwind.css`) führt heute fünf semantische Status-Familien:

```
status-info-{surface,border,text}        # blau-grau, neutral informativ
status-success-{surface,border,text}     # grün, OK / abgeschlossen
status-warning-{surface,border,text}     # amber/orange, Vorsicht
status-danger-{surface,border,text}      # rot, Fehler / kritisch
```

Außerdem (Story 7.1) die Severity-Tokens und Warnstufen-Tokens (5-stufig: keine/niedrig/mittel/hoch/akut), die für **operative Schwellenwerte** in der Gefahrenmatrix gedacht sind, nicht für Patienten-Sichtung.

### Verifizierte Konfliktpunkte

Eine naive Re-Use-Strategie („SK I = `status-danger`, SK II = `status-warning`, SK III = `status-success`, SK IV = `status-info`, TOT = ?") bricht an mehreren Stellen:

| # | Konflikt | Detail |
|---|---|---|
| 1 | **SK IV vs. `action-primary`** | `action-primary` ist Bluelight-Hub-Identitäts-Blau (Primäraktionen, Login-CTA, „Sofort erfassen"-Button). Ein doppelt belegtes Blau wäre semantisch zweideutig: ist der blaue Bereich „abwartender Patient" oder „aktiver Button"? In Stress-Situationen ein Patientensicherheits-Risiko. |
| 2 | **TOT hat kein bestehendes Token** | Die `status-*`-Familie kennt kein „Tot" — ein neutrales Dunkelgrau wäre semantisch unpassend, ein reines `#000` würde gegen Würde + Lesbarkeit verstoßen. Eigenes Token unausweichlich. |
| 3 | **Sättigung/Helligkeit für KPI-Großzahl** | `status-warning` (amber/orange) ist im Eigenschutz-/Generischer-Kontext bewusst dezent gewählt, damit Warnungen nicht alarmieren. SK-Gelb braucht auf 96 × 96 px KPI-Tiles aus 1,5 m Distanz mehr Sättigung und höheren Kontrast für peripheres Sehen. Eine Anhebung der `status-warning`-Sättigung wäre ein Boyscout-Schaden für Eigenschutz und alle anderen Status-Konsumer. |
| 4 | **`-fill`-Slot fehlt** | Status-Familien haben Slots `surface`, `border`, `text`. SK-Tiles brauchen einen zusätzlichen Slot `fill` für volldeckenden KPI-Card-Hintergrund (mit `text-inverse`-Kontrast). Re-Use würde die `status-*`-Familie um einen Slot erweitern, der für die meisten Konsumer (Form-Errors, System-Hinweise) sinnlos ist. |
| 5 | **Semantische Verwechslungsgefahr** | Ein Form-Validation-Fehler ist nicht „SK I". Ein erfolgreich gespeicherter Datensatz ist nicht „SK III". Wenn `status-danger` und SK I dasselbe Token sind, vermischt sich beim Refactoring oder bei Code-Review die semantische Lesbarkeit. |
| 6 | **Würde der Differenzierung TOT ≠ SK V** | Issue #417 ist explizit korrigiert: TOT ist eine eigene Kategorie, kein „SK V". Eine Re-Use-Strategie würde diese Trennung schwer machen, weil TOT keinem `status-*`-Slot zugeordnet werden kann. |

## Entscheidung

Wir führen eine eigenständige Ring-1-Token-Familie `sk-*` ein, separat von `status-*` / `severity-*` / `warnstufe-*`. Token-Namen folgen der SK-Farbe (nicht der Nummer), damit der Token-Name die Semantik mitführt.

### Token-Definition (Pflicht-Ergänzung in `index.tailwind.css`)

```
sk-rot-{surface,border,text,fill}        # SK I — Akut behandlungsbedürftig
sk-gelb-{surface,border,text,fill}       # SK II — Dringlich
sk-gruen-{surface,border,text,fill}      # SK III — Nicht dringlich
sk-blau-{surface,border,text,fill}       # SK IV — Abwartend (lebt, ohne Überlebenschance)
sk-schwarz-{surface,border,text,fill}    # TOT — Verstorben
```

Jede Familie hat **vier Slots**:

- `surface` — gedämpfter Card-Hintergrund (z. B. SK-Filter-Pill, Pill-Group-Inactive)
- `border` — Akzent-/Trennlinien-Farbe
- `text` — Text auf neutralem Hintergrund
- `fill` — volldeckende Großfläche (KPI-Tile, Sichtungs-Marker); kombiniert mit `text-inverse`-Token für Kontrast

### Hex-Werte (Vorschlag, finale Pilot-HiOrg-Validierung im Token-Story)

| Token | Light | Dark | Begründung |
|---|---|---|---|
| `sk-rot-fill` | `#c62828` | `#c62828` | Sättigung über `status-danger` für peripheres Sehen |
| `sk-rot-text` | `#7a0000` | `#ffeaea` | AA-Kontrast |
| `sk-gelb-fill` | `#e8b400` | `#e8b400` | Höhere Sättigung als `status-warning` |
| `sk-gelb-text` | `#1a1500` | `#1a1500` | Dunkler Text auf Gelb für AA |
| `sk-gruen-fill` | `#2e7d32` | `#2e7d32` | DIN-konformes Sichtungs-Grün |
| `sk-gruen-text` | `#0a3d0e` | `#eaffea` | AA-Kontrast |
| `sk-blau-fill` | `#1f5fb8` | `#1f5fb8` | Klar von `action-primary` (`#5e94f5`) unterscheidbar, DIN-Sichtungs-Blau |
| `sk-blau-text` | `#0d2a52` | `#eaf2ff` | AA-Kontrast |
| `sk-schwarz-fill` | `#1a1f28` | `#1a1f28` | Dunkles Grau-Schwarz, würde-bewusst, kein reines `#000` |
| `sk-schwarz-text` | `#1a1f28` | `#cfd6e0` | Light: Text dunkel; Dark: heller Text auf dunklem Hintergrund |

Hex-Werte sind **Vorschlag** — Pilot-HiOrg-Feedback im Token-Story (Phase 1 der Implementation Roadmap) kann sie justieren. Die Token-Namen und die Familien-Struktur sind dagegen final.

### Verbindliche Konsumtion

- Komponenten konsumieren ausschließlich semantische Tailwind-Utilities (`bg-sk-rot-fill`, `text-sk-rot-text`, `border-sk-blau-border`).
- **Keine direkten `--ring-1-color-sk-*`-Referenzen** im Feature-Code.
- **Keine `status-*`-Tokens für SK-Kategorien** — auch nicht als „Übergangslösung". Ein Feature-Story-Konsument, der SK-Farben braucht, muss diese Tokens nutzen.
- `status-*` bleibt reserviert für generische System-Status (Form-Validation, Toast-Inhalt — sofern überhaupt erlaubt, siehe UX-Spec Schritt 12, Toast-frei-Linie).
- `warnstufe-*` bleibt reserviert für operative Schwellenwerte (Gefahrenmatrix, perspektivisch „SK-I-Anteil > 30 %"-Banner — siehe ADR-013).

### Pflicht-Test-Gates (in `packages/frontend/src/shared/ui/__tests__/`)

- `sk-tokens.spec.ts` — Token-Existenz, Kontrast-Matrix (AA für `text`, AAA für KPI-Großzahl-Kombi `fill+inverse`), Light + Dark
- `sk-tokens-colorblind.spec.ts` (oder Erweiterung der bestehenden Token-Spec) — Protanopia/Deuteranopia/Tritanopia: SK-Kategorien dürfen niemals allein durch Farbton unterscheidbar sein (Triple-Signal-Regel)
- CSF-Fixture (falls Storybook eingeführt wird, sonst Code-Showcase) für manuelle Light/Dark + Farbenfehlsichtigkeits-Walkthrough

### Dreifach-Signal-Regel (Anwendungsregel)

SK wird in der UI **niemals nur über Farbe** kommuniziert. Pflicht-Kombination:

1. **Farbe** (`sk-*-fill` oder `sk-*-border`)
2. **Label** (`SK I`, `SK II`, `SK III`, `SK IV`, `TOT` — exakt nach SiKoKo)
3. **Phosphor-Icon** je Kategorie (z. B. `PiHeartbeatBold` für SK I, `PiHeartBold` für SK II, `PiUserBold` für SK III, `PiMoonBold` für SK IV, würde-bewusstes Icon für TOT)
4. **Zähler-Zahl** in XXL-Typografie (KPI-Tile)

Diese Regel ist in UX-Spec Schritt 8 und 12 verankert und wird über die Komponenten-Verträge (`CategoryCounterTile`, `PatientPill`) erzwungen.

## Konsequenzen

### Positiv

- **Semantische Klarheit.** `bg-sk-rot-fill` sagt im Code-Review unmissverständlich: „dies ist eine SK-Sichtungs-Fläche", nicht „dies ist ein Fehler-Indikator". Lesbarkeit für künftige Patienten-/Klinik-Features steigt.
- **Konflikt mit `action-primary` aufgelöst.** `sk-blau-fill` ist klar von Aktionsblau unterscheidbar; LNA verwechselt SK IV nicht mit „aktiver Button".
- **TOT bekommt eine eigene, würde-bewusste Farbe.** Kein reines Schwarz, kein Re-Use auf einer technischen Status-Farbe.
- **KPI-Großzahl-Tauglichkeit.** SK-Sättigung kann unabhängig von `status-*` für peripheres Sehen optimiert werden, ohne Nebeneffekte auf Eigenschutz und andere Status-Konsumer.
- **`-fill`-Slot ist sauber.** Nur dort eingeführt, wo er Sinn macht — keine Erweiterung der `status-*`-Familie für einen Slot, den Form-Errors nicht brauchen.
- **MDR-konforme Würde der Differenzierung.** TOT ist eine eigene Token-Familie, nicht „SK V" — passt zur ADR-015-Linie der Anzeige-ohne-Empfehlung.
- **Bestehender Ring-1-Vertrag bleibt stabil.** `status-*`, `severity-*`, `warnstufe-*` werden nicht verändert; nur additiv erweitert.

### Negativ

- **Token-Anzahl wächst.** 5 Familien × 4 Slots × 2 Modes = **40 neue Token-Werte** in `index.tailwind.css`. Mitigation: SK-Tokens sind klar abgegrenzt und folgen einem konsistenten Muster — Wartungsaufwand bleibt niedrig.
- **Doppelte semantische Felder Rot/Gelb/Grün.** `status-danger` und `sk-rot` sind beide Rot, aber semantisch verschieden. Code-Reviewer müssen die Unterscheidung lernen. Mitigation: Token-Name spricht für sich (`sk-rot` ≠ `status-danger`); Linting wäre möglich, aber initial nicht nötig.
- **Pilot-HiOrg-Validierung der Hex-Werte aussteht.** Die hier vorgeschlagenen Werte sind plausibel, aber nicht in der echten Pilot-Umgebung validiert. Mitigation: Token-Story hat explizite Pilot-Feedback-Schleife.
- **Bei späterer Internationalisierung (CH/AT)** muss geprüft werden, ob lokale Sanitätsdienst-Konventionen abweichen. DACH-Sanitätsdienste folgen DIN 13050 weitgehend, aber lokale Detailunterschiede sind möglich. Mitigation: Token-Familie ist erweiterbar (z. B. `sk-blau-ch-*` falls je nötig), aber zunächst nicht erforderlich.

## Alternativen

### 1. Re-Use auf bestehende `status-*`-Familie

Abgelehnt aus 6 verifizierten Konfliktgründen (siehe Kontext). Würde semantische Klarheit, KPI-Lesbarkeit und Würde der TOT-Differenzierung opfern, um Token-Anzahl zu sparen — schlechtes Trade-off bei einem Anwendungsfeld mit operativer Patientensicherheits-Relevanz.

### 2. Erweiterung der `warnstufe-*`-Familie um Sichtungs-Slots

Abgelehnt. `warnstufe-*` ist ein **operatives Schwellenwert-Konzept** (5-stufig: keine/niedrig/mittel/hoch/akut), nicht eine Sichtungs-Kategorisierung. Eine Vermischung würde beide Konzepte unklar machen — Warnstufe ist eine Bewertung von Gefahren (ADR-013), Sichtung ist eine Klassifikation von Patienten. Beide bleiben getrennt.

### 3. Feature-lokale Tailwind-Klassen (`bg-[#c62828]`)

Abgelehnt. Verstößt gegen Ring-1-Token-Pflicht (keine ad-hoc Farbwerte in Feature-Code, CLAUDE.md + Ring-3-Guardrails). Würde die Token-Disziplin des Projekts brechen, die wir mit Story 7.1 (Eigenschutz-Tokens) bewusst gestärkt haben.

### 4. SK-Tokens als `@theme inline`-Aliase auf `status-*` mit Override per CSS-Variable

Abgelehnt. Wäre eine versteckte Re-Use-Strategie mit allen Nachteilen von Variante 1, plus zusätzlicher Indirektion. Token-Klarheit wäre für Code-Reviewer noch schlechter.

### 5. SK-Tokens als separates Token-System außerhalb von Ring 1 (z. B. in einer Datei `features/patient/tokens.css`)

Abgelehnt. Würde eine zweite Token-Quelle neben Ring 1 etablieren — verstößt gegen das Ring-Modell („Tokens vor Einzelwerten, neue Tokens werden in Ring 1 ergänzt"). Die SK-Familie ist außerdem fachneutral genug, dass andere Module (Eigenschutz-Profil-Farben, perspektivisch andere klinische Module) ähnliche Patterns brauchen werden — Ring 1 ist der richtige Ort.

## Umsetzungshinweise

### Code-Ergänzung in `index.tailwind.css`

```css
@theme inline {
  /* Sichtungskategorie SK I — Akut (DIN 13050 / SiKoKo) */
  --color-sk-rot-surface: #ffe6e6;
  --color-sk-rot-border: #c62828;
  --color-sk-rot-text: #7a0000;
  --color-sk-rot-fill: #c62828;

  /* Sichtungskategorie SK II — Dringlich */
  --color-sk-gelb-surface: #fff4d6;
  --color-sk-gelb-border: #e8b400;
  --color-sk-gelb-text: #1a1500;
  --color-sk-gelb-fill: #e8b400;

  /* Sichtungskategorie SK III — Nicht dringlich */
  --color-sk-gruen-surface: #e6f5e8;
  --color-sk-gruen-border: #2e7d32;
  --color-sk-gruen-text: #0a3d0e;
  --color-sk-gruen-fill: #2e7d32;

  /* Sichtungskategorie SK IV — Abwartend (lebt, ohne Überlebenschance) */
  --color-sk-blau-surface: #e8f0fb;
  --color-sk-blau-border: #1f5fb8;
  --color-sk-blau-text: #0d2a52;
  --color-sk-blau-fill: #1f5fb8;

  /* Verstorben (separate Kategorie, nicht "SK V") */
  --color-sk-schwarz-surface: #d6d8dc;
  --color-sk-schwarz-border: #1a1f28;
  --color-sk-schwarz-text: #1a1f28;
  --color-sk-schwarz-fill: #1a1f28;
}

.dark {
  --color-sk-rot-surface: #3a1010;
  --color-sk-rot-border: #c62828;
  --color-sk-rot-text: #ffeaea;
  --color-sk-rot-fill: #c62828;

  /* analog gelb/gruen/blau/schwarz für Dark Mode */
}
```

### Token-Test-Spec (`packages/frontend/src/shared/ui/__tests__/sk-tokens.spec.ts`)

```typescript
describe('sk-* token contracts', () => {
  it.each([
    ['sk-rot', 'rot'],
    ['sk-gelb', 'gelb'],
    ['sk-gruen', 'gruen'],
    ['sk-blau', 'blau'],
    ['sk-schwarz', 'schwarz'],
  ])('%s family has all four slots in light + dark', (family, label) => {
    expect(getCSSVar(`--color-${family}-surface`)).toBeDefined();
    expect(getCSSVar(`--color-${family}-border`)).toBeDefined();
    expect(getCSSVar(`--color-${family}-text`)).toBeDefined();
    expect(getCSSVar(`--color-${family}-fill`)).toBeDefined();
  });

  it('sk-blau-fill is visually distinct from action-primary', () => {
    const skBlau = getCSSVar('--color-sk-blau-fill');
    const actionPrimary = getCSSVar('--color-action-primary');
    expect(perceptualDistance(skBlau, actionPrimary)).toBeGreaterThan(15);
  });

  it.each(/* alle Familien × Slots */)('%s text on %s surface meets WCAG AA', ...);
  it.each(/* fill × text-inverse */)('%s fill + text-inverse meets WCAG AAA for large text', ...);
});
```

### Phosphor-Icon-Zuordnung

Verbindlich für SK-Kategorien (gehört in `features/patient/constants/sk-categories.constants.ts`):

| SK | Phosphor-Icon | Begründung |
|---|---|---|
| SK I | `PiHeartbeatBold` | Akut, Vitalfunktion bedroht |
| SK II | `PiHeartBold` | Stabil, aber behandlungsbedürftig |
| SK III | `PiUserBold` | Geh-/Stehfähig, ambulant |
| SK IV | `PiMoonBold` | Palliativ, schmerzlindernd |
| TOT | (Vorschlag: `PiCrossBold` oder neutrales Symbol; finales Icon im Token-Story mit Pilot-Feedback) | Würde-bewusst, keine Schädel/Skull-Symbole |

### Boyscout-Punkt: Bestehende SK-IV-Konnotationen prüfen

Issue #417 ist explizit korrigiert: SK IV = Blau (abwartend, lebt), TOT = Schwarz. Vor der Token-Story ist ein Codebase-Sweep nötig:

```bash
rg -i "sk.?iv|sichtungskategorie.?iv|SK4" packages/
rg -i "tot.*schwarz|schwarz.*tot" packages/
```

Alte Konnotationen (z. B. Enum-Werte, Konstanten, Test-Fixtures, die SK IV mit Tot konnotieren) sind zu korrigieren. Scope: nur direkte Konstanten + Enum-Definitionen, keine Architektur-Umbauten.

### Story-Bezug

Token-Erweiterung ist **Story 1 von Phase 1** der Implementation Roadmap (UX Design Spec Schritt 11). Blocker für `CategoryCounterTile`, `KpiTile`, `PatientPill` und alle nachfolgenden Patienten-Komponenten.

### Migration / Backwards-Kompatibilität

Keine — die `sk-*`-Familie ist additiv neu, kollidiert mit keinem bestehenden Token. `status-*` bleibt unverändert.

## Referenzen

- [Issue #417 — Patienten-Dashboard im Einsatz](https://github.com/rubenvitt/bluelight-hub/issues/417)
- [UX Design Specification](../../\_bmad-output/planning-artifacts/ux-design-specification.md) — Schritt 6 (Customization Strategy) + Schritt 8 (Visual Foundation)
- [ADR-015: MDR-Grenze — Anzeige-Tool ohne Triage-Empfehlung](./adr-015-mdr-grenze-anzeige-ohne-triage-empfehlung.md) — TOT-Differenzierung als Würde-Pattern
- [Ring-1 Design Tokens](../frontend/ring-1-design-tokens.md) — bestehender Token-Vertrag
- [Frontend Design System Overview](../frontend/00-design-system-overview.md) — Ring-Modell + Guardrails
- [`packages/frontend/src/index.tailwind.css`](../../packages/frontend/src/index.tailwind.css) — Ziel-Datei für Token-Erweiterung
- [`packages/frontend/src/shared/ui/__tests__/ring-1-design-tokens.spec.ts`](../../packages/frontend/src/shared/ui/__tests__/ring-1-design-tokens.spec.ts) — Vorbild-Spec für `sk-tokens.spec.ts`
- [DIN 13050:2021-10](https://www.beuth.de/de/norm/din-13050/337090797) — Rettungswesen-Begriffe
- [SiKoKo-Glossar 2025](https://www.bbk.bund.de/) — Sichtungskategorien-Definition
- [Memory: MANV Sichtungskategorien Farben](../../\_bmad-output/../memory/project_manv_sichtungskategorien_farben.md) — Entscheidung Rubeen 2026-05-18
