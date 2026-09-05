import { test, expect } from './support/fixtures';
import { visibleShipmentNos, tableIsEmpty } from './support/ui';

test.describe('Role gating', () => {
  test('non-admin user does NOT see the Delete action on shipments', async ({ userPage }) => {
    await userPage.goto('/orgin');
    await expect(userPage.getByTestId('orgin-table')).toBeVisible();
    test.skip(await tableIsEmpty(userPage, 'orgin-table'), 'no shipments visible to this user');

    const [no] = await visibleShipmentNos(userPage, 'orgin-table');
    await userPage.getByTestId(`orgin-row-actions-${no}`).click();

    await expect(userPage.getByTestId(`orgin-row-action-view-${no}`)).toBeVisible();
    await expect(userPage.getByTestId(`orgin-row-action-images-${no}`)).toBeVisible();
    await expect(userPage.getByTestId(`orgin-row-delete-${no}`)).toHaveCount(0);
  });

  test('admin DOES see the Delete action on shipments', async ({ adminPage }) => {
    await adminPage.goto('/orgin');
    await expect(adminPage.getByTestId('orgin-table')).toBeVisible();
    test.skip(await tableIsEmpty(adminPage, 'orgin-table'), 'no shipments visible');

    const [no] = await visibleShipmentNos(adminPage, 'orgin-table');
    await adminPage.getByTestId(`orgin-row-actions-${no}`).click();
    await expect(adminPage.getByTestId(`orgin-row-delete-${no}`)).toBeVisible();
  });

  test('every nav destination is reachable while authenticated', async ({ adminPage }) => {
    await adminPage.goto('/dashboard');
    for (const [testId, urlRe, heading] of [
      ['nav-orgin', /\/orgin$/, 'Shipments'],
      ['nav-destination', /\/destination$/, 'Receiving'],
      ['nav-report', /\/report$/, 'Shipment Report'],
      ['nav-dashboard', /\/dashboard$/, 'Shipment Dashboard'],
    ] as const) {
      await adminPage.getByTestId(testId).click();
      await expect(adminPage).toHaveURL(urlRe);
      await expect(adminPage.getByRole('heading', { name: heading })).toBeVisible();
    }
  });
});
