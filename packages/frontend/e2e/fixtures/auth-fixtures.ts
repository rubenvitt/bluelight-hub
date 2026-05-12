import { test as base, type Page } from '@playwright/test';
import { readSeedState } from '../setup/seed';
import type { SeedState } from '../setup/types';

interface AuthFixtures {
  seedState: SeedState;
  markusPage: Page;
  steffi1Page: Page;
  steffi2Page: Page;
  steffi3Page: Page;
  einheitsfuehrerPage: Page;
  sabinePage: Page;
}

export const test = base.extend<AuthFixtures>({
  // eslint-disable-next-line no-empty-pattern -- Playwright fordert Object-Destructuring auch ohne Fixture-Bedarf
  seedState: async ({}, use) => {
    const state = await readSeedState();
    await use(state);
  },
  markusPage: async ({ browser, seedState }, use) => {
    const context = await browser.newContext({ storageState: seedState.users.markus.storageStateFile });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  steffi1Page: async ({ browser, seedState }, use) => {
    const context = await browser.newContext({ storageState: seedState.users.steffi1.storageStateFile });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  steffi2Page: async ({ browser, seedState }, use) => {
    const context = await browser.newContext({ storageState: seedState.users.steffi2.storageStateFile });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  steffi3Page: async ({ browser, seedState }, use) => {
    const context = await browser.newContext({ storageState: seedState.users.steffi3.storageStateFile });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  einheitsfuehrerPage: async ({ browser, seedState }, use) => {
    const context = await browser.newContext({ storageState: seedState.users.einheitsfuehrer.storageStateFile });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  sabinePage: async ({ browser, seedState }, use) => {
    const context = await browser.newContext({ storageState: seedState.users.sabine.storageStateFile });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
