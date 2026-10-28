// Rewrites RULES.md from the scheme pack (the renderer lives in src/core/register.ts and runs under Vitest).
import { spawnSync } from 'node:child_process';

const result = spawnSync('npx', ['vitest', 'run', 'src/core/register.test.ts'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, UPDATE_RULES_REGISTER: '1' },
});
process.exit(result.status ?? 1);
