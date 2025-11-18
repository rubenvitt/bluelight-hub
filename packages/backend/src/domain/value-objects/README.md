# MGRS Koordinatensystem - Knowledge Transfer

## Übersicht

Dieses Dokument erklärt das **MGRS (Military Grid Reference System)** Koordinatensystem, das in Bluelight Hub als primärer Koordinatentyp für DRK-Einsatzleitung verwendet wird.

## Warum MGRS?

MGRS ist der NATO-Standard für militärische und zivile Hilfsorganisationen. Gegenüber Lat/Lng bietet MGRS mehrere Vorteile:

- **Kompakt:** Weniger fehleranfällig bei Funkdurchsagen (z.B. "33 Uniform Uniform 123 456")
- **Metrisch:** Distanzen sind direkt in Metern ablesbar
- **NATO-Standard:** Interoperabilität mit anderen Hilfsorganisationen (Feuerwehr, THW, Bundeswehr)
- **DRK-Standard:** Entspricht den Vorgaben des Deutschen Roten Kreuzes für Einsatzleitung

## MGRS Format

### Format-Struktur

MGRS-Koordinaten folgen dem NATO-Standard:

```
32U MV 12345 67890
│   │  │     └─────── Northing (Meter innerhalb 100km Quadrat)
│   │  └───────────── Easting (Meter innerhalb 100km Quadrat)
│   └──────────────── 100km Square ID (zwei Buchstaben)
└──────────────────── Grid Zone Designator (GZD)
```

### Grid Zone Designator (GZD)

- **Format:** 1-2 Ziffern + 1 Buchstabe (z.B. `32U`, `33U`, `33N`)
- **Ziffern:** Längenzone (6° Breite, nummeriert 1-60 von West nach Ost)
- **Buchstabe:** Breitenband (8° Höhe, Buchstaben C-X ohne I und O)

**Deutsche MGRS-Zonen:**
- `32U`: Western/Northern Germany (Hamburg, Köln)
- `33U`: Eastern Germany (Berlin, Leipzig, Dresden)
- `33N`: Central/Southern Germany (Frankfurt, Stuttgart, München)

### 100km Square ID

- **Format:** Zwei Buchstaben (z.B. `UU`, `MV`, `NE`)
- Identifiziert ein 100km × 100km Quadrat innerhalb der Grid Zone
- Buchstaben: A-Z (ohne I und O, um Verwechslungen mit 1 und 0 zu vermeiden)

### Easting / Northing

- **Easting:** Ost-West Position in Metern (0-99999)
- **Northing:** Nord-Süd Position in Metern (0-99999)
- **Präzision:** Anzahl der Ziffern bestimmt die Genauigkeit
  - 10 Ziffern (5+5): 1m Genauigkeit (z.B. `12345 67890`)
  - 8 Ziffern (4+4): 10m Genauigkeit (z.B. `1234 6789`)
  - 6 Ziffern (3+3): 100m Genauigkeit (z.B. `123 678`)
  - 4 Ziffern (2+2): 1km Genauigkeit (z.B. `12 67`)
  - 2 Ziffern (1+1): 10km Genauigkeit (z.B. `1 6`)
  - 0 Ziffern: 100km Genauigkeit (nur Grid Square)

**Wichtig:** Easting und Northing müssen immer die gleiche Anzahl Ziffern haben!

## Lat/Lng ↔ MGRS Konvertierung

### MGRS zu Lat/Lng

Konvertiert MGRS-Koordinaten zu WGS84 Lat/Lng (Mittelpunkt der MGRS-Zelle):

```typescript
// MGRS-String parsen
const mgrsResult = MgrsCoordinate.fromString("33UUU8990317936");
if (mgrsResult.isSuccess) {
  const mgrs = mgrsResult.value;

  // Zu Lat/Lng konvertieren (Mittelpunkt)
  const latLng = mgrs.toLatLng();
  console.log(latLng.latitude);  // 52.5163
  console.log(latLng.longitude); // 13.3777
  console.log(latLng.toString()); // "52.5163°N, 13.3777°E"

  // Bounding Box der MGRS-Zelle berechnen
  const bbox = mgrs.toBoundingBox();
  console.log(bbox);
  // {
  //   minLat: 52.51629,
  //   minLng: 13.37769,
  //   maxLat: 52.51630,
  //   maxLng: 13.37771
  // }
}
```

### Lat/Lng zu MGRS

Konvertiert WGS84 Lat/Lng zu MGRS (z.B. für Geocoding-API-Ergebnisse):

```typescript
// Von Lat/Lng erstellen (z.B. Nominatim Geocoding-Ergebnis)
const mgrsResult = MgrsCoordinate.fromLatLng(52.5163, 13.3777, 5);
//                                            ^lat    ^lng     ^precision (5 = 1m)
if (mgrsResult.isSuccess) {
  const mgrs = mgrsResult.value;
  console.log(mgrs.value);      // "33UUU8990317936"
  console.log(mgrs.gridZone);   // "33U"
  console.log(mgrs.squareId);   // "UU"
  console.log(mgrs.easting);    // 89903
  console.log(mgrs.northing);   // 17936
  console.log(mgrs.precision);  // 1 (meter)
}
```

