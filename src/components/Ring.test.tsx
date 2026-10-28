import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Ring } from './Ring';

describe('Ring', () => {
  it('describes the passed, failed and unverified counts to screen readers', () => {
    render(<Ring pct={50} counts={{ passed: 1, failed: 1, needsReview: 2 }} />);
    const ring = screen.getByRole('img', { name: '50% ready' });
    expect(ring).toHaveAccessibleDescription('1 passed, 1 failed, 2 could not be verified.');
    expect(ring.querySelector('.sr-only')).toHaveTextContent('1 passed, 1 failed, 2 could not be verified.');
  });
  it('has no description when no counts are given', () => {
    render(<Ring pct={100} />);
    expect(screen.getByRole('img', { name: '100% ready' })).not.toHaveAttribute('aria-describedby');
  });
});
