import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { afterEach, expect } from 'vitest';
import { expectNoAxeViolations, type ExpectNoAxeViolationsOptions } from './a11y';
import { createMatchMediaList, resetTestViewport } from './viewport';

if (!globalThis.crypto || !globalThis.crypto.subtle) {
  const { webcrypto } = await import('node:crypto');
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: webcrypto,
  });
}

function createStorageMock(): Storage {
  const data = new Map<string, string>();

  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(data.keys())[index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(String(key), String(value));
    },
  } as Storage;
}

const localStorageMock = createStorageMock();
const sessionStorageMock = createStorageMock();

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: localStorageMock,
});

Object.defineProperty(window, 'sessionStorage', {
  configurable: true,
  value: sessionStorageMock,
});

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: localStorageMock,
});

Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  value: sessionStorageMock,
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetTestViewport();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => createMatchMediaList(query),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver implements globalThis.IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];

  disconnect(): void {}
  observe(_target: Element): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  unobserve(_target: Element): void {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver implements globalThis.ResizeObserver {
  disconnect(): void {}
  observe(_target: Element, _options?: ResizeObserverOptions): void {}
  unobserve(_target: Element): void {}
};

resetTestViewport();

/**
 * A11y-Audit (Story 7.8) — `toHaveNoAxeViolations`-Matcher.
 *
 * Verwendung:
 * ```ts
 * await expect(container).toHaveNoAxeViolations();
 * await expect(container).toHaveNoAxeViolations({ rules: { region: { enabled: false } } });
 * ```
 *
 * Default-Tags und deaktivierte Regeln (`color-contrast`,
 * `color-contrast-enhanced`) stammen aus `./a11y.ts`. jsdom-spezifische
 * Limits sind dort dokumentiert.
 */
expect.extend({
  async toHaveNoAxeViolations(received: HTMLElement, options?: ExpectNoAxeViolationsOptions) {
    try {
      await expectNoAxeViolations(received, options);
      return {
        pass: true,
        message: () => 'erwartete A11y-Verstöße — keine gefunden',
      };
    } catch (error) {
      return {
        pass: false,
        message: () => (error as Error).message,
      };
    }
  },
});