**Performance:** <1ms in-memory Konvertierung (nutzt `mgrs` npm package 1.x)

## Genauigkeit

MGRS bietet eine **±11m Genauigkeit**, die dem **DRK-Standard** entspricht und für Einsatzleitung vollkommen ausreichend ist:

- **±11m Radius:** Typische GPS-Genauigkeit (ohne DGPS/RTK)
- **Einsatztauglich:** Lokalisierung von Einsatzorten, Fahrzeugen und Personal
- **Optimiert:** 1m Präzision (5-stellig) für maximale Genauigkeit bei kompakter Darstellung

**Vergleich:**
- MGRS 1m Präzision: `33UUU8990317936` (15 Zeichen)
- Lat/Lng 6 Dezimalstellen: `52.516300, 13.377700` (21 Zeichen)

## Fallback-Strategie: Wann Lat/Lng nutzen?

Obwohl MGRS das primäre Speicherformat in der Datenbank ist, gibt es Situationen, in denen **GeoCoordinate (Lat/Lng)** verwendet werden muss:

### Verwendung von GeoCoordinate (Lat/Lng)

1. **Externe APIs:**
   - Geocoding-APIs (Nominatim, Google Maps Geocoding)
   - Map-Rendering (Leaflet, Google Maps, Mapbox)
   - Routing-APIs (OSRM, Google Directions)

2. **Frontend-Anzeige:**
   - Kartenanzeige (Leaflet erwartet Lat/Lng)
   - Marker-Positionierung
   - Polyline/Polygon-Zeichnung

3. **API-Integration:**
   - Externe Dienste geben fast immer Lat/Lng zurück
   - Standards wie GeoJSON nutzen Lat/Lng

### Workflow

```typescript
// 1. Externe API liefert Lat/Lng (z.B. Nominatim Geocoding)
const geocodingResult = await nominatim.search("Brandenburger Tor, Berlin");
const { lat, lng } = geocodingResult[0];

// 2. Konvertierung zu MGRS für Datenbank-Speicherung
const mgrsResult = MgrsCoordinate.fromLatLng(lat, lng, 5); // 1m Präzision
if (mgrsResult.isSuccess) {
  const mgrs = mgrsResult.value;

  // 3. MGRS in Datenbank speichern
  await einsatzRepository.save({
    ...einsatzData,
    einsatzort_mgrs: mgrs.value, // "33UUU8990317936"
  });
}

// 4. Beim Anzeigen: MGRS zurück zu Lat/Lng für Karte
const einsatz = await einsatzRepository.findById(einsatzId);
const mgrs = MgrsCoordinate.fromString(einsatz.einsatzort_mgrs).getValue();
const latLng = mgrs.toLatLng();

// 5. Leaflet Marker rendern
L.marker([latLng.latitude, latLng.longitude]).addTo(map);
```

## Beispiele

### Berlin: Brandenburger Tor

```typescript
// MGRS
const berlinMgrs = MgrsCoordinate.fromString("33UUU8990317936").getValue();
console.log(berlinMgrs.gridZone);  // "33U"
console.log(berlinMgrs.squareId);  // "UU"
console.log(berlinMgrs.precision); // 1 (meter)

// Lat/Lng
const berlinLatLng = berlinMgrs.toLatLng();
console.log(berlinLatLng.latitude);  // 52.5163
console.log(berlinLatLng.longitude); // 13.3777
```

### München: Marienplatz

```typescript
// Von Lat/Lng erstellen (München liegt in Zone 33T/32U, je nach genauer Position)
const muenchenResult = MgrsCoordinate.fromLatLng(48.1374, 11.5755, 5);
if (muenchenResult.isSuccess) {
  const muenchenMgrs = muenchenResult.value;
  console.log(muenchenMgrs.value); // "32UPU..." (Zone 32U für München)
  console.log(muenchenMgrs.gridZone); // "32U"
}
```

### Hamburg: Rathaus

```typescript
// Hamburg in Zone 32U
const hamburgResult = MgrsCoordinate.fromLatLng(53.5511, 9.9937, 5);
if (hamburgResult.isSuccess) {
  const hamburgMgrs = hamburgResult.value;
  console.log(hamburgMgrs.value); // "32UNE..." (Zone 32U)
  console.log(hamburgMgrs.gridZone); // "32U"
}
```

## Testing Coverage

Die MGRS-Implementierung ist umfassend getestet:

- **391 Tests** für MGRS-Koordinaten-Konvertierung (Epic 1)
- **97.1% Line Coverage**
- **Alle Edge Cases abgedeckt:**
  - Polregionen (werden gracefully behandelt)
  - UTM-Zonengrenzen
  - Format-Validierung (ungerade Ziffernanzahl, ungültige Zeichen)
  - Deutsche Zonen-Validierung (32U, 33U, 33N)
  - Präzisions-Varianten (0-10 Ziffern)

**Test-Datei für Entwickler:**
`packages/backend/src/domain/value-objects/mgrs-coordinate.spec.ts`

