import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const stylesheetPath = path.resolve(currentDirectory, '../../index.tailwind.css');

/**
 * WCAG-Kontrast-Spec für SK- und Patient-Status-Tokens (Story 1.5, AC6).
 *
 * Vorbild: `packages/frontend/src/shared/ui/__tests__/ring-1-design-tokens.spec.ts`.
 * Prüft die in `index.tailwind.css` definierten `--ring-1-color-sk-*` und
 * `--ring-1-color-patient-status-*` Custom Properties auf:
 *  - Normaltext-Kontrast `*-text` auf `*-surface` ≥ 4,5:1 (AA)
 *  - `sk-rot`-Sonderfall ≥ 7:1 (AAA — kritisch-assertiv)
 *  - Border-Kontrast `*-border` auf `surface-canvas` ≥ 3:1 (UI-Component)
 *  - Large-Text-Kontrast Weiß auf `sk-*-fill` ≥ 3:1 (für KPI-Großzahl in
 *    Variant=solid, text-title-xxl)
 */
const SK_FAMILIES = ['sk-rot', 'sk-gelb', 'sk-gruen', 'sk-blau', 'sk-schwarz'] as const;
const SK_SLOTS = ['surface', 'border', 'text', 'fill'] as const;

const PATIENT_STATUS_FAMILIES = [
  'patient-status-eintreffend',
  'patient-status-sichtung',
  'patient-status-behandlung',
  'patient-status-transport-wartend',
  'patient-status-im-transport',
  'patient-status-abtransportiert',
] as const;
const PATIENT_STATUS_SLOTS = ['surface', 'border', 'text'] as const;

function extractBlock(stylesheet: string, selector: ':root' | '.dark'): string {
  const matcher = new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([\\s\\S]*?)\\n\\}`);
  const match = matcher.exec(stylesheet);
  if (match === null) {
    throw new Error(`CSS block ${selector} not found`);
  }
  return match[1];
}

function readCssVariable(block: string, variableName: string): string {
  const matches = [...block.matchAll(new RegExp(`${variableName}:\\s*([^;]+);`, 'g'))];
  if (matches.length === 0) {
    throw new Error(`CSS variable ${variableName} not found`);
  }
  return matches[matches.length - 1][1].trim();
}

function hexToRgb(hexColor: string): [number, number, number] {
  const cleaned = hexColor.replace(/\s+/g, '');
  const match = /^#([0-9a-f]{6})$/i.exec(cleaned);
  if (match === null) {
    throw new Error(`Expected a 6-digit hex color, received ${hexColor}`);
  }
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function relativeLuminance([red, green, blue]: [number, number, number]): number {
  const [r, g, b] = [red, green, blue].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(hexToRgb(foreground));
  const backgroundLuminance = relativeLuminance(hexToRgb(background));
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

const stylesheet = readFileSync(stylesheetPath, 'utf8');
const lightBlock = extractBlock(stylesheet, ':root');
const darkBlock = extractBlock(stylesheet, '.dark');

describe('SK- und Patient-Status-Tokens — Primitives + Bridges definiert', () => {
  it('alle 5 SK-Familien x 4 Slots existieren in :root, .dark und @theme inline', () => {
    for (const family of SK_FAMILIES) {
      for (const slot of SK_SLOTS) {
        const primitive = `--ring-1-color-${family}-${slot}`;
        const alias = `--color-${family}-${slot}: var(${primitive});`;
        expect(lightBlock, `light ${primitive}`).toContain(`${primitive}:`);
        expect(darkBlock, `dark ${primitive}`).toContain(`${primitive}:`);
        expect(stylesheet, `bridge ${alias}`).toContain(alias);
      }
    }
  });

  it('alle 6 Patient-Status-Familien x 3 Slots existieren in :root, .dark und @theme inline', () => {
    for (const family of PATIENT_STATUS_FAMILIES) {
      for (const slot of PATIENT_STATUS_SLOTS) {
        const primitive = `--ring-1-color-${family}-${slot}`;
        const alias = `--color-${family}-${slot}: var(${primitive});`;
        expect(lightBlock, `light ${primitive}`).toContain(`${primitive}:`);
        expect(darkBlock, `dark ${primitive}`).toContain(`${primitive}:`);
        expect(stylesheet, `bridge ${alias}`).toContain(alias);
      }
    }
  });

  it('text-title-xxl-Token-Familie ist in @theme inline definiert', () => {
    expect(stylesheet).toContain('--text-title-xxl: clamp(');
    expect(stylesheet).toContain('--text-title-xxl--line-height:');
    expect(stylesheet).toContain('--text-title-xxl--font-weight:');
  });
});

describe.each([
  { name: 'light', block: lightBlock },
  { name: 'dark', block: darkBlock },
])('sk-* Tokens — $name Mode', ({ name, block }) => {
  const canvas = readCssVariable(block, '--ring-1-color-surface-canvas');

  describe.each(SK_FAMILIES)('%s', (family) => {
    const surface = () => readCssVariable(block, `--ring-1-color-${family}-surface`);
    const border = () => readCssVariable(block, `--ring-1-color-${family}-border`);
    const text = () => readCssVariable(block, `--ring-1-color-${family}-text`);
    const fill = () => readCssVariable(block, `--ring-1-color-${family}-fill`);

    it('Normaltext-Kontrast text auf surface >= 4,5:1 (AA)', () => {
      const ratio = contrastRatio(text(), surface());
      expect(ratio, `${name} ${family} text on surface = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    });

    it('Border-Kontrast border auf surface-canvas >= 3:1 (UI-Component-Grenze)', () => {
      const ratio = contrastRatio(border(), canvas);
      expect(ratio, `${name} ${family} border on canvas = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(3);
    });

    it('Large-Text-Kontrast Weiss (#ffffff) auf fill >= 3:1 (KPI-Grosszahl, text-title-xxl)', () => {
      const ratio = contrastRatio('#ffffff', fill());
      expect(ratio, `${name} ${family} fill = ${fill()} -> contrast ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(3);
    });
  });

  it('sk-rot-text auf sk-rot-surface >= 7:1 (AAA — kritisch-assertive Akut-Kategorie)', () => {
    const text = readCssVariable(block, '--ring-1-color-sk-rot-text');
    const surface = readCssVariable(block, '--ring-1-color-sk-rot-surface');
    const ratio = contrastRatio(text, surface);
    expect(ratio, `${name} sk-rot AAA = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(7);
  });
});

describe.each([
  { name: 'light', block: lightBlock },
  { name: 'dark', block: darkBlock },
])('patient-status-* Tokens — $name Mode', ({ name, block }) => {
  const canvas = readCssVariable(block, '--ring-1-color-surface-canvas');

  describe.each(PATIENT_STATUS_FAMILIES)('%s', (family) => {
    const surface = () => readCssVariable(block, `--ring-1-color-${family}-surface`);
    const border = () => readCssVariable(block, `--ring-1-color-${family}-border`);
    const text = () => readCssVariable(block, `--ring-1-color-${family}-text`);

    it('Normaltext-Kontrast text auf surface >= 4,5:1 (AA)', () => {
      const ratio = contrastRatio(text(), surface());
      expect(ratio, `${name} ${family} text on surface = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    });

    it('Border-Kontrast border auf surface-canvas >= 3:1', () => {
      const ratio = contrastRatio(border(), canvas);
      expect(ratio, `${name} ${family} border on canvas = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(3);
    });
  });
});
