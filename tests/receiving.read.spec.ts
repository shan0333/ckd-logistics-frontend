import { test, expect } from './support/fixtures';
import { visibleShipmentNos, tableIsEmpty } from './support/ui';

test.describe('Receiving (/destination) — Read', () => {
  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto('/destination');
    await expect(adminPage.getByRole('heading', { name: 'Receiving' })).toBeVisible();
    await expect(adminPage.getByTestId('destination-table')).toBeVisible();
  });

  test('inbound list loads with its count line', async ({ adminPage }) => {
    await expect(adminPage.getByText(/\d+ of \d+ inbound shipments/)).toBeVisible();
  });

  test('status pill sends a flag=D filtered request', async ({ adminPage }) => {
    const req = adminPage.waitForRequest(
      (r) => r.url().includes('/getOrgin') && r.method() === 'POST',
    );
    await adminPage.getByTestId('destination-status-pill-RECEIVED').click();
    const payload = (await req).postDataJSON();
    expect(payload.flag).toBe('D');
    expect(payload.status).toContain('RECEIVED');
  });

  test('search narrows the visible rows', async ({ adminPage }) => {
    test.skip(await tableIsEmpty(adminPage, 'destination-table'), 'no inbound shipments');
    const [no] = await visibleShipmentNos(adminPage, 'destination-table');
    await adminPage.getByTestId('destination-search-input').fill(no);
    await expect(adminPage.getByTestId(`destination-row-view-${no}`)).toBeVisible();
    await adminPage.getByTestId('destination-search-input').fill('___none___');
    await expect(
      adminPage.getByTestId('destination-table').getByText('No records found'),
    ).toBeVisible();
  });

  test('View modal shows receiving fields', async ({ adminPage }) => {
    test.skip(await tableIsEmpty(adminPage, 'destination-table'), 'no inbound shipments');
    const [no] = await visibleShipmentNos(adminPage, 'destination-table');
    await adminPage.getByTestId(`destination-row-view-${no}`).click();
    const modal = adminPage.getByTestId('destination-view-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Vehicle Reported On', { exact: true })).toBeVisible();
    await expect(modal.getByText('Delay Applicable', { exact: true })).toBeVisible();
  });

  test('Images modal opens from the row menu', async ({ adminPage }) => {
    test.skip(await tableIsEmpty(adminPage, 'destination-table'), 'no inbound shipments');
    const [no] = await visibleShipmentNos(adminPage, 'destination-table');
    await adminPage.getByTestId(`destination-row-actions-${no}`).click();
    await adminPage.getByTestId(`destination-row-action-images-${no}`).click();
    await expect(adminPage.getByTestId('destination-images-modal')).toBeVisible();
  });
});
