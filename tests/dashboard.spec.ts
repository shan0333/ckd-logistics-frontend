import { test, expect } from './support/fixtures';

test.describe('Dashboard (/dashboard) — Read', () => {
  test('loads stat tiles and all chart cards from one shipmentGraphInfo call', async ({ adminPage, adminAuth }) => {
    const req = adminPage.waitForRequest(
      (r) => r.url().includes('/shipmentGraphInfo') && r.method() === 'POST',
    );
    await adminPage.goto('/dashboard');

    const payload = (await req).postDataJSON();
    // no-fixed-location users must send the '-1' sentinel, not '' (see dashboard/page.tsx)
    expect(payload.loc_id).toBe(adminAuth.locId != null ? String(adminAuth.locId) : '-1');

    await expect(adminPage.getByRole('heading', { name: 'Shipment Dashboard' })).toBeVisible();

    for (const label of [
      'Total Shipments',
      'Shipments To Destinations',
      'Unloaded',
      'In Transit',
      'ODC Shipments',
    ]) {
      await expect(adminPage.getByText(label, { exact: true })).toBeVisible();
    }

    for (const title of [
      'Shipments by Route From',
      'Shipments by Destination',
      'Unloaded — Last 7 Days',
      'In Transit by Destination',
      'ODC Shipments by Destination',
      'ODC Shipments by Transporter',
    ]) {
      await expect(adminPage.getByText(title, { exact: true })).toBeVisible();
    }

    // recharts mounts an SVG per ResponsiveContainer once data resolves
    await expect(adminPage.locator('.recharts-responsive-container')).toHaveCount(6);
  });
});
