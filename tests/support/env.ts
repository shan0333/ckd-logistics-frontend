import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

/**
 * Test configuration, loaded from `.env.test` at the repo root (gitignored).
 * Copy `.env.test.example` -> `.env.test` and fill in real credentials before running.
 */
export interface TestEnv {
  baseUrl: string;
  apiUrl: string;
  admin: { username: string; password: string };
  user: { username: string; password: string };
  /** When false, Create/Update/Delete specs are skipped (read-only run). */
  allowWriteTests: boolean;
  /** Prefix stamped on every shipment number a test creates, for easy identification/cleanup. */
  testPrefix: string;
}

let cached: TestEnv | null = null;

export function loadTestEnv(): TestEnv {
  if (cached) return cached;

  const root = path.resolve(__dirname, '..', '..');
  const envFile = path.join(root, '.env.test');
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile });
  }

  const e = process.env;
  cached = {
    baseUrl: e.E2E_BASE_URL || 'http://localhost:3000',
    apiUrl: e.E2E_API_URL || e.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
    admin: {
      username: e.E2E_ADMIN_USERNAME || '',
      password: e.E2E_ADMIN_PASSWORD || '',
    },
    user: {
      username: e.E2E_USER_USERNAME || '',
      password: e.E2E_USER_PASSWORD || '',
    },
    allowWriteTests: e.ALLOW_WRITE_TESTS === '1' || e.ALLOW_WRITE_TESTS === 'true',
    testPrefix: e.E2E_TEST_PREFIX || 'E2ETEST-',
  };
  return cached;
}

export function requireCreds(which: 'admin' | 'user'): { username: string; password: string } {
  const env = loadTestEnv();
  const c = env[which];
  if (!c.username || !c.password) {
    throw new Error(
      `Missing ${which} credentials. Set E2E_${which.toUpperCase()}_USERNAME / ` +
        `E2E_${which.toUpperCase()}_PASSWORD in .env.test (see .env.test.example).`,
    );
  }
  return c;
}
