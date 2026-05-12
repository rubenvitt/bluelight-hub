/**
 * Spec für `SicherheitsregelStatusBadge` und die abgeleitete Status-
 * Logik (Goal G3 / Story 415-2-6-UI).
 *
 * Deckt ab:
 * - Status-Ableitung aus der `version` (1 → info, >1 → warning).
 * - Stripe-ClassName entspricht der Status-Variante.
 * - Render des Badges mit Status-Label.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SicherheitsregelStatusBadge, deriveSicherheitsregelStatus, getStatusStripeClassName } from '../SicherheitsregelStatusBadge';

describe('deriveSicherheitsregelStatus', () => {
  it('liefert info für die Erst-Version', () => {
    expect(deriveSicherheitsregelStatus({ version: 1 })).toBe('info');
  });

  it('liefert warning ab Version 2', () => {
    expect(deriveSicherheitsregelStatus({ version: 2 })).toBe('warning');
    expect(deriveSicherheitsregelStatus({ version: 5 })).toBe('warning');
  });
});

describe('getStatusStripeClassName', () => {
  it('liefert unterschiedliche Stripe-Klassen pro Status', () => {
    const info = getStatusStripeClassName('info');
    const warning = getStatusStripeClassName('warning');
    const critical = getStatusStripeClassName('critical');
    expect(info).not.toBe(warning);
    expect(warning).not.toBe(critical);
  });
});

describe('SicherheitsregelStatusBadge', () => {
  it('rendert das Bekanntgabe-Label für Status info', () => {
    render(<SicherheitsregelStatusBadge status="info" />);
    const badge = screen.getByTestId('sicherheitsregel-status-badge');
    expect(badge).toHaveAttribute('data-status', 'info');
    expect(badge).toHaveTextContent('Bekanntgabe');
  });

  it('rendert das Aktualisiert-Label für Status warning', () => {
    render(<SicherheitsregelStatusBadge status="warning" />);
    const badge = screen.getByTestId('sicherheitsregel-status-badge');
    expect(badge).toHaveAttribute('data-status', 'warning');
    expect(badge).toHaveTextContent('Aktualisiert');
  });
});
