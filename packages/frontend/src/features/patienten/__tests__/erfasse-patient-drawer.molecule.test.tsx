import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/shared', () => ({
  api: {
    patienten: () => ({
      patientenControllerErfassePatientVAlpha: vi.fn(),
    }),
  },
  ResponseError: class ResponseError extends Error {
    override name = 'ResponseError' as const;
    constructor(
      public response: Response,
      msg?: string,
    ) {
      super(msg);
    }
  },
}));

const { ErfassePatientDrawer } = await import('../ui/erfasse-patient-drawer.molecule');

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('ErfassePatientDrawer (Story 1.6 AC6)', () => {
  it('rendert die ErfassePatientForm, wenn isOpen=true', () => {
    render(<ErfassePatientDrawer einsatzId="ein_1" isOpen onClose={() => {}} />, { wrapper });
    expect(screen.getByTestId('erfasse-patient-form')).toBeInTheDocument();
  });

  it('rendert keine Form, wenn isOpen=false', () => {
    render(<ErfassePatientDrawer einsatzId="ein_1" isOpen={false} onClose={() => {}} />, { wrapper });
    expect(screen.queryByTestId('erfasse-patient-form')).not.toBeInTheDocument();
  });
});
