import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const findAllBasicMock = vi.fn();

vi.mock('@/shared', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/shared');
  return {
    ...actual,
    api: {
      users: () => ({
        userControllerFindAllBasicVAlpha: findAllBasicMock,
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

const USERS = [
  { id: 'user-1', username: 'Steffi Müller' },
  { id: 'user-2', username: 'Hans Maier' },
];

describe('PersonCombobox (G7)', () => {
  beforeEach(() => {
    findAllBasicMock.mockReset();
    findAllBasicMock.mockResolvedValue({ data: USERS });
  });

  it('rendert Label und exponiert role=combobox', async () => {
    const Wrapper = wrapper(makeClient());
    render(
      <Wrapper>
        <PersonCombobox value={null} onChange={() => {}} label="Person" testId="person-combobox" />
      </Wrapper>,
    );

    await waitFor(() => expect(findAllBasicMock).toHaveBeenCalled());

    expect(screen.getByText('Person')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded');
  });

  it('gibt User-ID an onChange zurück, wenn ein Name ausgewählt wird', async () => {
    const onChange = vi.fn();
    const Wrapper = wrapper(makeClient());
    render(
      <Wrapper>
        <PersonCombobox value={null} onChange={onChange} testId="person-combobox" />
      </Wrapper>,
    );

    await waitFor(() => expect(findAllBasicMock).toHaveBeenCalled());

    const user = userEvent.setup();
    const input = screen.getByRole('combobox');
    await user.click(input);
    await waitFor(() => expect(screen.getByText('Steffi Müller')).toBeInTheDocument());
    await user.click(screen.getByText('Steffi Müller'));

    expect(onChange).toHaveBeenCalledWith('user-1');
  });

  it('zeigt Empty-Hinweis, wenn keine Benutzer geladen sind', async () => {
    findAllBasicMock.mockResolvedValue({ data: [] });
    const Wrapper = wrapper(makeClient());
    render(
      <Wrapper>
        <PersonCombobox value={null} onChange={() => {}} testId="person-combobox" />
      </Wrapper>,
    );

    await waitFor(() => expect(findAllBasicMock).toHaveBeenCalled());
    await waitFor(() => {
      expect(screen.getByText(/Keine Benutzer verfügbar/i)).toBeInTheDocument();
    });
  });
});
