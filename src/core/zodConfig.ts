import { z } from 'zod';

/**
 * Zod normally compiles validators with `new Function`, which needs `unsafe-eval` in the CSP.
 * Interpreted ("jitless") mode keeps the Content-Security-Policy free of `unsafe-eval`.
 * Imported first by every module that builds a schema, so it is set before any schema is used.
 */
z.config({ jitless: true });
