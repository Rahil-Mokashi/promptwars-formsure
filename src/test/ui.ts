import { screen, waitFor } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { expect } from 'vitest';

/** Clicks "Run FormSure check" once file checks have finished and the button is enabled. */
export async function clickRun(user: UserEvent): Promise<void> {
  const run = screen.getByRole('button', { name: /run formsure check/i });
  await waitFor(() => expect(run).toBeEnabled());
  await user.click(run);
}
