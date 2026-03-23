/**
 * Tests fuer RBAC-basiertes Conditional Rendering im Befehl-Feature
 *
 * Story 5.4 AC2: Berechtigungsbasierte UI-Elemente
 *
 * Verifiziert:
 * - Korrektur-Button disabled fuer Nicht-Berechtigte
 * - Korrektur-Button aktiv fuer BEFEHLSGEBER/ERSTELLER
 * - Tooltip-Anzeige bei fehlender Berechtigung
 * - Quittieren-Button respektiert canQuittieren-Prop
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { createBefehl, createEmpfaenger } from '../../../__fixtures__/befehl-test-utils';
import type { BefehlPermissions } from '../../../hooks/use-befehl-permissions';
import { BefehlDetailPanel } from '../BefehlDetailPanel.organism';

/** Konfigurierbarer Mock fuer useBefehlPermissions */
const mockPermissions: BefehlPermissions = {
  canCreate: true,
  canQuittieren: false,
  canKorrigieren: true,
  canExport: true,

  canViewAll: true,
  isBeobachter: false,
  rolle: 'BEFEHLSGEBER',
  isLoading: false,
};

vi.mock('../../../hooks/use-befehl-permissions', () => ({
  useBefehlPermissions: () => mockPermissions,
}));

vi.mock('../../molecules/ZustellstatusAnzeige.molecule', () => ({
  ZustellstatusAnzeige: ({ empfaenger }: { empfaenger: unknown[] }) => <div data-testid="zustellstatus-anzeige">{empfaenger.length} Empfaenger</div>,
}));

vi.mock('../../atoms/BefehlStatusBadge.atom', () => ({
  BefehlStatusBadge: ({ status }: { status: string }) => <span data-testid="befehl-status-badge">{status}</span>,
}));

const baseBefehlProps = {
  id: 'befehl-1',
  nummer: 'B2026-test',
  befehlsgeberName: 'EL',
  auftrag: 'Testauftrag',
  status: 'ERTEILT' as const,
  erteiltAm: new Date('2026-02-20T10:00:00Z'),
  empfaenger: [createEmpfaenger({ empfaengerId: 'user-1', name: 'ZF Nord' })],
};

describe('BefehlDetailPanel RBAC (Story 5.4 AC2)', () => {
  beforeEach(() => {
    // Reset zu BEFEHLSGEBER-Permissions
    Object.assign(mockPermissions, {
      canCreate: true,
      canQuittieren: false,
      canKorrigieren: true,
      canExport: true,

      canViewAll: true,
      isBeobachter: false,
      rolle: 'BEFEHLSGEBER',
      isLoading: false,
    });
  });

  it('zeigt Korrektur-Button aktiv fuer BEFEHLSGEBER', () => {
    const befehl = createBefehl(baseBefehlProps);
    renderWithProviders(<BefehlDetailPanel befehl={befehl} isOpen={true} onClose={vi.fn()} einsatzId="einsatz-1" />);

    const korrekturButton = screen.getByRole('button', { name: /korrektur/i });
    expect(korrekturButton).not.toBeDisabled();
  });

  it('zeigt Korrektur-Button disabled fuer EMPFAENGER', () => {
    Object.assign(mockPermissions, {
      canCreate: false,
      canKorrigieren: false,
      canExport: false,

      rolle: 'EMPFAENGER',
    });

    const befehl = createBefehl(baseBefehlProps);
    renderWithProviders(<BefehlDetailPanel befehl={befehl} isOpen={true} onClose={vi.fn()} einsatzId="einsatz-1" />);

    const korrekturButton = screen.getByRole('button', { name: /korrektur/i });
    expect(korrekturButton).toBeDisabled();
  });

  it('zeigt Tooltip bei disabled Korrektur-Button', () => {
    Object.assign(mockPermissions, {
      canKorrigieren: false,
      isBeobachter: false,
      rolle: 'EMPFAENGER',
    });

    const befehl = createBefehl(baseBefehlProps);
    renderWithProviders(<BefehlDetailPanel befehl={befehl} isOpen={true} onClose={vi.fn()} einsatzId="einsatz-1" />);

    expect(screen.getByText(/nur befehlsgeber/i)).toBeInTheDocument();
  });

  it('zeigt keinen Korrektur-Button fuer BEOBACHTER', () => {
    Object.assign(mockPermissions, {
      canKorrigieren: false,
      isBeobachter: true,
      rolle: 'BEOBACHTER',
    });

    const befehl = createBefehl(baseBefehlProps);
    renderWithProviders(<BefehlDetailPanel befehl={befehl} isOpen={true} onClose={vi.fn()} einsatzId="einsatz-1" />);

    expect(screen.queryByRole('button', { name: /korrektur/i })).not.toBeInTheDocument();
  });

  it('zeigt keinen Korrektur-Button bei status=KORRIGIERT', () => {
    const befehl = createBefehl({ ...baseBefehlProps, status: 'KORRIGIERT' });
    renderWithProviders(<BefehlDetailPanel befehl={befehl} isOpen={true} onClose={vi.fn()} einsatzId="einsatz-1" />);

    expect(screen.queryByRole('button', { name: /korrektur/i })).not.toBeInTheDocument();
  });

  it('Korrektur-Button aktiv fuer ERSTELLER', () => {
    Object.assign(mockPermissions, { rolle: 'ERSTELLER', canKorrigieren: true });

    const befehl = createBefehl(baseBefehlProps);
    renderWithProviders(<BefehlDetailPanel befehl={befehl} isOpen={true} onClose={vi.fn()} einsatzId="einsatz-1" />);

    const korrekturButton = screen.getByRole('button', { name: /korrektur/i });
    expect(korrekturButton).not.toBeDisabled();
  });
});

