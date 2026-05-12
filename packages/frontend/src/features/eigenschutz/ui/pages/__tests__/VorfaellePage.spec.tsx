/**
 * Spec für `VorfaellePage` (Story 5.1 + 5.3).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EigenschutzVorfallListItemDto } from '@bluelight-hub/shared/client';
import { WorkspaceBlockingOverlayProvider } from '@/features/workspace/hooks/use-workspace-blocking-overlay';

const mockNavigate = vi.fn();
const mockList = vi.fn().mockResolvedValue({ data: [], meta: {} });

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/shared', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/shared');
  return {
    ...actual,
    api: {
      eigenschutz: () => ({
        eigenschutzVorfallControllerReportVorfallVAlpha: vi.fn(),
        eigenschutzVorfallControllerListVorfaelleVAlpha: mockList,
      }),
      einsatzPersonen: () => ({
        einsatzPersonenControllerFindAllVAlpha: vi.fn(() => Promise.resolve({ data: [] })),
      }),
    },
  };
});

vi.mock('@/features/kraefte/api/use-einsatz-einheiten', () => ({
  useEinsatzEinheiten: () => ({
    data: [
      {
        id: 'aaaaaaaaaaaaaaaaaaaaaaaaaa',
        einsatzId: 'einsatz-1',
        parentId: null,
        name: 'Abschnitt A',
        typ: 'ABSCHNITT',
        status: 'EINSATZBEREIT',
        sollStaerke: 0,
        istStaerke: 0,
      },
    ],
    isLoading: false,
  }),
}));

vi.mock('@/features/auth/api/use-users', () => ({
  useUserNames: () => ({ getUserName: () => '' }),
}));

import { replaceFilterState, resetFilter } from '../../../stores/vorfall-filter.store';
import { VorfaellePage } from '../VorfaellePage';

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  resetFilter();
  mockNavigate.mockReset();
  mockList.mockReset().mockResolvedValue({ data: [], meta: {} });
});

afterEach(() => {
  resetFilter();
});

describe('VorfaellePage (Story 5.1 + 5.3)', () => {
  it('(P1) Render-Smoke: Header, Add-Button, FilterBar, Liste', async () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <VorfaellePage einsatzId="einsatz-1" einheitId="clw3h8x9y0000qwertyui05002" />
      </Wrapper>,
    );

    expect(screen.getByTestId('vorfaelle-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Vorfälle/ })).toBeInTheDocument();
    expect(screen.getByTestId('vorfaelle-add-button')).toBeInTheDocument();
    expect(screen.getByTestId('vorfaelle-filter-bar')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('vorfaelle-list-empty')).toBeInTheDocument());
  });

  it('(P2) öffnet Drawer beim Klick auf Add-Button', async () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <VorfaellePage einsatzId="einsatz-1" einheitId="clw3h8x9y0000qwertyui05002" />
      </Wrapper>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByTestId('vorfaelle-add-button'));
    expect(screen.getByTestId('vorfall-melden-drawer')).toBeInTheDocument();
  });

  it('(P2b) öffnet den Melde-Drawer per Action-Param und entfernt den Param beim Schließen', async () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <VorfaellePage einsatzId="einsatz-1" einheitId="clw3h8x9y0000qwertyui05002" initialSearch={{ action: 'new-vorfall' }} />
      </Wrapper>,
    );

    expect(screen.getByTestId('vorfall-melden-drawer')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.keyboard('{Escape}');

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({
        to: '/app/einsatz/$einsatzId/sicherheit/eigenschutz/vorfaelle',
        params: { einsatzId: 'einsatz-1' },
        search: expect.any(Function),
        replace: true,
      }),
    );
  });

  it('(P2c) überschreibt den Action-Param beim Initial-Mount nicht mit altem Filter-Store', async () => {
    replaceFilterState({ vorfallZeitVon: '2026-05-01' });
    const Wrapper = makeWrapper();

    render(
      <Wrapper>
        <VorfaellePage einsatzId="einsatz-1" einheitId="clw3h8x9y0000qwertyui05002" initialSearch={{ action: 'new-vorfall' }} />
      </Wrapper>,
    );

    expect(screen.getByTestId('vorfall-melden-drawer')).toBeInTheDocument();
    await waitFor(() => expect(mockNavigate).not.toHaveBeenCalled());
  });

  it('(P3) /-Shortcut fokussiert das erste Filter-Control (Abschnitt-Trigger)', async () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <VorfaellePage einsatzId="einsatz-1" einheitId="clw3h8x9y0000qwertyui05002" />
      </Wrapper>,
    );

    const user = userEvent.setup();
    await user.keyboard('/');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('vorfaelle-filter-abschnitt-trigger')));
  });

  it('(P3b) schützt Filter-Eingaben vor globalem /-Shortcut', async () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <VorfaellePage einsatzId="einsatz-1" einheitId="clw3h8x9y0000qwertyui05002" />
      </Wrapper>,
    );

    const user = userEvent.setup();
    const dateInput = screen.getByTestId('vorfaelle-filter-von');
    await user.click(dateInput);
    await user.keyboard('/');

    expect(document.activeElement).toBe(dateInput);
  });

  it('(P3c) öffnet den bestehenden Melde-Drawer per V-Shortcut und die Hilfe per ?', async () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <VorfaellePage einsatzId="einsatz-1" einheitId="clw3h8x9y0000qwertyui05002" />
      </Wrapper>,
    );

    const user = userEvent.setup();
    await user.keyboard('v');
    expect(screen.getByTestId('vorfall-melden-drawer')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId('vorfall-melden-drawer')).not.toBeInTheDocument());
    await user.keyboard('?');
    expect(screen.getByTestId('eigenschutz-shortcut-help')).toHaveTextContent('Filter fokussieren');
    expect(screen.getByTestId('eigenschutz-shortcut-help')).toHaveTextContent('Vorfall melden');
    await waitFor(() => expect(screen.getByTestId('eigenschutz-shortcut-help-close')).toHaveFocus());

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId('eigenschutz-shortcut-help')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('eigenschutz-shortcut-help-trigger')).toHaveFocus());
  });

  it('(P3d) blockiert V-Shortcut, wenn die Workspace-Shell ein Overlay offen hat', async () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <WorkspaceBlockingOverlayProvider isBlocking>
          <VorfaellePage einsatzId="einsatz-1" einheitId="clw3h8x9y0000qwertyui05002" />
        </WorkspaceBlockingOverlayProvider>
      </Wrapper>,
    );

    const user = userEvent.setup();
    await user.keyboard('v');

    expect(screen.queryByTestId('vorfall-melden-drawer')).not.toBeInTheDocument();
  });

  it('(P4) Initial-Search aus URL füllt den Filter-Store', async () => {
    const row: EigenschutzVorfallListItemDto = {
      id: 'v-1',
      einheitId: 'einheit-1',
      vorfallZeit: '2026-05-06T10:00:00.000Z',
      was: 'Vorfall',
      unfallkasseRelevant: true,
      erfasstAm: '2026-05-06T10:00:00.000Z',
      erfasstVonUserId: 'user-1',
    } as EigenschutzVorfallListItemDto;
    mockList.mockResolvedValue({ data: [row], meta: {} });

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <VorfaellePage einsatzId="einsatz-1" einheitId={null} initialSearch={{ uk: '1', von: '2026-05-01' }} />
      </Wrapper>,
    );

    await waitFor(() => expect(mockList).toHaveBeenCalled());
    const args = mockList.mock.calls.at(-1)![0];
    expect(args.unfallkasseRelevant).toBe(true);
    // Code-Review F1: Page mappt `yyyy-mm-dd` zu lokalem Tagesanfang
    // (nicht UTC-Mitternacht). Verifiziere, dass der gesendete Wert ein
    // gültiges ISO-Datum ist und dass beim Reverse-Mapping in lokaler Zeit
    // exakt 2026-05-01 00:00:00 herauskommt.
    expect(args.vorfallZeitVon).toMatch(/^2026-04-30T2[2-3]:00:00\.000Z$|^2026-05-01T0[0-1]:00:00\.000Z$/);
    const reversed = new Date(args.vorfallZeitVon);
    expect(reversed.getFullYear()).toBe(2026);
    expect(reversed.getMonth()).toBe(4);
    expect(reversed.getDate()).toBe(1);
    expect(reversed.getHours()).toBe(0);
  });
});
