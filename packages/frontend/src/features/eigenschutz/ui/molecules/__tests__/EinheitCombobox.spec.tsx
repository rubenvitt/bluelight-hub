import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const findAllMock = vi.fn();

vi.mock('@/shared', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/shared');
  return {
    ...actual,
    api: {
      einsatzEinheiten: () => ({
        einsatzEinheitenControllerFindAllVAlpha: findAllMock,
      }),
    },
  };
});

import { EinheitCombobox } from '../EinheitCombobox';

const makeClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });

const wrapper =
  (client: QueryClient) =>
  ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

const EINHEITEN = [
  { id: 'einheit-a', name: 'Sani-Trupp 1' },
  { id: 'einheit-b', name: 'Charlie-21' },
];

describe('EinheitCombobox (G7)', () => {
  beforeEach(() => {
    findAllMock.mockReset();
    findAllMock.mockResolvedValue({ data: EINHEITEN });
  });

  it('rendert Label und exponiert Combobox-Input mit korrekten ARIA-Attributen', async () => {
    const Wrapper = wrapper(makeClient());
    render(
      <Wrapper>
        <EinheitCombobox einsatzId="einsatz-1" value={null} onChange={() => {}} label="Einheit" testId="einheit-combobox" />
      </Wrapper>,
    );

    await waitFor(() => expect(findAllMock).toHaveBeenCalled());

    expect(screen.getByText('Einheit')).toBeInTheDocument();
    // ARIA-Combobox-Pattern: input role=combobox, expanded, controls
    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('aria-expanded');
  });

  it('liefert Einheit-ID an onChange beim Auswählen eines Namens', async () => {
    const onChange = vi.fn();
    const Wrapper = wrapper(makeClient());
    render(
      <Wrapper>
        <EinheitCombobox einsatzId="einsatz-1" value={null} onChange={onChange} testId="einheit-combobox" />
      </Wrapper>,
    );

    await waitFor(() => expect(findAllMock).toHaveBeenCalled());

    const user = userEvent.setup();
    const input = screen.getByRole('combobox');
    await user.click(input);
    await waitFor(() => expect(screen.getByText('Sani-Trupp 1')).toBeInTheDocument());
    await user.click(screen.getByText('Sani-Trupp 1'));

    expect(onChange).toHaveBeenCalledWith('einheit-a');
  });

  it('zeigt Konfigurations-Hinweis als Helper-Text, wenn der Einsatz keine Einheiten hat', async () => {
    findAllMock.mockResolvedValue({ data: [] });
    const Wrapper = wrapper(makeClient());
    render(
      <Wrapper>
        <EinheitCombobox einsatzId="einsatz-1" value={null} onChange={() => {}} testId="einheit-combobox" />
      </Wrapper>,
    );

    await waitFor(() => expect(findAllMock).toHaveBeenCalled());
    await waitFor(() => {
      expect(screen.getByText(/Keine Einheiten in diesem Einsatz/i)).toBeInTheDocument();
    });
  });

  it('exponiert testId-Wrapper-Div für E2E-Hooks', async () => {
    const Wrapper = wrapper(makeClient());
    render(
      <Wrapper>
        <EinheitCombobox einsatzId="einsatz-1" value={null} onChange={() => {}} testId="einheit-combobox" />
      </Wrapper>,
    );

    expect(screen.getByTestId('einheit-combobox')).toBeInTheDocument();
  });
});
