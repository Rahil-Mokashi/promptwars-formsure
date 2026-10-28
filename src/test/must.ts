/** Returns `value`, or throws when it is null or undefined. For tests that would otherwise need a non-null assertion. */
export function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('Expected a value but got none');
  return value;
}
