/**
 * Performance Test Seed Script
 *
 * Erstellt Testdaten für Artillery Load Tests:
 * - 10 Einsätze mit verschiedenen Status
 * - 50 ETB-Einträge verteilt über die Einsätze
 * - 1 Performance-Test User
 *
 * Verwendung:
 *   npx ts-node artillery/seed-performance-data.ts
 *
 * oder via npm script:
 *   pnpm --filter @bluelight-hub/backend seed:perf
 */

import { EinsatzStatus, EtbKategorie, PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

// Realistische Testdaten
const ALARMSTICHWÖRTER = [
  'B1 Kleinbrand',
  'B2 Brand klein',
  'B3 Brand mittel',
  'B4 Brand groß',
  'H1 Hilfeleistung klein',
  'H2 Hilfeleistung mittel',
  'TH1 Technische Hilfe',
  'TH2 Verkehrsunfall',
  'RD Rettungsdienst',
  'NOTF Notfall',
];

const ORTE = [
  { ort: 'Teststadt', strasse: 'Hauptstraße 1' },
  { ort: 'Musterheim', strasse: 'Bahnhofstraße 23' },
  { ort: 'Beispieldorf', strasse: 'Schulweg 5' },
  { ort: 'Probehausen', strasse: 'Am Markt 12' },
  { ort: 'Demowil', strasse: 'Industrieweg 8' },
  { ort: 'Testlingen', strasse: 'Kirchplatz 3' },
  { ort: 'Musterdorf', strasse: 'Gartenstraße 17' },
  { ort: 'Beispielstadt', strasse: 'Rathausplatz 1' },
  { ort: 'Probingen', strasse: 'Waldweg 44' },
  { ort: 'Demoheim', strasse: 'Bergstraße 9' },
];

const ETB_TEXTE = [
  'Einsatzkräfte vor Ort eingetroffen',
  'Erkundung der Lage läuft',
  'Lage unter Kontrolle',
  'Verstärkung angefordert',
  'Einsatzleitung übernommen',
  'Absperrung eingerichtet',
  'Rettungsdienst alarmiert',
  'Polizei verständigt',
  'THW angefordert',
  'Brandbekämpfung eingeleitet',
  'Patienten werden versorgt',
  'Transport ins Krankenhaus',
  'Nachalarmierung erfolgt',
  'Einsatzstelle gesichert',
  'Ablösung angefordert',
];

const ETB_KATEGORIEN = Object.values(EtbKategorie);

/**
 * Generiert eine zufällige CUID-ähnliche ID
 */
function _generateId(): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 25; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Generiert eine realistische Einsatznummer
 */
function generateEinsatzNummer(index: number): string {
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).substring(2, 10);
  return `E${year}-${String(index).padStart(3, '0')}-${random}`;
}

