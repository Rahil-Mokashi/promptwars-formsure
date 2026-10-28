/** Resolves after `ms` milliseconds. The one place the app waits, so tests can replace it. */
export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
