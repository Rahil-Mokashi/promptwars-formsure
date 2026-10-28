// Copies the built React app next to the function so the Express app can serve it from its own URL.
import { cpSync, rmSync } from 'node:fs';

rmSync('functions/web', { recursive: true, force: true });
cpSync('dist/web', 'functions/web', { recursive: true });
