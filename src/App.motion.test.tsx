import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('with motion enabled', () => {
  it('moves from landing to the scheme picker through the page transition', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /try sample applicant/i }));
    expect(
      await screen.findByText('Which scholarship are you applying for?', {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /post-matric scholarship for obc/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
