import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const findAllEinsatzPersonenMock = vi.fn();

vi.mock('@/shared', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/shared');
  return {
    ...actual,
    api: {
      einsatzPersonen: () => ({
        einsatzPersonenControllerFindAllVAlpha: findAllEinsatzPersonenMock,
      }),
    },
  };
});

import { PersonCombobox } from '../PersonCombobox';

const makeClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });

const wrapper =
  (client: QueryClient) =>
  ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

const TEST_EINSATZ_ID = 'cl9einsatz12345678901234';

const PERSONEN = [
  { id: 'person-1', vorname: 'Steffi', nachname: 'Müller', funkrufname: 'Florian Mitte 1' },
  { id: 'person-2', vorname: 'Hans', nachname: 'Maier', funkrufname: null },
];

describe('PersonCombobox', () => {
  beforeEach(() => {
    findAllEinsatzPersonenMock.mockReset();
    findAllEinsatzPersonenMock.mockResolvedValue({ data: PERSONEN });
  });

  it('rendert Label und exponiert role=combobox', async () => {
    const Wrapper = wrapper(makeClient());
    render(
      <Wrapper>
        <PersonCombobox einsatzId={TEST_EINSATZ_ID} value={null} onChange={() => {}} label="Person" testId="person-combobox" />
      </Wrapper>,
    );

    await waitFor(() => expect(findAllEinsatzPersonenMock).toHaveBeenCalledWith({ einsatzId: TEST_EINSATZ_ID }));

    expect(screen.getByText('Person')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded');
  });

  it('gibt EinsatzPerson-ID an onChange zurück, wenn ein Name ausgewählt wird', async () => {
    const onChange = vi.fn();
    const Wrapper = wrapper(makeClient());
    render(
      <Wrapper>
        <PersonCombobox einsatzId={TEST_EINSATZ_ID} value={null} onChange={onChange} testId="person-combobox" />
      </Wrapper>,
    );

    await waitFor(() => expect(findAllEinsatzPersonenMock).toHaveBeenCalled());

    const user = userEvent.setup();
    const input = screen.getByRole('combobox');
    await user.click(input);
    await waitFor(() => expect(screen.getByText('Steffi Müller (Florian Mitte 1)')).toBeInTheDocument());
    await user.click(screen.getByText('Steffi Müller (Florian Mitte 1)'));

    expect(onChange).toHaveBeenCalledWith('person-1');
  });

  it('zeigt Empty-Hinweis, wenn keine Personen registriert sind', async () => {
    findAllEinsatzPersonenMock.mockResolvedValue({ data: [] });
    const Wrapper = wrapper(makeClient());
    render(
      <Wrapper>
        <PersonCombobox einsatzId={TEST_EINSATZ_ID} value={null} onChange={() => {}} testId="person-combobox" />
      </Wrapper>,
    );

    await waitFor(() => expect(findAllEinsatzPersonenMock).toHaveBeenCalled());
    await waitFor(() => {
      expect(screen.getByText(/Keine Personen registriert/i)).toBeInTheDocument();
    });
  });

  it('lädt Personen ohne Funkrufname als reinen "Vorname Nachname"-Label', async () => {
    const Wrapper = wrapper(makeClient());
    render(
      <Wrapper>
        <PersonCombobox einsatzId={TEST_EINSATZ_ID} value={null} onChange={() => {}} testId="person-combobox" />
      </Wrapper>,
    );

    await waitFor(() => expect(findAllEinsatzPersonenMock).toHaveBeenCalled());
    const user = userEvent.setup();
    await user.click(screen.getByRole('combobox'));
    await waitFor(() => expect(screen.getByText('Hans Maier')).toBeInTheDocument());
  });
});
