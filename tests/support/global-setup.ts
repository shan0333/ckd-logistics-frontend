import { request } from '@playwright/test';
import { loadTestEnv } from './env';
import { authenticate } from './api';

/**
 * Fails fast (before any spec runs) if the backend is unreachable or the configured
 * credentials are wrong, so you get one clear error instead of every spec timing out.
 */
export default async function globalSetup() {
  const env = loadTestEnv();
  const ctx = await request.newContext({ baseURL: env.apiUrl, ignoreHTTPSErrors: true });

  try {
    // 1. backend reachable?
    try {
      await ctx.get('/getLocation', { timeout: 8000 });
    } catch (e) {
      throw new Error(
        `Backend not reachable at ${env.apiUrl}. Start Logistics-backend ` +
          `(cd C:\\Users\\admin\\Logistics-backend\\spaceage-app && mvn spring-boot:run). ` +
          `Original error: ${(e as Error).message}`,
      );
    }

    // 2. admin creds valid + actually admin?
    if (env.admin.username && env.admin.password) {
      const admin = await authenticate(ctx, env.admin);
      const roles = (admin.roles ?? []).map((r) => r.toUpperCase());
      const isAdmin = roles.some((r) => r === 'ADMIN' || r === 'SUPER ADMIN');
      if (!isAdmin) {
        console.warn(
          `\n[global-setup] WARNING: E2E_ADMIN_USERNAME "${env.admin.username}" has roles ` +
            `[${roles.join(', ')}] — not ADMIN/SUPER ADMIN. Delete / Enable-Edit tests will fail.\n`,
        );
      }
    } else {
      console.warn('\n[global-setup] WARNING: admin credentials not set in .env.test.\n');
    }

    // 3. user creds valid?
    if (env.user.username && env.user.password) {
      await authenticate(ctx, env.user);
    } else {
      console.warn('\n[global-setup] WARNING: non-admin user credentials not set in .env.test.\n');
    }

    if (!env.allowWriteTests) {
      console.log('\n[global-setup] Read-only run (ALLOW_WRITE_TESTS not set). Create/Update/Delete specs will be skipped.\n');
    } else {
      console.log(`\n[global-setup] WRITE MODE ON. Test shipments will be prefixed "${env.testPrefix}" and soft-deleted after each test.\n`);
    }
  } finally {
    await ctx.dispose();
  }
}