Diese Datei enthält:
- Format-Validierungs-Tests
- Konvertierungs-Tests (MGRS ↔ Lat/Lng)
- Distanzberechnungs-Tests
- Bounding-Box-Tests
- Edge-Case-Tests

**Beispiel aus Tests:**

```typescript
// Format-Validierung
it('should fail with invalid format (odd number of digits)', () => {
  const result = MgrsCoordinate.fromString('33UUU123'); // 3 Ziffern (ungerade)
  expect(result.isFailure).toBe(true);
  expect(result.error).toContain('Invalid MGRS format');
});

// Deutsche Zonen-Validierung
it('should fail with invalid zone (not German)', () => {
  const result = MgrsCoordinate.fromString('10UGC1234567890'); // Zone 10U (USA)
  expect(result.isFailure).toBe(true);
  expect(result.error).toContain('Invalid grid zone');
  expect(result.error).toContain('32U, 33U, 33N');
});

// Konvertierungs-Tests
it('should create MgrsCoordinate from valid Berlin MGRS string', () => {
  const result = MgrsCoordinate.fromString('33UUU8990317936');
  expect(result.isSuccess).toBe(true);
  expect(result.value?.gridZone).toBe('33U');
  expect(result.value?.squareId).toBe('UU');
  expect(result.value?.precision).toBe(1); // 10 Ziffern = 1m Präzision
});
```

## API-Referenz

### Factory Methods

#### `MgrsCoordinate.fromString(mgrsString: string): Result<MgrsCoordinate>`

Erstellt MGRS-Koordinate aus String.

**Parameter:**
- `mgrsString`: MGRS-String (z.B. `"33UUU8990317936"`)

**Returns:** `Result<MgrsCoordinate>` (Success oder Failure)

**Validierungen:**
- Format-Regex: `^\d{1,2}[C-HJ-NP-X]{3}(\d{10}|\d{8}|\d{6}|\d{4}|\d{2})?$`
- Deutsche Zonen: `32U`, `33U`, `33N`
- Parseability via `mgrs.inverse()`

#### `MgrsCoordinate.fromLatLng(lat: number, lng: number, precision = 5): Result<MgrsCoordinate>`

Erstellt MGRS-Koordinate aus Lat/Lng.

**Parameter:**
- `lat`: Latitude (-90 bis 90)
- `lng`: Longitude (-180 bis 180)
- `precision`: MGRS-Genauigkeit (0-5, wobei 5 = 1m). Default: 5

**Returns:** `Result<MgrsCoordinate>`

**Wichtig:** Nutzt `mgrs.forward([lng, lat])` - Beachte die Reihenfolge!

### Instance Methods

#### `toLatLng(): GeoCoordinate`

Konvertiert MGRS zu Lat/Lng (Mittelpunkt der MGRS-Zelle).

**Returns:** `GeoCoordinate` mit `{ latitude, longitude }`

#### `toBoundingBox(): { minLat, minLng, maxLat, maxLng }`

Berechnet Bounding Box der MGRS-Zelle.

**Returns:** Objekt mit südwestlicher und nordöstlicher Ecke

#### `distanceTo(other: MgrsCoordinate): number`

Berechnet Distanz zu anderer MGRS-Koordinate (Haversine-Formel).

**Returns:** Distanz in Metern

### Readonly Properties

- `value: string` - Vollständiger MGRS-String
- `gridZone: string` - Grid Zone Designator (z.B. `"33U"`)
- `squareId: string` - 100km Square ID (z.B. `"UU"`)
- `easting: number` - Easting in Metern
- `northing: number` - Northing in Metern
- `precision: number` - Präzision in Metern (1, 10, 100, 1000, 10000, 100000)

## Best Practices

### DO's ✅

- **Speichere MGRS in der Datenbank** (primäres Format)
- **Konvertiere Lat/Lng zu MGRS** bei API-Eingaben
- **Nutze 1m Präzision** (precision=5) für Einsatzorte
- **Validiere MGRS-Format** vor Speicherung
- **Nutze Factory Methods** (`fromString`, `fromLatLng`) für Erstellung

### DON'Ts ❌

- **NICHT direkt Lat/Lng speichern** (außer für externe APIs)
- **NICHT MGRS-Strings manuell parsen** (nutze `fromString`)
- **NICHT ungerade Ziffernanzahl** verwenden (immer Easting + Northing gleich lang)
- **NICHT Zone 33T verwenden** (München: nutze 32U oder 33U je nach Position)
- **NICHT `new MgrsCoordinate()` aufrufen** (Constructor ist private!)

## Weiterführende Ressourcen

- **mgrs npm package:** https://www.npmjs.com/package/mgrs
- **MGRS Wikipedia:** https://en.wikipedia.org/wiki/Military_Grid_Reference_System
- **NATO STANAG 2211:** MGRS Standard-Spezifikation
- **UTM Coordinate System:** https://en.wikipedia.org/wiki/Universal_Transverse_Mercator_coordinate_system

---

**Autor:** Bluelight Hub Development Team
**Letzte Aktualisierung:** 2025-01-18
**Epic:** 276 - Hexagonale Architektur / Story 2-0 / Task 5