describe('BefehlKarte Quittieren RBAC (Story 5.4 AC2)', () => {
  // Importiere BefehlKarte separat um die canQuittieren-Prop direkt testen zu koennen
  // Die Komponente ist keine Dependency von useBefehlPermissions, sondern erhaelt canQuittieren als Prop

  it('rendert aktiven Quittieren-Button wenn canQuittieren=true', async () => {
    // Importiere dynamisch um Mocking-Konflikte zu vermeiden
    const { BefehlKarte } = await import('../../molecules/BefehlKarte.molecule');

    renderWithProviders(
      <BefehlKarte
        nummer="B-001"
        auftrag="Test"
        status="ERTEILT"
        empfaenger={[createEmpfaenger({ empfaengerId: 'current-user', name: 'ZF Nord', zugestelltAm: new Date() })]}
        erteiltAm={new Date()}
        currentUserId="current-user"
        befehlId="befehl-1"
        einsatzId="einsatz-1"
        onQuittieren={vi.fn()}
        canQuittieren={true}
      />,
    );

    const quittierenButton = screen.getByRole('button', { name: /quittieren/i });
    expect(quittierenButton).not.toBeDisabled();
  });

  it('rendert disabled Quittieren-Button mit Tooltip wenn canQuittieren=false', async () => {
    const { BefehlKarte } = await import('../../molecules/BefehlKarte.molecule');

    renderWithProviders(
      <BefehlKarte
        nummer="B-001"
        auftrag="Test"
        status="ERTEILT"
        empfaenger={[createEmpfaenger({ empfaengerId: 'current-user', name: 'ZF Nord', zugestelltAm: new Date() })]}
        erteiltAm={new Date()}
        currentUserId="current-user"
        befehlId="befehl-1"
        einsatzId="einsatz-1"
        onQuittieren={vi.fn()}
        canQuittieren={false}
      />,
    );

    const quittierenButton = screen.getByRole('button', { name: /quittieren/i });
    expect(quittierenButton).toBeDisabled();

    const tooltipWrapper = screen.getByTitle(/nur empfänger/i);
    expect(tooltipWrapper).toBeInTheDocument();
  });

  it('zeigt keinen Quittieren-Button wenn User kein Empfaenger ist', async () => {
    const { BefehlKarte } = await import('../../molecules/BefehlKarte.molecule');

    renderWithProviders(
      <BefehlKarte
        nummer="B-001"
        auftrag="Test"
        status="ERTEILT"
        empfaenger={[createEmpfaenger({ empfaengerId: 'other-user', name: 'ZF Nord' })]}
        erteiltAm={new Date()}
        currentUserId="current-user"
        befehlId="befehl-1"
        einsatzId="einsatz-1"
        onQuittieren={vi.fn()}
        canQuittieren={true}
      />,
    );

    expect(screen.queryByRole('button', { name: /quittieren/i })).not.toBeInTheDocument();
  });
});
