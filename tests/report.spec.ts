import { test, expect } from './support/fixtures';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test.describe('Report (/report) — Read / export', () => {
  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto('/report');
    await expect(adminPage.getByRole('heading', { name: 'Shipment Report' })).toBeVisible();
  });

  test('status and transporter filters toggle', async ({ adminPage }) => {
    const transit = adminPage.getByTestId('report-status-checkbox-TRANSIT');
    await transit.check();
    await expect(transit).toBeChecked();
    await transit.uncheck();
    await expect(transit).not.toBeChecked();

    const firstTransporter = adminPage.locator('input[data-testid^="report-transporter-checkbox-"]').first();
    if (await firstTransporter.count()) {
      await firstTransporter.check();
      await expect(firstTransporter).toBeChecked();
    }
  });

  test('download builds the filter header and returns an .xlsx file', async ({ adminPage }) => {
    await adminPage.getByTestId('report-status-checkbox-RECEIVED').check();
    await adminPage.getByTestId('report-lrdate-from').fill('2024-01-01');
    await adminPage.getByTestId('report-lrdate-to').fill('2030-12-31');

    const reqPromise = adminPage.waitForRequest((r) => r.url().includes('/logDownload'));
    const downloadPromise = adminPage.waitForEvent('download');

    await adminPage.getByTestId('report-download-button').click();

    const req = await reqPromise;
    const filterHeader = req.headers()['filter'];
    expect(filterHeader).toBeTruthy();
    const parsed = JSON.parse(filterHeader);
    expect(parsed.status).toContain('RECEIVED');
    expect(parsed.fromDate).toBe('2024-01-01');

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^Shipment_Report_.*\.xlsx$/);

    const dest = path.join(os.tmpdir(), `e2e-${download.suggestedFilename()}`);
    await download.saveAs(dest);
    expect(fs.statSync(dest).size).toBeGreaterThan(0);
    fs.unlinkSync(dest);
  });
});