async function main() {
  console.log('🚀 Starting Performance Data Seed...');
  console.log('');

  // 1. Erstelle Performance Test User
  console.log('👤 Creating performance test user...');
  let testUser = await prisma.user.findFirst({
    where: { username: 'perf-test-seed-user' },
  });

  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        username: 'perf-test-seed-user',
        role: UserRole.SUPER_ADMIN,
        isActive: true,
      },
    });
    console.log(`   ✅ Created user: ${testUser.username} (${testUser.id})`);
  } else {
    console.log(`   ℹ️ User already exists: ${testUser.username}`);
  }

  // 2. Lösche existierende Performance-Testdaten (optional)
  const existingPerfEinsaetze = await prisma.einsatz.count({
    where: { beschreibung: { contains: 'Performance Test Seed' } },
  });
  if (existingPerfEinsaetze > 0) {
    console.log(`\n🧹 Cleaning up ${existingPerfEinsaetze} existing performance test entries...`);

    // Lösche in korrekter Reihenfolge (Abhängigkeiten beachten)
    await prisma.etbEintrag.deleteMany({
      where: {
        etb: {
          einsatz: {
            beschreibung: { contains: 'Performance Test Seed' },
          },
        },
      },
    });
    await prisma.einsatztagebuch.deleteMany({
      where: {
        einsatz: {
          beschreibung: { contains: 'Performance Test Seed' },
        },
      },
    });
    await prisma.einsatz.deleteMany({
      where: { beschreibung: { contains: 'Performance Test Seed' } },
    });
    console.log('   ✅ Cleaned up old performance test data');
  }

  // 3. Erstelle 10 Einsätze
  console.log('\n📋 Creating 10 Einsätze...');
  const einsaetze: Array<{ id: string; etbId: string | null }> = [];

  for (let i = 0; i < 10; i++) {
    const ortData = ORTE[i % ORTE.length];
    const status = i < 7 ? EinsatzStatus.ANGELEGT : i < 9 ? EinsatzStatus.ABGESCHLOSSEN : EinsatzStatus.ARCHIVIERT;

    const einsatz = await prisma.einsatz.create({
      data: {
        nummer: generateEinsatzNummer(i + 1),
        alarmstichwort: ALARMSTICHWÖRTER[i % ALARMSTICHWÖRTER.length],
        status: status,
        einsatzort: ortData.strasse,
        ort: ortData.ort,
        beschreibung: `Performance Test Seed Einsatz #${i + 1}`,
        createdById: testUser.id,
        alarmpiertAt: new Date(Date.now() - (10 - i) * 3600000), // Verteilt über die letzten 10 Stunden
        abgeschlossenAt: status !== EinsatzStatus.ANGELEGT ? new Date() : null,
        archiviertAt: status === EinsatzStatus.ARCHIVIERT ? new Date() : null,
      },
    });

    // Erstelle ETB für jeden Einsatz
    const etb = await prisma.einsatztagebuch.create({
      data: {
        einsatzId: einsatz.id,
        status: status === EinsatzStatus.ABGESCHLOSSEN || status === EinsatzStatus.ARCHIVIERT ? 'LOCKED' : 'ACTIVE',
        version: 1,
      },
    });

    einsaetze.push({ id: einsatz.id, etbId: etb.id });
    console.log(`   ✅ Created Einsatz #${i + 1}: ${einsatz.nummer} (${status})`);
  }

  // 4. Erstelle 50 ETB-Einträge (verteilt über alle Einsätze)
  console.log('\n📝 Creating 50 ETB entries...');
  let etbEntryCount = 0;

  for (let i = 0; i < 50; i++) {
    const einsatzIndex = i % einsaetze.length;
    const einsatz = einsaetze[einsatzIndex];

    if (!einsatz.etbId) continue;

    // Berechne Sequenznummer für dieses ETB
    const existingCount = await prisma.etbEintrag.count({
      where: { etbId: einsatz.etbId },
    });

    await prisma.etbEintrag.create({
      data: {
        etbId: einsatz.etbId,
        sequenzNummer: existingCount + 1,
        kategorie: ETB_KATEGORIEN[i % ETB_KATEGORIEN.length],
        inhalt: ETB_TEXTE[i % ETB_TEXTE.length],
        createdById: testUser.id,
        erstelltAt: new Date(Date.now() - (50 - i) * 60000), // Verteilt über die letzten 50 Minuten
      },
    });
    etbEntryCount++;
  }
  console.log(`   ✅ Created ${etbEntryCount} ETB entries`);

  // 5. Zusammenfassung
  console.log(`\n${'='.repeat(50)}`);
  console.log('📊 Performance Test Seed Summary:');
  console.log('='.repeat(50));
  console.log(`   👤 Test User:     ${testUser.username}`);
  console.log(`   📋 Einsätze:      ${einsaetze.length}`);
  console.log(`   📝 ETB Entries:   ${etbEntryCount}`);
  console.log('');
  console.log('   Status Distribution:');
  console.log('      - ANGELEGT:      7');
  console.log('      - ABGESCHLOSSEN: 2');
  console.log('      - ARCHIVIERT:    1');
  console.log('');
  console.log('✅ Performance seed completed successfully!');
  console.log('');
  console.log('You can now run: pnpm --filter @bluelight-hub/backend test:perf');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
