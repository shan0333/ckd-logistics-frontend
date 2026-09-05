import { test, expect } from '@playwright/test';
import { loadTestEnv, requireCreds } from './support/env';
import { expectToast } from './support/ui';

const env = loadTestEnv();

test.describe('Auth — login / route guard / logout', () => {
  test('unauthenticated visit to a protected route redirects to /login', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId('login-submit-button')).toBeVisible();
  });

  test('submitting empty credentials shows a validation message and stays on /login', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-submit-button').click();
    await expectToast(page, /enter email and password/i);
    await expect(page).toHaveURL(/\/login$/);
  });

  test('invalid credentials show the error alert', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-email-input').fill('nobody@example.invalid');
    await page.getByTestId('login-password-input').fill('wrong-password-123');
    await page.getByTestId('login-submit-button').click();
    await expect(page.getByTestId('login-error-alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('valid admin credentials land on the dashboard with a session', async ({ page }) => {
    const { username, password } = requireCreds('admin');
    await page.goto('/login');
    await page.getByTestId('login-email-input').fill(username);
    await page.getByTestId('login-password-input').fill(password);
    await page.getByTestId('login-submit-button').click();

    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Shipment Dashboard' })).toBeVisible();

    const token = await page.evaluate(() => sessionStorage.getItem('token'));
    expect(token).toContain('Bearer ');
  });

  test('logout clears the session and re-protects routes', async ({ page }) => {
    const { username, password } = requireCreds('admin');
    await page.goto('/login');
    await page.getByTestId('login-email-input').fill(username);
    await page.getByTestId('login-password-input').fill(password);
    await page.getByTestId('login-submit-button').click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15000 });

    await page.getByTestId('nav-logout').click();
    await expect(page).toHaveURL(/\/login$/);

    const token = await page.evaluate(() => sessionStorage.getItem('token'));
    expect(token).toBeNull();

    await page.goto('/report');
    await expect(page).toHaveURL(/\/login$/);
  });
});
