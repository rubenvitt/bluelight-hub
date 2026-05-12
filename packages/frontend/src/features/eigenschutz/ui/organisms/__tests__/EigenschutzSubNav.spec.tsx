import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: ({
      to,
      params,
      activeProps,
      inactiveProps,
      activeOptions,
      children,
      ...rest
    }: {
      to: string;
      params?: Record<string, string>;
      activeProps?: Record<string, unknown>;
      inactiveProps?: Record<string, unknown>;
      activeOptions?: { exact?: boolean };
      children: React.ReactNode;
      [key: string]: unknown;
    }) => {
      // Im Mock rendern wir alle Tabs deterministisch als „inactive". Die
      // Active-State-Konfiguration wird über `data-active-*`-Attribute
      // exponiert, damit Tests den Vertrag prüfen können (welche Klassen
      // und ARIA-Werte würde der Router-Match setzen?), ohne TanStack-
      // Routers Match-Internals neu zu implementieren.
      return (
        <a
          href={to}
          data-params={JSON.stringify(params ?? {})}
          data-active-exact={String(activeOptions?.exact ?? false)}
          data-class-inactive={String((inactiveProps as { className?: string } | undefined)?.className ?? '')}
          data-class-active={String((activeProps as { className?: string } | undefined)?.className ?? '')}
          data-active-aria-current={String((activeProps as { 'aria-current'?: string } | undefined)?.['aria-current'] ?? '')}
          {...(rest as Record<string, unknown>)}
        >
          {children}
        </a>
      );
    },
  };
});

import { EigenschutzSubNav } from '../EigenschutzSubNav';

describe('EigenschutzSubNav', () => {
  it('rendert sechs Tabs in stabiler Reihenfolge (Goal G6: kein „Konflikte"-Tab)', () => {
    render(<EigenschutzSubNav einsatzId="einsatz-1" />);

    const nav = screen.getByTestId('eigenschutz-subnav');
    const labels = within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent?.trim());

    expect(labels).toEqual([
      expect.stringMatching(/^Übersicht$/),
      expect.stringMatching(/^Gefährdungen$/),
      expect.stringMatching(/^Sicherheitsregeln$/),
      expect.stringMatching(/^PSA-Profile$/),
      expect.stringMatching(/^Sicherungsposten$/),
      expect.stringMatching(/^Vorfälle$/),
    ]);
  });

  it('rendert keinen „Konflikte"-Tab mehr (Goal G6: Drawer statt Sub-Tab)', () => {
    render(<EigenschutzSubNav einsatzId="einsatz-1" />);

    expect(screen.queryByTestId('eigenschutz-subnav-link-konflikte')).toBeNull();
    expect(screen.queryByTestId('eigenschutz-subnav-konflikte-badge')).toBeNull();
  });

  it('propagiert die einsatzId an jeden Tab-Link', () => {
    render(<EigenschutzSubNav einsatzId="einsatz-42" />);

    const link = screen.getByTestId('eigenschutz-subnav-link-gefaehrdungen');
    expect(link.getAttribute('href')).toBe('/app/einsatz/$einsatzId/sicherheit/eigenschutz/gefaehrdungen');
    expect(link.getAttribute('data-params')).toBe(JSON.stringify({ einsatzId: 'einsatz-42' }));
  });

  it('nutzt exact-Matching nur für den Übersicht-Tab', () => {
    render(<EigenschutzSubNav einsatzId="einsatz-1" />);

    expect(screen.getByTestId('eigenschutz-subnav-link-uebersicht').getAttribute('data-active-exact')).toBe('true');
    expect(screen.getByTestId('eigenschutz-subnav-link-gefaehrdungen').getAttribute('data-active-exact')).toBe('false');
    expect(screen.getByTestId('eigenschutz-subnav-link-vorfaelle').getAttribute('data-active-exact')).toBe('false');
  });

  it('exponiert eine Navigations-Landmark mit deutschem aria-label', () => {
    render(<EigenschutzSubNav einsatzId="einsatz-1" />);

    expect(screen.getByRole('navigation', { name: 'Eigenschutz-Bereiche' })).toBeInTheDocument();
  });

  it('hält den Tab-Hit-Bereich auf ≥ 44 px Höhe (Touch-Target)', () => {
    render(<EigenschutzSubNav einsatzId="einsatz-1" />);

    const link = screen.getByTestId('eigenschutz-subnav-link-uebersicht');
    // Im Mock landen die Inaktiv-Klassen in `data-class-inactive`; im Real-
    // Router werden sie via `inactiveProps.className` direkt auf das `<a>`
    // gemergt. Beides validiert dieselbe Invariante.
    expect(link.getAttribute('data-class-inactive')).toMatch(/\bmin-h-11\b/);
  });

  it('konfiguriert den aktiven Tab mit aria-current="page" und Underline-Token (AC1/AC2/AC4)', () => {
    render(<EigenschutzSubNav einsatzId="einsatz-1" />);

    const psaTab = screen.getByTestId('eigenschutz-subnav-link-psa-profile');
    // Der Mock spiegelt, was TanStack-Routers Active-Match auf dem Element
    // platzieren würde — damit ist der Vertrag verifiziert, sobald die
    // jeweilige URL aktiv wird.
    expect(psaTab.getAttribute('data-active-aria-current')).toBe('page');
    expect(psaTab.getAttribute('data-class-active')).toMatch(/\bborder-action-primary\b/);
    expect(psaTab.getAttribute('data-class-active')).toMatch(/\btext-text-primary\b/);
  });
});
