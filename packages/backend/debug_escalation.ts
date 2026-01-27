import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Debugging Escalation State ---');
  try {
    // 1. Suche nach der spezifischen "admin" Erinnerung aus dem Screenshot
    const adminReminders = await prisma.erinnerung.findMany({
      where: { titel: { contains: 'admin' } },
      select: {
        id: true,
        titel: true,
        status: true,
        intensivierungsCount: true,
        eskalationsPersonId: true,
        ausgeloestAm: true,
        updatedAt: true,
        faelligAm: true,
      },
    });
    console.log('Specific Reminder (Admin):', JSON.stringify(adminReminders, null, 2));

    // 2. Suche generell nach AUSGELOESTEN Erinnerungen, die eigentlich eskaliert sein sollten
    // (älter als 1 Minute z.B., je nach Timeout Config - ich zeige einfach die ältesten)
    const stuckReminders = await prisma.erinnerung.findMany({
      where: { status: 'AUSGELOEST' },
      take: 5,
      orderBy: { ausgeloestAm: 'asc' }, // Älteste zuerst -> sollten längst eskaliert sein
      select: {
        id: true,
        titel: true,
        status: true,
        intensivierungsCount: true,
        eskalationsPersonId: true,
        ausgeloestAm: true,
      },
    });
    console.log('Oldest Stuck Reminders:', JSON.stringify(stuckReminders, null, 2));
  } catch (e) {
    console.error('Error querying DB:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
