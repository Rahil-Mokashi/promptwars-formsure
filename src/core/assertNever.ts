/**
 * Exhaustiveness check for `switch` statements: if a case is missing, passing the leftover value here is a
 * compile-time error, and at run time it throws instead of silently doing nothing.
 */
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}
