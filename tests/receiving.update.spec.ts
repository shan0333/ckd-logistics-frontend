import { writeTest as test, expect, testEnv, requireWriteMode } from './support/fixtures';
import {
  apiCreateShipment,
  authenticate,
  deleteShipmentByNo,
  listShipments,
  newApiContext,
  AuthResult,
} from './support/api';
import { requireCreds } from './support/env';
import { expectToast } from './support/ui';

let adminAuth: AuthResult;
let shipmentNo: string;

const wide = { fromDate: '2000-01-01', toDate: '2999-12-31' };

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
    /* ignore */
  }
  await ctx.dispose();
});

async function appearsOnDestination(auth: AuthResult, no: string): Promise<boolean> {
  const ctx = await newApiContext();
  const rows = await listShipments(ctx, auth, {
    loc_id: auth.locId != null ? String(auth.locId) : '',
    flag: 'D',
    status: [],
    ...wide,
  });
  await ctx.dispose();
  return rows.some((r) => r.shipment_no === no);
}

test.describe('Receiving (/destination) — Update (receive / submit)', () => {
  test('Receive → Save records receiving details without locking the row', async ({ adminPage }) => {
    test.skip(!(await appearsOnDestination(adminAuth, shipmentNo)), 'new shipment not on this user\'s inbound list');

    await adminPage.goto('/destination');
    await adminPage.getByTestId('destination-date-from').fill('2000-01-01');
    await adminPage.getByTestId('destination-search-input').fill(shipmentNo);
    await expect(adminPage.getByTestId(`destination-row-view-${shipmentNo}`)).toBeVisible({ timeout: 10000 });

    await adminPage.getByTestId(`destination-row-actions-${shipmentNo}`).click();
    await adminPage.getByTestId(`destination-receive-button-${shipmentNo}`).click();

    const modal = adminPage.getByTestId('destination-receive-modal');
    await expect(modal).toBeVisible();
    await modal.getByTestId('destination-modal-vehicle-reported-on-input').fill(new Date().toISOString().slice(0, 10));
    await modal.getByTestId('destination-modal-delay-select').selectOption('Y');
    await modal.getByTestId('destination-save-button').click();

    await expectToast(adminPage, /^Saved$/);

    const ctx = await newApiContext();
    const rows = await listShipments(ctx, adminAuth, {
      loc_id: adminAuth.locId != null ? String(adminAuth.locId) : '',
      flag: 'D',
      status: [],
      ...wide,
    });
    await ctx.dispose();
    const row = rows.find((r) => r.shipment_no === shipmentNo);
    expect(row?.org_status).not.toBe('S'); // saved as work-in-progress, not submitted
  });

  test('Receive → Submit locks the row (RECEIVED)', async ({ adminPage }) => {
    test.skip(!(await appearsOnDestination(adminAuth, shipmentNo)), 'new shipment not on this user\'s inbound list');

    await adminPage.goto('/destination');
    await adminPage.getByTestId('destination-date-from').fill('2000-01-01');
    await adminPage.getByTestId('destination-search-input').fill(shipmentNo);
    await expect(adminPage.getByTestId(`destination-row-view-${shipmentNo}`)).toBeVisible({ timeout: 10000 });

    await adminPage.getByTestId(`destination-row-actions-${shipmentNo}`).click();
    await adminPage.getByTestId(`destination-receive-button-${shipmentNo}`).click();

    const modal = adminPage.getByTestId('destination-receive-modal');
    await modal.getByTestId('destination-modal-vehicle-reported-on-input').fill(new Date().toISOString().slice(0, 10));
    await modal.getByTestId('destination-submit-button').click();

    const confirm = adminPage.getByTestId('destination-submit-confirm');
    await expect(confirm).toBeVisible();
    await adminPage.getByTestId('destination-submit-confirm-confirm').click();

    await expectToast(adminPage, /marked received/i);

    const ctx = await newApiContext();
    const rows = await listShipments(ctx, adminAuth, {
      loc_id: adminAuth.locId != null ? String(adminAuth.locId) : '',
      flag: 'D',
      status: [],
      ...wide,
    });
    await ctx.dispose();
    const row = rows.find((r) => r.shipment_no === shipmentNo);
    expect(row?.org_status).toBe('S');

    // reopen: locked-state UI. Admin with no fixed location gets an "Enable Edit" affordance;
    // a location-scoped admin sees the action hidden entirely.
    await adminPage.reload();
    await adminPage.getByTestId('destination-date-from').fill('2000-01-01');
    await adminPage.getByTestId('destination-search-input').fill(shipmentNo);
    await adminPage.getByTestId(`destination-row-actions-${shipmentNo}`).click();
    if (adminAuth.locId == null) {
      await adminPage.getByTestId(`destination-enable-edit-button-${shipmentNo}`).click();
      await expect(adminPage.getByTestId('destination-receive-modal')).toBeVisible();
      await expect(adminPage.getByTestId('destination-modal-vehicle-reported-on-input')).toBeDisabled();
      await adminPage.getByTestId('destination-enable-edit-button').click();
      await expect(adminPage.getByTestId('destination-modal-vehicle-reported-on-input')).toBeEnabled();
    } else {
      await expect(adminPage.getByTestId(`destination-receive-button-${shipmentNo}`)).toHaveCount(0);
    }
  });
});
