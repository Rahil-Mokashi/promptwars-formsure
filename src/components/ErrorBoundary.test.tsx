import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { ErrorBoundary } from './ErrorBoundary';

function Boom(): never {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  it('renders children normally', () => {
    render(<ErrorBoundary><p>fine</p></ErrorBoundary>);
    expect(screen.getByText('fine')).toBeInTheDocument();
  });

  it('shows a friendly, accessible fallback when a child throws', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { container } = render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toHaveTextContent(/something went wrong/i);
    expect(screen.getByRole('button', { name: /reload formsure/i })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
