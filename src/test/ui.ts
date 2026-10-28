import { screen, waitFor } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { expect } from 'vitest';

/** Ticks the consent box (if shown and unticked), waits for file checks to finish, then clicks "Run FormSure check". */
export async function clickRun(user: UserEvent): Promise<void> {
  const consent = screen.queryByRole('checkbox');
  if (consent instanceof HTMLInputElement && !consent.checked) await user.click(consent);
  const run = screen.getByRole('button', { name: /run formsure check/i });
  await waitFor(() => expect(run).toBeEnabled());
  await user.click(run);
}
