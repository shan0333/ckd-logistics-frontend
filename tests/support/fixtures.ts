import { test as base, expect, APIRequestContext, Browser, Page } from '@playwright/test';
import { loadTestEnv, requireCreds } from './env';
import { authenticate, authHeaders, AuthResult, newApiContext } from './api';

const env = loadTestEnv();

type WorkerFixtures = {
  /** Real /authenticate result for the admin user (worker-scoped — one login per worker). */
  adminAuth: AuthResult;
  /** Real /authenticate result for the non-admin / location user. */
  userAuth: AuthResult;
};

type TestFixtures = {
  /** A browser Page already carrying the admin session (cookie + sessionStorage seeded). */
  adminPage: Page;
  /** A browser Page already carrying the non-admin user session. */
  userPage: Page;
  /** APIRequestContext authenticated as admin — for setup/cleanup around UI tests. */
  adminApi: APIRequestContext;
};

async function seededPage(browser: Browser, auth: AuthResult, baseURL: string): Promise<Page> {
  const context = await browser.newContext();
  // proxy.ts (Next 16 middleware) guards /dashboard,/orgin,/destination,/report on this cookie.
  await context.addCookies([
    {
      name: 'logistics_token',
      value: auth.token.replace(/^Bearer /, ''),
      url: baseURL,
      sameSite: 'Strict',
    },
  ]);
  const page = await context.newPage();
  // LayoutShell/Header/api.ts all read auth state from sessionStorage — seed it the exact
  // same way src/lib/auth.ts saveSession() does, before any app code runs.
  await page.addInitScript((a: AuthResult) => {
    try {
      sessionStorage.setItem('username', a.username);
      sessionStorage.setItem('token', a.token.startsWith('Bearer ') ? a.token : 'Bearer ' + a.token);
      sessionStorage.setItem('id', String(a.id));
      if (a.roles) sessionStorage.setItem('roles', JSON.stringify(a.roles));
      if (a.refreshToken) sessionStorage.setItem('refreshToken', a.refreshToken);
      if (a.locId !== null && a.locId !== undefined) sessionStorage.setItem('locId', String(a.locId));
    } catch {
      /* sessionStorage unavailable — ignore */
    }
  }, auth);
  return page;
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  adminAuth: [
    async ({}, use) => {
      const ctx = await newApiContext();
      const auth = await authenticate(ctx, requireCreds('admin'));
      await ctx.dispose();
      await use(auth);
    },
    { scope: 'worker' },
  ],

  userAuth: [
    async ({}, use) => {
      const ctx = await newApiContext();
      const auth = await authenticate(ctx, requireCreds('user'));
      await ctx.dispose();
      await use(auth);
    },
    { scope: 'worker' },
  ],

  adminApi: async ({ adminAuth }, use) => {
    const ctx = await newApiContext();
    const wrapped = new Proxy(ctx, {
      get(target, prop, receiver) {
        const orig = Reflect.get(target, prop, receiver);
        if (typeof orig !== 'function') return orig;
        if (!['get', 'post', 'put', 'patch', 'delete', 'fetch', 'head'].includes(String(prop))) {
          return (orig as (...a: unknown[]) => unknown).bind(target);
        }
        return (url: string, opts: Record<string, unknown> = {}) =>
          (orig as (u: string, o: unknown) => unknown).call(target, url, {
            ...opts,
            headers: { ...authHeaders(adminAuth), ...((opts.headers as object) ?? {}) },
          });
      },
    }) as APIRequestContext;
    await use(wrapped);
    await ctx.dispose();
  },

  adminPage: async ({ browser, adminAuth, baseURL }, use) => {
    const page = await seededPage(browser, adminAuth, baseURL!);
    await use(page);
    await page.context().close();
  },

  userPage: async ({ browser, userAuth, baseURL }, use) => {
    const page = await seededPage(browser, userAuth, baseURL!);
    await use(page);
    await page.context().close();
  },
});

/**
 * Alias used by specs that mutate backend data. Pair it with a `test.beforeEach` guard:
 *
 *   import { writeTest as test, requireWriteMode } from './support/fixtures';
 *   test.beforeEach(() => requireWriteMode());
 */
export const writeTest = test;

/** Skips the current test unless ALLOW_WRITE_TESTS=1. Call from a beforeEach in write specs. */
export function requireWriteMode() {
  test.skip(
    !env.allowWriteTests,
    'Write test skipped — set ALLOW_WRITE_TESTS=1 in .env.test to run Create/Update/Delete specs.',
  );
}

export { expect };
export const testEnv = env;
