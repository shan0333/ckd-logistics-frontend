import { test, expect } from './support/fixtures';
import { visibleShipmentNos, tableIsEmpty } from './support/ui';

test.describe('Shipments (/orgin) — Read', () => {
  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto('/orgin');
    await expect(adminPage.getByRole('heading', { name: 'Shipments' })).toBeVisible();
    await expect(adminPage.getByTestId('orgin-table')).toBeVisible();
  });

  test('list loads and shows the record count', async ({ adminPage }) => {
    await expect(adminPage.getByText(/\d+ of \d+ records/)).toBeVisible();
  });

  test('status pill filter issues a filtered getOrgin request', async ({ adminPage }) => {
    const req = adminPage.waitForRequest(
      (r) => r.url().includes('/getOrgin') && r.method() === 'POST',
    );
    await adminPage.getByTestId('orgin-status-pill-TRANSIT').click();
    const payload = (await req).postDataJSON();
    expect(payload.status).toContain('TRANSIT');
    await expect(adminPage.getByTestId('orgin-status-pill-TRANSIT')).toHaveClass(/bg-indigo-600/);
  });

  test('date-range filter re-queries the backend', async ({ adminPage }) => {
    const req = adminPage.waitForRequest(
      (r) => r.url().includes('/getOrgin') && r.method() === 'POST',
    );
    await adminPage.getByTestId('orgin-date-from').fill('2024-01-01');
    const payload = (await req).postDataJSON();
    expect(payload.fromDate).toBe('2024-01-01');
  });

  test('search box filters the visible rows client-side', async ({ adminPage }) => {
    test.skip(await tableIsEmpty(adminPage, 'orgin-table'), 'no shipments to search');
    const nos = await visibleShipmentNos(adminPage, 'orgin-table');
    const term = nos[0].slice(0, 4);
    await adminPage.getByTestId('orgin-search-input').fill(term);
    await expect
      .poll(async () => {
        const filtered = await visibleShipmentNos(adminPage, 'orgin-table');
        return filtered.every((n) => n.toLowerCase().includes(term.toLowerCase()));
      })
      .toBe(true);

    await adminPage.getByTestId('orgin-search-input').fill('___no_such_shipment___');
    await expect(adminPage.getByTestId('orgin-table').getByText('No records found')).toBeVisible();
  });

  test('rows-per-page control is present and changeable', async ({ adminPage }) => {
    const select = adminPage.getByTestId('orgin-table').getByRole('combobox');
    await select.selectOption('25');
    await expect(select).toHaveValue('25');
  });

  test('clicking a shipment number opens the read-only View modal', async ({ adminPage }) => {
    test.skip(await tableIsEmpty(adminPage, 'orgin-table'), 'no shipments to view');
    const [no] = await visibleShipmentNos(adminPage, 'orgin-table');
    await adminPage.getByTestId(`orgin-row-view-${no}`).click();
    const modal = adminPage.getByTestId('orgin-view-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Customer', { exact: true })).toBeVisible();
    await expect(modal.getByText('Route From', { exact: true })).toBeVisible();
    await modal.getByRole('button').first().click(); // close (X)
    await expect(modal).toBeHidden();
  });

  test('row action menu opens the Images modal (grid or empty state)', async ({ adminPage }) => {
    test.skip(await tableIsEmpty(adminPage, 'orgin-table'), 'no shipments');
    const [no] = await visibleShipmentNos(adminPage, 'orgin-table');
    await adminPage.getByTestId(`orgin-row-actions-${no}`).click();
    await adminPage.getByTestId(`orgin-row-action-images-${no}`).click();
    const modal = adminPage.getByTestId('orgin-images-modal');
    await expect(modal).toBeVisible();
    const hasGrid = await modal.getByTestId('orgin-images-modal-grid').count();
    const hasEmpty = await modal.getByTestId('orgin-images-modal-empty-state').count();
    expect(hasGrid + hasEmpty).toBeGreaterThan(0);
  });

  test('"New Shipment" opens the create modal with all form controls', async ({ adminPage }) => {
    await adminPage.getByTestId('orgin-new-shipment-button').click();
    const modal = adminPage.getByTestId('orgin-new-shipment-modal');
    await expect(modal).toBeVisible();
    for (const id of [
      'orgin-modal-customer-select',
      'orgin-modal-vehicletype-select',
      'orgin-modal-route-from-select',
      'orgin-modal-route-to-select',
      'orgin-modal-shipment-no-input',
      'orgin-modal-vehicle-no-input',
      'orgin-modal-lr-date-input',
      'orgin-modal-transporter-input',
      'orgin-modal-save-button',
    ]) {
      await expect(modal.getByTestId(id)).toBeVisible();
    }
  });
});
