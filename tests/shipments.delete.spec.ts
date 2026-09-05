import { writeTest as test, expect, testEnv, requireWriteMode } from './support/fixtures';
import {
  apiCreateShipment,
  authenticate,
  deleteShipmentByNo,
  findShipmentByNo,
  newApiContext,
  AuthResult,
} from './support/api';
import { requireCreds } from './support/env';
import { expectToast } from './support/ui';

let adminAuth: AuthResult;
let shipmentNo: string;

test.beforeEach(() => requireWriteMode());

test.beforeAll(async () => {
  if (!testEnv.allowWriteTests) return;
  const ctx = await newApiContext();
  adminAuth = await authenticate(ctx, requireCreds('admin'));
  await ctx.dispose();
});

test.beforeEach(async () => {
  if (!testEnv.allowWriteTests) return;
  const ctx = await newApiContext();
  ({ shipmentNo } = await apiCreateShipment(ctx, adminAuth));
  await ctx.dispose();
});

test.afterEach(async () => {
  if (!testEnv.allowWriteTests) return;
  const ctx = await newApiContext();
  try {
    await deleteShipmentByNo(ctx, adminAuth, shipmentNo);
  } catch {
    /* already gone */
  }
  await ctx.dispose();
});

test.describe('Shipments (/orgin) — Delete (admin)', () => {
  test('admin deletes a shipment via the row menu + confirm dialog', async ({ adminPage }) => {
    await adminPage.goto('/orgin');
    await adminPage.getByTestId('orgin-date-from').fill('2000-01-01');
    await adminPage.getByTestId('orgin-search-input').fill(shipmentNo);

    const viewLink = adminPage.getByTestId(`orgin-row-view-${shipmentNo}`);
    await expect(viewLink).toBeVisible({ timeout: 10000 });

    await adminPage.getByTestId(`orgin-row-actions-${shipmentNo}`).click();
    await adminPage.getByTestId(`orgin-row-delete-${shipmentNo}`).click();

    const dialog = adminPage.getByTestId('orgin-delete-confirm');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(shipmentNo)).toBeVisible();
    await adminPage.getByTestId('orgin-delete-confirm-confirm').click();

    await expectToast(adminPage, 'Deleted');
    await expect(adminPage.getByTestId(`orgin-row-view-${shipmentNo}`)).toBeHidden();

    // confirm the soft-delete server-side
    const ctx = await newApiContext();
    const stillThere = await findShipmentByNo(ctx, adminAuth, shipmentNo, 'O');
    await ctx.dispose();
    expect(stillThere).toBeUndefined();
  });

  test('cancelling the confirm dialog keeps the shipment', async ({ adminPage }) => {
    await adminPage.goto('/orgin');
    await adminPage.getByTestId('orgin-date-from').fill('2000-01-01');
    await adminPage.getByTestId('orgin-search-input').fill(shipmentNo);
    await expect(adminPage.getByTestId(`orgin-row-view-${shipmentNo}`)).toBeVisible({ timeout: 10000 });

    await adminPage.getByTestId(`orgin-row-actions-${shipmentNo}`).click();
    await adminPage.getByTestId(`orgin-row-delete-${shipmentNo}`).click();
    await expect(adminPage.getByTestId('orgin-delete-confirm')).toBeVisible();
    await adminPage.getByTestId('orgin-delete-confirm-cancel').click();

    await expect(adminPage.getByTestId('orgin-delete-confirm')).toBeHidden();
    await expect(adminPage.getByTestId(`orgin-row-view-${shipmentNo}`)).toBeVisible();
  });
});
